const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-ai-verse-2025';

function signToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: opts.expiresIn || '24h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing or malformed Bearer token' });
  }

  const payload = verifyToken(parts[1]);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }

  req.user = payload;
  next();
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    const payload = verifyToken(parts[1]);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const userRole = (req.user?.role || '').toLowerCase();
    const isAdmin =
      userRole.includes('admin') ||
      userRole.includes('faculty') ||
      userRole.includes('coordinator') ||
      userRole.includes('advisor') ||
      userRole.includes('super');

    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin or Faculty role required' });
    }
    next();
  });
}

// Helper: ensure sessionId matches authenticated user (format: quizId_userId)
function ensureSessionOwnership(sessionId, uid) {
  if (!sessionId || !uid) return false;
  return sessionId.endsWith(`_${uid}`) || sessionId.includes(uid);
}

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  requireAdmin,
  ensureSessionOwnership,
};
