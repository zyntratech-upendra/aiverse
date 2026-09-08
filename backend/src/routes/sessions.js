const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const QuizSession = require('../models/QuizSession');
const QuizSubmission = require('../models/QuizSubmission');
const QuizAnswer = require('../models/QuizAnswer');
const { requireAuth, ensureSessionOwnership } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/quizzes/:quizId/sessions -> create or restore authoritative session
router.post(
  '/quizzes/:quizId/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const quizId = req.params.quizId;
    const user = {
      uid: req.user.uid,
      email: req.user.email || '',
      displayName: req.user.name || 'Participant',
    };
    const team = req.body.team || {};

    const sessionId = `${quizId.trim()}_${user.uid.trim()}`;
    const now = Date.now();

    // Check if session already exists
    let existingSession = await QuizSession.findById(sessionId).lean();
    if (existingSession) {
      return res.json({ ...existingSession, id: existingSession._id });
    }

    // Fetch quiz to determine authoritative duration and end time
    const quiz = await Quiz.findById(quizId).lean();
    const durationMinutes = (quiz && quiz.durationMinutes) || 30;
    const durationMs = durationMinutes * 60 * 1000;
    let authoritativeEndTime = now + durationMs;

    if (quiz && quiz.scheduledEndTime && quiz.scheduledEndTime > now) {
      authoritativeEndTime = Math.min(authoritativeEndTime, quiz.scheduledEndTime);
    }

    const sessionPayload = {
      _id: sessionId,
      quizId,
      quizTitle: (quiz && quiz.title) || 'Quiz',
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName,
      teamId: team.id || '',
      teamName: team.name || '',
      startTime: now,
      endTime: authoritativeEndTime,
      durationMinutes,
      status: 'in_progress',
      lastAutosavedAt: now,
      violationsCount: 0,
      violationLogs: [],
      createdAt: now,
      updatedAt: now,
    };

    const session = await QuizSession.findOneAndUpdate({ _id: sessionId }, { $setOnInsert: sessionPayload }, { upsert: true, new: true }).lean();

    res.json({ ...session, id: session._id });
  })
);

// GET /api/sessions/:sessionId -> Fetch session info
router.get(
  '/sessions/:sessionId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await QuizSession.findById(sessionId).lean();
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ ...session, id: session._id });
  })
);

// Evaluation helper function
function evaluateQuiz(quiz, answers = {}) {
  const questions = (quiz && quiz.questions) || [];
  const defaultPts = Number(quiz && quiz.pointsPerQuestion) || 2;
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  if (questions.length === 0) {
    const answered = Object.keys(answers).filter((k) => !!answers[k]).length;
    const totalQ = (quiz && quiz.questionsCount) || answered;
    const max = (quiz && quiz.totalMarks) || totalQ * defaultPts || 50;
    return {
      score: 0,
      maxScore: max,
      percentage: 0,
      correctCount: 0,
      incorrectCount: answered,
      unansweredCount: Math.max(0, totalQ - answered),
      passed: false,
    };
  }

  questions.forEach((q) => {
    const pts = Number(q.points) || defaultPts;
    maxScore += pts;
    const selected = answers[q.id];
    if (selected && String(selected).trim().length > 0) {
      if (
        q.correctOptionId &&
        String(selected).trim().toLowerCase() === String(q.correctOptionId).trim().toLowerCase()
      ) {
        score += pts;
        correctCount++;
      } else {
        incorrectCount++;
      }
    } else {
      unansweredCount++;
    }
  });

  if (maxScore === 0) {
    maxScore = Number(quiz && quiz.totalMarks) || questions.length * defaultPts || 50;
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passingMarks = Number(quiz && quiz.passingMarks) || (maxScore > 0 ? Math.round(maxScore * 0.4) : 0);
  const passed = score >= passingMarks;

  return { score, maxScore, percentage, correctCount, incorrectCount, unansweredCount, passed };
}

// POST /api/sessions/:sessionId/submit -> Final submission & evaluation
router.post(
  '/sessions/:sessionId/submit',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = req.params.sessionId;
    const {
      answers = {},
      isAutoSubmitted = false,
      violationsCount = 0,
      violationLogs = [],
    } = req.body || {};

    // 1. Check if already submitted (idempotency & double-submit protection)
    let existingSubmission = await QuizSubmission.findById(sessionId).lean();
    if (existingSubmission) {
      return res.json({ ...existingSubmission, id: existingSubmission._id });
    }

    // 2. Retrieve session and quiz
    const sess = await QuizSession.findById(sessionId).lean();
    if (!sess) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const quiz = await Quiz.findById(sess.quizId).lean();
    const now = Date.now();
    const evalResult = evaluateQuiz(quiz, answers);

    const totalQuestions = (quiz && quiz.questions && quiz.questions.length) || Object.keys(answers).length;
    const answeredCount = Object.keys(answers).filter((k) => !!answers[k]).length;
    const timeSpentSeconds = Math.max(1, Math.floor((now - (sess.startTime || now)) / 1000));

    const submissionPayload = {
      _id: sessionId,
      sessionId,
      quizId: sess.quizId,
      quizTitle: sess.quizTitle || (quiz && quiz.title) || 'Quiz',
      userId: sess.userId,
      userEmail: sess.userEmail || '',
      userName: sess.userName || 'Participant',
      teamId: sess.teamId || '',
      teamName: sess.teamName || '',
      answers,
      answeredCount,
      unansweredCount: evalResult.unansweredCount,
      totalQuestions,
      timeSpentSeconds,
      startTime: sess.startTime || now,
      submittedAt: now,
      isAutoSubmitted,
      isFinal: true,
      violationsCount: Number(violationsCount) || sess.violationsCount || 0,
      violationLogs: Array.isArray(violationLogs) && violationLogs.length > 0 ? violationLogs : sess.violationLogs || [],
      score: evalResult.score,
      maxScore: evalResult.maxScore,
      percentage: evalResult.percentage,
      correctCount: evalResult.correctCount,
      incorrectCount: evalResult.incorrectCount,
      passed: evalResult.passed,
      evaluatedAt: now,
    };

    // Save submission and mark session submitted
    await QuizSubmission.findOneAndUpdate(
      { _id: sessionId },
      { $set: submissionPayload },
      { upsert: true, new: true }
    );

    await QuizSession.updateOne(
      { _id: sessionId },
      { $set: { status: 'submitted', submittedAt: now, updatedAt: now } }
    );

    const created = await QuizSubmission.findById(sessionId).lean();
    res.json({ ...created, id: created._id });
  })
);

// GET /api/sessions/:sessionId/submission -> Fetch final submission
router.get(
  '/sessions/:sessionId/submission',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const submission = await QuizSubmission.findById(sessionId).lean();
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    res.json({ ...submission, id: submission._id });
  })
);

// POST /api/sessions/:sessionId/autosave -> Upsert draft and touch session
router.post(
  '/sessions/:sessionId/autosave',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { answers = {}, clientTimestamp = Date.now(), violationsCount, violationLogs } = req.body || {};
    const now = Date.now();

    const updateDoc = {
      sessionId,
      answers,
      lastAutosavedAt: now,
      clientTimestamp,
    };
    if (violationsCount !== undefined) updateDoc.violationsCount = violationsCount;
    if (violationLogs) updateDoc.violationLogs = violationLogs;

    await QuizAnswer.findOneAndUpdate(
      { _id: sessionId },
      { $set: updateDoc },
      { upsert: true }
    );

    await QuizSession.updateOne(
      { _id: sessionId },
      { $set: { lastAutosavedAt: now, updatedAt: now } }
    );

    res.json({ success: true, sessionId, lastAutosavedAt: now });
  })
);

module.exports = router;
