const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}
const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ai-verse';

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
  }
};

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('MongoDB disconnected. Reconnecting...');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime error:', err);
});

module.exports = connectDB;
