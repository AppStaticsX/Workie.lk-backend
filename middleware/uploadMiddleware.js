const multer = require('multer');
const s3Service = require('../services/s3Service');

// Configure multer to store files in memory
const storage = multer.memoryStorage();

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

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 20 // Maximum 20 files
  },
  fileFilter: fileFilter
});

// Middleware to handle multiple file uploads and upload to S3
const uploadFields = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'idPhotoFront', maxCount: 1 },
  { name: 'idPhotoBack', maxCount: 1 },
  { name: 'certificates', maxCount: 5 },
  { name: 'portfolioImages', maxCount: 10 },
  { name: 'verificationDocuments', maxCount: 5 }
]);

// Custom middleware to upload files to S3 after multer processing
const uploadToS3 = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next();
    }

    const userId = req.user?.id || 'anonymous';
    const uploadPromises = [];

    // Process each file field
    for (const fieldName in req.files) {
      const files = req.files[fieldName];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const folder = s3Service.getFolderPath(fieldName, userId);
        
        const uploadPromise = s3Service.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          folder
        ).then(result => {
          // Add S3 result to file object
          files[i].location = result.url;
          files[i].key = result.key;
          files[i].bucket = result.bucket;
          return result;
        });

        uploadPromises.push(uploadPromise);
      }
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    next();

  } catch (error) {
    console.error('S3 upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message
    });
  }
};

// Combined middleware function
const processFileUploads = [uploadFields, uploadToS3];

module.exports = {
  uploadFields: processFileUploads,
  upload,
  uploadToS3
};
