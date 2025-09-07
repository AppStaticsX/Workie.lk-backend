
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Profile = require('../models/Profile');

// Test if Cloudinary import works
let cloudinaryConfig;
try {
  cloudinaryConfig = require('../config/cloudinary');
  console.log('✅ Cloudinary config imported successfully');
  console.log('Available exports:', Object.keys(cloudinaryConfig));
} catch (error) {
  console.error('❌ Error importing Cloudinary config:', error.message);
}

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Media routes are working with Cloudinary only!',
    cloudinaryLoaded: !!cloudinaryConfig,
    availableUploaders: cloudinaryConfig ? Object.keys(cloudinaryConfig) : []
  });
});

// Profile picture upload route (uploads to Cloudinary + saves URL to MongoDB)
if (cloudinaryConfig && cloudinaryConfig.uploadProfilePicture) {
  const upload = cloudinaryConfig.uploadProfilePicture.single('profilePicture');
  router.post('/profile-picture', auth, (req, res, next) => {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }
      
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        // STEP 1: Image is already uploaded to Cloudinary by multer
        const cloudinaryUrl = req.file.path;
        const publicId = req.file.filename;

        // STEP 2: Save Cloudinary URL to MongoDB
        const updatedUser = await User.findByIdAndUpdate(
          req.user._id,
          { 
            profilePicture: cloudinaryUrl,
            profilePicturePublicId: publicId // Store for deletion later
          },
          { new: true }
        ).select('-password');

        if (!updatedUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        // STEP 3: Return success response with MongoDB data
        res.json({
          message: 'Profile picture uploaded and saved successfully!',
          user: {
            id: updatedUser._id,
            profilePicture: updatedUser.profilePicture,
            profilePicturePublicId: updatedUser.profilePicturePublicId
          },
          cloudinary: {
            url: cloudinaryUrl,
            publicId: publicId,
            optimizedUrl: cloudinaryConfig.generateOptimizedUrl ? 
              cloudinaryConfig.generateOptimizedUrl(publicId) : cloudinaryUrl
          }
        });

      } catch (error) {
        console.error('Profile picture upload error:', error);
        res.status(500).json({ message: 'Server error during file upload' });
      }
    });
  });
} else {
  console.log('⚠️ Profile picture uploader not available');
}

// Cover photo upload route (uploads to Cloudinary + saves URL to MongoDB)
if (cloudinaryConfig && cloudinaryConfig.uploadCoverPhoto) {
  const upload = cloudinaryConfig.uploadCoverPhoto.single('coverPhoto');
  router.post('/cover-photo', auth, (req, res, next) => {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }
      
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        // STEP 1: Image is already uploaded to Cloudinary by multer
        const cloudinaryUrl = req.file.path;
        const publicId = req.file.filename;

        // STEP 2: Save Cloudinary URL to MongoDB
        const updatedUser = await User.findByIdAndUpdate(
          req.user._id,
          { 
            coverPhoto: cloudinaryUrl,
            coverPhotoPublicId: publicId // Store for deletion later
          },
          { new: true }
        ).select('-password');

        if (!updatedUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        // STEP 3: Return success response with MongoDB data
        res.json({
          message: 'Cover photo uploaded and saved successfully!',
          user: {
            id: updatedUser._id,
            coverPhoto: updatedUser.coverPhoto,
            coverPhotoPublicId: updatedUser.coverPhotoPublicId
          },
          cloudinary: {
            url: cloudinaryUrl,
            publicId: publicId,
            optimizedUrl: cloudinaryConfig.generateOptimizedUrl ? 
              cloudinaryConfig.generateOptimizedUrl(publicId) : cloudinaryUrl
          }
        });

      } catch (error) {
        console.error('Cover photo upload error:', error);
        res.status(500).json({ message: 'Server error during file upload' });
      }
    });
  });
} else {
  console.log('⚠️ Cover photo uploader not available');
}

// Portfolio upload route (uploads multiple files to Cloudinary + saves URLs to MongoDB)
if (cloudinaryConfig && cloudinaryConfig.uploadPortfolio) {
  const portfolioUpload = cloudinaryConfig.uploadPortfolio.array('portfolioFiles', 10);
  router.post('/portfolio', auth, (req, res, next) => {
    portfolioUpload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }
      
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ message: 'No files uploaded' });
        }

        // STEP 1: Files are already uploaded to Cloudinary by multer
        const uploadedFiles = req.files.map(file => ({
          url: file.path,
          publicId: file.filename,
          resourceType: file.resource_type,
          format: file.format,
          optimizedUrl: cloudinaryConfig.generateOptimizedUrl ? 
            cloudinaryConfig.generateOptimizedUrl(file.filename) : file.path
        }));

        // STEP 2: Save Cloudinary URLs to MongoDB
        let profile = await Profile.findOne({ user: req.user._id });
        if (!profile) {
          profile = new Profile({ user: req.user._id, portfolio: [] });
        }

        // Add new files to existing portfolio
        profile.portfolio.push(...uploadedFiles);
        await profile.save();
        
        // STEP 3: Return success response with MongoDB data
        res.json({
          message: 'Portfolio files uploaded and saved successfully!',
          filesUploaded: uploadedFiles.length,
          newFiles: uploadedFiles,
          totalPortfolioItems: profile.portfolio.length
        });

      } catch (error) {
        console.error('Portfolio upload error:', error);
        res.status(500).json({ message: 'Server error during file upload' });
      }
    });
  });
} else {
  console.log('⚠️ Portfolio uploader not available');
}

// Verification documents upload route (uploads ID photos to Cloudinary + saves URLs to MongoDB)
if (cloudinaryConfig && cloudinaryConfig.uploadVerificationDoc) {
  const verificationUpload = cloudinaryConfig.uploadVerificationDoc.fields([
    { name: 'idPhotoFront', maxCount: 1 },
    { name: 'idPhotoBack', maxCount: 1 }
  ]);
  
  router.post('/verification-documents', auth, (req, res, next) => {
    verificationUpload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }
      
      try {
        if (!req.files || Object.keys(req.files).length === 0) {
          return res.status(400).json({ message: 'No files uploaded' });
        }

        // STEP 1: Files are already uploaded to Cloudinary by multer
        const uploadedFiles = {};

        // Process front ID photo
        if (req.files.idPhotoFront) {
          uploadedFiles.idPhotoFront = {
            url: req.files.idPhotoFront[0].path,
            publicId: req.files.idPhotoFront[0].filename
          };
        }

        // Process back ID photo
        if (req.files.idPhotoBack) {
          uploadedFiles.idPhotoBack = {
            url: req.files.idPhotoBack[0].path,
            publicId: req.files.idPhotoBack[0].filename
          };
        }

        // STEP 2: Save Cloudinary URLs to MongoDB
        const updateData = {};
        if (uploadedFiles.idPhotoFront) {
          updateData['verificationDocuments.idPhotoFront'] = uploadedFiles.idPhotoFront.url;
          updateData['verificationDocuments.publicIds.idPhotoFront'] = uploadedFiles.idPhotoFront.publicId;
        }
        if (uploadedFiles.idPhotoBack) {
          updateData['verificationDocuments.idPhotoBack'] = uploadedFiles.idPhotoBack.url;
          updateData['verificationDocuments.publicIds.idPhotoBack'] = uploadedFiles.idPhotoBack.publicId;
        }

        const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-password');

        if (!updatedUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        // STEP 3: Return success response with MongoDB data
        res.json({
          message: 'Verification documents uploaded and saved successfully!',
          files: uploadedFiles,
          user: {
            id: updatedUser._id,
            verificationDocuments: updatedUser.verificationDocuments
          }
        });

      } catch (error) {
        console.error('Verification documents upload error:', error);
        res.status(500).json({ message: 'Server error during file upload' });
      }
    });
  });
} else {
  console.log('⚠️ Verification document uploader not available');
}

module.exports = router;
