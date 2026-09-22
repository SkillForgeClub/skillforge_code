/**
 * A small in-process worker pool: caps how many judge jobs run at once
 * (like a mini version of the "judge worker fleet" behind CodeChef/LeetCode),
 * queues the rest, and runs everything asynchronously so the HTTP server's
 * event loop is never blocked waiting on a compile/run.
 */
import os from 'os';

type Release = () => void;

class Semaphore {
  private available: number;
  private waiters: (() => void)[] = [];

  constructor(count: number) {
    this.available = count;
  }

  acquire(): Promise<Release> {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve(() => this.release());
    }
    return new Promise<Release>((resolve) => {
      this.waiters.push(() => {
        this.available--;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.available++;
    const next = this.waiters.shift();
    if (next) next();
  }

  /** Number of jobs currently waiting for a free worker slot. */
  get queued(): number {
    return this.waiters.length;
  }
}

// Default: leave one core free for the HTTP server itself; always allow at least 2 concurrent judges.
const DEFAULT_CONCURRENCY = Math.max(2, os.cpus().length - 1);
export const JUDGE_CONCURRENCY = Number(process.env.JUDGE_CONCURRENCY) || DEFAULT_CONCURRENCY;

const judgeSemaphore = new Semaphore(JUDGE_CONCURRENCY);
let runningCount = 0;

export function queueStats() {
  return { running: runningCount, queued: judgeSemaphore.queued, concurrency: JUDGE_CONCURRENCY };
}

/**
 * Runs `job` once a worker slot is free. Resolves/rejects with the job's own result.
 * Multiple callers can call this concurrently; excess jobs simply wait their turn.
 */
export async function runQueued<T>(job: () => Promise<T>): Promise<T> {
  const release = await judgeSemaphore.acquire();
  runningCount++;
  try {
    return await job();
  } finally {
    runningCount--;
    release();
  }
}
