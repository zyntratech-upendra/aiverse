const mongoose = require('mongoose');

const JuryEvaluationSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: false, index: true },
    eventTitle: { type: String, default: '' },
    registrationId: { type: String, required: false, index: true },
    teamName: { type: String, default: '' },
    juryId: { type: String, required: false, index: true },
    juryName: { type: String, default: '' },
    juryEmail: { type: String, default: '' },
    round: { type: Number, default: 1 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    feedback: { type: String, default: '' },
    criteriaScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['Draft', 'Submitted', 'Approved'], default: 'Submitted' },
    evaluatedAt: { type: Number, default: Date.now },
  },
  {
    timestamps: true,
    strict: false,
  }
);

module.exports = mongoose.model('JuryEvaluation', JuryEvaluationSchema);
