const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const QuizSession = require('../models/QuizSession');
const QuizAnswer = require('../models/QuizAnswer');
const QuizSubmission = require('../models/QuizSubmission');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/quizzes - List quizzes
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { eventId, status, track } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (status) filter.status = status;
    if (track) filter.track = track;

    const quizzes = await Quiz.find(filter).sort({ createdAt: -1 }).lean();
    res.json(quizzes.map((q) => ({ ...q, id: q._id })));
  })
);

// GET /api/quizzes/:id - Fetch single quiz
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(req.params.id).lean();
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }
    res.json({ ...quiz, id: quiz._id });
  })
);

// GET /api/quizzes/:quizId/submissions - List all submissions for a quiz
router.get(
  '/:quizId/submissions',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const submissions = await QuizSubmission.find({ quizId }).sort({ score: -1, timeSpentSeconds: 1 }).lean();
    res.json(submissions.map((s) => ({ ...s, id: s._id })));
  })
);

// PUT /api/quizzes/:quizId/submissions-batch - Batch update/override multiple participant scores
router.put(
  '/:quizId/submissions-batch',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const { updates } = req.body || {};

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.json({ success: true, updatedCount: 0 });
    }

    const bulkOps = updates.map((u) => {
      const updateDoc = {
        evaluatedAt: Date.now(),
        isScoreOverridden: true,
        scoreOverriddenAt: Date.now(),
      };
      if (u.score !== undefined) updateDoc.score = Number(u.score);
      if (u.maxScore !== undefined) updateDoc.maxScore = Number(u.maxScore);
      if (u.percentage !== undefined) updateDoc.percentage = Number(u.percentage);
      if (u.correctCount !== undefined) updateDoc.correctCount = Number(u.correctCount);
      if (u.incorrectCount !== undefined) updateDoc.incorrectCount = Number(u.incorrectCount);
      if (u.passed !== undefined) updateDoc.passed = Boolean(u.passed);
      if (u.remarks !== undefined) updateDoc.remarks = u.remarks;
      if (u.originalScore !== undefined) updateDoc.originalScore = Number(u.originalScore);

      return {
        updateOne: {
          filter: { $or: [{ _id: u.id }, { sessionId: u.id }, { id: u.id }] },
          update: { $set: updateDoc },
        },
      };
    });

    await QuizSubmission.bulkWrite(bulkOps);
    res.json({ success: true, updatedCount: updates.length });
  })
);

// PUT /api/quizzes/:quizId/submissions/:submissionId - Update/override a participant's score
router.put(
  '/:quizId/submissions/:submissionId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { quizId, submissionId } = req.params;
    const { score, percentage, correctCount, incorrectCount, passed, maxScore, remarks, originalScore } = req.body || {};

    const updateDoc = {
      evaluatedAt: Date.now(),
      isScoreOverridden: true,
      scoreOverriddenAt: Date.now(),
    };
    if (score !== undefined) updateDoc.score = Number(score);
    if (maxScore !== undefined) updateDoc.maxScore = Number(maxScore);
    if (percentage !== undefined) updateDoc.percentage = Number(percentage);
    if (correctCount !== undefined) updateDoc.correctCount = Number(correctCount);
    if (incorrectCount !== undefined) updateDoc.incorrectCount = Number(incorrectCount);
    if (passed !== undefined) updateDoc.passed = Boolean(passed);
    if (remarks !== undefined) updateDoc.remarks = remarks;
    if (originalScore !== undefined) updateDoc.originalScore = Number(originalScore);

    const updated = await QuizSubmission.findOneAndUpdate(
      { $or: [{ _id: submissionId }, { sessionId: submissionId }, { id: submissionId }] },
      { $set: updateDoc },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    res.json({ success: true, submission: { ...updated, id: updated._id } });
  })
);

// GET /api/quizzes/:quizId/sessions - List all sessions for a quiz
router.get(
  '/:quizId/sessions',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const sessions = await QuizSession.find({ quizId }).sort({ updatedAt: -1 }).lean();
    res.json(sessions.map((s) => ({ ...s, id: s._id })));
  })
);

// POST /api/quizzes - Create quiz
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const id = payload._id || payload.id || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    const questionsCount = payload.questionsCount || questions.length;

    const newQuiz = new Quiz({
      ...payload,
      _id: id,
      questions,
      questionsCount,
      createdBy: req.user?.uid || payload.createdBy,
      createdAt: payload.createdAt || now,
      updatedAt: now,
    });

    const saved = await newQuiz.save();
    res.status(201).json({ success: true, quiz: { ...saved.toObject(), id: saved._id } });
  })
);

// PUT /api/quizzes/:id - Update quiz
router.put(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const payload = req.body || {};
    const now = Date.now();

    if (payload.questions && Array.isArray(payload.questions)) {
      payload.questionsCount = payload.questions.length;
    }
    payload.updatedAt = now;

    const updated = await Quiz.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).lean();
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    res.json({ success: true, quiz: { ...updated, id: updated._id } });
  })
);

// DELETE /api/quizzes/:id - Delete quiz cascading
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const quizId = req.params.id;

    await Quiz.findByIdAndDelete(quizId);
    await QuizSession.deleteMany({ quizId });
    await QuizAnswer.deleteMany({ quizId });
    await QuizSubmission.deleteMany({ quizId });

    res.json({ success: true, message: `Quiz ${quizId} and related data deleted successfully` });
  })
);

// POST /api/quizzes/:quizId/reset-participant - Reset a single participant's session and submission
router.post(
  '/:quizId/reset-participant',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { quizId } = req.params;
    const { userId } = req.body;
    const targetUserId = userId || req.user?.uid;

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Missing userId parameter' });
    }

    const sessionId = `${quizId.trim()}_${targetUserId.trim()}`;

    await QuizSession.deleteMany({ $or: [{ _id: sessionId }, { quizId, userId: targetUserId }] });
    await QuizAnswer.deleteMany({ $or: [{ _id: sessionId }, { sessionId }] });
    await QuizSubmission.deleteMany({ $or: [{ _id: sessionId }, { sessionId }, { quizId, userId: targetUserId }] });

    res.json({ success: true, message: `Participant ${targetUserId} reset for quiz ${quizId}` });
  })
);

// POST /api/quizzes/:quizId/reset-all - Reset all submissions and sessions for a quiz
router.post(
  '/:quizId/reset-all',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { quizId } = req.params;

    const sessions = await QuizSession.deleteMany({ quizId });
    const answers = await QuizAnswer.deleteMany({ quizId });
    const submissions = await QuizSubmission.deleteMany({ quizId });

    res.json({
      success: true,
      message: `Reset all data for quiz ${quizId}`,
      deleted: {
        sessions: sessions.deletedCount,
        answers: answers.deletedCount,
        submissions: submissions.deletedCount,
      },
    });
  })
);

// POST /api/quizzes/delete-by-event - Delete all quizzes and associated data for a specific event
router.post(
  '/delete-by-event',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { eventId, eventTitle } = req.body || {};
    if (!eventId && !eventTitle) {
      return res.status(400).json({ success: false, error: 'Missing eventId or eventTitle' });
    }

    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (eventTitle) filter.eventTitle = eventTitle;

    const quizzes = await Quiz.find(filter).lean();
    const quizIds = quizzes.map((q) => q._id);

    if (quizIds.length > 0) {
      await Quiz.deleteMany({ _id: { $in: quizIds } });
      await QuizSession.deleteMany({ quizId: { $in: quizIds } });
      await QuizAnswer.deleteMany({ quizId: { $in: quizIds } });
      await QuizSubmission.deleteMany({ quizId: { $in: quizIds } });
    }

    res.json({ success: true, deletedCount: quizIds.length, deletedQuizIds: quizIds });
  })
);

module.exports = router;
