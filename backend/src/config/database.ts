import mongoose from 'mongoose';
import { env } from './env';

const connectDB = async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('MongoDB connected successfully');
      break;
    } catch (error) {
      console.error(`MongoDB connection failed. Retries left: ${retries - 1}`, error);
      retries -= 1;
      await new Promise(res => setTimeout(res, 3000));
    }
  }

  if (retries === 0) {
    console.error('Could not connect to MongoDB after multiple retries.');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

export default connectDB;
