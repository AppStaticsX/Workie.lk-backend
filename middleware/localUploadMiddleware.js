const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const createUploadDirs = () => {
  const dirs = [
    'uploads',
    'uploads/worker-verification',
    'uploads/worker-verification/profile-photos',
    'uploads/worker-verification/id-photos',
    'uploads/worker-verification/certificates',
    'uploads/worker-verification/portfolio',
    'uploads/worker-verification/documents'
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
};

// Initialize upload directories
createUploadDirs();

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'uploads/worker-verification/';
    
    // Determine folder based on field name
    switch (file.fieldname) {
      case 'profilePhoto':
        uploadPath += 'profile-photos/';
        break;
      case 'idPhotoFront':
      case 'idPhotoBack':
        uploadPath += 'id-photos/';
        break;
      case 'certificates':
        uploadPath += 'certificates/';
        break;
      case 'portfolioImages':
        uploadPath += 'portfolio/';
        break;
      case 'verificationDocuments':
        uploadPath += 'documents/';
        break;
      default:
        uploadPath += 'documents/';
    }
    
    const fullPath = path.join(__dirname, '..', uploadPath);
    
    // Ensure directory exists
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, fullPath);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp and user ID
    const userId = req.user ? req.user.id : 'anonymous';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    
    // Clean filename - remove special characters
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    const filename = `${userId}_${timestamp}_${randomString}_${cleanBaseName}${extension}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Configure multer with size limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 20 // Maximum 20 files
  },
  fileFilter: fileFilter
});

// Multiple fields upload configuration
const uploadFields = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'idPhotoFront', maxCount: 1 },
  { name: 'idPhotoBack', maxCount: 1 },
  { name: 'certificates', maxCount: 5 },
  { name: 'portfolioImages', maxCount: 10 },
  { name: 'verificationDocuments', maxCount: 5 }
]);

// Middleware to add file URLs to request
const addFileUrls = (req, res, next) => {
  if (req.files) {
    // Convert file paths to URLs
    Object.keys(req.files).forEach(fieldName => {
      req.files[fieldName].forEach(file => {
        // Create URL path from file path
        const relativePath = path.relative(
          path.join(__dirname, '..'),
          file.path
        ).replace(/\\/g, '/'); // Convert Windows paths to URL format
        
        file.url = `${req.protocol}://${req.get('host')}/${relativePath}`;
      });
    });
  }
  next();
};

// Combined middleware
const processUpload = [uploadFields, addFileUrls];

// Utility function to delete file
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Function to get file path from URL
const getFilePathFromUrl = (fileUrl) => {
  try {
    const url = new URL(fileUrl);
    const relativePath = url.pathname.substring(1); // Remove leading slash
    return path.join(__dirname, '..', relativePath);
  } catch (error) {
    return null;
  }
};

module.exports = {
  uploadFields: processUpload,
  deleteFile,
  getFilePathFromUrl,
  createUploadDirs
};
