
import mongoose from 'mongoose';
import dns from 'node:dns';

// Use Google and Cloudflare DNS for MongoDB SRV lookups
dns.setServers([
  '8.8.8.8',
  '1.1.1.1'
]);

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is missing from .env');
  }

  try {
    console.log('Connecting to MongoDB Atlas...');

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000
    });

    console.log('MongoDB Atlas connected successfully!');
    console.log('Database:', mongoose.connection.name);

    return mongoose.connection;

  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
}
