const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary - use CLOUDINARY_URL if available, otherwise use individual values
if (process.env.CLOUDINARY_URL) {
  // Parse the CLOUDINARY_URL manually
  const url = new URL(process.env.CLOUDINARY_URL);
  cloudinary.config({
    cloud_name: url.hostname,
    api_key: url.username,
    api_secret: url.password,
  });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Profile Pictures Storage
const profilePictureStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie-lk/profile-pictures',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
  },
});

// Cover Photos Storage
const coverPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie-lk/cover-photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1200, height: 400, crop: 'fill', gravity: 'center' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
  },
});

// Worker Verification Documents Storage
const verificationDocStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie-lk/verification-documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto',
    transformation: [
      { quality: 'auto', fetch_format: 'auto' }
    ],
  },
});

// Portfolio Storage (Images and Videos)
const portfolioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie-lk/portfolio',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'],
    resource_type: 'auto', // Automatically detect if it's image or video
    transformation: [
      { quality: 'auto', fetch_format: 'auto' }
    ],
  },
});

// Job Images Storage
const jobImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie-lk/job-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
  },
});

// General Documents Storage
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie-lk/documents',
    allowed_formats: ['pdf', 'doc', 'docx', 'txt'],
    resource_type: 'auto',
  },
});

// Create multer instances for different file types
const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

const uploadCoverPhoto = multer({
  storage: coverPhotoStorage,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB limit for cover photos
  },
});

const uploadVerificationDoc = multer({
  storage: verificationDocStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const uploadPortfolio = multer({
  storage: portfolioStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
});

const uploadJobImage = multer({
  storage: jobImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper function to delete files from Cloudinary
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

// Helper function to delete video files from Cloudinary
const deleteVideo = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    return result;
  } catch (error) {
    console.error('Error deleting video from Cloudinary:', error);
    throw error;
  }
};

// Helper function to generate optimized URLs
const generateOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    quality: 'auto',
    fetch_format: 'auto',
    ...options
  });
};

// Helper function to generate thumbnail for videos
const generateVideoThumbnail = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [
      { width: 300, height: 200, crop: 'fill' },
      { quality: 'auto' }
    ],
    ...options
  });
};

module.exports = {
  cloudinary,
  uploadProfilePicture,
  uploadCoverPhoto,
  uploadVerificationDoc,
  uploadPortfolio,
  uploadJobImage,
  uploadDocument,
  deleteFile,
  deleteVideo,
  generateOptimizedUrl,
  generateVideoThumbnail,
};
