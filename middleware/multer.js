const multer = require('multer');
const path = require('path');

// Define storage settings for storing files in memory
const storage = multer.memoryStorage();

// Define file filter to accept only certain types of files
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif|avif|pdf|doc/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, and DOC are allowed.'));
  }
};

// Set the upload limits (optional)
const limits = {
  fileSize: 300 * 1024, // Limit file size to 300 KB
};

// Create the Multer instance
const upload = multer({
  storage: storage, 
  fileFilter: fileFilter,
  limits: limits,
});

module.exports = upload;
