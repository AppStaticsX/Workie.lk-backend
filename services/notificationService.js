const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
  // Create a like notification
  static async notifyLike(postId, recipientId, senderId, postContent) {
    try {
      // Don't notify if user likes their own post
      if (recipientId.toString() === senderId.toString()) {
        return null;
      }

      // Check if notification already exists for this post and sender
      const existingNotification = await Notification.findOne({
        recipient: recipientId,
        sender: senderId,
        type: 'like',
        'data.postId': postId
      });

      if (existingNotification) {
        // Update existing notification timestamp
        existingNotification.createdAt = new Date();
        existingNotification.isRead = false;
        await existingNotification.save();
        return existingNotification;
      }

      // Get sender details
      const sender = await User.findById(senderId).select('firstName lastName profilePicture');
      
      const notification = new Notification({
        recipient: recipientId,
        sender: senderId,
        type: 'like',
        title: 'New Like',
        message: `${sender.firstName} ${sender.lastName} liked your post`,
        data: {
          postId: postId,
          postContent: postContent
        }
      });

      await notification.save();

      // Populate sender details for real-time emission
      await notification.populate('sender', 'firstName lastName profilePicture');

      // Emit real-time notification if socket service is available
      try {
        const SocketService = require('./socketService');
        SocketService.emitToUser(recipientId.toString(), 'newNotification', notification);
      } catch (socketError) {
        console.warn('Socket service not available:', socketError.message);
      }

      return notification;
    } catch (error) {
      console.error('Error creating like notification:', error);
      throw error;
    }
  }

  // Create a comment notification
  static async notifyComment(postId, recipientId, senderId, comment, postContent) {
    try {
      // Don't notify if user comments on their own post
      if (recipientId.toString() === senderId.toString()) {
        return null;
      }

      // Get sender details
      const sender = await User.findById(senderId).select('firstName lastName profilePicture');
      
      const notification = new Notification({
        recipient: recipientId,
        sender: senderId,
        type: 'comment',
        title: 'New Comment',
        message: `${sender.firstName} ${sender.lastName} commented on your post`,
        data: {
          postId: postId,
          postContent: postContent,
          comment: comment
        }
      });

      await notification.save();

      // Populate sender details for real-time emission
      await notification.populate('sender', 'firstName lastName profilePicture');

      // Emit real-time notification if socket service is available
      try {
        const SocketService = require('./socketService');
        SocketService.emitToUser(recipientId.toString(), 'newNotification', notification);
      } catch (socketError) {
        console.warn('Socket service not available:', socketError.message);
      }

      return notification;
    } catch (error) {
      console.error('Error creating comment notification:', error);
      throw error;
    }
  }

  // Create a connection request notification
  static async notifyConnectionRequest(recipientId, senderId) {
    try {
      // Get sender details
      const sender = await User.findById(senderId).select('firstName lastName profilePicture');
      
      const notification = new Notification({
        recipient: recipientId,
        sender: senderId,
        type: 'connection_request',
        title: 'New Connection Request',
        message: `${sender.firstName} ${sender.lastName} sent you a connection request`,
        data: {
          connectionRequestId: senderId
        }
      });

      await notification.save();

      // Populate sender details for real-time emission
      await notification.populate('sender', 'firstName lastName profilePicture');

      // Emit real-time notification if socket service is available
      try {
        const SocketService = require('./socketService');
        SocketService.emitToUser(recipientId.toString(), 'newNotification', notification);
      } catch (socketError) {
        console.warn('Socket service not available:', socketError.message);
      }

      return notification;
    } catch (error) {
      console.error('Error creating connection request notification:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true },
        { new: true }
      );

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get user notifications
  static async getUserNotifications(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const notifications = await Notification.find({ recipient: userId })
        .populate('sender', 'firstName lastName profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments({ recipient: userId });
      const unreadCount = await Notification.countDocuments({ 
        recipient: userId, 
        isRead: false 
      });

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        unreadCount
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId) {
    try {
      await Notification.updateMany(
        { recipient: userId, isRead: false },
        { isRead: true }
      );

      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
