const cloudinary = require('cloudinary').v2;
const streamifier = require("streamifier");
require('dotenv').config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      (error, result) => {
        if (error) {
          reject(new Error("Cloudinary Upload Error: " + error.message));
        } else {
          resolve(result);
        }
      }
    );
    // Pipe buffer to Cloudinary
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

// Function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        return reject(new Error('Cloudinary Deletion Error: ' + error.message));
      }
      resolve(result);
    });
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary
};
