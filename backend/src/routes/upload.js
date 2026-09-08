const express = require('express');
const router = express.Router();
const { cloudinary, upload } = require('../config/cloudinary');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/upload - Single file or base64 upload
router.post(
  '/',
  (req, res, next) => {
    // Check if content-type is multipart/form-data
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return upload.single('file')(req, res, (err) => {
        if (err) {
          // If field was named 'image', retry with 'image'
          return upload.single('image')(req, res, (err2) => {
            if (err2) return res.status(400).json({ success: false, error: err2.message });
            next();
          });
        }
        next();
      });
    }
    next();
  },
  asyncHandler(async (req, res) => {
    // 1. If file was uploaded via Multer
    if (req.file) {
      return res.json({
        success: true,
        url: req.file.path || req.file.secure_url,
        secure_url: req.file.path || req.file.secure_url,
        public_id: req.file.filename || req.file.public_id,
        format: req.file.format,
        size: req.file.size,
      });
    }

    // 2. Base64 / Data URI upload
    const { image, data, folder = 'ai_verse' } = req.body || {};
    const base64Data = image || data;

    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'No file or image base64 data provided' });
    }

    // Upload base64 string to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'auto',
      quality: 'auto:good',
    });

    res.json({
      success: true,
      url: uploadResult.secure_url,
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
    });
  })
);

// POST /api/upload/multiple - Multiple files upload
router.post(
  '/multiple',
  upload.array('files', 15),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const results = req.files.map((file) => ({
      url: file.path || file.secure_url,
      secure_url: file.path || file.secure_url,
      public_id: file.filename || file.public_id,
      format: file.format,
      size: file.size,
    }));

    res.json({
      success: true,
      count: results.length,
      files: results,
    });
  })
);

// DELETE /api/upload - Delete image from Cloudinary by public_id
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const { public_id } = req.body || req.query || {};
    if (!public_id) {
      return res.status(400).json({ success: false, error: 'Missing public_id parameter' });
    }

    const result = await cloudinary.uploader.destroy(public_id);
    res.json({ success: true, result });
  })
);

module.exports = router;
