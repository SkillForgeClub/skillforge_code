/**
 * Server-Sent Events (SSE) for real-time submission status updates.
 *
 * The frontend connects to GET /api/v1/events and receives a stream.
 * When a judge worker finishes a submission, it calls sseEmit(userId, event)
 * and the event is pushed to that user's open SSE connection.
 *
 * This replaces the 500ms polling loop with a push model:
 * - Lower latency (instant verdict delivery)
 * - Lower server load (no repeated GET /api/submissions/:id)
 * - Scales fine for a single API instance
 *
 * For multi-instance deployments: use Redis pub/sub to fan out events
 * across API instances (see sseEmit — it publishes to Redis if available).
 */
import type { Request, Response } from 'express';
import { getRedis } from './redis.js';

interface SSEClient {
  userId: string;
  res: Response;
}

// In-process client registry (single-instance)
const clients = new Map<string, SSEClient[]>();

/** Registers an SSE connection for a user. */
export function sseConnect(userId: string, req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send a heartbeat immediately so the browser knows the connection is alive
  res.write('event: connected\ndata: {}\n\n');

  const client: SSEClient = { userId, res };
  const existing = clients.get(userId) || [];
  clients.set(userId, [...existing, client]);

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const remaining = (clients.get(userId) || []).filter((c) => c !== client);
    if (remaining.length === 0) clients.delete(userId);
    else clients.set(userId, remaining);
  });
}

/** Pushes an event to all SSE connections for a user. */
export function sseEmit(userId: string, data: Record<string, unknown>): void {
  const userClients = clients.get(userId) || [];
  const payload = `event: submission.updated\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of userClients) {
    try {
      client.res.write(payload);
    } catch {
      // Client disconnected mid-write — will be cleaned up on 'close'
    }
  }

  // Also publish to Redis for multi-instance fan-out
  const redis = getRedis();
  if (redis && userClients.length === 0) {
    // Only publish if this instance doesn't have the client (another instance might)
    redis.publish(`sse:${userId}`, JSON.stringify(data)).catch(() => {});
  }
}

/** Returns the number of active SSE connections (for health/metrics). */
export function sseConnectionCount(): number {
  let total = 0;
  for (const list of clients.values()) total += list.length;
  return total;
}
