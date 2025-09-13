const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { auth } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { sendEmailVerificationCode, sendPasswordResetPin, sendOtpEmail } = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // Set this in your .env file
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'uploads/';
    if (file.fieldname === 'profilePhoto') {
      uploadPath += 'profile-pictures/';
    } else if (file.fieldname === 'idPhotoFront' || file.fieldname === 'idPhotoBack') {
      uploadPath += 'worker-verification/';
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// @route   POST /api/auth/validate-token
// @desc    Validate JWT token and return user data
// @access  Public
router.post('/validate-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and populate profile
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Get user profile
    const profile = await Profile.findOne({ user: user._id });

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        user,
        profile
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during token validation',
      error: error.message
    });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { firstName, lastName, email, password, userType, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user (without userType - will be set during role selection)
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      userType: userType || undefined, // Only set if provided, otherwise leave null
      phone
    });

    // Create empty profile for the user
    await Profile.create({ user: user._id });

    // Generate 5-digit OTP
    const otp = Math.floor(10000 + Math.random() * 90000).toString();

    // Store OTP and expiry in user
    user.emailVerificationCode = otp;
    user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send OTP email (do not block response on error)
    sendOtpEmail(user.email, otp, user.firstName)
      .catch(err => console.error('Failed to send OTP email:', err));

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. OTP sent to email for verification.',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Validate password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    user.password = undefined;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const profile = await Profile.findOne({ user: req.user.id });

    res.status(200).json({
      success: true,
      data: {
        user,
        profile
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

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', auth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset PIN to email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user exists in database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address'
      });
    }

    // Only send a new PIN if there is no valid PIN
    const now = Date.now();
    if (!user.passwordResetPin || !user.passwordResetPinExpires || user.passwordResetPinExpires < now) {
      // Generate 5-digit PIN
      const resetPin = Math.floor(10000 + Math.random() * 90000).toString();
      user.passwordResetPin = resetPin;
      user.passwordResetPinExpires = now + 10 * 60 * 1000; // 10 minutes
      await user.save();
      // Send PIN via email
      try {
        await sendPasswordResetPin(user.email, user.firstName, resetPin);
      } catch (emailError) {
        console.error('Failed to send reset PIN email:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Failed to send reset PIN. Please try again.'
        });
      }
    } else {
      // If valid PIN exists, do not send another email
      return res.status(200).json({
        success: true,
        message: 'A valid PIN has already been sent to your email address. Please check your inbox.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reset PIN sent to your email address'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/auth/verify-reset-pin
// @desc    Verify password reset PIN
// @access  Public
router.post('/verify-reset-pin', async (req, res) => {
  try {
    const { email, pin } = req.body;

    if (!email || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Email and PIN are required'
      });
    }

    const user = await User.findOne({
      email,
      passwordResetPin: pin,
      passwordResetPinExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired PIN'
      });
    }

    // Generate a temporary token for password reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    
    // Clear the PIN since it's now verified
    user.passwordResetPin = undefined;
    user.passwordResetPinExpires = undefined;
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'PIN verified successfully',
      resetToken // This will be used for the final password reset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/reset-password/:token
// @desc    Reset password
// @access  Public
router.put('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;

    // Hash the token and find user
    const passwordResetToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        token
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

// @route   PUT /api/auth/change-password
// @desc    Change password for logged in user
// @access  Private
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP for email verification
// @access  Public
router.post('/verify-otp', async (req, res) => {
  console.log('Verify OTP endpoint hit:', req.body); // Debug log
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Find user with matching email and OTP
    const user = await User.findOne({ 
      email, 
      emailVerificationCode: otp,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP for email verification
// @access  Public
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new 5-digit OTP
    const otp = Math.floor(10000 + Math.random() * 90000).toString();

    // Update user with new OTP
    user.emailVerificationCode = otp;
    user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send OTP email
    await sendOtpEmail(user.email, otp, user.firstName);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: error.message
    });
  }
});

// @route   POST /api/auth/google-signin
// @desc    Google Sign-In authentication
// @access  Public
router.post('/google-signin', async (req, res) => {
  console.log('Google Sign-In request body:', req.body); // Debug log
  try {
    const { accessToken, userInfo } = req.body;
        
    if (!accessToken && !userInfo) {
      return res.status(400).json({
        success: false,
        message: 'No access token or user info provided'
      });
    }

    let payload;

    // Try to verify accessToken first
    if (accessToken) {
      try {
        // Verify accessToken by making a request to Google's userinfo endpoint
        const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
        if (response.ok) {
          const userProfile = await response.json();
          payload = {
            sub: userProfile.id,
            email: userProfile.email,
            given_name: userProfile.given_name,
            family_name: userProfile.family_name,
            picture: userProfile.picture,
            email_verified: userProfile.verified_email
          };
        }
      } catch (error) {
        console.error('Access Token verification failed:', error);
      }
    }

    // If accessToken verification failed, use userInfo as fallback
    if (!payload && userInfo && userInfo.email) {
      payload = {
        sub: userInfo.id,
        email: userInfo.email,
        given_name: userInfo.displayName ? userInfo.displayName.split(' ')[0] : '',
        family_name: userInfo.displayName ? userInfo.displayName.split(' ').slice(1).join(' ') : '',
        picture: userInfo.photoUrl,
        email_verified: true // Assume verified from Google
      };
    }

    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: 'Unable to verify Google authentication. Please try again.'
      });
    }

    // Find or create user
    let user = await User.findOne({ email: payload.email });
    
    if (!user) {
      // Create new user
      user = await User.create({
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        email: payload.email,
        password: crypto.randomBytes(16).toString('hex'), // Generate a random password
        googleId: payload.sub, // Store Google ID
        isGoogleUser: true, // Flag for Google users
        phone: '', // Phone not available from Google
        emailVerificationCode: undefined, // No need for verification code
        emailVerificationExpires: undefined,
        isEmailVerified: payload.email_verified || true,
        userType: 'worker', // Default user type
        isVerified: true,
        isActive: true,
        profilePicture: payload.picture || '',
      });
      
      // Create empty profile for the user
      await Profile.create({ user: user._id });
    } else {
      // Update existing user with Google info if needed
      let updateFields = {};
      if (!user.googleId && payload.sub) {
        updateFields.googleId = payload.sub;
        updateFields.isGoogleUser = true;
      }
      if (!user.profilePicture && payload.picture) {
        updateFields.profilePicture = payload.picture;
      }
      if (!user.isEmailVerified && payload.email_verified) {
        updateFields.isEmailVerified = true;
      }
      
      if (Object.keys(updateFields).length > 0) {
        await User.findByIdAndUpdate(user._id, updateFields);
        user = await User.findById(user._id); // Refresh user data
      }
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove password from response
    user.password = undefined;

    res.status(200).json({
      success: true,
      message: 'Google sign-in successful',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    res.status(500).json({
      success: false,
      message: 'Google sign-in failed',
      error: error.message,
    });
  }
});

// @route   POST /api/auth/worker-verification
// @desc    Submit worker verification data
// @access  Private
router.post('/worker-verification', auth, async (req, res) => {
  try {
    console.log('Worker verification request received:', req.body);
    console.log('User ID from auth middleware:', req.user?.id);
    
    const {
      categories,
      skills,
      experience,
      bio,
      dateOfBirth,
      age,
      country,
      streetAddress,
      city,
      province,
      postalCode,
      location,
      address,
      companyName,
      phone,
      profilePhotoUrl,
      idPhotoFrontUrl,
      idPhotoBackUrl
    } = req.body;

    // Validate required fields
    if (!categories || !bio || !dateOfBirth || !country || !streetAddress || !city || !province || !postalCode || !location || !address || !phone) {
      const missingFields = [];
      if (!categories) missingFields.push('categories');
      if (!bio) missingFields.push('bio');
      if (!dateOfBirth) missingFields.push('dateOfBirth');
      if (!country) missingFields.push('country');
      if (!streetAddress) missingFields.push('streetAddress');
      if (!city) missingFields.push('city');
      if (!province) missingFields.push('province');
      if (!postalCode) missingFields.push('postalCode');
      if (!location) missingFields.push('location');
      if (!address) missingFields.push('address');
      if (!phone) missingFields.push('phone');
      
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // Function to calculate age from date of birth
    const calculateAge = (dateOfBirth) => {
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    };
    
    // Calculate age from date of birth
    const calculatedAge = calculateAge(dateOfBirth);
    
    // Validate age
    if (calculatedAge < 18 || calculatedAge > 100) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 18 and 100 years old'
      });
    }

    // Find and update user profile
    let profile = await Profile.findOne({ user: req.user.id });
    
    if (!profile) {
      // Create new profile if doesn't exist
      console.log('Creating new profile for user:', req.user.id);
      profile = new Profile({ user: req.user.id });
    } else {
      console.log('Updating existing profile for user:', req.user.id);
    }

    // Parse categories if it's a string
    let parsedCategories = categories;
    if (typeof categories === 'string') {
      try {
        parsedCategories = JSON.parse(categories);
      } catch (error) {
        console.log('Error parsing categories:', error.message);
        return res.status(400).json({
          success: false,
          message: 'Invalid categories format - must be a valid JSON array'
        });
      }
    }
    
    // Validate categories array
    if (!Array.isArray(parsedCategories) || parsedCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Categories must be a non-empty array'
      });
    }

    // Update profile with worker verification data
    profile.workerCategories = parsedCategories;
    
    // Handle skills - convert string to proper format if needed
    if (skills && skills.trim()) {
      const skillsArray = skills.split(',').map(skill => ({
        name: skill.trim(),
        level: 'beginner',
        yearsOfExperience: 0
      }));
      profile.skills = skillsArray;
    }
    
    // Handle experience - convert string to proper format if needed
    if (experience && experience.trim()) {
      const experienceEntry = {
        title: 'General Experience',
        description: experience,
        isCurrent: true,
        startDate: new Date()
      };
      profile.experience = [experienceEntry];
    }
    
    profile.bio = bio;
    profile.dateOfBirth = new Date(dateOfBirth);
    profile.age = calculatedAge;
    profile.country = country;
    profile.streetAddress = streetAddress;
    profile.city = city;
    profile.province = province;
    profile.postalCode = postalCode;
    profile.workLocation = location;
    profile.preferredWorkAreas = address;
    profile.currentCompany = companyName;
    profile.phone = phone;
    
    // Store uploaded photo URLs if provided
    if (profilePhotoUrl) {
      profile.profilePicture = profilePhotoUrl;
    }
    if (idPhotoFrontUrl) {
      profile.idPhotoFront = idPhotoFrontUrl;
    }
    if (idPhotoBackUrl) {
      profile.idPhotoBack = idPhotoBackUrl;
    }
    
    profile.isWorkerVerificationSubmitted = true;
    profile.workerVerificationStatus = 'pending';
    profile.workerVerificationSubmittedAt = new Date();

    console.log('Saving profile with data:', profile.toObject());
    await profile.save();
    console.log('Profile saved successfully');

    // Update user to mark as worker if not already
    console.log('Finding user by ID:', req.user.id);
    const user = await User.findById(req.user.id);
    
    if (!user) {
      console.error('User not found with ID:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('Current user type:', user.userType);
    if (user.userType !== 'worker') {
      console.log('Updating user type from', user.userType, 'to worker');
      user.userType = 'worker';
      
      try {
        await user.save();
        console.log('User type updated successfully to:', user.userType);
        
        // Verify the update
        const updatedUser = await User.findById(req.user.id);
        console.log('Verified user type in database:', updatedUser.userType);
      } catch (userSaveError) {
        console.error('Error saving user type:', userSaveError);
        // Don't fail the whole request if user type update fails
        console.log('Continuing despite user type update failure...');
      }
    } else {
      console.log('User type already set to worker');
    }

    console.log('Worker verification completed successfully');
    res.status(200).json({
      success: true,
      message: 'Worker verification data submitted successfully',
      data: {
        profile: {
          id: profile._id,
          workerCategories: profile.workerCategories,
          bio: profile.bio,
          dateOfBirth: profile.dateOfBirth,
          age: profile.age,
          country: profile.country,
          city: profile.city,
          province: profile.province,
          workLocation: profile.workLocation,
          isWorkerVerificationSubmitted: profile.isWorkerVerificationSubmitted,
          workerVerificationStatus: profile.workerVerificationStatus,
          workerVerificationSubmittedAt: profile.workerVerificationSubmittedAt
        }
      }
    });

  } catch (error) {
    console.error('Worker verification error:', error);
    console.error('Error stack:', error.stack);
    
    // Check for specific MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    // Check for duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Profile already exists for this user'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during worker verification submission',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/auth/update-role
// @desc    Update user role (for role selection)
// @access  Private
router.put('/update-role', auth, async (req, res) => {
  try {
    const { userType } = req.body;

    // Validate userType
    if (!userType || !['worker', 'client'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Valid userType is required (worker or client)'
      });
    }

    // Find the user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Allow updating userType if it's currently null/undefined or if user is updating to same type
    if (user.userType && user.userType !== userType) {
      return res.status(400).json({
        success: false,
        message: 'User role has already been set and cannot be changed'
      });
    }

    // Update user role
    user.userType = userType;
    await user.save();

    // Create a profile if it doesn't exist
    let profile = await Profile.findOne({ user: req.user.id });
    if (!profile) {
      profile = new Profile({
        user: req.user.id,
        bio: '',
        skills: [],
        experience: [],
        portfolio: []
      });
      await profile.save();
    }

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          ...user.toJSON(),
          userType: user.userType
        },
        profile
      }
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes are working!' });
});

// Debug endpoint to test authentication
router.get('/debug', auth, (req, res) => {
  res.json({ 
    message: 'Authentication working!',
    user: {
      id: req.user._id,
      email: req.user.email,
      userType: req.user.userType,
      isActive: req.user.isActive
    }
  });
});

module.exports = router;