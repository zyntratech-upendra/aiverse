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
  optionalAuth,
  asyncHandler(async (req, res) => {
    const users = await User.find({ status: { $regex: /^active$/i } })
      .select('name display_name displayName email personal_email role roleType position sub_role bio linkedin github image show_in_about year status order created_at')
      .sort({ order: 1, created_at: 1 })
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

    const users = await User.find(filter).sort({ order: 1, created_at: -1 }).limit(2000).lean();
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
    const allowedFields = ['name', 'email', 'phone', 'college', 'branch', 'year', 'avatar', 'image', 'github', 'linkedin', 'bio', 'city', 'state', 'country', 'team_name', 'registration_id', 'event_title', 'personal_email', 'position', 'sub_role', 'order'];
    const payload = pick(rawPayload, allowedFields);

    const id = rawPayload._id || rawPayload.id || rawPayload.uid || new mongoose.Types.ObjectId().toString();
    const email = (payload.email || '').toLowerCase().trim();
    const now = Date.now();

    const userDoc = new User({
      ...payload,
      _id: id,
      uid: rawPayload.uid || id,
      email,
      role: rawPayload.role || 'participant',
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
      const allowedFields = ['name', 'email', 'phone', 'college', 'branch', 'year', 'avatar', 'image', 'github', 'linkedin', 'bio', 'city', 'state', 'country', 'team_name', 'registration_id', 'event_title', 'personal_email', 'status', 'requiresPasswordChange', 'display_name', 'displayName', 'position', 'sub_role', 'order'];
      const payload = pick(u, allowedFields);

      const email = (payload.email || '').toLowerCase().trim();
      const id = u._id || u.id || u.uid || new mongoose.Types.ObjectId().toString();
      const now = Date.now();

      return {
        updateOne: {
          filter: { email },
          update: {
            $set: {
              ...payload,
              _id: id,
              uid: u.uid || id,
              email,
              role: u.role || 'participant',
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
    const isAdmin = userRole.includes('admin') || userRole.includes('super') || userRole.includes('faculty');
    
    // Authorization check
    if (!isAdmin && req.user.uid !== id && req.user._id !== id && req.user.email?.toLowerCase() !== id.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only update your own profile' });
    }

    const rawPayload = req.body || {};
    let allowedFields = [
      'name', 'phone', 'college', 'branch', 'year', 'avatar', 'image',
      'github', 'linkedin', 'bio', 'city', 'state', 'country',
      'position', 'sub_role', 'order', 'showInAbout', 'show_in_about',
      'display_name', 'displayName'
    ];
    
    if (isAdmin) {
      // Admins can update more fields
      allowedFields = [
        ...allowedFields,
        'role', 'roleType', 'status', 'verified', 'score', 'team_id',
        'requiresPasswordChange', 'hasCustomPassword', 'registration_id', 'email', 'personal_email'
      ];
    }

    const payload = pick(rawPayload, allowedFields);
    if (payload.order !== undefined) {
      payload.order = Number(payload.order);
    }
    payload.updated_at = Date.now();

    let updated = await User.findOneAndUpdate(
      userQuery(id),
      { $set: payload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      // Fallback: Check if organizer with this ID or email exists in Organizer collection
      const Organizer = require('../models/Organizer');
      const orgUpdated = await Organizer.findOneAndUpdate(
        { $or: [{ _id: id }, { email: id.toLowerCase() }] },
        { $set: { ...payload, updatedAt: Date.now() } },
        { new: true }
      ).lean();

      if (orgUpdated) {
        return res.json({ success: true, user: { ...orgUpdated, id: orgUpdated._id } });
      }
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user: { ...updated, id: updated._id } });
  })
);

// POST /api/users/:id/remove-from-team - Remove member from club team (preserves user account in DB)
router.post(
  '/:id/remove-from-team',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const cleanId = (id || '').toLowerCase().trim();
    const Organizer = require('../models/Organizer');

    // 1. Update User collection to demote role to participant and clear team metadata
    const teamResetPayload = {
      role: 'participant',
      position: '',
      sub_role: '',
      show_in_about: false,
      showInAbout: false,
      order: 0,
      updated_at: Date.now(),
    };

    let updated = await User.findOneAndUpdate(
      userQuery(id),
      { $set: teamResetPayload },
      { new: true }
    ).lean();

    // 2. Remove any associated record from Organizer collection
    const targetEmail = (updated?.email || cleanId).toLowerCase();
    await Organizer.deleteMany({
      $or: [{ _id: id }, { email: targetEmail }],
    }).catch(() => {});

    if (!updated) {
      // If user wasn't in User collection, check if they were in Organizer collection and deleted
      return res.json({
        success: true,
        message: 'Member removed from team leadership successfully',
        user: null,
      });
    }

    res.json({
      success: true,
      message: 'Member removed from team leadership successfully. Base user account preserved.',
      user: { ...updated, id: updated._id },
    });
  })
);

// DELETE /api/users/:id - Delete user completely from database
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const cleanId = (id || '').toLowerCase().trim();
    const Organizer = require('../models/Organizer');

    // 1. Delete from User collection
    const deleted = await User.findOneAndDelete(userQuery(id)).lean();

    // 2. Also delete from Organizer collection
    const targetEmail = (deleted?.email || cleanId).toLowerCase();
    const orgDeleted = await Organizer.deleteMany({
      $or: [{ _id: id }, { email: targetEmail }],
    }).catch(() => {});

    if (!deleted && (!orgDeleted || orgDeleted.deletedCount === 0)) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, message: `User ${id} permanently deleted successfully` });
  })
);

module.exports = router;
