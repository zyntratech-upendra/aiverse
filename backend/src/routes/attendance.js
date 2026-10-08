const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Registration = require('../models/Registration');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');

// GET /api/attendance - List attendance records
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { eventId, registrationId, userEmail, status, session, participantId, day } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (registrationId) filter.registrationId = registrationId;
    if (userEmail) filter.userEmail = userEmail.toLowerCase().trim();
    if (status) filter.status = status;
    if (session) filter.session = session;
    if (participantId) filter.participantId = participantId;
    if (day) filter.day = Number(day);

    const records = await Attendance.find(filter).sort({ checkInTime: -1 }).limit(2000).lean();
    res.json(records.map((r) => ({ ...r, id: r._id })));
  })
);

// POST /api/attendance - Mark individual attendance
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    const allowedFields = ['eventId', 'registrationId', 'participantId', 'userEmail', 'session', 'day', 'dayNumber', 'status', 'markedBy', 'checkInTime'];
    const payload = pick(rawPayload, allowedFields);
    
    const eventId = payload.eventId;
    const registrationId = payload.registrationId || '';
    const participantId = payload.participantId || '';
    const userEmail = (payload.userEmail || '').toLowerCase().trim();
    const session = payload.session || 'gate_entry';
    const day = Number(payload.day || payload.dayNumber) || 1;

    if (!eventId || (!registrationId && !participantId && !userEmail)) {
      return res.status(400).json({ success: false, error: 'eventId and registrationId/participantId/userEmail are required' });
    }

    const id = payload._id || payload.id || `${eventId}_${participantId || registrationId || userEmail}_d${day}_${session}`;
    const now = Date.now();

    const record = await Attendance.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          ...payload,
          _id: id,
          eventId,
          registrationId,
          participantId,
          session,
          day,
          userEmail,
          checkInTime: payload.checkInTime || now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, new: true }
    ).lean();

    // Also update Registration document if registrationId is provided
    if (registrationId) {
      const regUpdate = {
        attendanceMarked: true,
        checkedInAt: now,
      };
      if (session === 'gate_entry') {
        regUpdate.gateEntryMarked = true;
        regUpdate.checkInTimeGateEntry = payload.checkInTime || now;
      } else if (session === 'gate_exit') {
        regUpdate.gateExitMarked = true;
        regUpdate.checkInTimeGateExit = payload.checkInTime || now;
      } else if (session === 'morning') {
        regUpdate.attendanceStatusMorning = payload.status || 'Present';
        regUpdate.checkInTimeMorning = payload.checkInTime || now;
      } else if (session === 'afternoon') {
        regUpdate.attendanceStatusAfternoon = payload.status || 'Present';
        regUpdate.checkInTimeAfternoon = payload.checkInTime || now;
      }
      regUpdate.attendanceStatus = payload.status || 'Present';

      await Registration.findByIdAndUpdate(registrationId, { $set: regUpdate }).catch(() => {});
    }

    res.json({ success: true, attendance: { ...record, id: record._id } });
  })
);

// POST /api/attendance/bulk-mark - Bulk mark attendance
router.post(
  '/bulk-mark',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { records = [], eventId, markedBy = 'Organizer', day = 1 } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: 'records array is required' });
    }

    const now = Date.now();
    const ops = records.map((rawR) => {
      const allowedFields = ['eventId', 'registrationId', 'participantId', 'userEmail', 'session', 'day', 'dayNumber', 'status', 'markedBy', 'checkInTime', '_id', 'id'];
      const r = pick(rawR, allowedFields);
      const email = (r.userEmail || '').toLowerCase().trim();
      const regId = r.registrationId || '';
      const evId = r.eventId || eventId;
      const sess = r.session || 'gate_entry';
      const dayNum = Number(r.day || r.dayNumber || day) || 1;
      const id = r._id || r.id || `${evId}_${regId || email}_d${dayNum}_${sess}`;

      return {
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              ...r,
              _id: id,
              eventId: evId,
              registrationId: regId,
              userEmail: email,
              session: sess,
              day: dayNum,
              status: r.status || 'Present',
              checkInTime: r.checkInTime || now,
              markedBy: r.markedBy || markedBy,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      };
    });

    const result = await Attendance.bulkWrite(ops);
    res.json({ success: true, modifiedCount: result.modifiedCount, upsertedCount: result.upsertedCount });
  })
);


// DELETE /api/attendance/:id - Delete attendance record
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await Attendance.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Attendance record not found' });
    }

    res.json({ success: true, message: `Attendance ${id} deleted` });
  })
);

module.exports = router;
