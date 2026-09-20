const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Album = require('../models/Album');
const { uploadToCloudinaryIfBase64 } = require('../utils/cloudinaryHelper');

async function migrate() {
  console.log('🌱 Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  console.log('✅ Connected to DB:', mongoose.connection.name);

  const albums = await Album.find({});
  console.log(`📸 Found ${albums.length} albums to process...`);

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];
    console.log(`[${i + 1}/${albums.length}] Processing "${album.title}"...`);

    let modified = false;

    // 1. Process coverImage
    if (album.coverImage && (album.coverImage.startsWith('data:') || album.coverImage.length > 500)) {
      const cUrl = await uploadToCloudinaryIfBase64(album.coverImage, 'ai_verse/albums');
      album.coverImage = cUrl;
      album.imageUrl = cUrl;
      modified = true;
    }

    // 2. Process imageUrl
    if (album.imageUrl && (album.imageUrl.startsWith('data:') || album.imageUrl.length > 500)) {
      const iUrl = await uploadToCloudinaryIfBase64(album.imageUrl, 'ai_verse/albums');
      album.imageUrl = iUrl;
      if (!album.coverImage) album.coverImage = iUrl;
      modified = true;
    }

    // 3. Process images array
    if (Array.isArray(album.images) && album.images.length > 0) {
      const updatedImages = [];
      for (const img of album.images) {
        if (typeof img === 'string') {
          const u = await uploadToCloudinaryIfBase64(img, 'ai_verse/albums');
          updatedImages.push({ url: u, caption: '', uploadedAt: Date.now() });
          modified = true;
        } else if (img && img.url) {
          const u = await uploadToCloudinaryIfBase64(img.url, 'ai_verse/albums');
          updatedImages.push({ ...img, url: u });
          if (u !== img.url) modified = true;
        } else {
          updatedImages.push(img);
        }
      }
      album.images = updatedImages;
      if (!album.imageUrl && updatedImages[0]?.url) {
        album.imageUrl = updatedImages[0].url;
        album.coverImage = updatedImages[0].url;
        modified = true;
      }
    }

    if (modified) {
      album.updatedAt = Date.now();
      await Album.updateOne({ _id: album._id }, {
        $set: {
          coverImage: album.coverImage,
          imageUrl: album.imageUrl,
          bannerImage: album.coverImage,
          images: album.images,
          updatedAt: album.updatedAt,
        }
      });
      console.log(`   ✨ Saved Cloudinary URL for "${album.title}": ${album.coverImage?.substring(0, 50)}...`);
    } else {
      console.log(`   ⏩ "${album.title}" already has clean URLs.`);
    }
  }

  console.log('🎉 Migration completed successfully!');
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
