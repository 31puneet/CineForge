import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import connectDB from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

import mongoose from 'mongoose';
import { redis } from './config/redis';

app.get('/api/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'ok' : 'error';
  
  let redisStatus = 'disabled';
  if (redis) {
    try {
      await redis.ping();
      redisStatus = 'ok';
    } catch {
      redisStatus = 'error';
    }
  }

  const status = mongoStatus === 'ok' && (redisStatus === 'ok' || redisStatus === 'disabled') ? 200 : 503;

  res.status(status).json({
    status: status === 200 ? 'ok' : 'error',
    service: 'backend',
    env: env.NODE_ENV,
    dependencies: {
      mongodb: mongoStatus,
      redis: redisStatus
    }
  });
});

// Example route to test error handling
app.get('/api/test-error', () => {
  throw new Error('This is a test error!');
});

app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`Backend server listening on port ${env.PORT}`);
  });
};

startServer();
