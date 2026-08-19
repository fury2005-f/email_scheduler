import { redisClient } from '../lib/redis.js';
import { env } from '../config/env.js';

export interface QuotaCheckResult {
  allowed: boolean;
  msUntilNextWindow?: number;
  reason?: string;
}

function getHourWindowKey(senderEmail: string): { globalKey: string; senderKey: string; ttlSeconds: number } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');

  const hourWindowStr = `${year}-${month}-${day}-${hour}`;
  const globalKey = `emails:counter:global:${hourWindowStr}`;
  const senderKey = `emails:counter:${senderEmail.toLowerCase()}:${hourWindowStr}`;

  // Time remaining in current hour window in seconds
  const currentMinute = now.getUTCMinutes();
  const currentSecond = now.getUTCSeconds();
  const currentMs = now.getUTCMilliseconds();
  
  const secondsLeftInHour = 3600 - (currentMinute * 60 + currentSecond);
  const msLeftInHour = (secondsLeftInHour * 1000) - currentMs;

  return {
    globalKey,
    senderKey,
    ttlSeconds: secondsLeftInHour + 60, // Add 1 minute buffer to TTL
  };
}

export async function checkAndReserveQuota(senderEmail: string): Promise<QuotaCheckResult> {
  const { globalKey, senderKey, ttlSeconds } = getHourWindowKey(senderEmail);

  // Read current counts
  const [globalCountStr, senderCountStr] = await Promise.all([
    redisClient.get(globalKey),
    redisClient.get(senderKey),
  ]);

  const globalCount = globalCountStr ? parseInt(globalCountStr, 10) : 0;
  const senderCount = senderCountStr ? parseInt(senderCountStr, 10) : 0;

  // Calculate ms until next hour window
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  const msUntilNextWindow = Math.max(1000, nextHour.getTime() - now.getTime());

  if (globalCount >= env.MAX_EMAILS_PER_HOUR) {
    return {
      allowed: false,
      msUntilNextWindow,
      reason: `Global hourly quota reached (${globalCount}/${env.MAX_EMAILS_PER_HOUR})`,
    };
  }

  if (senderCount >= env.MAX_EMAILS_PER_HOUR_PER_SENDER) {
    return {
      allowed: false,
      msUntilNextWindow,
      reason: `Per-sender hourly quota reached for ${senderEmail} (${senderCount}/${env.MAX_EMAILS_PER_HOUR_PER_SENDER})`,
    };
  }

  // Atomically increment counters
  const pipeline = redisClient.pipeline();
  pipeline.incr(globalKey);
  pipeline.expire(globalKey, ttlSeconds);
  pipeline.incr(senderKey);
  pipeline.expire(senderKey, ttlSeconds);
  await pipeline.exec();

  return { allowed: true };
}
