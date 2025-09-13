const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    profilePicture: { type: String, default: '' }
  },
  content: {
    type: String,
    trim: true,
    maxlength: 5000
  },
  media: [{
    url: { type: String, required: true },
    secureUrl: { type: String },
    publicId: { type: String, required: true },
    fileType: { 
      type: String, 
      enum: ['image', 'video'],
      required: true 
    },
    fileName: { type: String, required: true },
    folder: { type: String, required: true },
    size: { type: Number },
    mimetype: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  privacy: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  location: {
    type: String,
    trim: true,
    maxlength: 200
  },
  taggedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userInfo: {
      firstName: String,
      lastName: String,
      profilePicture: String
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    commentedAt: {
      type: Date,
      default: Date.now
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  shares: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  mediaCount: {
    type: Number,
    default: 0
  },
  hasMedia: {
    type: Boolean,
    default: false
  },
  engagement: {
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 }
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true, // This adds createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total engagement
postSchema.virtual('totalEngagement').get(function() {
  return this.engagement.likesCount + this.engagement.commentsCount + this.engagement.sharesCount;
});

// Index for better query performance
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ privacy: 1, createdAt: -1 });
postSchema.index({ 'likes.userId': 1 });
postSchema.index({ createdAt: -1 });

// Pre-save middleware to update engagement counts
postSchema.pre('save', function(next) {
  if (this.isModified('likes') || this.isModified('comments') || this.isModified('shares')) {
    this.engagement.likesCount = this.likes.length;
    this.engagement.commentsCount = this.comments.length;
    this.engagement.sharesCount = this.shares.length;
  }
  
  if (this.isModified('media')) {
    this.mediaCount = this.media.length;
    this.hasMedia = this.media.length > 0;
  }
  
  next();
});

// Static method to get posts with pagination
postSchema.statics.getPaginatedPosts = function(filter = {}, options = {}) {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = options;
  
  return this.find(filter)
    .populate('userId', 'firstName lastName profilePicture email role')
    .populate('taggedUsers', 'firstName lastName profilePicture')
    .sort({ [sortBy]: sortOrder })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();
};

// Static method to get feed posts
postSchema.statics.getFeedPosts = function(userId, options = {}) {
  const { page = 1, limit = 10 } = options;
  
  // For now, return public posts. Later you can add friends logic
  return this.getPaginatedPosts(
    { 
      privacy: { $in: ['public'] },
      // You can add friend logic here later
      // $or: [
      //   { privacy: 'public' },
      //   { privacy: 'friends', userId: { $in: friendIds } }
      // ]
    },
    { page, limit, sortBy: 'createdAt', sortOrder: -1 }
  );
};

module.exports = mongoose.model('Post', postSchema);
