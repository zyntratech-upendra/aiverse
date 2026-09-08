const nodemailer = require('nodemailer');

const createSmtpTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }
  return null;
};

const smtpTransporter = createSmtpTransporter();

/**
 * Send email helper function using Resend API (with SMTP fallback)
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.text]
 * @param {string} [options.from]
 * @param {string} [options.replyTo]
 * @param {string} [options.reply_to]
 * @param {Array} [options.attachments]
 * @param {Object} [options.headers]
 */
const sendMail = async ({ to, subject, html, text, from, replyTo, reply_to, attachments, headers }) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const defaultFrom = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'AI Verse <events@aiversevitb.dpdns.org>';
  const defaultReplyTo = process.env.RESEND_REPLY_TO || process.env.EMAIL_REPLY_TO || 'aiverse@vishnu.edu.in';

  const recipients = Array.isArray(to) ? to : [to];
  const sender = from || defaultFrom;
  const reply = replyTo || reply_to || defaultReplyTo;

  // 1. Primary: Send via Resend API
  if (RESEND_API_KEY) {
    const payload = {
      from: sender,
      to: recipients,
      reply_to: reply,
      subject: String(subject).trim(),
      html: html || `<p>${text}</p>`,
    };

    if (text) payload.text = text;
    if (headers && typeof headers === 'object') payload.headers = headers;
    if (attachments && Array.isArray(attachments)) payload.attachments = attachments;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || data?.error || 'Resend API Error');
    }

    return {
      success: true,
      service: 'resend',
      id: data.id,
      messageId: data.id,
      data,
    };
  }

  // 2. Fallback: Send via Nodemailer SMTP if configured
  if (smtpTransporter) {
    const mailOptions = {
      from: sender,
      to: recipients.join(', '),
      replyTo: reply,
      subject: String(subject).trim(),
      html: html || `<p>${text}</p>`,
    };
    if (text) mailOptions.text = text;
    if (attachments && Array.isArray(attachments)) mailOptions.attachments = attachments;
    if (headers && typeof headers === 'object') mailOptions.headers = headers;

    const info = await smtpTransporter.sendMail(mailOptions);
    return {
      success: true,
      service: 'smtp',
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response,
    };
  }

  console.warn('[Mailer] Neither RESEND_API_KEY nor SMTP credentials configured. Simulating email log.');
  return {
    success: true,
    simulated: true,
    to: recipients,
    subject,
  };
};

module.exports = {
  sendMail,
  smtpTransporter,
};
