const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const connectDB = require('../config/db');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');
const { uploadToCloudinaryIfBase64 } = require('../utils/cloudinaryHelper');

async function sanitizeEventImages(eventData) {
  if (eventData.posterUrl) eventData.posterUrl = await uploadToCloudinaryIfBase64(eventData.posterUrl, 'ai_verse/events');
  if (eventData.image) eventData.image = await uploadToCloudinaryIfBase64(eventData.image, 'ai_verse/events');
  if (eventData.posterPreview) eventData.posterPreview = await uploadToCloudinaryIfBase64(eventData.posterPreview, 'ai_verse/events');
  if (eventData.bannerImage) eventData.bannerImage = await uploadToCloudinaryIfBase64(eventData.bannerImage, 'ai_verse/events');
  if (eventData.coverImage) eventData.coverImage = await uploadToCloudinaryIfBase64(eventData.coverImage, 'ai_verse/events');
  if (eventData.speakerImagePreview) eventData.speakerImagePreview = await uploadToCloudinaryIfBase64(eventData.speakerImagePreview, 'ai_verse/events');
  if (eventData.paymentQrImagePreview) eventData.paymentQrImagePreview = await uploadToCloudinaryIfBase64(eventData.paymentQrImagePreview, 'ai_verse/events');
  if (eventData.juryImagePreview) eventData.juryImagePreview = await uploadToCloudinaryIfBase64(eventData.juryImagePreview, 'ai_verse/events');
  if (Array.isArray(eventData.posterImages)) {
    eventData.posterImages = await Promise.all(eventData.posterImages.map(async (pi) => {
      if (!pi) return pi;
      let preview = pi.preview;
      let url = pi.url;
      if (preview) preview = await uploadToCloudinaryIfBase64(preview, 'ai_verse/events');
      if (url) url = await uploadToCloudinaryIfBase64(url, 'ai_verse/events');
      return { filename: pi.filename || 'poster.png', preview: preview || url, url: url || preview };
    }));
  }
  return eventData;
}

// In-memory caching & stampede prevention for high-speed event delivery
const cachedEventsMap = new Map();
const lastEventsCacheTimeMap = new Map();
const cachedSingleEventMap = new Map();
const lastSingleEventCacheTimeMap = new Map();
const EVENTS_CACHE_TTL = 15000; // 15 seconds
const inFlightEventsMap = new Map();
const inFlightSingleEventMap = new Map();

function invalidateEventsCache() {
  cachedEventsMap.clear();
  lastEventsCacheTimeMap.clear();
  inFlightEventsMap.clear();
  cachedSingleEventMap.clear();
  lastSingleEventCacheTimeMap.clear();
  inFlightSingleEventMap.clear();
  cachedCounts = null;
}

// Helper to compute registration counts for events (counting active teams/registrations)
let cachedCounts = null;
let lastCountsFetch = 0;
let inFlightCountsPromise = null;
const COUNTS_CACHE_TTL = 15000; // 15s in-memory cache

async function getRegistrationCountsMap() {
  const now = Date.now();
  if (cachedCounts && (now - lastCountsFetch < COUNTS_CACHE_TTL)) {
    return cachedCounts;
  }
  if (inFlightCountsPromise) {
    return inFlightCountsPromise;
  }
  inFlightCountsPromise = (async () => {
    try {
      const regCounts = await Registration.aggregate([
        {
          $group: {
            _id: {
              eventId: '$eventId',
              eventTitle: { $toLower: { $trim: { input: { $ifNull: ['$eventTitle', ''] } } } }
            },
            totalTeams: { $sum: 1 }
          }
        }
      ]);
      const idMap = {};
      const titleMap = {};
      regCounts.forEach((r) => {
        const eid = r._id?.eventId ? String(r._id.eventId).trim() : '';
        const etitle = r._id?.eventTitle ? String(r._id.eventTitle).trim().toLowerCase() : '';
        if (eid) {
          idMap[eid] = (idMap[eid] || 0) + r.totalTeams;
        }
        if (etitle) {
          titleMap[etitle] = (titleMap[etitle] || 0) + r.totalTeams;
        }
      });
      cachedCounts = { idMap, titleMap };
      lastCountsFetch = Date.now();
      return cachedCounts;
    } catch (err) {
      console.warn('[events route] Error calculating registration counts:', err.message);
      return cachedCounts || { idMap: {}, titleMap: {} };
    } finally {
      inFlightCountsPromise = null;
    }
  })();
  return inFlightCountsPromise;
}

// GET /api/events - List events
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    try {
      await connectDB();
    } catch (e) {}

    const { category, track, isLive } = req.query;
    const cacheKey = `events_${category || ''}_${track || ''}_${isLive || ''}`;
    const now = Date.now();

    const cached = cachedEventsMap.get(cacheKey);
    const lastTime = lastEventsCacheTimeMap.get(cacheKey) || 0;

    if (cached && cached.length > 0 && (now - lastTime < EVENTS_CACHE_TTL)) {
      res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return res.json(cached);
    }

    if (inFlightEventsMap.has(cacheKey)) {
      const result = await inFlightEventsMap.get(cacheKey);
      res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return res.json(result);
    }

    const fetchPromise = (async () => {
      const filter = {};
      if (category) filter.category = category;
      if (track) filter.track = track;
      if (isLive !== undefined) filter.isLive = isLive === 'true';

      const [events, { idMap, titleMap }] = await Promise.all([
        Event.find(filter).sort({ createdAt: -1 }).lean(),
        getRegistrationCountsMap()
      ]);

      const formatted = events.map((e) => {
        const id = String(e._id || e.id || '').trim();
        const title = String(e.title || '').trim().toLowerCase();
        const computedSeats = (id && idMap[id]) || (title && titleMap[title]) || 0;
        return {
          ...e,
          id: e._id,
          currentReg: computedSeats
        };
      });

      cachedEventsMap.set(cacheKey, formatted);
      lastEventsCacheTimeMap.set(cacheKey, Date.now());
      // Seed single events cache
      formatted.forEach((ev) => {
        if (ev._id) cachedSingleEventMap.set(String(ev._id), ev);
        if (ev.id) cachedSingleEventMap.set(String(ev.id), ev);
        if (ev._id) lastSingleEventCacheTimeMap.set(String(ev._id), Date.now());
      });
      return formatted;
    })();

    inFlightEventsMap.set(cacheKey, fetchPromise);

    try {
      const data = await fetchPromise;
      res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      res.json(data);
    } finally {
      inFlightEventsMap.delete(cacheKey);
    }
  })
);

// GET /api/events/:id - Get single event
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    try {
      await connectDB();
    } catch (e) {}

    const id = req.params.id;
    const now = Date.now();

    // 1. Direct in-memory hit
    const cached = cachedSingleEventMap.get(id);
    const lastTime = lastSingleEventCacheTimeMap.get(id) || 0;
    if (cached && (now - lastTime < EVENTS_CACHE_TTL)) {
      res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return res.json(cached);
    }

    // 2. Check in-flight request
    if (inFlightSingleEventMap.has(id)) {
      const result = await inFlightSingleEventMap.get(id);
      if (!result) return res.status(404).json({ success: false, error: 'Event not found' });
      res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return res.json(result);
    }

    // 3. Check if any cached list in memory contains this event
    for (const list of cachedEventsMap.values()) {
      if (Array.isArray(list)) {
        const found = list.find((e) => String(e._id || e.id) === String(id) || String(e.id) === String(id));
        if (found) {
          cachedSingleEventMap.set(id, found);
          lastSingleEventCacheTimeMap.set(id, Date.now());
          res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
          return res.json(found);
        }
      }
    }

    // 4. Fetch from MongoDB with stampede protection
    const fetchPromise = (async () => {
      let event = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        event = await Event.findById(id).lean();
      }
      if (!event) {
        event = await Event.findOne({ $or: [{ id: id }, { _id: id }] }).lean();
      }
      if (!event) {
        return null;
      }

      const evId = String(event._id || event.id || id).trim();
      const evTitle = String(event.title || '').trim().toLowerCase();

      const { idMap, titleMap } = await getRegistrationCountsMap();
      const computedSeats = (evId && idMap[evId]) || (evTitle && titleMap[evTitle]) || event.currentReg || 0;

      const formatted = {
        ...event,
        id: event._id,
        currentReg: computedSeats
      };

      cachedSingleEventMap.set(id, formatted);
      if (event._id) cachedSingleEventMap.set(String(event._id), formatted);
      if (event.id) cachedSingleEventMap.set(String(event.id), formatted);
      lastSingleEventCacheTimeMap.set(id, Date.now());
      return formatted;
    })();

    inFlightSingleEventMap.set(id, fetchPromise);

    try {
      const result = await fetchPromise;
      if (!result) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      res.json(result);
    } finally {
      inFlightSingleEventMap.delete(id);
    }
  })
);

// POST /api/events - Create event
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    let { _id, id: bodyId, ...eventData } = rawPayload;
    eventData = await sanitizeEventImages(eventData);
    const id = _id || bodyId || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const newEvent = new Event({
      ...eventData,
      _id: id,
      createdAt: eventData.createdAt || now,
      updatedAt: now,
    });

    const saved = await newEvent.save();
    invalidateEventsCache();
    res.status(201).json({ success: true, id: saved._id, event: { ...saved.toObject(), id: saved._id } });
  })
);

// PUT /api/events/:id - Update event
router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const rawPayload = req.body || {};
    let { _id, id: bodyId, ...updateData } = rawPayload;
    updateData = await sanitizeEventImages(updateData);
    updateData.updatedAt = Date.now();

    const updated = await Event.findOneAndUpdate(
      { $or: [{ _id: id }, { id: id }] },
      { $set: updateData },
      { new: true, runValidators: false }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    invalidateEventsCache();
    res.json({ success: true, event: { ...updated, id: updated._id } });
  })
);

// DELETE /api/events/:id - Delete event
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await Event.findOneAndDelete({ $or: [{ _id: id }, { id: id }] });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    invalidateEventsCache();
    res.json({ success: true, message: `Event ${id} deleted successfully` });
  })
);

module.exports = router;
