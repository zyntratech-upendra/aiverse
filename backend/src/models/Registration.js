const mongoose = require('mongoose');
const { Schema } = mongoose;

const RegistrationMemberSchema = new Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
    phone: { type: String, default: '' },
    college: { type: String, default: '' },
    registrationNumber: { type: String, default: '' },
    studentId: { type: String, default: '' },
    rollNo: { type: String, default: '' },
    role: { type: String, default: 'Member' },
    isLeader: { type: Boolean, default: false },
  },
  { _id: false, strict: false }
);

const RegistrationSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    eventId: { type: String, required: true, index: true },
    eventTitle: { type: String, default: '' },
    userId: { type: String, index: true },
    userEmail: { type: String, lowercase: true, trim: true, index: true },
    userName: { type: String, default: '' },
    fullName: { type: String, default: '' },
    teamLeadName: { type: String, default: '' },
    teamName: { type: String, default: '' },
    groupName: { type: String, default: '' },
    teamSize: { type: Number, default: 1 },
    members: [RegistrationMemberSchema],
    leadEmail: { type: String, lowercase: true, trim: true },
    teamLeadEmail: { type: String, lowercase: true, trim: true },
    leadPhone: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    phone: { type: String, default: '' },
    college: { type: String, default: '' },
    year: { type: String, default: '' },
    branch: { type: String, default: '' },
    ticketCode: { type: String, sparse: true, index: true },
    transactionId: { type: String, default: '' },
    paymentProof: { type: String, default: '' },
    paymentStatus: { type: String, default: 'Free' },
    status: { type: String, default: 'Not Confirmed' },
    accessGranted: { type: Boolean, default: false },
    loginAccessGranted: { type: Boolean, default: false },
    attendanceMarked: { type: Boolean, default: false },
    attendanceStatus: { type: String, default: 'Pending' },
    certificateIssued: { type: Boolean, default: false },
    checkedInAt: { type: Number, default: null },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'registrations',
    strict: false,
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

RegistrationSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('Registration', RegistrationSchema);
