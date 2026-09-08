const express = require('express');
const router = express.Router();
const { sendMail } = require('../config/mailer');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/send-email - Send transactional email via Resend
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { to, subject, html, text, from, reply_to, replyTo, headers, attachments } = req.body || {};

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, and html or text',
      });
    }

    try {
      const result = await sendMail({
        to,
        subject,
        html: html || `<p>${text}</p>`,
        text,
        from,
        replyTo: replyTo || reply_to,
        headers,
        attachments,
      });

      res.json({
        success: true,
        data: result,
        id: result.id || result.messageId,
        messageId: result.messageId || result.id,
      });
    } catch (err) {
      console.error('[sendEmail] Email Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to send email',
      });
    }
  })
);

module.exports = router;
