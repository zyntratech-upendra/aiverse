const express = require('express');
const router = express.Router();
const JuryEvaluation = require('../models/JuryEvaluation');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { pick } = require('../utils/sanitize');

// GET /api/jury_evaluations - Query jury evaluations
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { eventId, registrationId, juryId, round } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (registrationId) filter.registrationId = registrationId;
    if (juryId) filter.juryId = juryId;
    if (round) filter.round = Number(round);

    const list = await JuryEvaluation.find(filter).sort({ createdAt: -1 });
    res.json(
      list.map((item) => ({
        ...item.toObject(),
        id: item._id.toString(),
      }))
    );
  })
);

// GET /api/jury_evaluations/:id - Get single evaluation
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    let doc = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      doc = await JuryEvaluation.findById(id);
    }
    if (!doc) {
      doc = await JuryEvaluation.findOne({
        $or: [{ registrationId: id }, { teamName: id }],
      });
    }

    if (!doc) {
      return res.status(404).json({ error: 'Jury evaluation not found', id });
    }

    res.json({
      ...doc.toObject(),
      id: doc._id.toString(),
    });
  })
);

// POST /api/jury_evaluations - Create evaluation
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    const allowedFields = ['eventId', 'registrationId', 'teamName', 'juryId', 'juryName', 'round', 'scores', 'totalScore', 'feedback', 'notes'];
    const payload = pick(rawPayload, allowedFields);
    const created = await JuryEvaluation.create(payload);
    res.status(201).json({
      success: true,
      ...created.toObject(),
      id: created._id.toString(),
    });
  })
);

// PUT /api/jury_evaluations/:id - Update evaluation (or upsert)
router.put(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rawPayload = req.body || {};
    const allowedFields = ['eventId', 'registrationId', 'teamName', 'juryId', 'juryName', 'round', 'scores', 'totalScore', 'feedback', 'notes'];
    const payload = pick(rawPayload, allowedFields);

    let filter = { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null };
    if (!filter._id) {
      filter = { $or: [{ registrationId: id }, { _id: id }] };
    }

    const updated = await JuryEvaluation.findOneAndUpdate(
      filter,
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      ...updated.toObject(),
      id: updated._id.toString(),
    });
  })
);

// DELETE /api/jury_evaluations/:id - Delete evaluation
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await JuryEvaluation.deleteMany({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { registrationId: id }],
    });
    res.json({ success: true, message: 'Jury evaluation deleted' });
  })
);

module.exports = router;
