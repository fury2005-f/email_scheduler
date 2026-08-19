import Redis from 'ioredis';
import { env } from '../config/env.js';

export const redisConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
};

export const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
});
