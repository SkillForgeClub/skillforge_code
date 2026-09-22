/**
 * Per-user submission throttle. Protects the judge queue during a live contest:
 * without this, one student spamming "Submit" could starve everyone else's
 * queue position. Two simple rules, both configurable via env vars:
 *   1. A minimum gap between submissions (anti-spam-click).
 *   2. At most one in-flight (Queued/Running) submission per user at a time.
 */

const MIN_GAP_MS = Number(process.env.SUBMIT_MIN_GAP_MS) || 3000;
const MAX_PENDING_PER_USER = Number(process.env.SUBMIT_MAX_PENDING) || 1;

const lastSubmitAt = new Map<string, number>();
const pendingCount = new Map<string, number>();

export function checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const last = lastSubmitAt.get(userId) || 0;
  const sinceLast = now - last;
  if (sinceLast < MIN_GAP_MS) {
    const waitSec = Math.ceil((MIN_GAP_MS - sinceLast) / 1000);
    return { ok: false, reason: `Please wait ${waitSec}s before submitting again.` };
  }
  if ((pendingCount.get(userId) || 0) >= MAX_PENDING_PER_USER) {
    return { ok: false, reason: 'You already have a submission being judged. Please wait for it to finish.' };
  }
  return { ok: true };
}

export function markSubmitted(userId: string) {
  lastSubmitAt.set(userId, Date.now());
  pendingCount.set(userId, (pendingCount.get(userId) || 0) + 1);
}

export function markFinished(userId: string) {
  pendingCount.set(userId, Math.max(0, (pendingCount.get(userId) || 0) - 1));
}
