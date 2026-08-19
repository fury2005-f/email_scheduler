import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { addEmailToQueue } from '../services/queueService.js';
import { redisClient } from '../lib/redis.js';
import { env } from '../config/env.js';
import crypto from 'crypto';

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email('Invalid email recipient')).min(1, 'At least one recipient is required'),
  sender: z.string().email().optional().default('outreach@reachinbox.ai'),
  startTime: z.string().optional(),
  delayBetweenEmailsMs: z.number().nonnegative().optional().default(0),
});

export async function scheduleEmails(req: Request, res: Response): Promise<Response> {
  const parseResult = scheduleSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { subject, body, recipients, sender, startTime, delayBetweenEmailsMs } = parseResult.data;

  const baseStartTime = startTime ? new Date(startTime).getTime() : Date.now();
  const batchId = crypto.randomUUID();
  const now = Date.now();

  const createdEmails = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i].trim();
    // Offset each lead's schedule time if delayBetweenEmailsMs is provided
    const targetScheduledTimeMs = baseStartTime + i * delayBetweenEmailsMs;
    const scheduledAt = new Date(targetScheduledTimeMs);
    const delayMs = Math.max(0, targetScheduledTimeMs - now);

    // 1. Create DB row first (Source of Truth)
    const emailRecord = await prisma.email.create({
      data: {
        sender,
        recipient,
        subject,
        body,
        scheduledAt,
        originalScheduledAt: scheduledAt,
        status: 'PENDING',
        batchId,
      },
    });

    // 2. Enqueue BullMQ delayed job with jobId = emailRecord.id
    await addEmailToQueue(emailRecord.id, delayMs);

    createdEmails.push(emailRecord);
  }

  return res.status(201).json({
    message: `Successfully scheduled ${createdEmails.length} email(s)`,
    batchId,
    count: createdEmails.length,
    scheduledEmails: createdEmails,
  });
}

export async function getScheduledEmails(req: Request, res: Response): Promise<Response> {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const statusFilter = req.query.status as string | undefined;

  const skip = (page - 1) * limit;

  const whereClause: any = {
    status: statusFilter ? (statusFilter as any) : { in: ['PENDING', 'SENDING'] },
  };

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.email.count({ where: whereClause }),
  ]);

  return res.json({
    data: emails,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getSentEmails(req: Request, res: Response): Promise<Response> {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const statusFilter = req.query.status as string | undefined;

  const skip = (page - 1) * limit;

  const whereClause: any = {
    status: statusFilter ? (statusFilter as any) : { in: ['SENT', 'FAILED'] },
  };

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.email.count({ where: whereClause }),
  ]);

  return res.json({
    data: emails,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getStats(_req: Request, res: Response): Promise<Response> {
  const [pendingCount, sendingCount, sentCount, failedCount] = await Promise.all([
    prisma.email.count({ where: { status: 'PENDING' } }),
    prisma.email.count({ where: { status: 'SENDING' } }),
    prisma.email.count({ where: { status: 'SENT' } }),
    prisma.email.count({ where: { status: 'FAILED' } }),
  ]);

  // Current hour Redis quota usage
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');

  const globalKey = `emails:counter:global:${year}-${month}-${day}-${hour}`;
  const currentHourGlobalCountStr = await redisClient.get(globalKey);
  const currentHourGlobalCount = currentHourGlobalCountStr ? parseInt(currentHourGlobalCountStr, 10) : 0;

  return res.json({
    summary: {
      pending: pendingCount,
      sending: sendingCount,
      sent: sentCount,
      failed: failedCount,
      totalScheduled: pendingCount + sendingCount + sentCount + failedCount,
    },
    quota: {
      currentHourUsed: currentHourGlobalCount,
      maxEmailsPerHour: env.MAX_EMAILS_PER_HOUR,
      maxEmailsPerHourPerSender: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      workerConcurrency: env.WORKER_CONCURRENCY,
      minSendIntervalMs: env.MIN_SEND_INTERVAL_MS,
    },
  });
}
