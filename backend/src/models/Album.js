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
    coverImage: { type: String, default: '' },
    eventId: { type: String, index: true },
    eventTitle: { type: String, default: '' },
    images: [AlbumImageSchema],
    order: { type: Number, default: 0 },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    collection: 'albums',
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AlbumSchema.virtual('id').get(function () {
  return this._id;
});

module.exports = mongoose.model('Album', AlbumSchema);
