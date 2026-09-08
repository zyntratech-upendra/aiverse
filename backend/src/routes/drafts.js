const express = require('express');
const router = express.Router();
const QuizAnswer = require('../models/QuizAnswer');
const { requireAuth, ensureSessionOwnership } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/sessions/:sessionId/draft - Load draft answers
router.get(
  '/sessions/:sessionId/draft',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    if (!ensureSessionOwnership(sessionId, req.user.uid)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Session ownership mismatch' });
    }

    const draft = await QuizAnswer.findById(sessionId).lean();
    if (!draft) {
      return res.json(null);
    }
    res.json({ ...draft, id: draft._id });
  })
);

// POST /api/sessions/:sessionId/draft - Save draft answers
router.post(
  '/sessions/:sessionId/draft',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    if (!ensureSessionOwnership(sessionId, req.user.uid)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Session ownership mismatch' });
    }

    const {
      answers = {},
      flaggedQuestions = [],
      currentQuestionIndex = 0,
      violationsCount = 0,
      violationLogs = [],
      clientTimestamp = Date.now(),
    } = req.body || {};
    const now = Date.now();

    const payload = {
      _id: sessionId,
      sessionId,
      answers,
      flaggedQuestions,
      currentQuestionIndex,
      violationsCount,
      violationLogs,
      lastAutosavedAt: now,
      clientTimestamp,
    };

    await QuizAnswer.findOneAndUpdate({ _id: sessionId }, { $set: payload }, { upsert: true, new: true });

    res.json({ success: true, sessionId, lastAutosavedAt: now });
  })
);

module.exports = router;
