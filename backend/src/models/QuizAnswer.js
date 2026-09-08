const mongoose = require('mongoose');
const { Schema } = mongoose;

const QuizAnswerSchema = new Schema(
  {
    _id: { type: String, required: true }, // sessionId
    sessionId: { type: String, required: true, index: true },
    quizId: { type: String, index: true },
    userId: { type: String, index: true },
    answers: { type: Schema.Types.Mixed, default: {} }, // questionId -> selectedOptionId
    flaggedQuestions: [{ type: String }],
    currentQuestionIndex: { type: Number, default: 0 },
    violationsCount: { type: Number, default: 0 },
    violationLogs: [{ type: Schema.Types.Mixed }],
    lastAutosavedAt: { type: Number, default: () => Date.now() },
    clientTimestamp: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'quizAnswers',
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

QuizAnswerSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('QuizAnswer', QuizAnswerSchema);
