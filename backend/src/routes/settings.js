const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/settings - List all settings
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await Setting.find({}).lean();
    res.json(list.map(s => {
      const val = s.value || {};
      return {
        ...s,
        ...val,
        id: s.key || s._id,
        _id: s._id,
        key: s.key,
        availableRoles: s.availableRoles || val.availableRoles || ["Faculty Coordinator", "Student Lead", "Organizer", "Volunteer"],
      };
    }));
  })
);

// GET /api/settings/:key - Get single setting document by key
router.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    let doc = await Setting.findOne({ $or: [{ key }, { _id: key.match(/^[0-9a-fA-F]{24}$/) ? key : null }] }).lean();

    if (!doc) {
      // If portal_config doesn't exist yet, provide default fallback
      if (key === 'portal_config') {
        return res.json({
          id: 'portal_config',
          key: 'portal_config',
          availableRoles: ["Faculty Coordinator", "Student Lead", "Organizer", "Volunteer"],
          activeEventId: null,
          allowPublicRegistrations: true,
          allowTeamLogin: true,
          allowSubmissions: true,
          currentRound: 1,
        });
      }
      return res.status(404).json({ error: 'Setting not found', id: key });
    }

    const val = doc.value || {};
    const data = {
      ...doc,
      ...val,
      id: doc.key || doc._id,
      _id: doc._id,
      key: doc.key,
      availableRoles: doc.availableRoles || val.availableRoles || ["Faculty Coordinator", "Student Lead", "Organizer", "Volunteer"],
    };
    res.json(data);
  })
);

// PUT or POST /api/settings/:key - Upsert setting
const upsertSetting = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const payload = req.body || {};

  const doc = await Setting.findOneAndUpdate(
    { key },
    {
      $set: {
        key,
        value: payload,
        ...payload,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const val = (doc && doc.value) || {};
  res.json({
    success: true,
    ...doc,
    ...val,
    id: (doc && doc.key) || key,
    key: (doc && doc.key) || key,
    availableRoles: (doc && doc.availableRoles) || val.availableRoles || payload.availableRoles || ["Faculty Coordinator", "Student Lead", "Organizer", "Volunteer"],
  });
});

router.put('/:key', upsertSetting);
router.post('/:key', upsertSetting);
router.post('/', upsertSetting);

module.exports = router;
