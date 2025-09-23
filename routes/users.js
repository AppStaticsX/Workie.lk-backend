const express = require('express');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      userType,
      isActive,
      search
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {};
    if (userType) filter.userType = userType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's profile
    const profile = await Profile.findOne({ user: req.params.id });

    res.status(200).json({
      success: true,
      data: {
        user,
        profile
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Own profile or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user is updating their own profile or is admin
    if (req.params.id !== req.user._id.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.'
      });
    }

    const allowedFields = ['firstName', 'lastName', 'phone', 'profilePicture', 'address'];
    const updateData = {};

    // Only allow certain fields to be updated
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Admin can update additional fields
    if (req.user.userType === 'admin') {
      const adminFields = ['userType', 'isActive', 'isVerified'];
      adminFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete)
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete - deactivate user
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/users/:id/activate
// @desc    Activate user
// @access  Private (Admin only)
router.post('/:id/activate', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/workers/search
// @desc    Search workers by skills and location
// @access  Public
router.get('/workers/search', async (req, res) => {
  try {
    const {
      skills,
      city,
      minRating = 0,
      maxDistance,
      availability,
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build aggregation pipeline
    const pipeline = [
      // Match users who are workers and active
      {
        $match: {
          userType: 'worker',
          isActive: true
        }
      },
      // Lookup profiles
      {
        $lookup: {
          from: 'profiles',
          localField: '_id',
          foreignField: 'user',
          as: 'profile'
        }
      },
      {
        $unwind: '$profile'
      }
    ];

    // Add filters
    const matchStage = {};

    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      matchStage['profile.skills.name'] = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
    }

    if (city) {
      matchStage['address.city'] = new RegExp(city, 'i');
    }

    if (minRating) {
      matchStage['profile.ratings.average'] = { $gte: parseFloat(minRating) };
    }

    if (availability) {
      matchStage['profile.availability.status'] = availability;
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add pagination
    pipeline.push(
      { $sort: { 'profile.ratings.average': -1, 'profile.completedJobs': -1 } },
      { $skip: skip },
      { $limit: limitNum }
    );

    // Project only needed fields
    pipeline.push({
      $project: {
        firstName: 1,
        lastName: 1,
        profilePicture: 1,
        address: 1,
        createdAt: 1,
        'profile.bio': 1,
        'profile.skills': 1,
        'profile.ratings': 1,
        'profile.completedJobs': 1,
        'profile.availability': 1
      }
    });

    const workers = await User.aggregate(pipeline);

    // Get total count
    const countPipeline = pipeline.slice(0, -3); // Remove sort, skip, limit, and project
    countPipeline.push({ $count: 'total' });
    const countResult = await User.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        workers,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics (admin only)
// @access  Private (Admin)
router.get('/stats/overview', auth, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalWorkers = await User.countDocuments({ userType: 'worker' });
    const totalClients = await User.countDocuments({ userType: 'client' });
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true });

    // Users registered in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalWorkers,
        totalClients,
        activeUsers,
        verifiedUsers,
        recentUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/online
// @desc    Get all online users
// @access  Private
router.get('/online', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      userType 
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter for online users
    const filter = {
      isOnline: true,
      _id: { $ne: req.user.id } // Exclude current user
    };

    if (userType) {
      filter.userType = userType;
    }

    const onlineUsers = await User.find(filter)
      .select('firstName lastName email profilePicture isOnline lastActivity userType')
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('profilePicture');

    const totalOnline = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users: onlineUsers,
        pagination: {
          current: pageNum,
          total: Math.ceil(totalOnline / limitNum),
          count: onlineUsers.length,
          totalOnline
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error getting online users',
      error: error.message
    });
  }
});

// @route   GET /api/users/online/count
// @desc    Get count of online users
// @access  Private
router.get('/online/count', auth, async (req, res) => {
  try {
    const { userType } = req.query;
    
    const filter = { isOnline: true };
    if (userType) {
      filter.userType = userType;
    }

    const onlineCount = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        onlineCount,
        userType: userType || 'all'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error getting online count',
      error: error.message
    });
  }
});

// @route   PUT /api/users/status/offline
// @desc    Manually set user status to offline
// @access  Private
router.put('/status/offline', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      {
        isOnline: false,
        lastActivity: new Date()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Status updated to offline'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating status',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id/status
// @desc    Get specific user's online status
// @access  Private
router.get('/:id/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('firstName lastName isOnline lastActivity');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate if user should be considered online
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isCurrentlyOnline = user.isOnline && user.lastActivity > fiveMinutesAgo;

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        isOnline: isCurrentlyOnline,
        lastActivity: user.lastActivity,
        lastSeen: user.lastActivity
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error getting user status',
      error: error.message
    });
  }
});

module.exports = router;
