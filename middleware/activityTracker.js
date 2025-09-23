const User = require('../models/User');

/**
 * Middleware to track user activity and update online status
 * This middleware runs on every authenticated request to keep user activity updated
 */
const trackActivity = async (req, res, next) => {
  try {
    // Only track activity if user is authenticated
    if (req.user && req.user.id) {
      // Update user's last activity and set online status to true
      await User.findByIdAndUpdate(
        req.user.id,
        {
          lastActivity: new Date(),
          isOnline: true
        },
        { new: true }
      );
    }
    
    next();
  } catch (error) {
    // Don't block the request if activity tracking fails
    console.error('Activity tracking error:', error.message);
    next();
  }
};

/**
 * Function to mark users as offline based on inactivity
 * Users are considered offline if their last activity was more than 5 minutes ago
 */
const markInactiveUsersOffline = async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    await User.updateMany(
      {
        lastActivity: { $lt: fiveMinutesAgo },
        isOnline: true
      },
      {
        isOnline: false
      }
    );
    
    console.log('Updated offline status for inactive users');
  } catch (error) {
    console.error('Error updating offline users:', error.message);
  }
};

/**
 * Start the background job to periodically mark inactive users as offline
 * Runs every 2 minutes
 */
const startOfflineStatusUpdater = () => {
  setInterval(markInactiveUsersOffline, 2 * 60 * 1000); // Every 2 minutes
  console.log('Activity tracker: Offline status updater started');
};

module.exports = {
  trackActivity,
  markInactiveUsersOffline,
  startOfflineStatusUpdater
};