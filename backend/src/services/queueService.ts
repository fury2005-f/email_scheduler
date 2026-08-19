import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis';

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
      age: 86400,
      count: 5000,
    },
    removeOnFail: {
      age: 604800,
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
      jobId: emailId,
      delay: calculatedDelay,
    }
  );
}
