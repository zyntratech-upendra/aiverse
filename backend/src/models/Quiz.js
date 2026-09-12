const mongoose = require('mongoose');
const { Schema } = mongoose;

const QuizSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'General' },
    eventId: { type: String, index: true },
    eventTitle: { type: String, default: '' },
    track: { type: String, default: 'General' },
    durationMinutes: { type: Number, default: 30 },
    totalMarks: { type: Number, default: 50 },
    passingMarks: { type: Number, default: 20 },
    pointsPerQuestion: { type: Number, default: 2 },
    instructions: { type: Schema.Types.Mixed, default: [] },
    status: {
      type: String,
      default: 'draft',
      index: true,
    },
    isLive: { type: Boolean, default: true },
    scheduledStartTime: { type: Number },
    scheduledEndTime: { type: Number },
    resultsPublished: { type: Boolean, default: false },
    questionsCount: { type: Number, default: 0 },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    questions: { type: Schema.Types.Mixed, default: [] },
    createdBy: { type: String },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'quizzes',
    strict: false,
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

QuizSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('Quiz', QuizSchema);
