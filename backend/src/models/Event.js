const mongoose = require('mongoose');
const { Schema } = mongoose;

const EventSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    category: { type: String, default: 'Technical' },
    track: { type: String, default: 'General' },
    date: { type: String, default: '' },
    time: { type: String, default: '' },
    venue: { type: String, default: '' },
    location: { type: String, default: '' },
    banner: { type: String, default: '' },
    bannerImage: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    rules: { type: Schema.Types.Mixed, default: [] },
    prizes: { type: Schema.Types.Mixed, default: [] },
    tags: { type: Schema.Types.Mixed, default: [] },
    maxParticipants: { type: Number, default: 100 },
    maxReg: { type: Number, default: 100 },
    currentReg: { type: Number, default: 0 },
    teamSizeMin: { type: Number, default: 1 },
    teamSizeMax: { type: Number, default: 4 },
    minTeamSize: { type: Number, default: 1 },
    maxTeamSize: { type: Number, default: 4 },
    fee: { type: Number, default: 0 },
    isLive: { type: Boolean, default: true },
    registrationOpen: { type: Boolean, default: true },
    status: { type: String, default: 'Open' },
    coordinators: { type: Schema.Types.Mixed, default: [] },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'events',
    strict: false,
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

EventSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('Event', EventSchema);
