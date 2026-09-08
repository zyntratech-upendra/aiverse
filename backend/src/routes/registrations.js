const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const User = require('../models/User');
const QuizSubmission = require('../models/QuizSubmission');
const QuizSession = require('../models/QuizSession');
const QuizAnswer = require('../models/QuizAnswer');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/registrations - List registrations
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { eventId, userId, userEmail, status } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (userId) filter.userId = userId;
    if (userEmail) filter.userEmail = userEmail.toLowerCase();
    if (status) filter.status = status;

    const docs = await Registration.find(filter).sort({ createdAt: -1 }).limit(2000).lean();
    res.json(docs.map((d) => ({ ...d, id: d._id })));
  })
);

// GET /api/registrations/:id - Get single registration
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const doc = await Registration.findById(req.params.id).lean();
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }
    res.json({ ...doc, id: doc._id });
  })
);

// POST /api/registrations - Create registration
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const eventId = payload.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'Event ID is required for registration.' });
    }

    // 1. Gather Team Lead emails
    const leadEmailSet = new Set();
    const addLeadEmail = (raw) => {
      if (!raw || typeof raw !== 'string') return;
      const clean = raw.trim().toLowerCase();
      if (clean && clean.includes('@')) {
        leadEmailSet.add(clean);
      }
    };

    addLeadEmail(payload.teamLeadEmail);
    addLeadEmail(payload.teamLeadPersonalEmail);
    addLeadEmail(payload.teamLeadCollegeEmail);
    addLeadEmail(payload.userEmail);
    addLeadEmail(payload.email);
    addLeadEmail(payload.personalEmail);
    addLeadEmail(payload.collegeEmail);

    // 2. Gather and validate Members emails (check collisions with Lead and other members)
    const cleanMembers = [];
    const memberEmailSet = new Set();

    if (Array.isArray(payload.members)) {
      for (let i = 0; i < payload.members.length; i++) {
        const m = payload.members[i];
        if (m && typeof m === 'object') {
          const mEmail = (m.email || '').trim().toLowerCase();
          const mName = (m.name || '').trim();

          if (mEmail && mEmail.includes('@') && mName) {
            // Check if member email matches lead email
            if (leadEmailSet.has(mEmail)) {
              return res.status(400).json({
                success: false,
                error: `Member #${i + 2}'s email (${mEmail}) cannot be the same as the Team Lead's email. Each participant must have a distinct, unique email address.`,
              });
            }

            // Check if member email matches another member email
            if (memberEmailSet.has(mEmail)) {
              return res.status(400).json({
                success: false,
                error: `Duplicate member email detected: ${mEmail}. Each team member must have a unique email address.`,
              });
            }

            memberEmailSet.add(mEmail);
            cleanMembers.push({
              ...m,
              name: mName,
              email: mEmail,
              phone: (m.phone || '').trim(),
              studentId: (m.studentId || m.registrationNumber || '').trim(),
            });
          }
        }
      }
    }

    const allSubmittedEmails = Array.from(new Set([...leadEmailSet, ...memberEmailSet]));

    // 3. Check if any submitted email is already registered in MongoDB for this event
    if (allSubmittedEmails.length > 0) {
      const existingReg = await Registration.findOne({
        eventId: eventId,
        $or: [
          { teamLeadEmail: { $in: allSubmittedEmails } },
          { teamLeadPersonalEmail: { $in: allSubmittedEmails } },
          { teamLeadCollegeEmail: { $in: allSubmittedEmails } },
          { userEmail: { $in: allSubmittedEmails } },
          { email: { $in: allSubmittedEmails } },
          { personalEmail: { $in: allSubmittedEmails } },
          { collegeEmail: { $in: allSubmittedEmails } },
          { 'members.email': { $in: allSubmittedEmails } },
        ],
      }).lean();

      if (existingReg) {
        const existingEmails = [
          existingReg.teamLeadEmail,
          existingReg.teamLeadPersonalEmail,
          existingReg.teamLeadCollegeEmail,
          existingReg.userEmail,
          existingReg.email,
          existingReg.personalEmail,
          existingReg.collegeEmail,
          ...(Array.isArray(existingReg.members) ? existingReg.members.map((m) => m && m.email) : []),
        ]
          .filter(Boolean)
          .map((e) => e.trim().toLowerCase());

        const matchedEmail = allSubmittedEmails.find((e) => existingEmails.includes(e)) || allSubmittedEmails[0];

        return res.status(400).json({
          success: false,
          error: `Participant with email "${matchedEmail}" is already registered for this event. Duplicate registrations for the same event are not allowed.`,
        });
      }
    }

    const id = payload._id || payload.id || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const isQuiz = Boolean(payload.isQuiz || payload.category === 'QUIZ' || payload.category === 'Quiz');
    const teamSize = isQuiz ? 1 : Math.max(1, cleanMembers.length + 1);

    const newReg = new Registration({
      ...payload,
      _id: id,
      members: isQuiz ? [] : cleanMembers,
      teamSize,
      createdAt: payload.createdAt || now,
      updatedAt: now,
    });

    const saved = await newReg.save();

    // Increment currentReg on the Event if eventId provided
    if (payload.eventId) {
      await Event.findByIdAndUpdate(payload.eventId, { $inc: { currentReg: teamSize } }).catch(() => {});
    }

    res.status(201).json({ success: true, id: saved._id, registration: { ...saved.toObject(), id: saved._id } });
  })
);

// PUT /api/registrations/:id - Update registration
router.put(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const payload = req.body || {};
    payload.updatedAt = Date.now();

    const updated = await Registration.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).lean();
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }

    res.json({ success: true, registration: { ...updated, id: updated._id } });
  })
);

// DELETE /api/registrations/:id - Delete registration
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const doc = await Registration.findByIdAndDelete(id).lean();
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }

    if (doc.eventId) {
      const dec = Math.max(1, Number(doc.teamSize) || 1);
      await Event.findByIdAndUpdate(doc.eventId, { $inc: { currentReg: -dec } }).catch(() => {});
    }

    res.json({ success: true, message: `Registration ${id} deleted` });
  })
);

// POST /api/registrations/:id/cascade-delete - Deep cascade delete
// Body: { emailList: string[], teamSize?: number, eventId?: string }
router.post(
  '/:id/cascade-delete',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const regId = req.params.id;
    const { emailList = [], teamSize = 1, eventId } = req.body || {};

    // 1. Delete registration document
    const regDoc = await Registration.findByIdAndDelete(regId).lean();

    // 2. Delete quiz related records referencing this registration or user emails
    await QuizSubmission.deleteMany({ $or: [{ registrationId: regId }, { userEmail: { $in: emailList } }] }).catch(() => {});
    await QuizSession.deleteMany({ $or: [{ registrationId: regId }, { userEmail: { $in: emailList } }] }).catch(() => {});
    await QuizAnswer.deleteMany({ registrationId: regId }).catch(() => {});

    // 3. Delete attendance and certificates if collections exist
    const db = mongoose.connection;
    const extraCollections = ['attendance', 'certificates'];
    for (const col of extraCollections) {
      try {
        await db.collection(col).deleteMany({ $or: [{ registrationId: regId }, { userEmail: { $in: emailList } }] });
      } catch (e) {}
    }

    // 4. Clean up user accounts created for this registration
    if (emailList && Array.isArray(emailList) && emailList.length > 0) {
      const normalizedEmails = emailList.map((e) => String(e).toLowerCase().trim()).filter(Boolean);
      await User.deleteMany({
        $or: [
          { registration_id: regId },
          { email: { $in: normalizedEmails } },
          { personal_email: { $in: normalizedEmails } },
        ],
      }).catch(() => {});
    } else {
      await User.deleteMany({ registration_id: regId }).catch(() => {});
    }

    // 5. Decrement event registration counter
    const targetEventId = eventId || (regDoc && regDoc.eventId);
    if (targetEventId) {
      const dec = Math.max(1, Number(teamSize) || (regDoc && regDoc.teamSize) || 1);
      await Event.findByIdAndUpdate(targetEventId, { $inc: { currentReg: -dec } }).catch(() => {});
    }

    res.json({ success: true, message: `Registration ${regId} and cascaded records deleted successfully` });
  })
);

module.exports = router;
