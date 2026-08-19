import { redisClient } from '../lib/redis';
import { env } from '../config/env';

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

  const currentMinute = now.getUTCMinutes();
  const currentSecond = now.getUTCSeconds();
  
  const secondsLeftInHour = 3600 - (currentMinute * 60 + currentSecond);

  return {
    globalKey,
    senderKey,
    ttlSeconds: secondsLeftInHour + 60,
  };
}

const ATOMIC_QUOTA_LUA_SCRIPT = `
  local globalKey = KEYS[1]
  local senderKey = KEYS[2]
  local maxGlobal = tonumber(ARGV[1])
  local maxSender = tonumber(ARGV[2])
  local ttlSeconds = tonumber(ARGV[3])

  local currentGlobal = tonumber(redis.call('get', globalKey) or "0")
  local currentSender = tonumber(redis.call('get', senderKey) or "0")

  if currentGlobal >= maxGlobal then
    return {0, "global", currentGlobal}
  end

  if currentSender >= maxSender then
    return {0, "sender", currentSender}
  end

  local newGlobal = redis.call('incr', globalKey)
  if newGlobal == 1 then
    redis.call('expire', globalKey, ttlSeconds)
  end

  local newSender = redis.call('incr', senderKey)
  if newSender == 1 then
    redis.call('expire', senderKey, ttlSeconds)
  end

  return {1, "ok", newGlobal}
`;

export async function checkAndReserveQuota(senderEmail: string): Promise<QuotaCheckResult> {
  const { globalKey, senderKey, ttlSeconds } = getHourWindowKey(senderEmail);

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  const msUntilNextWindow = Math.max(1000, nextHour.getTime() - now.getTime());

  try {
    const result = (await redisClient.eval(
      ATOMIC_QUOTA_LUA_SCRIPT,
      2,
      globalKey,
      senderKey,
      env.MAX_EMAILS_PER_HOUR,
      env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      ttlSeconds
    )) as [number, string, number?];

    const [status, limitType, count] = result;

    if (status === 1) {
      return { allowed: true };
    }

    if (limitType === 'global') {
      return {
        allowed: false,
        msUntilNextWindow,
        reason: `Global hourly quota reached (${count || env.MAX_EMAILS_PER_HOUR}/${env.MAX_EMAILS_PER_HOUR})`,
      };
    }

    return {
      allowed: false,
      msUntilNextWindow,
      reason: `Per-sender hourly quota reached for ${senderEmail} (${count || env.MAX_EMAILS_PER_HOUR_PER_SENDER}/${env.MAX_EMAILS_PER_HOUR_PER_SENDER})`,
    };
  } catch (err: any) {
    console.error('[RateLimiter Lua Error]', err);
    return {
      allowed: false,
      msUntilNextWindow: 5000,
      reason: 'Rate limiter evaluation error',
    };
  }
}
