const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    uid: { type: String, index: true },
    auth_id: { type: String, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    personal_email: { type: String, lowercase: true, trim: true },
    name: { type: String, default: '' },
    displayName: { type: String, default: '' },
    role: { type: String, default: 'participant', index: true },
    college: { type: String, default: '' },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    image: { type: String, default: '' },
    position: { type: String, default: '' },
    sub_role: { type: String, default: '' },
    order: { type: Number, default: 0 },
    bio: { type: String, default: '' },
    github: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    show_in_about: { type: Boolean, default: false },
    showInAbout: { type: Boolean, default: false },
    registration_id: { type: String, index: true },
    registered_events: [{ type: String }],
    status: { type: String, default: 'active' },
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'users',
    strict: false,
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

UserSchema.index({ uid: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ personal_email: 1 });
UserSchema.index({ registration_id: 1 });
UserSchema.index({ role: 1, show_in_about: 1, order: 1 });

UserSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('User', UserSchema);
