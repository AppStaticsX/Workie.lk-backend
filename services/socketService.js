class SocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Map of userId -> socketId
  }

  // Initialize socket service with io instance
  init(io) {
    this.io = io;
    console.log('✅ Socket service initialized');
  }

  // Store user socket connection
  addUserSocket(userId, socketId) {
    this.userSockets.set(userId, socketId);
    console.log(`👤 User ${userId} connected with socket ${socketId}`);
  }

  // Remove user socket connection
  removeUserSocket(userId) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.userSockets.delete(userId);
      console.log(`👤 User ${userId} disconnected from socket ${socketId}`);
    }
  }

  // Emit event to specific user
  emitToUser(userId, event, data) {
    if (!this.io) {
      console.warn('❌ Socket service not initialized');
      return false;
    }

    console.log(`🎯 Attempting to emit ${event} to user ${userId}`);
    console.log(`📋 Current connected users:`, Array.from(this.userSockets.keys()));

    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      console.log(`✅ Successfully emitted ${event} to user ${userId} (socket: ${socketId})`);
      return true;
    } else {
      console.log(`❌ User ${userId} not connected (no socket found)`);
      console.log(`📋 Available sockets:`, Array.from(this.userSockets.entries()));
      return false;
    }
  }

  // Emit to all connected users
  emitToAll(event, data) {
    if (!this.io) {
      console.warn('Socket service not initialized');
      return false;
    }

    this.io.emit(event, data);
    console.log(`📡 Emitted ${event} to all users`);
    return true;
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.userSockets.size;
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }
}

// Export singleton instance
module.exports = new SocketService();
