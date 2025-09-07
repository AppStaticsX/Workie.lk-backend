const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coverLetter: {
    type: String,
    maxlength: [1000, 'Cover letter cannot exceed 1000 characters']
  },
  proposedPrice: {
    amount: {
      type: Number,
      min: [0, 'Proposed price must be positive']
    },
    currency: {
      type: String,
      default: 'LKR'
    }
  },
  estimatedDuration: {
    type: String // e.g., "2 hours", "3 days"
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  availability: {
    startDate: Date,
    endDate: Date,
    timeSlots: [{
      day: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      startTime: String, // e.g., "09:00"
      endTime: String    // e.g., "17:00"
    }]
  },
  portfolio: [{
    title: String,
    description: String,
    images: [String],
    url: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  respondedAt: Date,
  notes: {
    worker: String,
    client: String
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate applications
applicationSchema.index({ job: 1, worker: 1 }, { unique: true });

// Indexes for queries
applicationSchema.index({ worker: 1, status: 1 });
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ createdAt: -1 });

// Pre-save middleware
applicationSchema.pre('save', async function(next) {
  if (this.isModified('status') && this.status !== 'pending' && !this.respondedAt) {
    this.respondedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Application', applicationSchema);
