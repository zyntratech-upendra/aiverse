const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    activeEventId: { type: String, default: null },
    activeEventTitle: { type: String, default: null },
    allowPublicRegistrations: { type: Boolean, default: true },
    allowTeamLogin: { type: Boolean, default: true },
    allowSubmissions: { type: Boolean, default: true },
    currentRound: { type: Number, default: 1 },
    updatedBy: { type: String, default: 'system' },
  },
  {
    timestamps: true,
    strict: false,
  }
);

module.exports = mongoose.model('Setting', SettingSchema);
