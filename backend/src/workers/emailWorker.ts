import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '../services/queueService';
import { redisConnectionOptions } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { checkAndReserveQuota } from '../services/rateLimiterService';
import { sendEmailViaEthereal } from '../services/etherealService';
import { env } from '../config/env';

export async function reconcileStaleSendingJobs(): Promise<number> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  
  const updated = await prisma.email.updateMany({
    where: {
      status: 'SENDING',
      updatedAt: {
        lt: twoMinutesAgo,
      },
    },
    data: {
      status: 'PENDING',
    },
  });

  if (updated.count > 0) {
    console.log(`[Worker Startup] Reconciled ${updated.count} stale SENDING job(s) back to PENDING`);
  }
  return updated.count;
}

async function processEmailJob(job: Job<{ emailId: string }>): Promise<void> {
  const { emailId } = job.data;

  // 1. Fetch source of truth from database
  const email = await prisma.email.findUnique({
    where: { id: emailId },
  });

  if (!email) {
    console.warn(`[Worker] Job ${job.id} referenced non-existent email ID ${emailId}`);
    return;
  }

  // Idempotency check: Skip if already sent or failed
  if (email.status === 'SENT') {
    console.log(`[Worker] Email ${emailId} is already marked SENT in DB. Skipping duplicate send.`);
    return;
  }

  if (email.status === 'FAILED' && job.attemptsMade === 0) {
    console.log(`[Worker] Email ${emailId} is marked FAILED in DB. Skipping.`);
    return;
  }

  // Handle crash recovery state (SENDING)
  if (email.status === 'SENDING') {
    const timeInSendingMs = Date.now() - new Date(email.updatedAt).getTime();
    if (timeInSendingMs < 120000 && job.attemptsMade === 0) {
      console.log(`[Worker] Email ${emailId} is currently being processed by another worker. Skipping.`);
      return;
    }
    console.log(`[Worker] Recovering email ${emailId} from stale SENDING state (duration: ${Math.round(timeInSendingMs / 1000)}s)`);
  }

  // 2. Check Redis sliding/fixed hourly quota
  const quota = await checkAndReserveQuota(email.sender);

  if (!quota.allowed) {
    const baseDelay = quota.msUntilNextWindow || 60000;
    const sequenceOffset = Number(email.sequenceNumber % 1000n) * 50; 
    const totalReDelayMs = baseDelay + sequenceOffset;

    console.log(
      `[Worker Rate Limit] ${quota.reason}. Re-delaying email ${emailId} (recipient: ${email.recipient}) by ${Math.round(totalReDelayMs / 1000)}s`
    );

    await job.moveToDelayed(Date.now() + totalReDelayMs, job.token);
    return;
  }

  // 3. Mark DB status as SENDING
  await prisma.email.update({
    where: { id: emailId },
    data: { status: 'SENDING' },
  });

  try {
    // 4. Send via Ethereal SMTP
    const result = await sendEmailViaEthereal({
      to: email.recipient,
      from: email.sender,
      subject: email.subject,
      html: email.body,
    });

    // 5. Update DB status to SENT
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        etherealPreviewUrl: result.previewUrl || null,
        error: null,
      },
    });

    console.log(
      `[Worker Success] Email sent to ${email.recipient} | Subject: "${email.subject}" | Ethereal Link: ${result.previewUrl || 'N/A'}`
    );
  } catch (err: any) {
    const errorMessage = err?.message || 'SMTP transmission error';
    console.error(`[Worker Error] Failed to send email ${emailId} to ${email.recipient}: ${errorMessage}`);

    const maxAttempts = job.opts.attempts || 3;
    if (job.attemptsMade + 1 >= maxAttempts) {
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          error: errorMessage,
        },
      });
    }

    throw err;
  }
}

export function startEmailWorker(): Worker {
  const worker = new Worker<{ emailId: string }>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job);
    },
    {
      connection: redisConnectionOptions,
      concurrency: env.WORKER_CONCURRENCY,
      limiter: {
        max: 1,
        duration: env.MIN_SEND_INTERVAL_MS,
      },
    }
  );

  worker.on('failed', (job, err) => {
    if (job) {
      console.error(`[BullMQ Job Failed] Job ${job.id} (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
    }
  });

  worker.on('error', (err) => {
    console.error('[BullMQ Worker Error]', err);
  });

  console.log(`[Worker Boot] BullMQ Email Worker started. Concurrency: ${env.WORKER_CONCURRENCY}, Min Delay: ${env.MIN_SEND_INTERVAL_MS}ms`);

  return worker;
}
