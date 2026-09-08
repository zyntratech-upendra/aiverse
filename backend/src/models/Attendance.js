const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    eventId: { type: String, required: true, index: true },
    eventTitle: { type: String, default: '' },
    registrationId: { type: String, default: '', index: true },
    participantId: { type: String, default: '', index: true },
    session: { type: String, default: 'morning', index: true },
    userId: { type: String, default: '', index: true },
    userEmail: { type: String, default: '', lowercase: true, trim: true, index: true },
    userName: { type: String, default: '' },
    name: { type: String, default: '' },
    role: { type: String, default: 'Participant' },
    teamName: { type: String, default: '' },
    status: {
      type: String,
      default: 'Present',
    },
    checkInTime: { type: mongoose.Schema.Types.Mixed, default: () => Date.now() },
    markedBy: { type: String, default: 'System' },
    notes: { type: String, default: '' },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    timestamps: false,
    versionKey: false,
    _id: false,
    strict: false,
  }
);

AttendanceSchema.index({ eventId: 1, registrationId: 1 });
AttendanceSchema.index({ eventId: 1, userEmail: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
