const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Quiz = require('../models/Quiz');
const QuizSubmission = require('../models/QuizSubmission');
const QuizSession = require('../models/QuizSession');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/admin/delete-user - Admin delete user
router.post(
  '/delete-user',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const callerUid = req.user?.uid;
    const targetUid = req.body?.uid;

    if (!targetUid) {
      return res.status(400).json({ success: false, error: 'Missing target uid' });
    }

    if (callerUid === targetUid) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own admin account' });
    }

    await User.deleteMany({ $or: [{ uid: targetUid }, { _id: targetUid }] });
    await QuizSubmission.deleteMany({ userId: targetUid });
    await QuizSession.deleteMany({ userId: targetUid });

    res.json({ success: true, message: `User ${targetUid} deleted from database` });
  })
);

// POST /api/admin/send-team-email - Admin send batch email
router.post(
  '/send-team-email',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { to, subject, html, text, from, replyTo } = req.body || {};
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ success: false, error: 'Missing to, subject, or html' });
    }

    const { sendMail } = require('../config/mailer');

    try {
      const info = await sendMail({
        to,
        subject,
        html: html || `<p>${text}</p>`,
        text,
        from,
        replyTo,
      });

      res.json({
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        response: info.response,
      });
    } catch (err) {
      console.error('[Admin] Batch email SMTP error:', err);
      res.status(500).json({ success: false, error: 'Failed to send batch email', details: err.message });
    }
  })
);

// GET /api/admin/stats - Admin dashboard statistics overview
router.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [usersCount, eventsCount, registrationsCount, quizzesCount, submissionsCount] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Registration.countDocuments(),
      Quiz.countDocuments(),
      QuizSubmission.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: {
        users: usersCount,
        events: eventsCount,
        registrations: registrationsCount,
        quizzes: quizzesCount,
        quizSubmissions: submissionsCount,
      },
    });
  })
);

module.exports = router;
