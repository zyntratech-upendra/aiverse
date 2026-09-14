const mongoose = require('mongoose');
const { Schema } = mongoose;

const AlbumImageSchema = new Schema(
  {
    url: { type: String, required: true },
    caption: { type: String, default: '' },
    uploadedAt: { type: Number, default: () => Date.now() },
  },
  { _id: false }
);

const AlbumSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    caption: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    bannerImage: { type: String, default: '' },
    category: { type: String, default: 'Workshops' },
    status: { type: String, default: 'Published' },
    date: { type: String, default: '' },
    eventId: { type: String, index: true },
    eventTitle: { type: String, default: '' },
    tags: [{ type: String }],
    images: [AlbumImageSchema],
    photosCount: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    driveLink: { type: String, default: '' },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'albums',
    strict: false,
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AlbumSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('Album', AlbumSchema);
