const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrganizerSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    name: { type: String, required: true },
    role: { type: String, default: 'Coordinator' },
    email: { type: String, default: '', lowercase: true, trim: true },
    phone: { type: String, default: '' },
    photo: { type: String, default: '' },
    department: { type: String, default: '' },
    year: { type: String, default: '' },
    order: { type: Number, default: 0 },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    instagram: { type: String, default: '' },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'organizers',
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

OrganizerSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('Organizer', OrganizerSchema);
