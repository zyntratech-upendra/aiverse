const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');

// Helper: build a safe user lookup query
// _id is String type (not ObjectId) so we can safely match on email/_id/uid without CastErrors
function userQuery(id) {
  const normalized = id.toLowerCase();
  return {
    $or: [
      { _id: id },
      { _id: normalized },
      { uid: id },
      { email: normalized },
    ],
  };
}

// GET /api/users/team - Public endpoint for About/Team page (no auth required)
router.get(
  '/team',
  asyncHandler(async (req, res) => {
    const users = await User.find({ status: 'Active' })
      .select('name display_name email role position bio linkedin github image show_in_about year status')
      .sort({ created_at: 1 })
      .lean();

    // Filter out participants to safely expose only team members
    const filteredUsers = users.filter(u => {
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const pos = (u.position || '').toLowerCase();

      if (
        role === 'participant' ||
        role.includes('participant') ||
        pos === 'participant' ||
        pos.includes('participant') ||
        email.includes('participant') ||
        email.startsWith('team')
      ) {
        return false;
      }
      return true;
    });

    res.json(filteredUsers.map((u) => ({ ...u, id: u._id })));
  })
);

// GET /api/users - List users
router.get(
  '/',
  requireAdmin,
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
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const user = await User.findOne(userQuery(id)).lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ ...user, id: user._id });
  })
);

// POST /api/users - Create single user (Self-registration)
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    // Public creation allows limited fields
    const allowedFields = ['name', 'email', 'phone', 'college', 'branch', 'year', 'avatar', 'github', 'linkedin', 'bio', 'city', 'state', 'country', 'team_name', 'registration_id', 'event_title', 'personal_email'];
    const payload = pick(rawPayload, allowedFields);

    const id = rawPayload._id || rawPayload.id || rawPayload.uid || new mongoose.Types.ObjectId().toString();
    const email = (payload.email || '').toLowerCase().trim();
    const now = Date.now();

    const userDoc = new User({
      ...payload,
      _id: id,
      uid: rawPayload.uid || id,
      email,
      role: 'participant', // Force role to participant for public creations
      created_at: rawPayload.created_at || now,
      updated_at: now,
    });

    const saved = await userDoc.save();
    res.status(201).json({ success: true, user: { ...saved.toObject(), id: saved._id } });
  })
);

// POST /api/users/bulk-create - Bulk upsert users (Registration provisioning)
router.post(
  '/bulk-create',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { users = [] } = req.body || {};
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'users array is required' });
    }

    const operations = users.map((u) => {
      const allowedFields = ['name', 'email', 'phone', 'college', 'branch', 'year', 'avatar', 'github', 'linkedin', 'bio', 'city', 'state', 'country', 'team_name', 'registration_id', 'event_title', 'personal_email', 'status', 'requiresPasswordChange', 'display_name'];
      const payload = pick(u, allowedFields);

      const email = (payload.email || '').toLowerCase().trim();
      const id = u._id || u.id || u.uid || new mongoose.Types.ObjectId().toString();
      const now = Date.now();

      return {
        updateOne: {
          filter: { $or: [{ email }, { uid: u.uid || id }, { _id: id }] },
          update: {
            $set: {
              ...payload,
              _id: id,
              uid: u.uid || id,
              email,
              role: 'participant', // Force role
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
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const userRole = (req.user?.role || '').toLowerCase();
    const isAdmin = userRole.includes('admin') || userRole.includes('super');
    
    // Authorization check
    if (!isAdmin && req.user.uid !== id && req.user._id !== id) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only update your own profile' });
    }

    const rawPayload = req.body || {};
    let allowedFields = ['name', 'phone', 'college', 'branch', 'year', 'avatar', 'github', 'linkedin', 'bio', 'city', 'state', 'country'];
    
    if (isAdmin) {
      // Admins can update more fields
      allowedFields = [...allowedFields, 'role', 'verified', 'score', 'team_id', 'requiresPasswordChange', 'hasCustomPassword', 'registration_id', 'email'];
    }

    const payload = pick(rawPayload, allowedFields);
    payload.updated_at = Date.now();

    const updated = await User.findOneAndUpdate(
      userQuery(id),
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
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await User.findOneAndDelete(userQuery(id)).lean();

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, message: `User ${id} deleted successfully` });
  })
);

module.exports = router;
