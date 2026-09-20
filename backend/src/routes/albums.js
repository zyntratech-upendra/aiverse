const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Album = require('../models/Album');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');
const { uploadToCloudinaryIfBase64 } = require('../utils/cloudinaryHelper');

async function sanitizeAlbumImages(item) {
  if (item.coverImage) item.coverImage = await uploadToCloudinaryIfBase64(item.coverImage, 'ai_verse/albums');
  if (item.imageUrl) item.imageUrl = await uploadToCloudinaryIfBase64(item.imageUrl, 'ai_verse/albums');
  if (item.bannerImage) item.bannerImage = await uploadToCloudinaryIfBase64(item.bannerImage, 'ai_verse/albums');
  if (Array.isArray(item.images)) {
    item.images = await Promise.all(item.images.map(async (img) => {
      if (typeof img === 'string') {
        const u = await uploadToCloudinaryIfBase64(img, 'ai_verse/albums');
        return { url: u };
      }
      if (img && img.url) {
        img.url = await uploadToCloudinaryIfBase64(img.url, 'ai_verse/albums');
      }
      return img;
    }));
  }
  return item;
}

// In-memory caching & stampede prevention for high-speed album delivery
const cachedAlbumsMap = new Map();
const lastCacheTimeMap = new Map();
const ALBUMS_CACHE_TTL = 30000; // 30 seconds
const inFlightFetchMap = new Map();

function invalidateAlbumsCache() {
  cachedAlbumsMap.clear();
  lastCacheTimeMap.clear();
  inFlightFetchMap.clear();
}

// GET /api/albums - List albums
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { eventId, category, status } = req.query;
    const cacheKey = `albums_${eventId || ''}_${category || ''}_${status || ''}`;
    const now = Date.now();

    const cached = cachedAlbumsMap.get(cacheKey);
    const lastTime = lastCacheTimeMap.get(cacheKey) || 0;

    if (cached && now - lastTime < ALBUMS_CACHE_TTL) {
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return res.json(cached);
    }

    if (inFlightFetchMap.has(cacheKey)) {
      const result = await inFlightFetchMap.get(cacheKey);
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return res.json(result);
    }

    const fetchPromise = (async () => {
      const filter = {};
      if (eventId) filter.eventId = eventId;
      if (category && category !== 'All') filter.category = category;
      if (status && status !== 'All') filter.status = status;

      let albums = [];
      try {
        // Fast query with maxTimeMS constraint to prevent connection hangs
        albums = await Album.find(filter)
          .maxTimeMS(6000)
          .sort({ order: 1, createdAt: -1 })
          .lean();
      } catch (findErr) {
        console.warn('[albums] DB sort query failed, falling back to basic find:', findErr.message);
        try {
          albums = await Album.find(filter).maxTimeMS(4000).lean();
          albums.sort((a, b) => (a.order || 0) - (b.order || 0) || (b.createdAt || 0) - (a.createdAt || 0));
        } catch (fallbackErr) {
          console.error('[albums] DB find failed completely:', fallbackErr.message);
          return cachedAlbumsMap.get(cacheKey) || [];
        }
      }

      const formatted = albums.map((a) => ({ ...a, id: a._id }));
      cachedAlbumsMap.set(cacheKey, formatted);
      lastCacheTimeMap.set(cacheKey, Date.now());
      return formatted;
    })();

    inFlightFetchMap.set(cacheKey, fetchPromise);

    try {
      const data = await fetchPromise;
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      res.json(data);
    } finally {
      inFlightFetchMap.delete(cacheKey);
    }
  })
);

// GET /api/albums/:id - Get single album
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    let album = await Album.findById(id).maxTimeMS(4000).lean().catch(() => null);
    if (!album) {
      album = await Album.findOne({ $or: [{ _id: id }, { id: id }] }).maxTimeMS(4000).lean().catch(() => null);
    }
    if (!album) {
      return res.status(404).json({ success: false, error: 'Album not found' });
    }
    res.json({ ...album, id: album._id });
  })
);

// Allowed fields for create and update operations
const ALBUM_ALLOWED_FIELDS = [
  'title',
  'description',
  'caption',
  'coverImage',
  'imageUrl',
  'bannerImage',
  'category',
  'status',
  'date',
  'eventId',
  'eventTitle',
  'tags',
  'images',
  'photosCount',
  'order',
  'isFeatured',
  'isPublic',
  'driveLink',
];

// POST /api/albums/bulk - Create multiple single images in batch
router.post(
  '/bulk',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const items = req.body?.items || req.body || [];
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No items provided for bulk upload' });
    }

    const now = Date.now();
    const docsToInsert = await Promise.all(
      items.map(async (rawItem, idx) => {
        let item = pick(rawItem, ALBUM_ALLOWED_FIELDS);
        item = await sanitizeAlbumImages(item);
        const id = rawItem._id || rawItem.id || new mongoose.Types.ObjectId().toString();
        return {
          ...item,
          _id: id,
          category: item.category || 'Workshops',
          status: item.status || 'Published',
          photosCount: item.photosCount || 1,
          order: item.order !== undefined ? item.order : idx,
          createdAt: item.createdAt || now,
          updatedAt: now,
        };
      })
    );

    const saved = await Album.insertMany(docsToInsert);
    invalidateAlbumsCache();
    res.status(201).json({
      success: true,
      count: saved.length,
      items: saved.map((s) => ({ ...s.toObject(), id: s._id })),
    });
  })
);

// POST /api/albums - Create album or single photo
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    let payload = pick(rawPayload, ALBUM_ALLOWED_FIELDS);
    payload = await sanitizeAlbumImages(payload);
    const id = rawPayload._id || rawPayload.id || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const newAlbum = new Album({
      ...payload,
      _id: id,
      category: payload.category || 'Workshops',
      status: payload.status || 'Published',
      photosCount: payload.photosCount || 1,
      images: Array.isArray(payload.images) ? payload.images : [],
      createdAt: payload.createdAt || now,
      updatedAt: now,
    });

    const saved = await newAlbum.save();
    invalidateAlbumsCache();
    res.status(201).json({ success: true, id: saved._id, album: { ...saved.toObject(), id: saved._id } });
  })
);

// PUT /api/albums/:id - Update album
router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const rawPayload = req.body || {};
    let payload = pick(rawPayload, ALBUM_ALLOWED_FIELDS);
    payload = await sanitizeAlbumImages(payload);
    payload.updatedAt = Date.now();

    let updated = await Album.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).lean();
    if (!updated) {
      updated = await Album.findOneAndUpdate(
        { $or: [{ _id: id }, { id: id }] },
        { $set: payload },
        { new: true, runValidators: true }
      ).lean();
    }

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Album not found' });
    }

    invalidateAlbumsCache();
    res.json({ success: true, album: { ...updated, id: updated._id } });
  })
);

// DELETE /api/albums/:id - Delete album
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    let deleted = await Album.findByIdAndDelete(id);
    if (!deleted) {
      deleted = await Album.findOneAndDelete({ $or: [{ _id: id }, { id: id }] });
    }
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Album not found' });
    }

    invalidateAlbumsCache();
    res.json({ success: true, message: `Album ${id} deleted successfully` });
  })
);

module.exports = router;
