require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import Route Handlers
const authRouter = require('./routes/auth');
const quizzesRouter = require('./routes/quizzes');
const sessionsRouter = require('./routes/sessions');
const draftsRouter = require('./routes/drafts');
const eventsRouter = require('./routes/events');
const registrationsRouter = require('./routes/registrations');
const usersRouter = require('./routes/users');
const organizersRouter = require('./routes/organizers');
const albumsRouter = require('./routes/albums');
const uploadRouter = require('./routes/upload');
const sendEmailRouter = require('./routes/sendEmail');
const contactsRouter = require('./routes/contacts');
const attendanceRouter = require('./routes/attendance');
const adminRouter = require('./routes/admin');
const settingsRouter = require('./routes/settings');
const juryEvaluationsRouter = require('./routes/juryEvaluations');

// Initialize Express App
const app = express();

// Database Connection
connectDB();

// Middlewares
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health Check
app.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

// Root API Endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'AI Verse Backend API',
    version: '2.0.0',
    status: 'active',
    database: 'MongoDB Atlas',
    storage: 'Cloudinary',
    mailer: 'Nodemailer SMTP',
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/auth', authRouter); // Root alias compatibility

app.use('/api/quizzes', quizzesRouter);
app.use('/api', sessionsRouter);
app.use('/api', draftsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/users', usersRouter);
app.use('/api/organizers', organizersRouter);
app.use('/api/albums', albumsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/send-email', sendEmailRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin/settings', settingsRouter);
app.use('/api/jury_evaluations', juryEvaluationsRouter);
app.use('/api/jury-evaluations', juryEvaluationsRouter);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// Server Listener (only start listener in standalone node environment, not under Vercel serverless)
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  const server = app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 AI Verse Server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`📡 API Base:     http://localhost:${PORT}/api`);
    console.log(`=========================================`);
  });

  // Graceful Shutdown
  const handleShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      await mongoose.connection.close(false);
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

module.exports = app;
