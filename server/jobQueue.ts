/**
 * Submission queue using BullMQ (Redis-backed) when Redis is available,
 * falling back to the in-process semaphore queue for single-instance dev.
 *
 * Job payload shape:
 * {
 *   submissionId, userId, problemId, contestId?,
 *   language, priority, isRun, runId?
 * }
 *
 * BullMQ handles:
 * - persistence across restarts
 * - retry on infrastructure failure (not on WA/TLE — those are correct verdicts)
 * - dead-letter via failed queue
 * - concurrency control across multiple worker instances
 * - job deduplication via jobId
 */
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { createRedisConnection, isRedisAvailable } from './redis.js';
import { runQueued as inProcessRunQueued, queueStats as inProcessQueueStats } from './queue.js';

export interface SubmissionJobData {
  submissionId: string;
  userId: string;
  problemId: string;
  contestId?: string;
  language: string;
  priority?: number;
  isRun?: boolean;
  runId?: string;
}

const QUEUE_NAME = 'submissions';

let submissionQueue: Queue<SubmissionJobData> | null = null;

export function getSubmissionQueue(): Queue<SubmissionJobData> | null {
  if (!isRedisAvailable()) return null;
  if (!submissionQueue) {
    submissionQueue = new Queue<SubmissionJobData>(QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return submissionQueue;
}

/** Adds a submission job to the BullMQ queue (or falls back to in-process). */
export async function enqueueSubmission(
  data: SubmissionJobData,
  handler: () => Promise<void>
): Promise<{ queued: boolean; jobId?: string }> {
  const queue = getSubmissionQueue();

  if (queue) {
    const job = await queue.add(data.submissionId, data, {
      jobId: data.submissionId, // idempotent — duplicate submits are ignored
      priority: data.priority ?? 10,
    });
    return { queued: true, jobId: job.id };
  }

  // Fallback: in-process queue (dev mode, no Redis)
  inProcessRunQueued(handler).catch((err) => {
    console.error('[queue] In-process job failed:', err);
  });
  return { queued: false };
}

/** Returns queue depth stats (works with both BullMQ and in-process). */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  mode: 'bullmq' | 'in-process';
}> {
  const queue = getSubmissionQueue();
  if (queue) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed, mode: 'bullmq' };
  }
  const stats = inProcessQueueStats();
  return {
    waiting: stats.queued,
    active: stats.running,
    completed: 0,
    failed: 0,
    mode: 'in-process',
  };
}
