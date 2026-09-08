const express = require('express');
const router = express.Router();
const { signToken, requireAuth, optionalAuth } = require('../middleware/auth');
const User = require('../models/User');
const Registration = require('../models/Registration');
const { asyncHandler } = require('../middleware/errorHandler');

const DEFAULT_ADMIN_PASSWORDS = ['password123', 'admin123', 'aiverse123', 'aiverse@123', 'Password123!'];

// Normalize role helper
const normalizeRole = (rawRole, defaultRole = 'participant') => {
  if (!rawRole) return defaultRole;
  const lower = String(rawRole).toLowerCase().trim();
  if (
    lower === 'faculty' ||
    lower === 'admin' ||
    lower.includes('super admin') ||
    lower.includes('faculty coordinator') ||
    lower.includes('system admin')
  ) {
    return 'faculty';
  }
  if (
    lower === 'organizer' ||
    lower.includes('lead organizer') ||
    lower.includes('student organizer') ||
    lower.includes('co-organizer')
  ) {
    return 'organizer';
  }
  if (lower === 'jury' || lower.includes('jury') || lower.includes('evaluator')) {
    return 'jury';
  }
  return 'participant';
};

// POST /api/auth/login - Direct login endpoint with MongoDB
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPassword = (password || '').trim();

    const digitsOnly = cleanEmail.replace(/\D/g, '');
    const isPhoneInput = !cleanEmail.includes('@') && digitsOnly.length >= 7;

    // 1. Phone number login
    if (isPhoneInput) {
      const last10 = digitsOnly.slice(-10);
      let userDoc = await User.findOne({
        $or: [{ phone: cleanEmail }, { phone: last10 }, { phoneNumber: cleanEmail }, { phoneNumber: last10 }],
      }).lean();

      if (!userDoc) {
        const regDoc = await Registration.findOne({
          $or: [
            { phone: cleanEmail },
            { phone: last10 },
            { phoneNumber: cleanEmail },
            { phoneNumber: last10 },
            { leadPhone: cleanEmail },
            { leadPhone: last10 },
          ],
        }).lean();

        if (regDoc) {
          const role = 'participant';
          const payload = {
            uid: regDoc._id,
            email: regDoc.email || regDoc.teamEmail || `${last10}@aiverse.in`,
            name: regDoc.fullName || regDoc.teamLeadName || regDoc.name || 'Participant',
            role,
            displayRole: 'Participant',
            registration_id: regDoc._id,
            teamName: regDoc.groupName || regDoc.teamName || '',
            eventTitle: regDoc.eventTitle || '',
          };
          const token = signToken(payload, { expiresIn: '7d' });
          return res.json({ success: true, token, user: payload });
        }
      } else {
        const role = normalizeRole(userDoc.role, 'participant');
        const payload = {
          uid: userDoc.uid || userDoc._id,
          email: userDoc.email,
          name: userDoc.name || userDoc.display_name || 'Participant',
          role,
          displayRole: userDoc.displayRole || userDoc.position || 'Participant',
          registration_id: userDoc.registration_id || '',
          teamName: userDoc.team_name || userDoc.teamName || '',
          eventTitle: userDoc.event_title || userDoc.eventTitle || '',
        };
        const token = signToken(payload, { expiresIn: '7d' });
        return res.json({ success: true, token, user: payload });
      }

      return res.status(404).json({ success: false, error: 'No registered user found for this phone number' });
    }

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // 2. Email login
    let userDoc = await User.findOne({
      $or: [{ email: cleanEmail }, { personal_email: cleanEmail }, { uid: cleanEmail }],
    }).lean();

    const PREDEFINED_EMAILS = [
      'admin@aiverse.in',
      'facultycoordinator@aiverse.in',
      'studentorganizer@aiverse.in',
      'jury@aiverse.in',
      'jurry@aiverse.in',
      'participant@aiverse.in',
    ];

    if (userDoc) {
      if (userDoc.password && userDoc.password !== cleanPassword) {
        return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
      }
      if (!userDoc.password && PREDEFINED_EMAILS.includes(cleanEmail)) {
        if (!DEFAULT_ADMIN_PASSWORDS.includes(cleanPassword)) {
          return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
        }
        await User.findByIdAndUpdate(userDoc._id, { password: cleanPassword }).catch(() => {});
      }

      const role = normalizeRole(userDoc.role, 'participant');
      const payload = {
        uid: userDoc.uid || userDoc._id,
        email: userDoc.email,
        name: userDoc.name || userDoc.display_name || cleanEmail.split('@')[0],
        role,
        displayRole: userDoc.displayRole || userDoc.position || (role === 'faculty' ? 'Super Admin' : (role === 'organizer' ? 'Student Organizer' : (role === 'jury' ? 'Jury Evaluator' : 'Participant'))),
        registration_id: userDoc.registration_id || '',
        teamName: userDoc.team_name || userDoc.teamName || '',
        eventTitle: userDoc.event_title || userDoc.eventTitle || '',
      };

      const token = signToken(payload, { expiresIn: '7d' });
      return res.json({ success: true, token, user: payload });
    }

    // If predefined email not yet created, create now
    if (PREDEFINED_EMAILS.includes(cleanEmail)) {
      if (!DEFAULT_ADMIN_PASSWORDS.includes(cleanPassword)) {
        return res.status(401).json({ success: false, error: 'Invalid credentials.' });
      }

      let role = 'participant';
      let displayRole = 'Participant';
      let name = 'Participant';

      if (cleanEmail === 'admin@aiverse.in') {
        role = 'faculty';
        displayRole = 'Super Admin';
        name = 'Super Admin';
      } else if (cleanEmail === 'facultycoordinator@aiverse.in') {
        role = 'faculty';
        displayRole = 'Faculty Coordinator';
        name = 'Faculty Coordinator';
      } else if (cleanEmail === 'studentorganizer@aiverse.in') {
        role = 'organizer';
        displayRole = 'Student Organizer';
        name = 'Student Organizer';
      } else if (cleanEmail === 'jury@aiverse.in' || cleanEmail === 'jurry@aiverse.in') {
        role = 'jury';
        displayRole = 'Jury Evaluator';
        name = 'Jury Panelist';
      }

      const newUser = new User({
        _id: cleanEmail.replace(/[^a-z0-9]/g, '_'),
        uid: cleanEmail.replace(/[^a-z0-9]/g, '_'),
        email: cleanEmail,
        name,
        role,
        displayRole,
        password: cleanPassword,
        status: 'Active',
      });
      await newUser.save();

      const payload = {
        uid: newUser.uid,
        email: cleanEmail,
        name,
        role,
        displayRole,
        registration_id: '',
      };

      const token = signToken(payload, { expiresIn: '7d' });
      return res.json({ success: true, token, user: payload });
    }

    // Check in registrations collection
    const reg = await Registration.findOne({
      $or: [{ email: cleanEmail }, { teamEmail: cleanEmail }, { leadPersonalEmail: cleanEmail }],
    }).lean();

    if (reg) {
      const payload = {
        uid: reg._id,
        email: cleanEmail,
        name: reg.fullName || reg.teamLeadName || reg.name || 'Participant',
        role: 'participant',
        displayRole: 'Participant',
        registration_id: reg._id,
        teamName: reg.groupName || reg.teamName || '',
        eventTitle: reg.eventTitle || '',
      };
      const token = signToken(payload, { expiresIn: '7d' });
      return res.json({ success: true, token, user: payload });
    }

    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  })
);

// POST /api/auth/token - Issue JWT token for user session
router.post(
  '/token',
  asyncHandler(async (req, res) => {
    const { user } = req.body || {};
    if (!user || (!user.uid && !user.id && !user.email)) {
      return res.status(400).json({ success: false, error: 'Missing user identification (uid/email)' });
    }

    const uid = user.uid || user.id || user.email;
    const email = (user.email || '').toLowerCase().trim();
    const name = user.displayName || user.name || '';

    let userDoc = await User.findOne({
      $or: [{ uid }, { email }, { _id: uid }],
    }).lean();

    const role = normalizeRole(user.role || (userDoc && userDoc.role), 'participant');

    const payload = {
      uid,
      email,
      name: name || (userDoc && userDoc.name) || '',
      role,
      registration_id: user.registration_id || (userDoc && userDoc.registration_id) || '',
    };

    const token = signToken(payload, { expiresIn: '7d' });
    res.json({ success: true, token, user: payload });
  })
);

// POST /api/auth/register - Register a new user in MongoDB
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name, role = 'participant' } = req.body || {};
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { uid: cleanEmail }],
    }).lean();

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User already exists with this email' });
    }

    const normalized = normalizeRole(role, 'participant');
    const displayRole =
      normalized === 'faculty'
        ? 'Faculty Coordinator'
        : normalized === 'organizer'
        ? 'Student Organizer'
        : normalized === 'jury'
        ? 'Jury Evaluator'
        : 'Participant';

    const userId = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const newUser = new User({
      _id: userId,
      uid: userId,
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      role: normalized,
      displayRole,
      password: cleanPassword,
      status: 'Active',
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await newUser.save();

    const payload = {
      uid: newUser.uid,
      email: cleanEmail,
      name: newUser.name,
      role: normalized,
      displayRole,
      registration_id: '',
    };

    const token = signToken(payload, { expiresIn: '7d' });
    res.status(201).json({ success: true, token, user: payload });
  })
);

// PUT /api/auth/password - Update user password
router.put(
  '/password',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { password, email, userId } = req.body || {};
    const cleanPassword = (password || '').trim();
    if (!cleanPassword) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const targetEmail = (req.user && req.user.email) || email || (userId && userId.includes('@') ? userId : null) || 'admin@aiverse.in';
    const targetUid = (req.user && req.user.uid) || (userId && !userId.includes('@') ? userId : null) || targetEmail.replace(/[^a-z0-9]/g, '_');

    await User.findOneAndUpdate(
      { $or: [{ uid: targetUid }, { email: targetEmail }, { _id: targetUid }] },
      {
        $set: {
          password: cleanPassword,
          requiresPasswordChange: false,
          updated_at: Date.now(),
        },
        $setOnInsert: {
          _id: targetUid,
          uid: targetUid,
          email: targetEmail,
          name: targetEmail.includes('admin') ? 'Super Admin' : 'User',
          role: targetEmail.includes('admin') ? 'faculty' : 'participant',
          status: 'Active',
          created_at: Date.now(),
        },
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, message: 'Password updated successfully' });
  })
);

// GET /api/auth/me - Get current user profile from token
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userDoc = await User.findOne({
      $or: [{ uid: req.user.uid }, { email: req.user.email }, { _id: req.user.uid }],
    }).lean();

    res.json({
      success: true,
      user: userDoc || req.user,
    });
  })
);

module.exports = router;
