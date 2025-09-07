const express = require('express');
const Application = require('../models/Application');
const Job = require('../models/Job');
const { auth, authorize } = require('../middleware/auth');
const { validateApplication } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/applications
// @desc    Create a new job application
// @access  Private (Workers only)
router.post('/', auth, authorize('worker'), validateApplication, async (req, res) => {
  try {
    const { job: jobId, coverLetter, proposedPrice, estimatedDuration, availability, portfolio } = req.body;

    // Check if job exists and is open
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Job is no longer open for applications'
      });
    }

    // Check if worker has already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      worker: req.user._id,
      isActive: true
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    // Check if applications limit reached
    const applicationsCount = await Application.countDocuments({
      job: jobId,
      isActive: true
    });

    if (applicationsCount >= job.maxApplicants) {
      return res.status(400).json({
        success: false,
        message: 'This job has reached the maximum number of applications'
      });
    }

    // Create application
    const application = await Application.create({
      job: jobId,
      worker: req.user._id,
      coverLetter,
      proposedPrice,
      estimatedDuration,
      availability,
      portfolio
    });

    // Update job applications count
    await Job.findByIdAndUpdate(jobId, {
      $inc: { applicationsCount: 1 }
    });

    await application.populate([
      { path: 'worker', select: 'firstName lastName profilePicture' },
      { path: 'job', select: 'title category budget' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/applications
// @desc    Get current user's applications
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = { worker: req.user._id, isActive: true };
    if (status) filter.status = status;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const applications = await Application.find(filter)
      .populate('job', 'title category budget location status client')
      .populate({
        path: 'job',
        populate: {
          path: 'client',
          select: 'firstName lastName profilePicture'
        }
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const total = await Application.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        applications,
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

// @route   GET /api/applications/:id
// @desc    Get single application by ID
// @access  Private (Application owner, job owner, or admin)
router.get('/:id', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('worker', 'firstName lastName profilePicture phone email')
      .populate({
        path: 'worker',
        populate: {
          path: 'profile',
          model: 'Profile',
          select: 'bio skills ratings completedJobs'
        }
      })
      .populate('job', 'title category budget location client');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check access permissions
    const isWorker = application.worker._id.toString() === req.user._id.toString();
    const isJobOwner = application.job.client.toString() === req.user._id.toString();
    const isAdmin = req.user.userType === 'admin';

    if (!isWorker && !isJobOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/applications/:id
// @desc    Update application
// @access  Private (Application owner only, before response)
router.put('/:id', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if user owns the application
    if (application.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own applications.'
      });
    }

    // Check if application is still pending
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update application after it has been responded to'
      });
    }

    const allowedFields = ['coverLetter', 'proposedPrice', 'estimatedDuration', 'availability', 'portfolio', 'notes.worker'];
    const updateData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          if (!updateData[parent]) updateData[parent] = {};
          updateData[parent][child] = req.body[field];
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate([
      { path: 'worker', select: 'firstName lastName profilePicture' },
      { path: 'job', select: 'title category budget' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      data: updatedApplication
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/applications/:id/accept
// @desc    Accept an application
// @access  Private (Job owner only)
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate('job');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if user owns the job
    if (application.job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if application is pending
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Application has already been responded to'
      });
    }

    // Check if job is still open
    if (application.job.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Job is no longer open'
      });
    }

    // Accept the application
    application.status = 'accepted';
    await application.save();

    // Update job status and assign worker
    await Job.findByIdAndUpdate(application.job._id, {
      status: 'in-progress',
      assignedWorker: application.worker
    });

    // Reject other pending applications for this job
    await Application.updateMany(
      {
        job: application.job._id,
        _id: { $ne: application._id },
        status: 'pending'
      },
      { status: 'rejected' }
    );

    res.status(200).json({
      success: true,
      message: 'Application accepted successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/applications/:id/reject
// @desc    Reject an application
// @access  Private (Job owner only)
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const application = await Application.findById(req.params.id).populate('job');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if user owns the job
    if (application.job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if application is pending
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Application has already been responded to'
      });
    }

    // Reject the application
    application.status = 'rejected';
    if (reason) {
      application.notes = application.notes || {};
      application.notes.client = reason;
    }
    await application.save();

    res.status(200).json({
      success: true,
      message: 'Application rejected successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/applications/:id/withdraw
// @desc    Withdraw an application
// @access  Private (Application owner only)
router.post('/:id/withdraw', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if user owns the application
    if (application.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if application can be withdrawn
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw application after it has been responded to'
      });
    }

    // Withdraw the application
    application.status = 'withdrawn';
    application.isActive = false;
    await application.save();

    // Update job applications count
    await Job.findByIdAndUpdate(application.job, {
      $inc: { applicationsCount: -1 }
    });

    res.status(200).json({
      success: true,
      message: 'Application withdrawn successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/applications/stats/overview
// @desc    Get application statistics for current user
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    let stats = {};

    if (req.user.userType === 'worker') {
      // Worker statistics
      const totalApplications = await Application.countDocuments({
        worker: req.user._id,
        isActive: true
      });

      const acceptedApplications = await Application.countDocuments({
        worker: req.user._id,
        status: 'accepted',
        isActive: true
      });

      const pendingApplications = await Application.countDocuments({
        worker: req.user._id,
        status: 'pending',
        isActive: true
      });

      const rejectedApplications = await Application.countDocuments({
        worker: req.user._id,
        status: 'rejected',
        isActive: true
      });

      stats = {
        totalApplications,
        acceptedApplications,
        pendingApplications,
        rejectedApplications,
        acceptanceRate: totalApplications > 0 ? ((acceptedApplications / totalApplications) * 100).toFixed(2) : 0
      };
    } else if (req.user.userType === 'client') {
      // Client statistics
      const jobs = await Job.find({ client: req.user._id, isActive: true });
      const jobIds = jobs.map(job => job._id);

      const totalApplicationsReceived = await Application.countDocuments({
        job: { $in: jobIds },
        isActive: true
      });

      const pendingApplications = await Application.countDocuments({
        job: { $in: jobIds },
        status: 'pending',
        isActive: true
      });

      stats = {
        totalJobs: jobs.length,
        totalApplicationsReceived,
        pendingApplications,
        averageApplicationsPerJob: jobs.length > 0 ? (totalApplicationsReceived / jobs.length).toFixed(2) : 0
      };
    }

    res.status(200).json({
      success: true,
      data: stats
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
