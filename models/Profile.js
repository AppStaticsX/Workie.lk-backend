const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  skills: [{
    name: {
      type: String,
      required: true
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'beginner'
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 0
    }
  }],
  experience: [{
    title: {
      type: String,
      required: true
    },
    company: String,
    description: String,
    startDate: Date,
    endDate: Date,
    isCurrent: {
      type: Boolean,
      default: false
    },
    location: String
  }],
  education: [{
    institution: {
      type: String,
      required: true
    },
    degree: String,
    field: String,
    startDate: Date,
    endDate: Date,
    isCurrent: {
      type: Boolean,
      default: false
    }
  }],
  certifications: [{
    name: {
      type: String,
      required: true
    },
    issuer: String,
    issueDate: Date,
    expiryDate: Date,
    credentialId: String,
    url: String
  }],
  portfolio: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    media: [{
      url: String,
      publicId: String,
      type: {
        type: String,
        enum: ['image', 'video'],
        required: true
      },
      thumbnail: String, // For video thumbnails
      format: String,
      size: Number
    }],
    images: [String], // Keep for backward compatibility
    url: String,
    completedDate: Date,
    category: String
  }],
  availability: {
    status: {
      type: String,
      enum: ['available', 'busy', 'not-available'],
      default: 'available'
    },
    hoursPerWeek: {
      type: Number,
      min: 0,
      max: 168 // Maximum hours in a week
    },
    preferredWorkingHours: {
      start: String, // e.g., "09:00"
      end: String    // e.g., "17:00"
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
  preferences: {
    jobTypes: [{
      type: String,
      enum: [
        'cleaning', 'gardening', 'plumbing', 'electrical', 'carpentry',
        'painting', 'delivery', 'tutoring', 'pet-care', 'elderly-care',
        'cooking', 'photography', 'event-planning', 'repair-services',
        'moving', 'other'
      ]
    }],
    maxDistance: {
      type: Number, // in kilometers
      default: 50
    },
    minBudget: {
      type: Number,
      default: 0
    },
    workLocationPreference: {
      type: String,
      enum: ['on-site', 'remote', 'hybrid', 'any'],
      default: 'any'
    }
  },
  ratings: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  languages: [{
    name: {
      type: String,
      required: true
    },
    proficiency: {
      type: String,
      enum: ['basic', 'conversational', 'fluent', 'native'],
      default: 'basic'
    }
  }],
  socialLinks: {
    linkedin: String,
    facebook: String,
    instagram: String,
    website: String
  },
  // Worker Verification Fields
  workerCategories: [{
    type: String
  }],
  age: {
    type: Number,
    min: 18,
    max: 100
  },
  country: String,
  streetAddress: String,
  city: String,
  postalCode: String,
  workLocation: String,
  preferredWorkAreas: String,
  currentCompany: String,
  phone: String,
  isWorkerVerificationSubmitted: {
    type: Boolean,
    default: false
  },
  workerVerificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  workerVerificationSubmittedAt: Date,
  workerVerificationApprovedAt: Date,
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDocuments: [{
    type: {
      type: String,
      enum: ['id-card', 'passport', 'driving-license', 'professional-certificate']
    },
    url: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
profileSchema.index({ user: 1 });
profileSchema.index({ 'skills.name': 1 });
profileSchema.index({ 'ratings.average': -1 });
profileSchema.index({ completedJobs: -1 });

// Virtual for experience years calculation
profileSchema.virtual('totalExperienceYears').get(function() {
  if (!this.experience || this.experience.length === 0) return 0;
  
  return this.experience.reduce((total, exp) => {
    const endDate = exp.endDate || new Date();
    const startDate = exp.startDate;
    if (!startDate) return total;
    
    const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
    return total + Math.max(0, years);
  }, 0);
});

module.exports = mongoose.model('Profile', profileSchema);
