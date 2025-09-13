const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      logger.warn('Authentication failed: No token provided', { 
        ip: req.ip || req.connection.remoteAddress, 
        userAgent: req.get('User-Agent'),
        url: req.url,
        requestId: req.requestId
      });
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      logger.warn('Authentication failed: User not found', { 
        tokenId: decoded.id,
        ip: req.ip || req.connection.remoteAddress,
        requestId: req.requestId
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      logger.warn('Authentication failed: Account deactivated', { 
        userId: user._id,
        email: user.email,
        ip: req.ip || req.connection.remoteAddress,
        requestId: req.requestId
      });
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

// Middleware to check user roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('Authorization failed: No authenticated user', {
        requiredRoles: roles,
        url: req.url,
        method: req.method,
        requestId: req.requestId
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.userType)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user._id,
        userType: req.user.userType,
        requiredRoles: roles,
        url: req.url,
        method: req.method,
        requestId: req.requestId
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Middleware to check if user owns the resource
const checkOwnership = (Model, paramName = 'id', userField = 'user') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const resource = await Model.findById(resourceId);

      if (!resource) {
        logger.warn('Ownership check failed: Resource not found', {
          resourceId,
          model: Model.modelName,
          userId: req.user._id,
          requestId: req.requestId
        });
        return res.status(404).json({
          success: false,
          message: 'Resource not found.'
        });
      }

      // Check if user owns the resource or is admin
      if (resource[userField].toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
        logger.warn('Ownership check failed: Access denied', {
          resourceId,
          resourceOwner: resource[userField],
          userId: req.user._id,
          userType: req.user.userType,
          model: Model.modelName,
          requestId: req.requestId
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own resources.'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      logger.error('Ownership check error', {
        error: error.message,
        stack: error.stack,
        resourceId: req.params[paramName],
        model: Model.modelName,
        userId: req.user._id,
        requestId: req.requestId
      });
      res.status(500).json({
        success: false,
        message: 'Error checking resource ownership.'
      });
    }
  };
};

// Middleware to require admin access
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

module.exports = { auth, authorize, checkOwnership, requireAdmin };
