const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/users - List users
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { role, email, registration_id } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (email) filter.email = email.toLowerCase().trim();
    if (registration_id) filter.registration_id = registration_id;

    const users = await User.find(filter).sort({ created_at: -1 }).limit(2000).lean();
    res.json(users.map((u) => ({ ...u, id: u._id })));
  })
);

// GET /api/users/:id - Get single user
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const user = await User.findOne({
      $or: [{ _id: id }, { uid: id }, { email: id.toLowerCase() }],
    }).lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ ...user, id: user._id });
  })
);

// POST /api/users - Create single user
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const id = payload._id || payload.id || payload.uid || new mongoose.Types.ObjectId().toString();
    const email = (payload.email || '').toLowerCase().trim();
    const now = Date.now();

    const userDoc = new User({
      ...payload,
      _id: id,
      uid: payload.uid || id,
      email,
      created_at: payload.created_at || now,
      updated_at: now,
    });

    const saved = await userDoc.save();
    res.status(201).json({ success: true, user: { ...saved.toObject(), id: saved._id } });
  })
);

// POST /api/users/bulk-create - Bulk upsert users
router.post(
  '/bulk-create',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { users = [] } = req.body || {};
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'users array is required' });
    }

    const operations = users.map((u) => {
      const email = (u.email || '').toLowerCase().trim();
      const id = u._id || u.id || u.uid || new mongoose.Types.ObjectId().toString();
      const now = Date.now();

      return {
        updateOne: {
          filter: { $or: [{ email }, { uid: u.uid || id }, { _id: id }] },
          update: {
            $set: {
              ...u,
              _id: id,
              uid: u.uid || id,
              email,
              updated_at: now,
            },
            $setOnInsert: { created_at: now },
          },
          upsert: true,
        },
      };
    });

    const result = await User.bulkWrite(operations);
    res.json({
      success: true,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
      totalProcessed: users.length,
    });
  })
);

// PUT /api/users/:id - Update user
router.put(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const payload = req.body || {};
    payload.updated_at = Date.now();

    const updated = await User.findOneAndUpdate(
      { $or: [{ _id: id }, { uid: id }, { email: id.toLowerCase() }] },
      { $set: payload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user: { ...updated, id: updated._id } });
  })
);

// DELETE /api/users/:id - Delete user
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await User.findOneAndDelete({
      $or: [{ _id: id }, { uid: id }, { email: id.toLowerCase() }],
    }).lean();

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, message: `User ${id} deleted successfully` });
  })
);

module.exports = router;
