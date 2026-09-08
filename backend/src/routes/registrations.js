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
    const id = payload._id || payload.id || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const teamSize = Number(payload.teamSize) || (Array.isArray(payload.members) ? payload.members.length : 1);

    const newReg = new Registration({
      ...payload,
      _id: id,
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
