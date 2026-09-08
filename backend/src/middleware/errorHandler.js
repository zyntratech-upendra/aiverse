// Async route wrapper to catch async errors automatically
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? (err.statusCode || 500) : res.statusCode;
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

// 404 handler for unmatched routes
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Not Found - ${req.method} ${req.originalUrl}`,
  });
};

module.exports = {
  asyncHandler,
  errorHandler,
  notFoundHandler,
};
