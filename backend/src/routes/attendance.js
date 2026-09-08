const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Registration = require('../models/Registration');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/attendance - List attendance records
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { eventId, registrationId, userEmail, status } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (registrationId) filter.registrationId = registrationId;
    if (userEmail) filter.userEmail = userEmail.toLowerCase().trim();
    if (status) filter.status = status;

    const records = await Attendance.find(filter).sort({ checkInTime: -1 }).limit(2000).lean();
    res.json(records.map((r) => ({ ...r, id: r._id })));
  })
);

// POST /api/attendance - Mark individual attendance
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const eventId = payload.eventId;
    const registrationId = payload.registrationId;
    const userEmail = (payload.userEmail || '').toLowerCase().trim();

    if (!eventId || (!registrationId && !userEmail)) {
      return res.status(400).json({ success: false, error: 'eventId and registrationId or userEmail are required' });
    }

    const id = payload._id || payload.id || `${eventId}_${registrationId || userEmail}`;
    const now = Date.now();

    const record = await Attendance.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          ...payload,
          _id: id,
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
      await Registration.findByIdAndUpdate(registrationId, {
        $set: { attendanceMarked: true, attendanceStatus: payload.status || 'Present', checkedInAt: now },
      }).catch(() => {});
    }

    res.json({ success: true, attendance: { ...record, id: record._id } });
  })
);

// POST /api/attendance/bulk-mark - Bulk mark attendance
router.post(
  '/bulk-mark',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { records = [], eventId, markedBy = 'Organizer' } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: 'records array is required' });
    }

    const now = Date.now();
    const ops = records.map((r) => {
      const email = (r.userEmail || '').toLowerCase().trim();
      const regId = r.registrationId || '';
      const evId = r.eventId || eventId;
      const id = r._id || r.id || `${evId}_${regId || email}`;

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
              status: r.status || 'Present',
              markedBy: r.markedBy || markedBy,
              checkInTime: r.checkInTime || now,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      };
    });

    const result = await Attendance.bulkWrite(ops);
    res.json({ success: true, upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount });
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
