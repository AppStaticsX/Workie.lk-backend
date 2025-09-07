const express = require('express');
const Review = require('../models/Review');
const Job = require('../models/Job');
const { auth } = require('../middleware/auth');
const { validateReview } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/reviews
// @desc    Create a new review
// @access  Private
router.post('/', auth, validateReview, async (req, res) => {
  try {
    const { job: jobId, reviewee, rating, comment, categories, reviewType } = req.body;

    // Check if job exists and is completed
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only review completed jobs'
      });
    }

    // Validate review permissions
    let validReview = false;
    let determinedReviewType = '';

    if (job.client.toString() === req.user._id.toString() && 
        job.assignedWorker && job.assignedWorker.toString() === reviewee) {
      // Client reviewing worker
      validReview = true;
      determinedReviewType = 'client-to-worker';
    } else if (job.assignedWorker && job.assignedWorker.toString() === req.user._id.toString() && 
               job.client.toString() === reviewee) {
      // Worker reviewing client
      validReview = true;
      determinedReviewType = 'worker-to-client';
    }

    if (!validReview) {
      return res.status(403).json({
        success: false,
        message: 'You can only review people you have worked with on this job'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      job: jobId,
      reviewer: req.user._id,
      reviewType: determinedReviewType
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this person for this job'
      });
    }

    // Create review
    const review = await Review.create({
      job: jobId,
      reviewer: req.user._id,
      reviewee,
      rating,
      comment,
      categories,
      reviewType: determinedReviewType
    });

    await review.populate([
      { path: 'reviewer', select: 'firstName lastName profilePicture' },
      { path: 'reviewee', select: 'firstName lastName profilePicture' },
      { path: 'job', select: 'title category' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/reviews/user/:userId
// @desc    Get reviews for a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      rating,
      reviewType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {
      reviewee: req.params.userId,
      isVisible: true
    };

    if (rating) filter.rating = parseInt(rating);
    if (reviewType) filter.reviewType = reviewType;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reviews = await Review.find(filter)
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('job', 'title category')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const total = await Review.countDocuments(filter);

    // Calculate rating statistics
    const ratingStats = await Review.aggregate([
      { $match: { reviewee: req.params.userId, isVisible: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      },
      {
        $project: {
          averageRating: { $round: ['$averageRating', 1] },
          totalReviews: 1,
          ratingCounts: {
            5: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 5] } } } },
            4: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 4] } } } },
            3: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 3] } } } },
            2: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 2] } } } },
            1: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 1] } } } }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        },
        statistics: ratingStats.length > 0 ? ratingStats[0] : {
          averageRating: 0,
          totalReviews: 0,
          ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
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

// @route   GET /api/reviews/:id
// @desc    Get single review by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('reviewee', 'firstName lastName profilePicture')
      .populate('job', 'title category budget');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (!review.isVisible) {
      return res.status(404).json({
        success: false,
        message: 'Review not available'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/reviews/:id
// @desc    Update review
// @access  Private (Review owner only, within time limit)
router.put('/:id', auth, validateReview, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own reviews.'
      });
    }

    // Check if review can still be edited (within 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    if (review.createdAt < twentyFourHoursAgo) {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be edited within 24 hours of creation'
      });
    }

    const allowedFields = ['rating', 'comment', 'categories'];
    const updateData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate([
      { path: 'reviewer', select: 'firstName lastName profilePicture' },
      { path: 'reviewee', select: 'firstName lastName profilePicture' },
      { path: 'job', select: 'title category' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: updatedReview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete review (hide review)
// @access  Private (Review owner or admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check permissions
    const isOwner = review.reviewer.toString() === req.user._id.toString();
    const isAdmin = req.user.userType === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Hide review instead of deleting
    review.isVisible = false;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review hidden successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/reviews/:id/helpful
// @desc    Mark review as helpful
// @access  Private
router.post('/:id/helpful', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Increment helpful count
    review.helpfulCount += 1;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review marked as helpful',
      data: { helpfulCount: review.helpfulCount }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/reviews/:id/report
// @desc    Report a review
// @access  Private
router.post('/:id/report', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Report reason is required'
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Increment report count
    review.reportCount += 1;
    await review.save();

    // In a real application, you would also create a report record
    // and potentially hide the review if it gets too many reports

    res.status(200).json({
      success: true,
      message: 'Review reported successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/reviews/job/:jobId
// @desc    Get reviews for a specific job
// @access  Private (Job participants only)
router.get('/job/:jobId', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user is involved in this job
    const isClient = job.client.toString() === req.user._id.toString();
    const isWorker = job.assignedWorker && job.assignedWorker.toString() === req.user._id.toString();

    if (!isClient && !isWorker && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const reviews = await Review.find({ job: req.params.jobId })
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('reviewee', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reviews
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
