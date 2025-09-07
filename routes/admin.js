const express = require('express');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Middleware to require admin access for all admin routes
router.use(auth);
router.use(requireAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Admin only
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalWorkers,
      totalClients,
      totalJobs,
      activeJobs,
      completedJobs,
      totalApplications,
      pendingApplications,
      recentUsers,
      recentJobs,
      recentApplications
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ userType: 'worker' }),
      User.countDocuments({ userType: 'client' }),
      Job.countDocuments(),
      Job.countDocuments({ status: 'open' }),
      Job.countDocuments({ status: 'completed' }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'pending' }),
      User.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName userType createdAt'),
      Job.find().sort({ createdAt: -1 }).limit(5).populate('client', 'firstName lastName').select('title status createdAt'),
      Application.find().sort({ createdAt: -1 }).limit(5).select('status createdAt')
    ]);

    // Calculate monthly revenue (mock data for now)
    const monthlyRevenue = Math.floor(Math.random() * 10000) + 5000;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalWorkers,
        totalClients,
        totalJobs,
        activeJobs,
        completedJobs,
        totalApplications,
        pendingApplications,
        monthlyRevenue,
        recentUsers,
        recentJobs,
        recentApplications
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filtering
// @access  Admin only
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const userType = req.query.userType || '';

    // Build query
    let query = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (userType && userType !== 'all') {
      query.userType = userType;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users,
        totalPages,
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PATCH /api/admin/users/:id/activate
// @desc    Activate/deactivate user
// @access  Admin only
router.patch('/users/:id/activate', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  } catch (error) {
    console.error('Admin user activate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/jobs
// @desc    Get all jobs with pagination and filtering
// @access  Admin only
router.get('/jobs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    // Build query
    let query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && status !== 'all') {
      query.status = status;
    }

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .populate('client', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Job.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        jobs,
        totalPages,
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Admin jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/applications
// @desc    Get all applications with pagination and filtering
// @access  Admin only
router.get('/applications', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';

    // Build query
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('worker', 'firstName lastName email')
        .populate('job', 'title budget location client')
        .populate('job.client', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        applications,
        totalPages,
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Admin applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/reviews
// @desc    Get all reviews with pagination and filtering
// @access  Admin only
router.get('/reviews', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const rating = req.query.rating || '';

    // Build query
    let query = {};
    if (rating && rating !== 'all') {
      query.rating = parseInt(rating);
    }

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('reviewer', 'firstName lastName')
        .populate('reviewee', 'firstName lastName')
        .populate('job', 'title budget')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        reviews,
        totalPages,
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Admin reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/reports
// @desc    Get admin reports and analytics
// @access  Admin only
router.get('/reports/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let data = {};

    switch (type) {
      case 'user-stats':
        const totalUsers = await User.countDocuments();
        const newUsers = await User.countDocuments({ createdAt: { $gte: startDate } });
        const activeUsers = await User.countDocuments({ isActive: true });
        
        data = {
          totalUsers,
          newUsersThisMonth: newUsers,
          activeUsers,
          userGrowthRate: totalUsers > 0 ? Math.round((newUsers / totalUsers) * 100) : 0
        };
        break;

      case 'job-stats':
        const totalJobs = await Job.countDocuments();
        const recentJobs = await Job.countDocuments({ createdAt: { $gte: startDate } });
        const completedJobs = await Job.countDocuments({ status: 'completed' });
        
        data = {
          totalJobs,
          jobsThisMonth: recentJobs,
          completedJobs,
          averageJobValue: 450 // Mock data
        };
        break;

      case 'revenue-stats':
        // Mock revenue data - in real implementation, calculate from payments
        data = {
          totalRevenue: 45000,
          monthlyRevenue: 8500,
          averageTransactionValue: 520,
          revenueGrowthRate: 12.8
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/admin/notifications
// @desc    Create and send admin notification
// @access  Admin only
router.post('/notifications', async (req, res) => {
  try {
    const { title, message, type, targetAudience } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Get target users based on audience
    let targetUsers = [];
    if (targetAudience === 'workers') {
      targetUsers = await User.find({ userType: 'worker' }).select('_id');
    } else if (targetAudience === 'clients') {
      targetUsers = await User.find({ userType: 'client' }).select('_id');
    } else {
      targetUsers = await User.find().select('_id');
    }

    // Create notifications for each target user
    const notifications = targetUsers.map(user => ({
      user: user._id,
      title,
      message,
      type: type || 'info',
      createdBy: req.user.id
    }));

    await Notification.insertMany(notifications);

    res.json({
      success: true,
      message: 'Notifications sent successfully',
      data: {
        recipientCount: targetUsers.length
      }
    });
  } catch (error) {
    console.error('Admin notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/notifications
// @desc    Get admin sent notifications
// @access  Admin only
router.get('/notifications', async (req, res) => {
  try {
    // Mock data for admin notifications
    const notifications = [
      {
        _id: '1',
        title: 'Welcome to Workie.lk',
        message: 'Thank you for joining our platform.',
        type: 'info',
        createdAt: new Date(),
        recipients: 45,
        readCount: 32
      }
    ];

    res.json({
      success: true,
      data: { notifications }
    });
  } catch (error) {
    console.error('Admin get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
