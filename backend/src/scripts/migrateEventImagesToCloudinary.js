const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Event = require('../models/Event');
const { uploadToCloudinaryIfBase64 } = require('../utils/cloudinaryHelper');

async function migrateEvents() {
  console.log('🌱 Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  console.log('✅ Connected to DB:', mongoose.connection.name);

  const events = await Event.find({});
  console.log(`🎟️ Found ${events.length} events to process...`);

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    console.log(`[${i + 1}/${events.length}] Processing "${evt.title}"...`);

    const updateFields = {};
    let modified = false;

    // Helper to upload if base64
    const processField = async (val, folder = 'ai_verse/events') => {
      if (val && typeof val === 'string' && (val.startsWith('data:') || (val.length > 500 && !val.startsWith('http')))) {
        const u = await uploadToCloudinaryIfBase64(val, folder);
        return u;
      }
      return val;
    };

    // 1. posterPreview
    if (evt.posterPreview) {
      const u = await processField(evt.posterPreview);
      if (u !== evt.posterPreview) {
        updateFields.posterPreview = u;
        updateFields.posterUrl = u;
        updateFields.image = u;
        modified = true;
      }
    }

    // 2. image
    if (evt.image) {
      const u = await processField(evt.image);
      if (u !== evt.image) {
        updateFields.image = u;
        if (!updateFields.posterPreview) updateFields.posterPreview = u;
        modified = true;
      }
    }

    // 3. posterUrl
    if (evt.posterUrl) {
      const u = await processField(evt.posterUrl);
      if (u !== evt.posterUrl) {
        updateFields.posterUrl = u;
        if (!updateFields.posterPreview) updateFields.posterPreview = u;
        modified = true;
      }
    }

    // 4. coverImage & bannerImage
    if (evt.coverImage) {
      const u = await processField(evt.coverImage);
      if (u !== evt.coverImage) {
        updateFields.coverImage = u;
        modified = true;
      }
    }
    if (evt.bannerImage) {
      const u = await processField(evt.bannerImage);
      if (u !== evt.bannerImage) {
        updateFields.bannerImage = u;
        modified = true;
      }
    }

    // 5. posterImages array
    if (Array.isArray(evt.posterImages) && evt.posterImages.length > 0) {
      const newPosterImages = [];
      for (const pi of evt.posterImages) {
        if (!pi) continue;
        let preview = pi.preview;
        let url = pi.url;
        if (preview) preview = await processField(preview);
        if (url) url = await processField(url);
        newPosterImages.push({
          filename: pi.filename || 'poster.png',
          preview: preview || url,
          url: url || preview,
        });
      }
      updateFields.posterImages = newPosterImages;
      modified = true;
    }

    // 6. speakerImagePreview
    if (evt.speakerImagePreview) {
      const u = await processField(evt.speakerImagePreview);
      if (u !== evt.speakerImagePreview) {
        updateFields.speakerImagePreview = u;
        modified = true;
      }
    }

    // 7. paymentQrImagePreview
    if (evt.paymentQrImagePreview) {
      const u = await processField(evt.paymentQrImagePreview);
      if (u !== evt.paymentQrImagePreview) {
        updateFields.paymentQrImagePreview = u;
        modified = true;
      }
    }

    // 8. juryImagePreview
    if (evt.juryImagePreview) {
      const u = await processField(evt.juryImagePreview);
      if (u !== evt.juryImagePreview) {
        updateFields.juryImagePreview = u;
        modified = true;
      }
    }

    if (modified) {
      updateFields.updatedAt = Date.now();
      await Event.updateOne({ _id: evt._id }, { $set: updateFields });
      console.log(`   ✨ Saved Cloudinary URLs for "${evt.title}"!`);
    } else {
      console.log(`   ⏩ "${evt.title}" already clean.`);
    }
  }

  console.log('🎉 Event images migration completed successfully!');
  await mongoose.disconnect();
}

migrateEvents().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
