/**
 * SkillForge Judge Worker — standalone process.
 *
 * Run separately from the API server:
 *   npx tsx server/worker.ts
 *
 * In production (docker-compose), this runs as its own container with
 * /var/run/docker.sock mounted so it can spawn judge containers.
 *
 * The worker:
 * 1. Pulls jobs from the BullMQ 'submissions' queue
 * 2. Runs the Docker judge
 * 3. Updates the submission record in Postgres
 * 4. Emits SSE events so the frontend updates in real-time
 *
 * Infrastructure failures (Docker crash, DB timeout) are retried with
 * exponential backoff. Correct verdicts (WA, TLE, RE) are NOT retried —
 * they are final answers, not infrastructure errors.
 */
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { createRedisConnection } from './redis.js';
import { db, initSchema } from './db.js';
import { judge, Language } from './judge.js';
import { sseEmit } from './sse.js';
import type { SubmissionJobData } from './jobQueue.js';

const JUDGE_CONCURRENCY = Number(process.env.JUDGE_CONCURRENCY) || 4;
const QUEUE_NAME = 'submissions';

async function processSubmission(job: Job<SubmissionJobData>): Promise<void> {
  const { submissionId, problemId, language, contestId } = job.data;

  console.log(`[worker] Processing job ${job.id} — submission ${submissionId}`);

  // Mark as Running
  await db.prepare(`UPDATE submissions SET status='Running' WHERE id=?`).run(submissionId);
  sseEmit(job.data.userId, { submissionId, status: 'Running' });

  // Fetch test cases
  const allCases = await db.prepare(
    `SELECT * FROM test_cases WHERE problem_id=? ORDER BY ord ASC`
  ).all(problemId);

  if (allCases.length === 0) {
    await db.prepare(`UPDATE submissions SET status='System Error', result_json=? WHERE id=?`)
      .run(JSON.stringify({ compileError: 'No test cases found for this problem.' }), submissionId);
    sseEmit(job.data.userId, { submissionId, status: 'System Error' });
    return;
  }

  // Fetch problem for per-problem limits
  const probRow = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(problemId);

  const summary = await judge(
    language as Language,
    job.data.language, // raw code stored in job? No — fetch from DB
    allCases.map((tc: any) => ({
      input: tc.input,
      expectedOutput: tc.expected_output,
      isPublic: !!tc.is_public,
    })),
    {
      timeLimitMs: probRow?.time_limit_ms || undefined,
      memoryLimitMb: probRow?.memory_limit_mb || undefined,
    }
  );

  const testCasesChecked = summary.cases.map((c) => ({
    input: c.input,
    expected: c.expected,
    actual: c.stdout || c.stderr || '',
    passed: c.passed,
    isPublic: c.isPublic,
  }));

  await db.prepare(
    `UPDATE submissions SET status=?, execution_time_ms=?, memory_kb=?, result_json=? WHERE id=?`
  ).run(
    summary.overallStatus,
    summary.timeMs,
    summary.memoryKb,
    JSON.stringify({ compileError: summary.compileError, testCasesChecked }),
    submissionId
  );

  // Update problem stats
  await db.prepare(`UPDATE problems SET attempt_count = attempt_count + 1 WHERE id=?`).run(problemId);

  if (summary.overallStatus === 'Accepted') {
    const alreadySolved = await db.prepare(
      `SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND status='Accepted' AND id != ? LIMIT 1`
    ).get(job.data.userId, problemId, submissionId);

    if (!alreadySolved && probRow) {
      await db.prepare(`UPDATE problems SET solved_count = solved_count + 1 WHERE id=?`).run(problemId);
      const pointsAward = probRow.difficulty === 'Hard' ? 8 : probRow.difficulty === 'Medium' ? 4 : 2;
      const col = probRow.difficulty === 'Hard' ? 'hard_solved' : probRow.difficulty === 'Medium' ? 'medium_solved' : 'easy_solved';
      const userRow = await db.prepare(`SELECT * FROM users WHERE id=?`).get(job.data.userId);
      if (userRow) {
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        let newStreak = userRow.streak;
        if (userRow.last_solved_date === today) {
          // already solved today
        } else if (userRow.last_solved_date === yesterday) {
          newStreak = userRow.streak + 1;
        } else {
          newStreak = 1;
        }
        const newPoints = userRow.points + pointsAward;
        const newStars = computeStarRating(newPoints);
        await db.prepare(`
          UPDATE users SET ${col} = ${col} + 1, points = points + ?, streak = ?, last_solved_date = ?,
            level = 1 + CAST((easy_solved + medium_solved + hard_solved + 1) / 5 AS INTEGER),
            star_rating = GREATEST(star_rating, ?)
          WHERE id=?
        `).run(pointsAward, newStreak, today, newStars, job.data.userId);
      }
    }
  }

  // Emit SSE to the submitting user
  sseEmit(job.data.userId, {
    submissionId,
    status: summary.overallStatus,
    timeMs: summary.timeMs,
    memoryKb: summary.memoryKb,
    compileError: summary.compileError,
  });

  console.log(`[worker] Done ${submissionId} → ${summary.overallStatus}`);
}

const STAR_THRESHOLDS = [1500, 2500, 4000, 5500, 6500];
function computeStarRating(points: number): number {
  let stars = 1;
  for (let i = 1; i < STAR_THRESHOLDS.length; i++) {
    if (points >= STAR_THRESHOLDS[i]) stars = i + 1;
  }
  return stars;
}

async function start() {
  await initSchema();
  console.log(`[worker] Starting BullMQ worker (concurrency=${JUDGE_CONCURRENCY})`);

  const worker = new Worker<SubmissionJobData>(
    QUEUE_NAME,
    async (job) => {
      // Fetch source code from DB (not stored in job payload — avoids large Redis payloads)
      const subRow = await db.prepare(`SELECT * FROM submissions WHERE id=?`).get(job.data.submissionId);
      if (!subRow) {
        console.warn(`[worker] Submission ${job.data.submissionId} not found — skipping`);
        return;
      }
      // Attach code to job data for judge
      job.data.language = subRow.language;
      // Pass code via a local variable, not mutating job.data (immutable in BullMQ)
      const code = subRow.code;

      // Re-implement inline to pass code
      const { submissionId, problemId, userId, contestId } = job.data;
      await db.prepare(`UPDATE submissions SET status='Running' WHERE id=?`).run(submissionId);
      sseEmit(userId, { submissionId, status: 'Running' });

      const allCases = await db.prepare(
        `SELECT * FROM test_cases WHERE problem_id=? ORDER BY ord ASC`
      ).all(problemId);

      const probRow = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(problemId);

      const summary = await judge(
        subRow.language as Language,
        code,
        allCases.map((tc: any) => ({
          input: tc.input,
          expectedOutput: tc.expected_output,
          isPublic: !!tc.is_public,
        })),
        {
          timeLimitMs: probRow?.time_limit_ms || undefined,
          memoryLimitMb: probRow?.memory_limit_mb || undefined,
        }
      );

      const testCasesChecked = summary.cases.map((c) => ({
        input: c.input,
        expected: c.expected,
        actual: c.stdout || c.stderr || '',
        passed: c.passed,
        isPublic: c.isPublic,
      }));

      await db.prepare(
        `UPDATE submissions SET status=?, execution_time_ms=?, memory_kb=?, result_json=? WHERE id=?`
      ).run(
        summary.overallStatus,
        summary.timeMs,
        summary.memoryKb,
        JSON.stringify({ compileError: summary.compileError, testCasesChecked }),
        submissionId
      );

      await db.prepare(`UPDATE problems SET attempt_count = attempt_count + 1 WHERE id=?`).run(problemId);

      if (summary.overallStatus === 'Accepted') {
        const alreadySolved = await db.prepare(
          `SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND status='Accepted' AND id != ? LIMIT 1`
        ).get(userId, problemId, submissionId);

        if (!alreadySolved && probRow) {
          await db.prepare(`UPDATE problems SET solved_count = solved_count + 1 WHERE id=?`).run(problemId);
          const pointsAward = probRow.difficulty === 'Hard' ? 8 : probRow.difficulty === 'Medium' ? 4 : 2;
          const col = probRow.difficulty === 'Hard' ? 'hard_solved' : probRow.difficulty === 'Medium' ? 'medium_solved' : 'easy_solved';
          const userRow = await db.prepare(`SELECT * FROM users WHERE id=?`).get(userId);
          if (userRow) {
            const today = new Date().toISOString().slice(0, 10);
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            let newStreak = userRow.streak;
            if (userRow.last_solved_date === today) {
              // already solved today
            } else if (userRow.last_solved_date === yesterday) {
              newStreak = userRow.streak + 1;
            } else {
              newStreak = 1;
            }
            const newPoints = userRow.points + pointsAward;
            await db.prepare(`
              UPDATE users SET ${col} = ${col} + 1, points = points + ?, streak = ?, last_solved_date = ?,
                level = 1 + CAST((easy_solved + medium_solved + hard_solved + 1) / 5 AS INTEGER),
                star_rating = GREATEST(star_rating, ?)
              WHERE id=?
            `).run(pointsAward, newStreak, today, computeStarRating(newPoints), userId);
          }
        }
      }

      sseEmit(userId, {
        submissionId,
        status: summary.overallStatus,
        timeMs: summary.timeMs,
        memoryKb: summary.memoryKb,
        compileError: summary.compileError,
      });

      console.log(`[worker] ${submissionId} → ${summary.overallStatus} (${summary.timeMs}ms)`);
    },
    {
      connection: createRedisConnection(),
      concurrency: JUDGE_CONCURRENCY,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err.message);
    if (job?.data.submissionId) {
      db.prepare(`UPDATE submissions SET status='System Error', result_json=? WHERE id=?`)
        .run(JSON.stringify({ compileError: `Judge error: ${err.message}` }), job.data.submissionId)
        .catch(() => {});
      sseEmit(job.data.userId, { submissionId: job.data.submissionId, status: 'System Error' });
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[worker] SIGTERM received — draining...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await worker.close();
    process.exit(0);
  });

  console.log('[worker] Ready');
}

start().catch((err) => {
  console.error('[worker] Fatal startup error:', err);
  process.exit(1);
});
