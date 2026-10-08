import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import connectDB from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(requestLogger);

import authRoutes from './api/auth.routes';
import projectRoutes from './api/project.routes';
import { updateWorkflowState } from './api/message.controller';

// Internal routes (requires internal API key)
import crypto from 'crypto';

app.put('/api/internal/projects/:projectId/messages/state', (req, res, next) => {
  const apiKey = req.headers['x-internal-api-key'] as string;
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('INTERNAL_API_KEY is not set in environment');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  if (!apiKey || apiKey.length !== expectedKey.length || !crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))) {
    res.status(401).json({ error: 'Unauthorized internal access' });
    return;
  }
  next();
}, updateWorkflowState);

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

import mongoose from 'mongoose';
import { redis } from './config/redis';
import { storageService } from './services/storage.service';

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
  await storageService.initializeBuckets();
  app.listen(env.PORT, () => {
    console.log(`Backend server listening on port ${env.PORT}`);
  });
};

startServer();
