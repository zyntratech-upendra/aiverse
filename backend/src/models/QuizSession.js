const mongoose = require('mongoose');
const { Schema } = mongoose;

const QuizViolationLogSchema = new Schema(
  {
    type: { type: String, required: true },
    message: { type: String, default: '' },
    timestamp: { type: Number, default: () => Date.now() },
  },
  { _id: false }
);

const QuizSessionSchema = new Schema(
  {
    _id: { type: String, required: true }, // deterministic format: `${quizId}_${userId}`
    quizId: { type: String, required: true, index: true },
    quizTitle: { type: String, default: 'Quiz' },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, lowercase: true, trim: true, default: '' },
    userName: { type: String, default: 'Participant' },
    teamId: { type: String, default: '' },
    teamName: { type: String, default: '' },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    durationMinutes: { type: Number, default: 30 },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'expired'],
      default: 'in_progress',
      index: true,
    },
    lastAutosavedAt: { type: Number, default: () => Date.now() },
    submittedAt: { type: Number },
    ipAddress: { type: String },
    userAgent: { type: String },
    violationsCount: { type: Number, default: 0 },
    violationLogs: [QuizViolationLogSchema],
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'quizSessions',
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

QuizSessionSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('QuizSession', QuizSessionSchema);
