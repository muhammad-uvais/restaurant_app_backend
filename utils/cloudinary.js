const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Your cloud name from Cloudinary dashboard
  api_key: process.env.CLOUDINARY_API_KEY, // Your API key from Cloudinary dashboard
  api_secret: process.env.CLOUDINARY_API_SECRET, // Your API secret from Cloudinary dashboard
});

/**
 * Uploads a file buffer to Cloudinary.
 * @param {Buffer} fileBuffer - The file buffer from multer's memoryStorage.
 * @returns {Promise<Object>} - A promise that resolves to the Cloudinary upload result.
 */
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((error, result) => {
            if (error) {
                reject(new Error('Cloudinary Upload Error: ' + error.message));
            } else {
                resolve(result);
            }
        });
        stream.end(fileBuffer); // Use the file buffer from multer's memoryStorage
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

const overwriteCloudinaryImage = async (publicId, newImagePath) => {
    try {
        // Upload the new image and overwrite the existing one using the same public_id
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload(newImagePath, { public_id: publicId, overwrite: true }, (error, result) => {
                if (error) {
                    return reject(new Error('Cloudinary Overwrite Error: ' + error.message));
                }
                resolve(result);
            });
        });

        // Return the new image information (e.g., URL)
        return uploadResult;
    } catch (error) {
        throw new Error('Image Update Error: ' + error.message);
    }
};

module.exports = {
    cloudinary,
    uploadToCloudinary,
    deleteFromCloudinary,
    overwriteCloudinaryImage
};
