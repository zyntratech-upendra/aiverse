const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');

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

    const events = await Event.find(filter).sort({ createdAt: -1 }).lean();
    res.json(events.map((e) => ({ ...e, id: e._id })));
  })
);

// GET /api/events/:id - Get single event
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const event = await Event.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    res.json({ ...event, id: event._id });
  })
);

// POST /api/events - Create event
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    const allowedFields = ['title', 'description', 'shortDescription', 'category', 'track', 'date', 'time', 'venue', 'location', 'banner', 'bannerImage', 'coverImage', 'rules', 'prizes', 'tags', 'maxParticipants', 'maxReg', 'currentReg', 'teamSizeMin', 'teamSizeMax', 'minTeamSize', 'maxTeamSize', 'fee', 'isLive', 'registrationOpen', 'status', 'coordinators'];
    const payload = pick(rawPayload, allowedFields);
    
    const id = rawPayload._id || rawPayload.id || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const newEvent = new Event({
      ...payload,
      _id: id,
      createdAt: payload.createdAt || now,
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
    const allowedFields = ['title', 'description', 'shortDescription', 'category', 'track', 'date', 'time', 'venue', 'location', 'banner', 'bannerImage', 'coverImage', 'rules', 'prizes', 'tags', 'maxParticipants', 'maxReg', 'currentReg', 'teamSizeMin', 'teamSizeMax', 'minTeamSize', 'maxTeamSize', 'fee', 'isLive', 'registrationOpen', 'status', 'coordinators'];
    const payload = pick(rawPayload, allowedFields);
    payload.updatedAt = Date.now();

    const updated = await Event.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).lean();
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
    const deleted = await Event.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    res.json({ success: true, message: `Event ${id} deleted successfully` });
  })
);

module.exports = router;
