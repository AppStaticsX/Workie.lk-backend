const logger = require('../utils/logger');

class CrashDetector {
  constructor() {
    this.healthCheckInterval = null;
    this.isShuttingDown = false;
    this.startTime = Date.now();
  }

  // Perform application health check
  performHealthCheck() {
    try {
      const uptime = Date.now() - this.startTime;
      const memUsage = process.memoryUsage();
      
      // Check memory usage
      const maxMemory = 500 * 1024 * 1024; // 500MB
      if (memUsage.heapUsed > maxMemory) {
        logger.error('Memory leak detected', {
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
          limit: `${Math.round(maxMemory / 1024 / 1024)} MB`,
          uptime: `${Math.round(uptime / 1000)} seconds`
        });
      }

      // Log health status periodically
      if (uptime % (5 * 60 * 1000) === 0) { // Every 5 minutes
        logger.info('Health check passed', {
          uptime: `${Math.round(uptime / 1000)} seconds`,
          memoryUsage: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
          pid: process.pid
        });
      }
    } catch (error) {
      logger.error('Health check failed', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Setup process monitoring
  setupProcessMonitors() {
    // Monitor exit events
    process.on('exit', (code) => {
      if (!this.isShuttingDown) {
        logger.error('Unexpected process exit', {
          exitCode: code,
          uptime: Date.now() - this.startTime,
          memoryUsage: process.memoryUsage()
        });
      }
    });

    // Monitor warning events
    process.on('warning', (warning) => {
      logger.warn('Node.js warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });

    // Monitor rejection events (backup to global handler)
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection in crash detector', {
        reason: reason.toString(),
        stack: reason.stack
      });
    });
  }

  // Graceful shutdown
  initiateShutdown(reason = 'Unknown') {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info('Initiating graceful shutdown', {
      reason,
      uptime: Date.now() - this.startTime
    });

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Give time for cleanup
    setTimeout(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    }, 5000);
  }
}

// Export singleton instance
module.exports = new CrashDetector();
