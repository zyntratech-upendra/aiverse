/**
 * Simple migration script: Firestore -> MongoDB
 * Requirements:
 * - Set GOOGLE_APPLICATION_CREDENTIALS pointing to Firebase service account JSON
 * - Set MONGO_URI to target MongoDB
 */
require('dotenv').config();
const admin = require('firebase-admin');
const mongoose = require('mongoose');

const Quiz = require('../models/Quiz');
const QuizSession = require('../models/QuizSession');
const QuizAnswer = require('../models/QuizAnswer');
const QuizSubmission = require('../models/QuizSubmission');

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-verse-migrate';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS environment variable to a Firebase service account JSON file');
    process.exit(1);
  }

  admin.initializeApp({});
  const firestore = admin.firestore();

  const collections = [ 'quizzes', 'quizSessions', 'quizAnswers', 'quizSubmissions', 'users' ];

  for (const col of collections) {
    console.log(`Migrating collection: ${col}`);
    const snap = await firestore.collection(col).get();
    console.log(`Found ${snap.size} documents in ${col}`);
    let i = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      const id = doc.id;
      try {
        if (col === 'quizzes') {
          await Quiz.updateOne({ _id: id }, { $set: { ...data, _id: id } }, { upsert: true });
        } else if (col === 'quizSessions') {
          await QuizSession.updateOne({ _id: id }, { $set: { ...data, _id: id } }, { upsert: true });
        } else if (col === 'quizAnswers') {
          await QuizAnswer.updateOne({ _id: id }, { $set: { ...data, _id: id } }, { upsert: true });
        } else if (col === 'quizSubmissions') {
          await QuizSubmission.updateOne({ _id: id }, { $set: { ...data, _id: id } }, { upsert: true });
        } else if (col === 'users') {
          // Simple users import into 'users' collection in Mongo
          await mongoose.connection.collection('users').updateOne({ _id: id }, { $set: { ...data, _id: id } }, { upsert: true });
        }
        i++;
      } catch (e) {
        console.warn(`Failed to migrate ${col}/${id}:`, e);
      }
    }
    console.log(`Migrated ${i} documents from ${col}`);
  }

  console.log('Migration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration error', err);
  process.exit(1);
});
