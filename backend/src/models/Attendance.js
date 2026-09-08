const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    eventId: { type: String, required: true, index: true },
    eventTitle: { type: String, default: '' },
    registrationId: { type: String, required: true, index: true },
    userId: { type: String, default: '', index: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    userName: { type: String, default: '' },
    teamName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Excused'],
      default: 'Present',
    },
    checkInTime: { type: Number, default: () => Date.now() },
    markedBy: { type: String, default: 'System' },
    notes: { type: String, default: '' },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    timestamps: false,
    versionKey: false,
    _id: false,
  }
);

AttendanceSchema.index({ eventId: 1, registrationId: 1 });
AttendanceSchema.index({ eventId: 1, userEmail: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
