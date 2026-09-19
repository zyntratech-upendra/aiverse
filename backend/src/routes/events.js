const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');

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
    const { category, track, isLive } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (track) filter.track = track;
    if (isLive !== undefined) filter.isLive = isLive === 'true';

    const [events, { idMap, titleMap }] = await Promise.all([
      Event.find(filter).sort({ createdAt: -1 }).lean(),
      getRegistrationCountsMap()
    ]);

    res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
    res.json(
      events.map((e) => {
        const id = String(e._id || e.id || '').trim();
        const title = String(e.title || '').trim().toLowerCase();
        const computedSeats = (id && idMap[id]) || (title && titleMap[title]) || 0;
        return {
          ...e,
          id: e._id,
          currentReg: computedSeats
        };
      })
    );
  })
);

// GET /api/events/:id - Get single event
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    let event = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      event = await Event.findById(id).lean();
    }
    if (!event) {
      event = await Event.findOne({ $or: [{ id: id }, { _id: id }] }).lean();
    }
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const evId = String(event._id || event.id || id).trim();
    const evTitle = String(event.title || '').trim();

    // Fast indexed count for single event
    const computedSeats = await Registration.countDocuments({
      $or: [{ eventId: evId }, { eventTitle: evTitle }]
    }).catch(() => event.currentReg || 0);

    res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
    res.json({
      ...event,
      id: event._id,
      currentReg: computedSeats
    });
  })
);

// POST /api/events - Create event
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    const { _id, id: bodyId, ...eventData } = rawPayload;
    const id = _id || bodyId || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const newEvent = new Event({
      ...eventData,
      _id: id,
      createdAt: eventData.createdAt || now,
      updatedAt: now,
    });

    const saved = await newEvent.save();
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
    const { _id, id: bodyId, ...updateData } = rawPayload;
    updateData.updatedAt = Date.now();

    const updated = await Event.findOneAndUpdate(
      { $or: [{ _id: id }, { id: id }] },
      { $set: updateData },
      { new: true, runValidators: false }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

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

    res.json({ success: true, message: `Event ${id} deleted successfully` });
  })
);

module.exports = router;
