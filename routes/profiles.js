const express = require('express');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { validateProfile } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/profiles/search
// @desc    Search profiles by criteria (both workers and clients)
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const {
      skills,
      city,
      minRating = 0,
      availability,
      experienceLevel,
      category,
      userType, // Can be 'worker', 'client', or 'both'
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build aggregation pipeline
    const pipeline = [
      // Lookup user data
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      }
    ];

    // Match stage for user type and active status
    const userMatchStage = {
      'userInfo.isActive': true
    };

    // Add userType filter based on parameter
    if (userType && userType !== 'both') {
      userMatchStage['userInfo.userType'] = userType;
    }
    // If userType is 'both' or not specified, include both workers and clients

    pipeline.push({ $match: userMatchStage });

    // Add filters
    const matchStage = {};

    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      matchStage['skills.name'] = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
    }

    if (city) {
      matchStage['userInfo.address.city'] = new RegExp(city, 'i');
    }

    if (minRating) {
      matchStage['ratings.average'] = { $gte: parseFloat(minRating) };
    }

    if (availability) {
      matchStage['availability.status'] = availability;
    }

    if (category) {
      matchStage['preferences.jobTypes'] = category;
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add pagination and sorting
    pipeline.push(
      { $sort: { 'ratings.average': -1, completedJobs: -1 } },
      { $skip: skip },
      { $limit: limitNum }
    );

    // Project only needed fields
    pipeline.push({
      $project: {
        bio: 1,
        skills: 1,
        ratings: 1,
        completedJobs: 1,
        availability: 1,
        portfolio: 1,
        'userInfo.firstName': 1,
        'userInfo.lastName': 1,
        'userInfo.profilePicture': 1,
        'userInfo.address': 1,
        'userInfo.userType': 1,
        'userInfo.createdAt': 1
      }
    });

    const profiles = await Profile.aggregate(pipeline);

    // Get total count
    const countPipeline = pipeline.slice(0, -3); // Remove sort, skip, limit, and project
    countPipeline.push({ $count: 'total' });
    const countResult = await Profile.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        profiles,
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

// @route   GET /api/profiles/:userId
// @desc    Get user profile by user ID
// @access  Public
router.get('/:userId', async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.params.userId })
      .populate('user', 'firstName lastName profilePicture userType createdAt isVerified');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/profiles/:userId
// @desc    Update user profile
// @access  Private (Profile owner only)
router.put('/:userId', auth, validateProfile, async (req, res) => {
  try {
    // Check if user is updating their own profile
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.'
      });
    }

    let profile = await Profile.findOne({ user: req.params.userId });

    if (!profile) {
      // Create profile if it doesn't exist
      profile = await Profile.create({
        user: req.params.userId,
        ...req.body
      });
    } else {
      // Update existing profile
      profile = await Profile.findOneAndUpdate(
        { user: req.params.userId },
        req.body,
        {
          new: true,
          runValidators: true
        }
      );
    }

    await profile.populate('user', 'firstName lastName profilePicture userType');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/profiles/:userId/skills
// @desc    Add a skill to profile
// @access  Private (Profile owner only)
router.post('/:userId/skills', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { name, level, yearsOfExperience } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Skill name is required'
      });
    }

    const profile = await Profile.findOne({ user: req.params.userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if skill already exists
    const existingSkill = profile.skills.find(skill => 
      skill.name.toLowerCase() === name.toLowerCase()
    );

    if (existingSkill) {
      return res.status(400).json({
        success: false,
        message: 'Skill already exists in profile'
      });
    }

    profile.skills.push({
      name,
      level: level || 'beginner',
      yearsOfExperience: yearsOfExperience || 0
    });

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Skill added successfully',
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/profiles/:userId/skills/:skillId
// @desc    Update a skill in profile
// @access  Private (Profile owner only)
router.put('/:userId/skills/:skillId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const profile = await Profile.findOne({ user: req.params.userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const skill = profile.skills.id(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    // Update skill fields
    const { name, level, yearsOfExperience } = req.body;
    if (name) skill.name = name;
    if (level) skill.level = level;
    if (yearsOfExperience !== undefined) skill.yearsOfExperience = yearsOfExperience;

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Skill updated successfully',
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/profiles/:userId/skills/:skillId
// @desc    Remove a skill from profile
// @access  Private (Profile owner only)
router.delete('/:userId/skills/:skillId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const profile = await Profile.findOne({ user: req.params.userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const skill = profile.skills.id(req.params.skillId);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }

    skill.deleteOne();
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Skill removed successfully',
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/profiles/:userId/experience
// @desc    Add work experience to profile
// @access  Private (Profile owner only)
router.post('/:userId/experience', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { title, company, description, startDate, endDate, isCurrent, location } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Job title is required'
      });
    }

    const profile = await Profile.findOne({ user: req.params.userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    profile.experience.push({
      title,
      company,
      description,
      startDate,
      endDate: isCurrent ? null : endDate,
      isCurrent: isCurrent || false,
      location
    });

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Experience added successfully',
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/profiles/:userId/portfolio
// @desc    Add portfolio item to profile
// @access  Private (Profile owner only)
router.post('/:userId/portfolio', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { title, description, images, url, completedDate, category } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Portfolio title is required'
      });
    }

    const profile = await Profile.findOne({ user: req.params.userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    profile.portfolio.push({
      title,
      description,
      images: images || [],
      url,
      completedDate,
      category
    });

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Portfolio item added successfully',
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/profiles/:userId/availability
// @desc    Update availability status
// @access  Private (Profile owner only)
router.put('/:userId/availability', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const profile = await Profile.findOne({ user: req.params.userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const { status, hoursPerWeek, preferredWorkingHours, workingDays } = req.body;

    if (status) profile.availability.status = status;
    if (hoursPerWeek !== undefined) profile.availability.hoursPerWeek = hoursPerWeek;
    if (preferredWorkingHours) profile.availability.preferredWorkingHours = preferredWorkingHours;
    if (workingDays) profile.availability.workingDays = workingDays;

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Availability updated successfully',
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/profiles/search
// @desc    Search profiles by criteria
// @access  Public
router.get('/search/workers', async (req, res) => {
  try {
    const {
      skills,
      city,
      minRating = 0,
      availability,
      experienceLevel,
      category,
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build aggregation pipeline
    const pipeline = [
      // Lookup user data
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      // Match active workers only
      {
        $match: {
          'userInfo.userType': 'worker',
          'userInfo.isActive': true
        }
      }
    ];

    // Add filters
    const matchStage = {};

    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      matchStage['skills.name'] = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
    }

    if (city) {
      matchStage['userInfo.address.city'] = new RegExp(city, 'i');
    }

    if (minRating) {
      matchStage['ratings.average'] = { $gte: parseFloat(minRating) };
    }

    if (availability) {
      matchStage['availability.status'] = availability;
    }

    if (category) {
      matchStage['preferences.jobTypes'] = category;
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add pagination and sorting
    pipeline.push(
      { $sort: { 'ratings.average': -1, completedJobs: -1 } },
      { $skip: skip },
      { $limit: limitNum }
    );

    // Project only needed fields
    pipeline.push({
      $project: {
        bio: 1,
        skills: 1,
        ratings: 1,
        completedJobs: 1,
        availability: 1,
        portfolio: 1,
        'userInfo.firstName': 1,
        'userInfo.lastName': 1,
        'userInfo.profilePicture': 1,
        'userInfo.address': 1,
        'userInfo.createdAt': 1
      }
    });

    const profiles = await Profile.aggregate(pipeline);

    // Get total count
    const countPipeline = pipeline.slice(0, -3); // Remove sort, skip, limit, and project
    countPipeline.push({ $count: 'total' });
    const countResult = await Profile.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        profiles,
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

module.exports = router;
