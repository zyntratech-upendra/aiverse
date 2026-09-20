const { cloudinary } = require('../config/cloudinary');

/**
 * Uploads a base64 or data-uri image string to Cloudinary.
 * If the string is already an http/https URL, it returns it as-is.
 * @param {string} str - Base64 image or URL
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string>} - Cloudinary secure HTTPS URL
 */
async function uploadToCloudinaryIfBase64(str, folder = 'ai_verse') {
  if (!str || typeof str !== 'string') return str;
  const trimmed = str.trim();
  if (trimmed.startsWith('data:image/') || trimmed.length > 500 && !trimmed.startsWith('http')) {
    try {
      const result = await cloudinary.uploader.upload(trimmed, {
        folder,
        resource_type: 'auto',
        quality: 'auto:good',
      });
      return result.secure_url;
    } catch (err) {
      console.warn('[Cloudinary] Base64 image auto-upload failed:', err.message);
      return str;
    }
  }
  return str;
}

module.exports = {
  uploadToCloudinaryIfBase64,
};
