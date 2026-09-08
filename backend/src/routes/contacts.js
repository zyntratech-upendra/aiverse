const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/contacts - List contact inquiries
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { status, email } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (email) filter.email = email.toLowerCase().trim();

    const contacts = await Contact.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
    res.json(contacts.map((c) => ({ ...c, id: c._id })));
  })
);

// GET /api/contacts/:id - Get single inquiry
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const contact = await Contact.findById(req.params.id).lean();
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact inquiry not found' });
    }
    res.json({ ...contact, id: contact._id });
  })
);

// POST /api/contacts - Submit contact inquiry (publicly accessible)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, subject, and message are required.' });
    }

    const newContact = new Contact({
      _id: new mongoose.Types.ObjectId().toString(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: 'New',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const saved = await newContact.save();
    res.status(201).json({ success: true, id: saved._id, contact: { ...saved.toObject(), id: saved._id } });
  })
);

// PUT /api/contacts/:id - Update status or notes
router.put(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const payload = req.body || {};
    payload.updatedAt = Date.now();

    const updated = await Contact.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Contact inquiry not found' });
    }

    res.json({ success: true, contact: { ...updated, id: updated._id } });
  })
);

// DELETE /api/contacts/:id - Delete inquiry
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await Contact.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Contact inquiry not found' });
    }

    res.json({ success: true, message: `Contact inquiry ${id} deleted successfully` });
  })
);

module.exports = router;
