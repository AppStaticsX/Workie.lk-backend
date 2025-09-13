const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logger utility with different levels
class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
    this.errorFile = path.join(logsDir, 'error.log');
    this.crashFile = path.join(logsDir, 'crashes.log');
  }

  // Format log message
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta,
      pid: process.pid,
      memory: process.memoryUsage()
    };
    
    return JSON.stringify(logEntry);
  }

  // Write to file
  writeToFile(filePath, message) {
    try {
      fs.appendFileSync(filePath, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // Console output with colors
  consoleOutput(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[35m', // Magenta
      reset: '\x1b[0m'   // Reset
    };

    const color = colors[level] || colors.reset;
    console.log(`${color}[${timestamp}] [${level.toUpperCase()}] ${message}${colors.reset}`);
    
    if (Object.keys(meta).length > 0) {
      console.log(`${color}[META]${colors.reset}`, meta);
    }
  }

  // Log methods
  error(message, meta = {}) {
    const formattedMessage = this.formatMessage('error', message, meta);
    this.consoleOutput('error', message, meta);
    this.writeToFile(this.errorFile, formattedMessage);
    this.writeToFile(this.logFile, formattedMessage);
  }

  warn(message, meta = {}) {
    const formattedMessage = this.formatMessage('warn', message, meta);
    this.consoleOutput('warn', message, meta);
    this.writeToFile(this.logFile, formattedMessage);
  }

  info(message, meta = {}) {
    const formattedMessage = this.formatMessage('info', message, meta);
    this.consoleOutput('info', message, meta);
    this.writeToFile(this.logFile, formattedMessage);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('debug', message, meta);
      this.consoleOutput('debug', message, meta);
      this.writeToFile(this.logFile, formattedMessage);
    }
  }

  // Log crash information
  logCrash(error, context = '') {
    const crashInfo = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform
    };

    const crashMessage = this.formatMessage('crash', 'Server crash detected', crashInfo);
    this.consoleOutput('error', `CRASH DETECTED: ${error.message}`, crashInfo);
    this.writeToFile(this.crashFile, crashMessage);
    this.writeToFile(this.errorFile, crashMessage);
  }

  // Log request information
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user ? req.user._id : 'anonymous'
    };

    const level = res.statusCode >= 400 ? 'error' : 'info';
    this[level](`${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`, logData);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
