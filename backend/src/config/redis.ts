import Redis from 'ioredis';
import { env } from './env';

export const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

if (redis) {
  redis.on('error', (err) => {
    console.error('Redis connection error:', err);
  });
  redis.on('connect', () => {
    console.log('Redis connected successfully');
  });
}
