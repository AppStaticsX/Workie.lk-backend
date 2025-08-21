const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Profile Pictures Storage
const profilePictureStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie/profile-pictures',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 300, height: 300, crop: 'fill', quality: 'auto' }
    ]
  }
});

// Job Images Storage
const jobImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie/job-images',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 800, height: 600, crop: 'limit', quality: 'auto' }
    ]
  }
});

// Portfolio Images Storage
const portfolioImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie/portfolio',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 1200, height: 800, crop: 'limit', quality: 'auto' }
    ]
  }
});

// Document Storage (for verification documents)
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'workie/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto'
  }
});

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  profilePicture: 5 * 1024 * 1024, // 5MB
  jobImage: 10 * 1024 * 1024,      // 10MB
  portfolioImage: 15 * 1024 * 1024, // 15MB
  document: 20 * 1024 * 1024        // 20MB
};

// Create multer instances
const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.profilePicture },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile pictures'), false);
    }
  }
});

const uploadJobImages = multer({
  storage: jobImageStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.jobImage },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for job images'), false);
    }
  }
});

const uploadPortfolioImages = multer({
  storage: portfolioImageStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.portfolioImage },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for portfolio images'), false);
    }
  }
});

const uploadDocuments = multer({
  storage: documentStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.document },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed for documents'), false);
    }
  }
});

// Helper function to delete file from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

// Helper function to get file info from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  // Extract public_id from Cloudinary URL
  const parts = url.split('/');
  const fileWithExt = parts[parts.length - 1];
  const publicId = fileWithExt.split('.')[0];
  
  // Include folder structure
  const folderIndex = parts.findIndex(part => part === 'workie');
  if (folderIndex !== -1) {
    const folderPath = parts.slice(folderIndex, -1).join('/');
    return `${folderPath}/${publicId}`;
  }
  
  return publicId;
};

module.exports = {
  uploadProfilePicture,
  uploadJobImages,
  uploadPortfolioImages,
  uploadDocuments,
  deleteFromCloudinary,
  getPublicIdFromUrl,
  cloudinary
};
