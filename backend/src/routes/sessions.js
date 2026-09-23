const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const QuizSession = require('../models/QuizSession');
const QuizSubmission = require('../models/QuizSubmission');
const QuizAnswer = require('../models/QuizAnswer');
const Registration = require('../models/Registration');
const { requireAuth, optionalAuth, ensureSessionOwnership } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Helper: Mulberry32 seeded shuffle
function seededShuffle(items = [], seedStr = '') {
  let seed = 0;
  const str = String(seedStr || 'aiverse_quiz_seed');
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) >>> 0;
  }

  const random = () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper: Category-aware or global seeded deterministic question picker
function selectSeededQuestionIds(questions = [], count = 0, seedStr = '', categoryDistribution = null) {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  // 1. Category-wise quota distribution
  if (categoryDistribution && typeof categoryDistribution === 'object' && Object.keys(categoryDistribution).length > 0) {
    const questionsByCategory = {};
    for (const q of questions) {
      const cat = (q.category && String(q.category).trim()) || 'General';
      if (!questionsByCategory[cat]) questionsByCategory[cat] = [];
      questionsByCategory[cat].push(q);
    }

    let selectedQuestions = [];
    for (const [cat, catQs] of Object.entries(questionsByCategory)) {
      const quotaVal = categoryDistribution[cat];
      if (quotaVal !== undefined && quotaVal !== null && quotaVal !== '') {
        const quota = Number(quotaVal);
        if (quota > 0) {
          const picked = seededShuffle(catQs, `${seedStr}_cat_${cat}`).slice(0, Math.min(quota, catQs.length));
          selectedQuestions.push(...picked);
        }
        // quota === 0 means 0 questions from this category
      } else {
        selectedQuestions.push(...catQs);
      }
    }

    // Keep questions separated category by category (do not mix across categories)
    return selectedQuestions.map((q) => q.id);
  }

  // 2. Global count fallback
  if (count <= 0 || count >= questions.length) {
    return questions.map((q) => q.id);
  }
  return seededShuffle(questions, seedStr).slice(0, count).map((q) => q.id);
}

// POST /api/quizzes/:quizId/sessions -> create or restore authoritative session
router.post(
  '/quizzes/:quizId/sessions',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const quizId = req.params.quizId;
    const user = {
      uid: (req.user && req.user.uid) || req.body.userId || (req.body.user && req.body.user.uid) || 'participant',
      email: (req.user && req.user.email) || req.body.userEmail || (req.body.user && req.body.user.email) || '',
      displayName: (req.user && req.user.name) || req.body.userName || (req.body.user && req.body.user.name) || 'Participant',
    };
    const team = req.body.team || {};

    const sessionId = `${quizId.trim()}_${user.uid.trim()}`;
    const now = Date.now();

    // Fetch quiz to determine authoritative duration, end time, and random question pool
    const quiz = await Quiz.findById(quizId).lean();

    // Check if session already exists
    let existingSession = await QuizSession.findById(sessionId).lean();
    if (existingSession) {
      const hasCategoryDist = quiz?.categoryDistribution && typeof quiz.categoryDistribution === 'object' && Object.values(quiz.categoryDistribution).some(v => Number(v) > 0);
      const hasGlobalSubset = quiz?.questionsToDisplayCount > 0 && quiz?.questions && quiz.questions.length > quiz.questionsToDisplayCount;

      let needsAssignment = !existingSession.assignedQuestionIds || existingSession.assignedQuestionIds.length === 0;

      // Validate that existing assignments match current category quotas
      if (!needsAssignment && hasCategoryDist && existingSession.status === 'in_progress') {
        const catCounts = {};
        const qMap = new Map((quiz.questions || []).map(q => [q.id, q]));
        for (const id of existingSession.assignedQuestionIds) {
          const qObj = qMap.get(id);
          const c = (qObj && qObj.category && qObj.category.trim()) || 'General';
          catCounts[c] = (catCounts[c] || 0) + 1;
        }
        for (const [cat, quota] of Object.entries(quiz.categoryDistribution)) {
          const numQuota = Number(quota);
          if (numQuota > 0 && catCounts[cat] !== numQuota) {
            needsAssignment = true;
            break;
          }
        }
      }

      if ((hasCategoryDist || hasGlobalSubset) && needsAssignment) {
        const assignedIds = selectSeededQuestionIds(quiz.questions || [], quiz.questionsToDisplayCount, sessionId, quiz.categoryDistribution);
        if (assignedIds.length > 0) {
          await QuizSession.updateOne({ _id: sessionId }, { $set: { assignedQuestionIds: assignedIds } });
          existingSession.assignedQuestionIds = assignedIds;
        }
      }
      return res.json({ ...existingSession, id: existingSession._id });
    }

    const durationMinutes = (quiz && quiz.durationMinutes) || 30;
    const durationMs = durationMinutes * 60 * 1000;
    let authoritativeEndTime = now + durationMs;

    if (quiz && quiz.scheduledEndTime && quiz.scheduledEndTime > now) {
      authoritativeEndTime = Math.min(authoritativeEndTime, quiz.scheduledEndTime);
    }

    // Select random subset of questions if quiz has categoryDistribution or questionsToDisplayCount configured
    let assignedQuestionIds = [];
    const hasCategoryDist = quiz && quiz.categoryDistribution && typeof quiz.categoryDistribution === 'object' && Object.values(quiz.categoryDistribution).some(v => Number(v) > 0);
    const hasGlobalSubset = quiz && quiz.questionsToDisplayCount > 0 && quiz.questions && quiz.questions.length > quiz.questionsToDisplayCount;

    if (hasCategoryDist || hasGlobalSubset) {
      assignedQuestionIds = selectSeededQuestionIds(quiz.questions || [], quiz.questionsToDisplayCount, sessionId, quiz.categoryDistribution);
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
      assignedQuestionIds,
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
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await QuizSession.findById(sessionId).lean();
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ ...session, id: session._id });
  })
);

// GET /api/sessions/:sessionId/draft -> Fetch draft answers
router.get(
  '/sessions/:sessionId/draft',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const draft = await QuizAnswer.findById(sessionId).lean();
    if (!draft) {
      return res.json({ sessionId, answers: {} });
    }
    res.json({ ...draft, id: draft._id });
  })
);

// POST /api/sessions/:sessionId/draft -> Save draft answers
router.post(
  '/sessions/:sessionId/draft',
  optionalAuth,
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

// Evaluation helper function
function evaluateQuiz(quiz, answers = {}, assignedQuestionIds = null) {
  let questions = (quiz && quiz.questions) || [];
  const defaultPts = Number(quiz && quiz.pointsPerQuestion) || 2;

  if (Array.isArray(assignedQuestionIds) && assignedQuestionIds.length > 0) {
    const idSet = new Set(assignedQuestionIds);
    questions = questions.filter((q) => idSet.has(q.id));
  } else if (quiz && quiz.questionsToDisplayCount > 0 && quiz.questionsToDisplayCount < questions.length) {
    const answeredKeys = Object.keys(answers || {});
    if (answeredKeys.length > 0) {
      const answeredSet = new Set(answeredKeys);
      const answeredQuestions = questions.filter((q) => answeredSet.has(q.id));
      if (answeredQuestions.length > 0) {
        questions = answeredQuestions;
      }
    }
  }

  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  if (questions.length === 0) {
    const answered = Object.keys(answers).filter((k) => !!answers[k]).length;
    const totalQ = (quiz && (quiz.questionsToDisplayCount || quiz.questionsCount)) || answered;
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
  optionalAuth,
  asyncHandler(async (req, res) => {
    const sessionId = req.params.sessionId;
    let {
      answers = {},
      isAutoSubmitted = false,
      violationsCount = 0,
      violationLogs = [],
    } = req.body || {};

    // If answers is empty, try loading from draft
    if (!answers || Object.keys(answers).length === 0) {
      const draftDoc = await QuizAnswer.findById(sessionId).lean();
      if (draftDoc && draftDoc.answers) {
        answers = draftDoc.answers;
      }
    }

    // 1. Check if already submitted (idempotency & double-submit protection)
    let existingSubmission = await QuizSubmission.findById(sessionId).lean();
    if (existingSubmission) {
      return res.json({ ...existingSubmission, id: existingSubmission._id });
    }

    // 2. Retrieve session and quiz
    let sess = await QuizSession.findById(sessionId).lean();
    const quizId = sess ? sess.quizId : sessionId.split('_')[0];
    const quiz = await Quiz.findById(quizId).lean();
    const now = Date.now();
    const evalResult = evaluateQuiz(quiz, answers, sess?.assignedQuestionIds);

    const totalQuestions = (sess?.assignedQuestionIds && sess.assignedQuestionIds.length > 0)
      ? sess.assignedQuestionIds.length
      : (quiz && quiz.questionsToDisplayCount > 0 && quiz.questionsToDisplayCount < (quiz.questions?.length || 0))
        ? quiz.questionsToDisplayCount
        : ((quiz && quiz.questions && quiz.questions.length) || Object.keys(answers).length);
    const answeredCount = Object.keys(answers).filter((k) => !!answers[k]).length;
    const timeSpentSeconds = Math.max(1, Math.floor((now - (sess?.startTime || now)) / 1000));

    // Authoritative lookup for registered participant & team details
    const cleanEmail = ((sess && sess.userEmail) || (req.user && req.user.email) || '').toLowerCase().trim();
    let regDoc = null;
    if (cleanEmail) {
      regDoc = await Registration.findOne({
        $or: [
          { email: cleanEmail },
          { userEmail: cleanEmail },
          { teamEmail: cleanEmail },
          { teamLeadEmail: cleanEmail },
          { 'members.email': cleanEmail },
        ],
      }).lean();
    }

    const resolvedLeadName =
      regDoc?.teamLeadName ||
      regDoc?.fullName ||
      regDoc?.userName ||
      regDoc?.name ||
      (sess && sess.teamLeadName) ||
      '';

    const resolvedTeamName =
      regDoc?.teamName ||
      regDoc?.groupName ||
      (sess && sess.teamName) ||
      (resolvedLeadName ? `${resolvedLeadName}'s Team` : '');

    const finalUserName =
      resolvedLeadName ||
      (sess && sess.userName && sess.userName !== 'Dr. P. S. R. Murty' ? sess.userName : null) ||
      (req.user && req.user.role === 'participant' && req.user.name && req.user.name !== 'Dr. P. S. R. Murty' ? req.user.name : null) ||
      'Participant';

    const submissionPayload = {
      _id: sessionId,
      sessionId,
      quizId: quizId,
      quizTitle: (sess && sess.quizTitle) || (quiz && quiz.title) || 'Quiz',
      userId: (sess && sess.userId) || sessionId.split('_')[1] || 'participant',
      userEmail: (sess && sess.userEmail) || (req.user && req.user.email) || '',
      userName: finalUserName,
      teamLeadName: resolvedLeadName,
      teamId: (sess && sess.teamId) || (regDoc ? String(regDoc._id) : ''),
      teamName: resolvedTeamName,
      assignedQuestionIds: sess?.assignedQuestionIds || [],
      answers,
      answeredCount,
      unansweredCount: evalResult.unansweredCount,
      totalQuestions,
      timeSpentSeconds,
      startTime: (sess && sess.startTime) || now,
      submittedAt: now,
      isAutoSubmitted,
      isFinal: true,
      violationsCount: Number(violationsCount) || (sess && sess.violationsCount) || 0,
      violationLogs: Array.isArray(violationLogs) && violationLogs.length > 0 ? violationLogs : (sess && sess.violationLogs) || [],
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
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    let submission = await QuizSubmission.findById(sessionId).lean();
    if (!submission) {
      return res.json(null); // Prevent 404 console error on frontend
    }

    // Ensure teamLeadName and teamName are accurately populated from registration
    const email = (submission.userEmail || (req.user && req.user.email) || '').toLowerCase().trim();
    if (email) {
      const reg = await Registration.findOne({
        $or: [
          { email },
          { userEmail: email },
          { teamEmail: email },
          { teamLeadEmail: email },
          { 'members.email': email },
        ],
      }).lean();
      if (reg) {
        submission.teamLeadName = reg.teamLeadName || reg.fullName || reg.userName || reg.name || submission.teamLeadName || '';
        submission.teamName = reg.teamName || reg.groupName || submission.teamName || '';
        if (submission.teamLeadName && (submission.userName === 'Dr. P. S. R. Murty' || submission.userName === 'Participant')) {
          submission.userName = submission.teamLeadName;
        }
      }
    }

    res.json({ ...submission, id: submission._id });
  })
);

// POST /api/sessions/:sessionId/autosave -> Upsert draft and touch session (alias)
router.post(
  '/sessions/:sessionId/autosave',
  optionalAuth,
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
