const express = require('express');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { auth, authorize } = require('../middleware/auth');
const { validateJob } = require('../middleware/validation');
const cloudinaryConfig = require('../config/cloudinary');

const router = express.Router();

// @route   GET /api/jobs
// @desc    Get all jobs with filtering, sorting, and pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      city,
      minBudget,
      maxBudget,
      status = 'open',
      urgency,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (urgency) filter.urgency = urgency;
    
    // Budget range filter
    if (minBudget || maxBudget) {
      filter['budget.amount'] = {};
      if (minBudget) filter['budget.amount'].$gte = parseFloat(minBudget);
      if (maxBudget) filter['budget.amount'].$lte = parseFloat(maxBudget);
    }

    // Search in title and description
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { skills: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const jobs = await Job.find(filter)
      .populate('client', 'firstName lastName profilePicture')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Job.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        jobs,
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

// @route   GET /api/jobs/:id
// @desc    Get single job by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'firstName lastName profilePicture phone email')
      .populate('assignedWorker', 'firstName lastName profilePicture');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/jobs
// @desc    Create a new job
// @access  Private (Clients only)
router.post('/', auth, authorize('client', 'admin'), validateJob, async (req, res) => {
  try {
    const jobData = {
      ...req.body,
      client: req.user._id
    };

    const job = await Job.create(jobData);
    await job.populate('client', 'firstName lastName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/jobs/:id
// @desc    Update a job
// @access  Private (Job owner or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user owns the job or is admin
    if (job.client.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own jobs.'
      });
    }

    // Prevent updating certain fields if job is in progress
    if (job.status === 'in-progress' && req.body.status !== 'completed' && req.body.status !== 'cancelled') {
      const restrictedFields = ['budget', 'category', 'location'];
      const hasRestrictedFields = restrictedFields.some(field => req.body[field]);
      
      if (hasRestrictedFields) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify budget, category, or location while job is in progress'
        });
      }
    }

    // Enforce status transition guards
    if (req.body.status && req.body.status !== job.status) {
      const from = job.status;
      const to = req.body.status;

      const isValidTransition = (() => {
        switch (from) {
          case 'open':
            if (to === 'in-progress') {
              // Require assignedWorker (in body or already set) when moving to in-progress
              const assigned = req.body.assignedWorker || job.assignedWorker;
              return !!assigned;
            }
            return to === 'paused' || to === 'cancelled';
          case 'paused':
            return to === 'open' || to === 'cancelled';
          case 'in-progress':
            return to === 'completed' || to === 'cancelled';
          case 'completed':
          case 'cancelled':
            return false; // terminal states
          default:
            return false;
        }
      })();

      if (!isValidTransition) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${from} to ${to}`
        });
      }

      // If marking completed, set completedAt
      if (to === 'completed') {
        req.body.completedAt = new Date();
      }
    }

    job = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('client', 'firstName lastName profilePicture');

    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Job images upload (owner or admin). Accepts multiple files under 'jobImages'
if (cloudinaryConfig && cloudinaryConfig.uploadJobImage) {
  const uploadJobImages = cloudinaryConfig.uploadJobImage.array('jobImages', 5);

  router.post('/:id/images', auth, async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Check if user owns the job or is admin
      if (job.client.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. You can only modify your own jobs.' });
      }

      uploadJobImages(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ success: false, message: 'File upload error', error: err.message });
        }

        try {
          if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
          }

          const descriptions = Array.isArray(req.body.descriptions)
            ? req.body.descriptions
            : (req.body.descriptions ? [req.body.descriptions] : []);

          // Map uploaded files to Job image entries
          const newImages = req.files.map((file, idx) => ({
            url: file.path,
            publicId: file.filename,
            description: descriptions[idx] || ''
          }));

          const updated = await Job.findByIdAndUpdate(
            job._id,
            { $push: { images: { $each: newImages } } },
            { new: true, runValidators: true }
          );

          return res.status(200).json({
            success: true,
            message: 'Images uploaded and attached to job',
            data: {
              imagesAdded: newImages,
              imagesCount: updated.images.length
            }
          });
        } catch (error) {
          return res.status(500).json({ success: false, message: 'Server error', error: error.message });
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  });

  // Delete a specific job image by publicId (owner or admin)
  router.delete('/:id/images/:publicId', auth, async (req, res) => {
    try {
      const { id, publicId } = req.params;
      const job = await Job.findById(id);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      if (job.client.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. You can only modify your own jobs.' });
      }

      const exists = job.images.find(img => img.publicId === publicId);
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Image not found on this job' });
      }

      // Delete from Cloudinary first
      try {
        await cloudinaryConfig.deleteFile(publicId);
      } catch (cloudErr) {
        return res.status(500).json({ success: false, message: 'Failed to delete image from storage', error: cloudErr.message });
      }

      // Remove from DB
      await Job.updateOne(
        { _id: id },
        { $pull: { images: { publicId } } }
      );

      return res.status(200).json({ success: true, message: 'Image removed from job' });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  });
}

// @route   DELETE /api/jobs/:id
// @desc    Delete a job (soft delete)
// @access  Private (Job owner or admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user owns the job or is admin
    if (job.client.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own jobs.'
      });
    }

    // Check if job can be deleted
    if (job.status === 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a job that is in progress'
      });
    }

    // Soft delete
    job.isActive = false;
    job.status = 'cancelled';
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/jobs/:id/applications
// @desc    Get all applications for a job
// @access  Private (Job owner or admin)
router.get('/:id/applications', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user owns the job or is admin
    if (job.client.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view applications for your own jobs.'
      });
    }

    const applications = await Application.find({ job: req.params.id, isActive: true })
      .populate('worker', 'firstName lastName profilePicture email phone userType')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/jobs/:id/assign/:workerId
// @desc    Assign a job to a worker
// @access  Private (Job owner or admin)
router.post('/:id/assign/:workerId', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user owns the job or is admin
    if (job.client.toString() !== req.user._id.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if job is still open
    if (job.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Job is not available for assignment'
      });
    }

    // Check if worker has applied for this job
    const application = await Application.findOne({
      job: req.params.id,
      worker: req.params.workerId,
      status: 'pending'
    });

    if (!application) {
      return res.status(400).json({
        success: false,
        message: 'Worker has not applied for this job or application is not pending'
      });
    }

    // Update job
    job.assignedWorker = req.params.workerId;
    job.status = 'in-progress';
    await job.save();

    // Update application status
    application.status = 'accepted';
    await application.save();

    // Reject other applications
    await Application.updateMany(
      {
        job: req.params.id,
        worker: { $ne: req.params.workerId },
        status: 'pending'
      },
      { status: 'rejected' }
    );

    await job.populate('assignedWorker', 'firstName lastName profilePicture');

    res.status(200).json({
      success: true,
      message: 'Job assigned successfully',
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/jobs/:id/complete
// @desc    Mark a job as completed
// @access  Private (Job owner or assigned worker)
router.post('/:id/complete', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user is job owner or assigned worker
    const isOwner = job.client.toString() === req.user._id.toString();
    const isAssignedWorker = job.assignedWorker && job.assignedWorker.toString() === req.user._id.toString();

    if (!isOwner && !isAssignedWorker && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if job is in progress
    if (job.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Job is not in progress'
      });
    }

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job marked as completed',
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/jobs/user/my-jobs
// @desc    Get current user's jobs (posted jobs for clients, applied/assigned jobs for workers)
// @access  Private
router.get('/user/my-jobs', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let jobs = [];
    let total = 0;

    if (req.user.userType === 'client') {
      // Get jobs posted by client
      const filter = { client: req.user._id, isActive: true };
      if (status) filter.status = status;

      jobs = await Job.find(filter)
        .populate('assignedWorker', 'firstName lastName profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      total = await Job.countDocuments(filter);
    } else if (req.user.userType === 'worker') {
      // Get jobs where worker has applied or is assigned
      const applications = await Application.find({ worker: req.user._id })
        .populate({
          path: 'job',
          populate: {
            path: 'client',
            select: 'firstName lastName profilePicture'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      jobs = applications.map(app => ({
        ...app.job.toObject(),
        applicationStatus: app.status,
        applicationId: app._id
      }));

      total = await Application.countDocuments({ worker: req.user._id });
    }

    res.status(200).json({
      success: true,
      data: {
        jobs,
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