import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis.js';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs in Redis for 24h
      count: 5000,
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs in Redis for 7 days
      count: 5000,
    },
  },
});

export async function addEmailToQueue(emailId: string, delayMs: number): Promise<void> {
  const calculatedDelay = Math.max(0, delayMs);

  await emailQueue.add(
    'send-email',
    { emailId },
    {
      jobId: emailId, // Stable jobId = DB Row UUID for idempotency
      delay: calculatedDelay,
    }
  );
}
