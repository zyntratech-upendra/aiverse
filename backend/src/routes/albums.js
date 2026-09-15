const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Album = require('../models/Album');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');

// GET /api/albums - List albums
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { eventId } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;

    const albums = await Album.find(filter).sort({ order: 1, createdAt: -1 }).lean();
    res.json(albums.map((a) => ({ ...a, id: a._id })));
  })
);

// GET /api/albums/:id - Get single album
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const album = await Album.findById(req.params.id).lean();
    if (!album) {
      return res.status(404).json({ success: false, error: 'Album not found' });
    }
    res.json({ ...album, id: album._id });
  })
);

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
    const allowedFields = ['title', 'description', 'coverImage', 'eventId', 'date', 'tags', 'images'];
    const docsToInsert = items.map((rawItem, idx) => {
      const item = pick(rawItem, allowedFields);
      const id = rawItem._id || rawItem.id || new mongoose.Types.ObjectId().toString();
      return {
        ...item,
        _id: id,
        photosCount: 1,
        order: item.order !== undefined ? item.order : idx,
        createdAt: item.createdAt || now,
        updatedAt: now,
      };
    });

    const saved = await Album.insertMany(docsToInsert);
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
    const allowedFields = ['title', 'description', 'coverImage', 'eventId', 'date', 'tags', 'images'];
    const payload = pick(rawPayload, allowedFields);
    const id = rawPayload._id || rawPayload.id || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const newAlbum = new Album({
      ...payload,
      _id: id,
      photosCount: payload.photosCount || 1,
      images: Array.isArray(payload.images) ? payload.images : [],
      createdAt: payload.createdAt || now,
      updatedAt: now,
    });

    const saved = await newAlbum.save();
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
    const allowedFields = ['title', 'description', 'coverImage', 'eventId', 'date', 'tags', 'images', 'photosCount'];
    const payload = pick(rawPayload, allowedFields);
    payload.updatedAt = Date.now();

    const updated = await Album.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).lean();
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Album not found' });
    }

    res.json({ success: true, album: { ...updated, id: updated._id } });
  })
);

// DELETE /api/albums/:id - Delete album
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await Album.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Album not found' });
    }

    res.json({ success: true, message: `Album ${id} deleted successfully` });
  })
);

module.exports = router;
