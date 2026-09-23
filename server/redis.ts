/**
 * Redis client (ioredis) for BullMQ queue and distributed rate limiting.
 *
 * Falls back gracefully when REDIS_URL is not set — the in-process queue
 * (server/queue.ts) is used instead, which is fine for single-instance dev.
 * In production with multiple API instances, REDIS_URL must be set.
 */
import Redis from 'ioredis';
import 'dotenv/config';

const REDIS_URL = process.env.REDIS_URL;

let redisClient: Redis | null = null;
let redisAvailable = false;

if (REDIS_URL) {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    redisAvailable = true;
    console.log('[redis] Connected');
  });

  redisClient.on('error', (err) => {
    redisAvailable = false;
    console.error('[redis] Connection error:', err.message);
  });

  redisClient.on('close', () => {
    redisAvailable = false;
  });

  // Attempt initial connection (non-blocking)
  redisClient.connect().catch(() => {
    console.warn('[redis] Could not connect on startup — will retry automatically');
  });
} else {
  console.warn('[redis] REDIS_URL not set — using in-process queue (single-instance only)');
}

export function getRedis(): Redis | null {
  return redisClient;
}

export function isRedisAvailable(): boolean {
  return redisAvailable && redisClient !== null;
}

/** Creates a new ioredis connection for BullMQ (it needs its own connection). */
export function createRedisConnection(): Redis {
  if (!REDIS_URL) throw new Error('REDIS_URL is not set');
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
