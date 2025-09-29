const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const profileRoutes = require('./routes/profiles');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const mediaRoutes = require('./routes/media');
const connectionRoutes = require('./routes/connections');
const analyticsRoutes = require('./routes/analytics');
const postRoutes = require('./routes/posts'); // New: Posts route

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// Basic error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting - More lenient in development
const limiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'development' ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 minute in dev, 15 minutes in prod
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // 1000 requests in dev, 100 in prod
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: process.env.NODE_ENV === 'development' ? '1 minute' : '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and OPTIONS requests in development
    if (process.env.NODE_ENV === 'development' && 
        (req.url === '/api/health' || req.method === 'OPTIONS')) {
      return true;
    }
    return false;
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5174', // Vite dev server alternative port
    'http://localhost:3000'  // Allow React dev server port too
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Additional CORS headers middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB with comprehensive error handling
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workie_db', {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  heartbeatFrequencyMS: 2000,     // Check every 2 seconds
  maxPoolSize: 10,                // Connection pool size
  minPoolSize: 1,                 // Minimum connections
  maxIdleTimeMS: 30000,          // Close connections after 30 seconds of inactivity
})
.then(() => {
  console.log('MongoDB connected successfully');
})
.catch(err => {
  console.error('MongoDB connection failed:', err.message);
  process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Handle MongoDB connection errors during runtime
mongoose.connection.on('close', () => {
  console.log('MongoDB connection closed');
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/posts', postRoutes); // New: Posts routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthStatus = {
    status: 'OK',
    message: 'Workie.lk API is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
  };

  const statusCode = mongoose.connection.readyState === 1 ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Create HTTP server and Socket.IO instance
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
  }
});

// Initialize Socket.IO service
const SocketService = require('./services/socketService');
SocketService.init(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`📡 New socket connection: ${socket.id}`);

  // Handle user authentication and store socket
  socket.on('authenticate', (userId) => {
    console.log(`🔐 Authenticate request from socket ${socket.id} for user: ${userId}`);
    if (userId) {
      SocketService.addUserSocket(userId, socket.id);
      socket.join(`user_${userId}`); // Join user-specific room
      console.log(`✅ User ${userId} authenticated and joined room user_${userId}`);
    } else {
      console.warn(`❌ Invalid userId provided for authentication: ${userId}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`📡 User disconnected: ${socket.id}`);
    // Find and remove user from socket mapping
    for (const [userId, socketId] of SocketService.userSockets.entries()) {
      if (socketId === socket.id) {
        SocketService.removeUserSocket(userId);
        break;
      }
    }
  });

  // Handle notification acknowledgments
  socket.on('notificationRead', (notificationId) => {
    // Handle marking notification as read
    console.log(`📖 Notification ${notificationId} marked as read`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

// Handle server timeout
server.timeout = 120000; // 2 minutes timeout

module.exports = { app, server, io };
