require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-verse-migrate';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  console.log('Connected to MongoDB for verification');
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    try {
      const name = c.name;
      const count = await db.collection(name).countDocuments();
      const sample = await db.collection(name).find().limit(3).toArray();
      console.log(`\nCollection: ${name} (count: ${count})`);
      console.log(JSON.stringify(sample, null, 2));
    } catch (e) {
      console.warn('Error reading collection', c.name, e);
    }
  }
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Verification error', err);
  process.exit(1);
});