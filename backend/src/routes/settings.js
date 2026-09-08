const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/settings - List all settings
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await Setting.find({});
    res.json(list.map(s => ({
      id: s.key || s._id,
      _id: s._id,
      key: s.key,
      ...(s.value || {}),
      ...s.toObject(),
    })));
  })
);

// GET /api/settings/:key - Get single setting document by key
router.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    let doc = await Setting.findOne({ $or: [{ key }, { _id: key.match(/^[0-9a-fA-F]{24}$/) ? key : null }] });

    if (!doc) {
      // If portal_config doesn't exist yet, provide default fallback
      if (key === 'portal_config') {
        return res.json({
          id: 'portal_config',
          key: 'portal_config',
          activeEventId: null,
          allowPublicRegistrations: true,
          allowTeamLogin: true,
          allowSubmissions: true,
          currentRound: 1,
        });
      }
      return res.status(404).json({ error: 'Setting not found', id: key });
    }

    const data = {
      id: doc.key || doc._id,
      _id: doc._id,
      key: doc.key,
      ...(doc.value || {}),
      ...doc.toObject(),
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
  );

  res.json({
    success: true,
    id: doc.key,
    key: doc.key,
    ...(doc.value || {}),
    ...doc.toObject(),
  });
});

router.put('/:key', upsertSetting);
router.post('/:key', upsertSetting);
router.post('/', upsertSetting);

module.exports = router;
