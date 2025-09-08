const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  userType: {
    type: String,
    enum: ['worker', 'client', 'admin'],
    required: false
  },
  profilePicture: {
    type: String,
    default: ''
  },
  profilePicturePublicId: {
    type: String,
    default: ''
  },
  // Cover photo (Cloudinary URL)
  coverPhoto: {
    type: String,
    default: ''
  },
  coverPhotoPublicId: {
    type: String,
    default: ''
  },
  // Verification documents (Cloudinary URLs)
  verificationDocuments: {
    idPhotoFront: {
      type: String,
      default: ''
    },
    idPhotoBack: {
      type: String,
      default: ''
    },
    publicIds: {
      profilePicture: String,
      idPhotoFront: String,
      idPhotoBack: String
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  dateOfBirth: {
    type: Date
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Sri Lanka' }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordResetPin: String,
  passwordResetPinExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  emailVerificationCode: String,
  isEmailVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.passwordResetPin;
  delete userObject.passwordResetPinExpires;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.emailVerificationCode;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
