const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { pick } = require('../utils/sanitize');

// Helper to compute registration counts for events
async function getRegistrationCountsMap() {
  try {
    const regCounts = await Registration.aggregate([
      {
        $project: {
          eventId: 1,
          seatCount: {
            $cond: {
              if: { $and: [{ $isArray: '$members' }, { $gt: [{ $size: '$members' }, 0] }] },
              then: { $add: [{ $size: '$members' }, 1] },
              else: { $ifNull: ['$teamSize', 1] }
            }
          }
        }
      },
      {
        $group: {
          _id: '$eventId',
          totalSeats: { $sum: '$seatCount' }
        }
      }
    ]);
    const map = {};
    regCounts.forEach((r) => {
      if (r._id) {
        map[String(r._id).trim()] = r.totalSeats;
      }
    });
    return map;
  } catch (err) {
    console.warn('[events route] Error calculating registration counts:', err.message);
    return {};
  }
}

// GET /api/events - List events
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { category, track, isLive } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (track) filter.track = track;
    if (isLive !== undefined) filter.isLive = isLive === 'true';

    const [events, regMap] = await Promise.all([
      Event.find(filter).sort({ createdAt: -1 }).lean(),
      getRegistrationCountsMap()
    ]);

    res.json(
      events.map((e) => {
        const id = e._id;
        const computedSeats = regMap[String(id).trim()] || regMap[String(e.id || '').trim()] || 0;
        return {
          ...e,
          id: e._id,
          currentReg: Math.max(Number(e.currentReg) || 0, computedSeats)
        };
      })
    );
  })
);

// GET /api/events/:id - Get single event
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const event = await Event.findOne({ $or: [{ _id: id }, { id: id }] }).lean();
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const regMap = await getRegistrationCountsMap();
    const computedSeats = regMap[String(event._id).trim()] || regMap[String(event.id || id).trim()] || 0;

    res.json({
      ...event,
      id: event._id,
      currentReg: Math.max(Number(event.currentReg) || 0, computedSeats)
    });
  })
);

// POST /api/events - Create event
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawPayload = req.body || {};
    const { _id, id: bodyId, ...eventData } = rawPayload;
    const id = _id || bodyId || new mongoose.Types.ObjectId().toString();
    const now = Date.now();

    const newEvent = new Event({
      ...eventData,
      _id: id,
      createdAt: eventData.createdAt || now,
      updatedAt: now,
    });

    const saved = await newEvent.save();
    res.status(201).json({ success: true, id: saved._id, event: { ...saved.toObject(), id: saved._id } });
  })
);

// PUT /api/events/:id - Update event
router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const rawPayload = req.body || {};
    const { _id, id: bodyId, ...updateData } = rawPayload;
    updateData.updatedAt = Date.now();

    const updated = await Event.findOneAndUpdate(
      { $or: [{ _id: id }, { id: id }] },
      { $set: updateData },
      { new: true, runValidators: false }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    res.json({ success: true, event: { ...updated, id: updated._id } });
  })
);

// DELETE /api/events/:id - Delete event
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await Event.findOneAndDelete({ $or: [{ _id: id }, { id: id }] });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    res.json({ success: true, message: `Event ${id} deleted successfully` });
  })
);

module.exports = router;
