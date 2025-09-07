const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    maxlength: [2000, 'Job description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Job category is required'],
    enum: [
      'cleaning',
      'gardening',
      'plumbing',
      'electrical',
      'carpentry',
      'painting',
      'delivery',
      'tutoring',
      'pet-care',
      'elderly-care',
      'cooking',
      'photography',
      'event-planning',
      'repair-services',
      'moving',
      'other'
    ]
  },
  budget: {
    amount: {
      type: Number,
      required: [true, 'Budget amount is required'],
      min: [0, 'Budget amount must be positive']
    },
    currency: {
      type: String,
      default: 'LKR'
    },
    type: {
      type: String,
      enum: ['fixed', 'hourly', 'negotiable'],
      default: 'fixed'
    }
  },
  location: {
    address: {
      type: String,
      required: [true, 'Job location is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requirements: [{
    type: String,
    trim: true
  }],
  skills: [{
    type: String,
    trim: true
  }],
  duration: {
    estimated: String, // e.g., "2 hours", "1 day", "1 week"
    startDate: Date,
    endDate: Date,
    isFlexible: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'completed', 'cancelled', 'paused'],
    default: 'open'
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  images: [{
    url: String,
    description: String
  }],
  applicationsCount: {
    type: Number,
    default: 0
  },
  maxApplicants: {
    type: Number,
    default: 50
  },
  isRemote: {
    type: Boolean,
    default: false
  },
  experienceLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'expert', 'any'],
    default: 'any'
  },
  assignedWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
jobSchema.index({ category: 1, status: 1 });
jobSchema.index({ 'location.city': 1, status: 1 });
jobSchema.index({ client: 1, status: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ 'budget.amount': 1 });

// Virtual for applications
jobSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'job'
});

// Pre-save middleware to update applications count
jobSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('status')) {
    // Additional logic can be added here
  }
  next();
});

module.exports = mongoose.model('Job', jobSchema);
