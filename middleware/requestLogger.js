const logger = require('../utils/logger');

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Add request ID for tracking
  req.requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  res.set('X-Request-ID', req.requestId);

  // Log incoming request
  logger.debug(`Incoming request: ${req.method} ${req.url}`, {
    requestId: req.requestId,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const responseTime = Date.now() - startTime;
    
    // Log the response
    logger.logRequest(req, res, responseTime);
    
    return originalJson.call(this, body);
  };

  // Handle response end
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Log if not already logged by res.json override
    if (res.headersSent && !res.locals.logged) {
      logger.logRequest(req, res, responseTime);
    }
    
    res.locals.logged = true;
  });

  next();
};

module.exports = requestLogger;
