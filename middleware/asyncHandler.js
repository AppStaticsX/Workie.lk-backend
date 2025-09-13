const logger = require('../utils/logger');

// Async error handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Async handler error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        requestId: req.requestId,
        userId: req.user ? req.user._id : 'anonymous'
      });
      next(error);
    });
  };
};

// Error boundary for route handlers
const errorBoundary = (routeHandler) => {
  return asyncHandler(async (req, res, next) => {
    try {
      await routeHandler(req, res, next);
    } catch (error) {
      logger.error('Route handler error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        requestId: req.requestId
      });
      
      // Don't throw, let error handler middleware handle it
      next(error);
    }
  });
};

module.exports = { asyncHandler, errorBoundary };
