const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Organizer = require('../models/Organizer');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');

// GET /api/organizers - List organizers sorted by order
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const organizers = await Organizer.find({}).sort({ order: 1, createdAt: 1 }).lean();
    res.json(organizers.map((o) => ({ ...o, id: o._id })));
  })
);

// GET /api/organizers/:id - Get single organizer
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const organizer = await Organizer.findById(req.params.id).lean();
    if (!organizer) {
      return res.status(404).json({ success: false, error: 'Organizer not found' });
    }
    res.json({ ...organizer, id: organizer._id });
  })
);

// POST /api/organizers - Create organizer
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    const allowedFields = ['name', 'role', 'organization', 'image', 'photo', 'linkedin', 'twitter', 'github', 'order', 'position', 'sub_role', 'bio', 'email', 'phone', 'department', 'year'];
    const payload = pick(rawPayload, allowedFields);
    if (payload.order !== undefined) payload.order = Number(payload.order);
    const id = rawPayload._id || rawPayload.id || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const newOrganizer = new Organizer({
      ...payload,
      _id: id,
      createdAt: payload.createdAt || now,
      updatedAt: now,
    });

    const saved = await newOrganizer.save();
    res.status(201).json({ success: true, id: saved._id, organizer: { ...saved.toObject(), id: saved._id } });
  })
);

// PUT /api/organizers/:id - Update organizer
router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const rawPayload = req.body || {};
    const allowedFields = ['name', 'role', 'organization', 'image', 'photo', 'linkedin', 'twitter', 'github', 'order', 'position', 'sub_role', 'bio', 'email', 'phone', 'department', 'year'];
    const payload = pick(rawPayload, allowedFields);
    if (payload.order !== undefined) payload.order = Number(payload.order);
    payload.updatedAt = Date.now();

    const updated = await Organizer.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).lean();
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Organizer not found' });
    }

    res.json({ success: true, organizer: { ...updated, id: updated._id } });
  })
);

// DELETE /api/organizers/:id - Delete organizer
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await Organizer.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Organizer not found' });
    }

    res.json({ success: true, message: `Organizer ${id} deleted successfully` });
  })
);

module.exports = router;
