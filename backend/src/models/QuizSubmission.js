const mongoose = require('mongoose');
const { Schema } = mongoose;

const QuizSubmissionSchema = new Schema(
  {
    _id: { type: String, required: true }, // sessionId
    sessionId: { type: String, required: true, index: true },
    quizId: { type: String, required: true, index: true },
    quizTitle: { type: String, default: 'Quiz' },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, lowercase: true, trim: true, default: '' },
    userName: { type: String, default: 'Participant' },
    teamId: { type: String, default: '' },
    teamName: { type: String, default: '' },
    answers: { type: Schema.Types.Mixed, default: {} },
    answeredCount: { type: Number, default: 0 },
    unansweredCount: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    startTime: { type: Number, required: true },
    submittedAt: { type: Number, default: () => Date.now() },
    isAutoSubmitted: { type: Boolean, default: false },
    isFinal: { type: Boolean, default: true },
    violationsCount: { type: Number, default: 0 },
    violationLogs: [{ type: Schema.Types.Mixed }],
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    evaluatedAt: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'quizSubmissions',
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

QuizSubmissionSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('QuizSubmission', QuizSubmissionSchema);
