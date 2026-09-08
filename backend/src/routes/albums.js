const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Album = require('../models/Album');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

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

// POST /api/albums - Create album
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const id = payload._id || payload.id || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const newAlbum = new Album({
      ...payload,
      _id: id,
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
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const payload = req.body || {};
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
  optionalAuth,
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
