const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    maxlength: [500, 'Review comment cannot exceed 500 characters']
  },
  categories: {
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    quality: {
      type: Number,
      min: 1,
      max: 5
    },
    timeliness: {
      type: Number,
      min: 1,
      max: 5
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  reviewType: {
    type: String,
    enum: ['client-to-worker', 'worker-to-client'],
    required: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  reportCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate reviews for the same job
reviewSchema.index({ job: 1, reviewer: 1, reviewType: 1 }, { unique: true });

// Indexes for queries
reviewSchema.index({ reviewee: 1, isVisible: 1 });
reviewSchema.index({ reviewer: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });

// Pre-save middleware to update user ratings
reviewSchema.post('save', async function() {
  const Profile = mongoose.model('Profile');
  
  // Update reviewee's average rating
  const reviews = await this.constructor.find({
    reviewee: this.reviewee,
    isVisible: true
  });
  
  if (reviews.length > 0) {
    const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    
    await Profile.findOneAndUpdate(
      { user: this.reviewee },
      {
        'ratings.average': Math.round(avgRating * 10) / 10, // Round to 1 decimal
        'ratings.count': reviews.length
      }
    );
  }
});

module.exports = mongoose.model('Review', reviewSchema);
