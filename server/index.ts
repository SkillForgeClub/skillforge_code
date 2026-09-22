import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, initSchema } from './db.js';
import { seedIfEmpty } from './seed.js';
import { signToken, requireAuth, requireAdmin, optionalAuth, AuthedRequest } from './auth.js';
import { judge, runCustom, Language } from './judge.js';
import { runQueued, queueStats } from './queue.js';
import { contestsRouter } from './contests.js';
import { checkRateLimit, markSubmitted, markFinished } from './rateLimit.js';
import { sendResetCodeEmail } from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 8787;

// In a split deployment, set ALLOWED_ORIGIN to the frontend's exact origin (e.g.
// https://yourapp.vercel.app) to restrict which sites can call this API with credentials.
// Left unset, all origins are allowed - fine for local dev and for a combined single-server
// deployment (same-origin requests don't need CORS at all), but set this for a real
// split (Vercel + separate backend) production deployment.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
app.use(cors(ALLOWED_ORIGIN ? { origin: ALLOWED_ORIGIN } : {}));
app.use(express.json({ limit: '2mb' }));

function newId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}
function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Serialization helpers: DB rows (snake_case) -> frontend shapes (camelCase)
// ---------------------------------------------------------------------------

function toStudent(row: any) {
  return {
    id: row.id,
    fullName: row.full_name,
    rollNumber: row.roll_number,
    email: row.email,
    starRating: row.star_rating,
    level: row.level,
    rank: 0, // computed on the leaderboard endpoint
    problemsSolved: { easy: row.easy_solved, medium: row.medium_solved, hard: row.hard_solved },
    streak: row.streak,
    points: row.points,
    certificates: JSON.parse(row.certificates || '[]'),
    badges: [],
  };
}

async function toProblemSummary(row: any, studentId?: string) {
  let status: 'Solved' | 'Attempted' | 'Unsolved' = 'Unsolved';
  if (studentId) {
    const solved = await db.prepare(`SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND status='Accepted' LIMIT 1`).get(studentId, row.id);
    if (solved) status = 'Solved';
    else {
      const attempted = await db.prepare(`SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? LIMIT 1`).get(studentId, row.id);
      if (attempted) status = 'Attempted';
    }
  }
  const attempts = row.attempt_count || 0;
  const acceptanceRate = attempts > 0 ? Math.round((row.solved_count / attempts) * 1000) / 10 : 0;
  const testCaseCount = (await db.prepare(`SELECT COUNT(*)::int c FROM test_cases WHERE problem_id=?`).get(row.id)).c;
  return {
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    category: row.category,
    statement: row.statement,
    inputFormat: row.input_format,
    outputFormat: row.output_format,
    constraints: row.constraints,
    examples: JSON.parse(row.examples || '[]'),
    starterTemplates: JSON.parse(row.starter_templates || '{}'),
    solvedCount: row.solved_count,
    acceptanceRate,
    status,
    testCaseCount,
  };
}

async function getTestCases(problemId: string) {
  return db.prepare(`SELECT * FROM test_cases WHERE problem_id=? ORDER BY ord ASC`).all(problemId);
}

async function toProblemFull(row: any, studentId: string | undefined, includeHidden: boolean) {
  const summary = await toProblemSummary(row, studentId);
  const cases = await getTestCases(row.id);
  return {
    ...summary,
    testCases: cases
      .filter((tc: any) => includeHidden || tc.is_public)
      .map((tc: any) => ({ id: tc.id, input: tc.input, expectedOutput: tc.expected_output, isPublic: !!tc.is_public })),
  };
}

async function toQuizSummary(row: any) {
  const participants = (await db.prepare(`SELECT COUNT(*)::int c FROM quiz_attempts WHERE quiz_id=?`).get(row.id)).c;
  const questionCount = (await db.prepare(`SELECT COUNT(*)::int c FROM quiz_questions WHERE quiz_id=?`).get(row.id)).c;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    status: row.status,
    participantsCount: participants,
    questionCount,
  };
}

async function toQuizFull(row: any) {
  const questions = await db.prepare(`SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY ord ASC`).all(row.id);
  const questionDtos = await Promise.all(questions.map(async (q: any) => {
    const base: any = {
      id: q.id,
      questionText: q.question_text,
      type: q.type,
      points: q.points,
      difficulty: q.difficulty,
    };
    if (q.type === 'multiple-choice') {
      base.options = JSON.parse(q.options || '[]');
      base.correctOption = q.correct_option;
    } else if (q.type === 'coding' && q.coding_problem_id) {
      const probRow = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(q.coding_problem_id);
      if (probRow) base.codingProblem = await toProblemFull(probRow, undefined, false);
    }
    return base;
  }));
  return { ...(await toQuizSummary(row)), questions: questionDtos };
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  const { fullName, rollNumber, email, password } = req.body || {};
  if (!fullName || !rollNumber || !email || !password) {
    return res.status(400).json({ error: 'Full name, roll number, email, and password are all required.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(String(email).toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const id = newId('stud');
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare(`
    INSERT INTO users (id, full_name, email, roll_number, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?, 'student', ?)
  `).run(id, fullName, String(email).toLowerCase(), rollNumber, hash, nowIso());

  const row = await db.prepare(`SELECT * FROM users WHERE id=?`).get(id);
  const token = signToken({ id, role: 'student', email: String(email).toLowerCase() });
  res.status(201).json({ token, user: toStudent(row), role: 'student' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const row = await db.prepare(`SELECT * FROM users WHERE email = ?`).get(String(email).toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = signToken({ id: row.id, role: row.role, email: row.email });
  if (row.role === 'admin') {
    res.json({ token, role: 'admin', user: { id: row.id, fullName: row.full_name, email: row.email } });
  } else {
    res.json({ token, role: 'student', user: toStudent(row) });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthedRequest, res) => {
  const row = await db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user!.id);
  if (!row) return res.status(404).json({ error: 'User not found.' });
  if (row.role === 'admin') {
    return res.json({ role: 'admin', user: { id: row.id, fullName: row.full_name, email: row.email } });
  }
  res.json({ role: 'student', user: toStudent(row) });
});

// Forgot-password flow. Genuinely backed by the database (real generated code, real expiry,
// real attempt limiting, real password update) and genuinely emailed via server/email.ts
// (SMTP-based, works with any provider) - falls back to a console log only if SMTP isn't
// configured (see .env.example / server/email.ts).
const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const normalizedEmail = String(email).toLowerCase();

  const user = await db.prepare(`SELECT id FROM users WHERE email=?`).get(normalizedEmail);
  if (user) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();
    await db.prepare(`
      INSERT INTO password_resets (email, code, expires_at, attempts) VALUES (?, ?, ?, 0)
      ON CONFLICT (email) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, attempts=0
    `).run(normalizedEmail, code, expiresAt);
    await sendResetCodeEmail(normalizedEmail, code);
  }
  res.json({ success: true, message: 'If an account exists for that email, a reset code has been sent.' });
});

app.post('/api/auth/verify-reset-code', async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });
  const normalizedEmail = String(email).toLowerCase();

  const row = await db.prepare(`SELECT * FROM password_resets WHERE email=?`).get(normalizedEmail);
  if (!row) return res.status(400).json({ error: 'No reset request found for this email. Please request a new code.' });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare(`DELETE FROM password_resets WHERE email=?`).run(normalizedEmail);
    return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
  }
  if (row.attempts >= RESET_MAX_ATTEMPTS) {
    await db.prepare(`DELETE FROM password_resets WHERE email=?`).run(normalizedEmail);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }
  if (row.code !== String(code)) {
    await db.prepare(`UPDATE password_resets SET attempts = attempts + 1 WHERE email=?`).run(normalizedEmail);
    return res.status(400).json({ error: 'Incorrect code. Please try again.' });
  }
  res.json({ valid: true });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code, and new password are required.' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const normalizedEmail = String(email).toLowerCase();

  const row = await db.prepare(`SELECT * FROM password_resets WHERE email=?`).get(normalizedEmail);
  if (!row || row.code !== String(code) || new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired reset code. Please start over.' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await db.prepare(`UPDATE users SET password_hash=? WHERE email=?`).run(hash, normalizedEmail);
  await db.prepare(`DELETE FROM password_resets WHERE email=?`).run(normalizedEmail);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------

app.get('/api/problems', optionalAuth, async (req: AuthedRequest, res) => {
  const rows = await db.prepare(`SELECT * FROM problems ORDER BY created_at ASC`).all();
  const studentId = req.user?.role === 'student' ? req.user.id : undefined;
  res.json(await Promise.all(rows.map((r: any) => toProblemSummary(r, studentId))));
});

app.get('/api/problems/:id', optionalAuth, async (req: AuthedRequest, res) => {
  const row = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Problem not found.' });
  const isAdmin = req.user?.role === 'admin';
  res.json(await toProblemFull(row, req.user?.role === 'student' ? req.user.id : undefined, isAdmin));
});

app.post('/api/problems', requireAuth, requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.statement) return res.status(400).json({ error: 'Title and statement are required.' });
  const id = newId('prob');
  await db.prepare(`
    INSERT INTO problems (id, title, difficulty, category, statement, input_format, output_format, constraints, examples, starter_templates, solved_count, attempt_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).run(
    id, b.title, b.difficulty || 'Easy', b.category || 'General', b.statement,
    b.inputFormat || '', b.outputFormat || '', b.constraints || '',
    JSON.stringify(b.examples || []),
    JSON.stringify(b.starterTemplates || {
      Python: '# Read input, write your solution, print output\n',
      C: '#include <stdio.h>\nint main() {\n    // Read input, write your solution, print output\n    return 0;\n}',
      'C++': '#include <iostream>\nusing namespace std;\nint main() {\n    // Read input, write your solution, print output\n    return 0;\n}',
      Java: 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Read input, write your solution, print output\n    }\n}'
    }),
    nowIso()
  );
  const insertTC = db.prepare(`INSERT INTO test_cases (id, problem_id, input, expected_output, is_public, ord) VALUES (?, ?, ?, ?, ?, ?)`);
  for (const [idx, tc] of (b.testCases || []).entries()) {
    await insertTC.run(newId('tc'), id, tc.input || '', tc.expectedOutput || '', tc.isPublic ? 1 : 0, idx);
  }
  const row = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(id);
  res.status(201).json(await toProblemFull(row, undefined, true));
});

/**
 * Bulk import: accepts { problems: [...] } where each entry has the same shape as the
 * single-create payload above. Each problem gets its own generated id and is inserted
 * independently - one bad entry doesn't abort the rest of the batch. Returns a per-item
 * report so the admin UI can show exactly what succeeded/failed and why.
 */
app.post('/api/problems/bulk', requireAuth, requireAdmin, async (req, res) => {
  const items = Array.isArray(req.body?.problems) ? req.body.problems : null;
  if (!items) return res.status(400).json({ error: 'Body must be { "problems": [ ... ] }.' });
  if (items.length === 0) return res.status(400).json({ error: 'The problems array is empty.' });
  if (items.length > 500) return res.status(400).json({ error: 'Max 500 problems per import - split into smaller batches.' });

  const results: { index: number; title?: string; success: boolean; id?: string; error?: string }[] = [];
  const insertTC = db.prepare(`INSERT INTO test_cases (id, problem_id, input, expected_output, is_public, ord) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertProblem = db.prepare(`
    INSERT INTO problems (id, title, difficulty, category, statement, input_format, output_format, constraints, examples, starter_templates, solved_count, attempt_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `);

  for (const [index, b] of items.entries()) {
    try {
      if (!b || !b.title || !b.statement) {
        results.push({ index, title: b?.title, success: false, error: 'Missing required field: title and statement are both required.' });
        continue;
      }
      if (!Array.isArray(b.testCases) || b.testCases.filter((tc: any) => tc.isPublic).length === 0) {
        results.push({ index, title: b.title, success: false, error: 'At least one public test case is required.' });
        continue;
      }
      const id = newId('prob');
      await insertProblem.run(
        id, b.title, b.difficulty || 'Easy', b.category || 'General', b.statement,
        b.inputFormat || '', b.outputFormat || '', b.constraints || '',
        JSON.stringify(b.examples || []),
        JSON.stringify(b.starterTemplates || {
          Python: '# Read input, write your solution, print output\n',
          C: '#include <stdio.h>\nint main() {\n    // Read input, write your solution, print output\n    return 0;\n}',
          'C++': '#include <iostream>\nusing namespace std;\nint main() {\n    // Read input, write your solution, print output\n    return 0;\n}',
          Java: 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Read input, write your solution, print output\n    }\n}'
        }),
        nowIso()
      );
      for (const [idx, tc] of b.testCases.entries()) {
        await insertTC.run(newId('tc'), id, tc.input || '', tc.expectedOutput || '', tc.isPublic ? 1 : 0, idx);
      }
      results.push({ index, title: b.title, success: true, id });
    } catch (err: any) {
      results.push({ index, title: b?.title, success: false, error: err?.message || String(err) });
    }
  }

  const successCount = results.filter(r => r.success).length;
  res.status(201).json({ total: items.length, succeeded: successCount, failed: items.length - successCount, results });
});

app.put('/api/problems/:id', requireAuth, requireAdmin, async (req, res) => {
  const existing = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Problem not found.' });
  const b = req.body || {};
  // Fall back to the existing row's values for any field the caller omitted, rather than
  // writing NULL into a NOT NULL column (which previously crashed the whole server process -
  // see the global error handler below for why a single bad request can no longer do that).
  await db.prepare(`
    UPDATE problems SET title=?, difficulty=?, category=?, statement=?, input_format=?, output_format=?, constraints=?, examples=?, starter_templates=?
    WHERE id=?
  `).run(
    b.title ?? existing.title, b.difficulty ?? existing.difficulty, b.category ?? existing.category,
    b.statement ?? existing.statement, b.inputFormat ?? existing.input_format, b.outputFormat ?? existing.output_format,
    b.constraints ?? existing.constraints,
    JSON.stringify(b.examples ?? JSON.parse(existing.examples || '[]')),
    JSON.stringify(b.starterTemplates ?? JSON.parse(existing.starter_templates || '{}')),
    req.params.id
  );
  if (Array.isArray(b.testCases)) {
    await db.prepare(`DELETE FROM test_cases WHERE problem_id=?`).run(req.params.id);
    const insertTC = db.prepare(`INSERT INTO test_cases (id, problem_id, input, expected_output, is_public, ord) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const [idx, tc] of b.testCases.entries()) {
      await insertTC.run(tc.id && tc.id.startsWith('tc-') ? tc.id : newId('tc'), req.params.id, tc.input || '', tc.expectedOutput || '', tc.isPublic ? 1 : 0, idx);
    }
  }
  const row = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(req.params.id);
  res.json(await toProblemFull(row, undefined, true));
});

app.delete('/api/problems/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await db.prepare(`DELETE FROM problems WHERE id=?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Problem not found.' });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Submissions / Judge - async, queued (like a real judge worker pool)
// ---------------------------------------------------------------------------

const STAR_THRESHOLDS = [0, 50, 150, 350, 700]; // points required for 1★, 2★, 3★, 4★, 5★
function computeStarRating(points: number): number {
  let stars = 1;
  for (let i = 1; i < STAR_THRESHOLDS.length; i++) {
    if (points >= STAR_THRESHOLDS[i]) stars = i + 1;
  }
  return stars;
}

function langToJudge(lang: string): Language {
  if (lang === 'C++' || lang === 'C' || lang === 'Java' || lang === 'Python') return lang;
  return 'Python';
}

interface RunJob {
  status: 'Queued' | 'Running' | 'Done' | 'Error';
  userId: string;
  createdAt: number;
  result?: any;
  error?: string;
}
const runJobs = new Map<string, RunJob>();
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, job] of runJobs) if (job.createdAt < cutoff) runJobs.delete(id);
}, 60 * 1000).unref();

app.get('/api/submissions/queue-status', (_req, res) => {
  res.json(queueStats());
});

app.post('/api/submissions/run', requireAuth, async (req: AuthedRequest, res) => {
  const { problemId, language, code, customInput } = req.body || {};
  const probRow = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(problemId);
  if (!probRow) return res.status(404).json({ error: 'Problem not found.' });

  const runId = newId('run');
  runJobs.set(runId, { status: 'Queued', userId: req.user!.id, createdAt: Date.now() });
  res.status(202).json({ runId, status: 'Queued', ...queueStats() });

  runQueued(async () => {
    const job = runJobs.get(runId);
    if (job) job.status = 'Running';

    if (typeof customInput === 'string' && customInput.length > 0) {
      const result = await runCustom(langToJudge(language), code, customInput);
      runJobs.set(runId, { status: 'Done', userId: req.user!.id, createdAt: Date.now(), result: { mode: 'custom', ...result } });
      return;
    }

    const allCases = await getTestCases(problemId);
    const publicCases = allCases.filter((tc: any) => tc.is_public);
    const summary = await judge(langToJudge(language), code, publicCases.map((tc: any) => ({ input: tc.input, expectedOutput: tc.expected_output, isPublic: true })));
    runJobs.set(runId, {
      status: 'Done', userId: req.user!.id, createdAt: Date.now(),
      result: {
        mode: 'public-tests',
        status: summary.overallStatus,
        compileError: summary.compileError,
        timeMs: summary.timeMs,
        memoryKb: summary.memoryKb,
        testCasesChecked: summary.cases.map(c => ({
          input: c.input, expected: c.expected, actual: c.stdout || c.stderr || '', passed: c.passed, isPublic: true,
        })),
      },
    });
  }).catch((err) => {
    runJobs.set(runId, { status: 'Error', userId: req.user!.id, createdAt: Date.now(), error: String(err) });
  });
});

app.get('/api/submissions/run/:runId', requireAuth, (req: AuthedRequest, res) => {
  const job = runJobs.get(req.params.runId);
  if (!job || job.userId !== req.user!.id) return res.status(404).json({ error: 'Run job not found.' });
  if (job.status === 'Done') return res.json({ jobState: 'Done', ...job.result });
  if (job.status === 'Error') return res.status(500).json({ jobState: 'Error', error: job.error });
  res.json({ jobState: job.status, ...queueStats() });
});

app.post('/api/submissions/submit', requireAuth, async (req: AuthedRequest, res) => {
  const { problemId, language, code, contestId } = req.body || {};
  if (req.user!.role !== 'student') return res.status(403).json({ error: 'Only students can submit solutions.' });
  const probRow = await db.prepare(`SELECT * FROM problems WHERE id=?`).get(problemId);
  if (!probRow) return res.status(404).json({ error: 'Problem not found.' });

  if (contestId) {
    const contestRow = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(contestId);
    if (!contestRow) return res.status(404).json({ error: 'Contest not found.' });
    const now = Date.now();
    const CONTEST_END_GRACE_MS = Number(process.env.CONTEST_END_GRACE_MS) || 5000;
    if (now < new Date(contestRow.start_time).getTime() || now > new Date(contestRow.end_time).getTime() + CONTEST_END_GRACE_MS) {
      return res.status(400).json({ error: 'This contest is not currently live.' });
    }
    const registered = await db.prepare(`SELECT 1 FROM contest_registrations WHERE contest_id=? AND user_id=?`).get(contestId, req.user!.id);
    if (!registered) return res.status(403).json({ error: 'You are not registered for this contest.' });
    const belongsToContest = await db.prepare(`SELECT 1 FROM contest_problems WHERE contest_id=? AND problem_id=?`).get(contestId, problemId);
    if (!belongsToContest) return res.status(400).json({ error: 'This problem is not part of this contest.' });
  }

  const rate = checkRateLimit(req.user!.id);
  if (!rate.ok) return res.status(429).json({ error: (rate as any).reason });

  const subId = newId('sub');
  await db.prepare(`
    INSERT INTO submissions (id, user_id, problem_id, language, code, status, execution_time_ms, memory_kb, result_json, contest_id, submitted_at)
    VALUES (?, ?, ?, ?, ?, 'Queued', 0, 0, '{}', ?, ?)
  `).run(subId, req.user!.id, problemId, language, code, contestId || null, nowIso());

  markSubmitted(req.user!.id);
  res.status(202).json({ submissionId: subId, status: 'Queued', ...queueStats() });

  runQueued(async () => {
    await db.prepare(`UPDATE submissions SET status='Running' WHERE id=?`).run(subId);

    const allCases = await getTestCases(problemId);
    const summary = await judge(langToJudge(language), code, allCases.map((tc: any) => ({ input: tc.input, expectedOutput: tc.expected_output, isPublic: !!tc.is_public })));

    const testCasesChecked = summary.cases.map(c => ({
      input: c.input, expected: c.expected, actual: c.stdout || c.stderr || '', passed: c.passed, isPublic: c.isPublic,
    }));

    await db.prepare(`UPDATE submissions SET status=?, execution_time_ms=?, memory_kb=?, result_json=? WHERE id=?`)
      .run(summary.overallStatus, summary.timeMs, summary.memoryKb, JSON.stringify({ compileError: summary.compileError, testCasesChecked }), subId);

    await db.prepare(`UPDATE problems SET attempt_count = attempt_count + 1 WHERE id=?`).run(problemId);

    if (summary.overallStatus === 'Accepted') {
      const alreadySolvedBefore = !!(await db.prepare(`
        SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND status='Accepted' AND id != ? LIMIT 1
      `).get(req.user!.id, problemId, subId));

      if (!alreadySolvedBefore) {
        await db.prepare(`UPDATE problems SET solved_count = solved_count + 1 WHERE id=?`).run(problemId);
        const pointsAward = probRow.difficulty === 'Hard' ? 50 : probRow.difficulty === 'Medium' ? 25 : 10;
        const col = probRow.difficulty === 'Hard' ? 'hard_solved' : probRow.difficulty === 'Medium' ? 'medium_solved' : 'easy_solved';
        const userRow = await db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user!.id);
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        let newStreak = userRow.streak;
        if (userRow.last_solved_date === today) {
          // already solved something today, streak unchanged
        } else if (userRow.last_solved_date === yesterday) {
          newStreak = userRow.streak + 1;
        } else {
          newStreak = 1;
        }
        // Postgres has no scalar MAX(a, b) - GREATEST is the equivalent (MAX is aggregate-only in Postgres).
        await db.prepare(`
          UPDATE users SET ${col} = ${col} + 1, points = points + ?, streak = ?, last_solved_date = ?,
            level = 1 + CAST((easy_solved + medium_solved + hard_solved + 1) / 5 AS INTEGER),
            star_rating = GREATEST(star_rating, ?)
          WHERE id=?
        `).run(pointsAward, newStreak, today, computeStarRating(userRow.points + pointsAward), req.user!.id);
      }
    }
  }).catch(async (err) => {
    await db.prepare(`UPDATE submissions SET status='Runtime Error', result_json=? WHERE id=?`)
      .run(JSON.stringify({ compileError: String(err), testCasesChecked: [] }), subId);
  }).finally(() => {
    markFinished(req.user!.id);
  });
});

app.get('/api/submissions/mine', requireAuth, async (req: AuthedRequest, res) => {
  const rows = await db.prepare(`
    SELECT s.*, p.title as problem_title FROM submissions s
    JOIN problems p ON p.id = s.problem_id
    WHERE s.user_id = ? ORDER BY s.submitted_at DESC LIMIT 100
  `).all(req.user!.id);
  res.json(rows.map((r: any) => ({
    id: r.id, problemId: r.problem_id, problemTitle: r.problem_title, language: r.language,
    status: r.status, submittedAt: r.submitted_at, executionTimeMs: r.execution_time_ms, memoryKb: r.memory_kb,
  })));
});

app.get('/api/submissions/:id', requireAuth, async (req: AuthedRequest, res) => {
  const row = await db.prepare(`SELECT * FROM submissions WHERE id=?`).get(req.params.id);
  if (!row || row.user_id !== req.user!.id) return res.status(404).json({ error: 'Submission not found.' });
  const extra = JSON.parse(row.result_json || '{}');
  res.json({
    submissionId: row.id,
    status: row.status,
    timeMs: row.execution_time_ms,
    memoryKb: row.memory_kb,
    compileError: extra.compileError,
    testCasesChecked: extra.testCasesChecked || [],
    ...((row.status === 'Queued' || row.status === 'Running') ? queueStats() : {}),
  });
});

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

app.get('/api/quizzes', optionalAuth, async (req, res) => {
  const rows = await db.prepare(`SELECT * FROM quizzes ORDER BY start_time DESC`).all();
  res.json(await Promise.all(rows.map((r: any) => toQuizSummary(r))));
});

app.get('/api/quizzes/:id', requireAuth, async (req: AuthedRequest, res) => {
  const row = await db.prepare(`SELECT * FROM quizzes WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Quiz not found.' });
  const attempt = await db.prepare(`SELECT * FROM quiz_attempts WHERE quiz_id=? AND user_id=?`).get(req.params.id, req.user!.id);
  res.json({ ...(await toQuizFull(row)), myAttempt: attempt ? { score: attempt.score, maxScore: attempt.max_score, submittedAt: attempt.submitted_at, answers: JSON.parse(attempt.answers) } : null });
});

app.post('/api/quizzes', requireAuth, requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Quiz title is required.' });
  const id = newId('quiz');
  const durationMinutes = b.durationMinutes || 60;
  const startTime = b.startTime || new Date().toISOString();
  const endTime = b.endTime || new Date(Date.now() + durationMinutes * 60000).toISOString();
  await db.prepare(`
    INSERT INTO quizzes (id, title, description, start_time, end_time, duration_minutes, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.title, b.description || '', startTime, endTime, durationMinutes, b.status || 'Upcoming', nowIso());

  const insertQ = db.prepare(`
    INSERT INTO quiz_questions (id, quiz_id, question_text, type, options, correct_option, coding_problem_id, points, difficulty, ord)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [idx, q] of (b.questions || []).entries()) {
    await insertQ.run(
      newId('q'), id, q.questionText, q.type,
      q.type === 'multiple-choice' ? JSON.stringify(q.options || []) : null,
      q.type === 'multiple-choice' ? (q.correctOption ?? 0) : null,
      q.type === 'coding' ? (q.codingProblemId || q.codingProblem?.id || null) : null,
      q.points || 5, q.difficulty || 'Easy', idx
    );
  }

  const row = await db.prepare(`SELECT * FROM quizzes WHERE id=?`).get(id);
  res.status(201).json(await toQuizFull(row));
});

app.put('/api/quizzes/:id', requireAuth, requireAdmin, async (req, res) => {
  const existing = await db.prepare(`SELECT * FROM quizzes WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Quiz not found.' });
  const b = req.body || {};
  await db.prepare(`
    UPDATE quizzes SET title=?, description=?, duration_minutes=?, status=? WHERE id=?
  `).run(b.title, b.description || '', b.durationMinutes || 60, b.status || 'Upcoming', req.params.id);

  if (Array.isArray(b.questions)) {
    await db.prepare(`DELETE FROM quiz_questions WHERE quiz_id=?`).run(req.params.id);
    const insertQ = db.prepare(`
      INSERT INTO quiz_questions (id, quiz_id, question_text, type, options, correct_option, coding_problem_id, points, difficulty, ord)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [idx, q] of b.questions.entries()) {
      await insertQ.run(
        q.id && q.id.startsWith('q-') ? q.id : newId('q'), req.params.id, q.questionText, q.type,
        q.type === 'multiple-choice' ? JSON.stringify(q.options || []) : null,
        q.type === 'multiple-choice' ? (q.correctOption ?? 0) : null,
        q.type === 'coding' ? (q.codingProblemId || q.codingProblem?.id || null) : null,
        q.points || 5, q.difficulty || 'Easy', idx
      );
    }
  }
  const row = await db.prepare(`SELECT * FROM quizzes WHERE id=?`).get(req.params.id);
  res.json(await toQuizFull(row));
});

app.delete('/api/quizzes/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await db.prepare(`DELETE FROM quizzes WHERE id=?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Quiz not found.' });
  res.json({ success: true });
});

app.post('/api/quizzes/:id/submit', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role !== 'student') return res.status(403).json({ error: 'Only students can submit quiz attempts.' });
  const quizRow = await db.prepare(`SELECT * FROM quizzes WHERE id=?`).get(req.params.id);
  if (!quizRow) return res.status(404).json({ error: 'Quiz not found.' });

  const answers = (req.body && req.body.answers) || {};
  const questions = await db.prepare(`SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY ord ASC`).all(req.params.id);

  let score = 0;
  let maxScore = 0;
  const breakdown: any[] = [];

  for (const q of questions) {
    maxScore += q.points;
    if (q.type === 'multiple-choice') {
      const selected = answers[q.id];
      const correct = selected === q.correct_option;
      if (correct) score += q.points;
      breakdown.push({ questionId: q.id, type: q.type, correct, awarded: correct ? q.points : 0 });
    } else if (q.type === 'coding' && q.coding_problem_id) {
      const code = answers[q.id];
      if (typeof code === 'string' && code.trim().length > 0) {
        const cases = await getTestCases(q.coding_problem_id);
        const lang = (answers[`${q.id}__lang`] as Language) || 'Python';
        const summary = await runQueued(() => judge(lang, code, cases.map((tc: any) => ({ input: tc.input, expectedOutput: tc.expected_output }))));
        const passedAll = summary.overallStatus === 'Accepted';
        const passedCount = summary.cases.filter(c => c.passed).length;
        const partialCredit = cases.length > 0 ? Math.round((passedCount / cases.length) * q.points) : 0;
        const awarded = passedAll ? q.points : partialCredit;
        score += awarded;
        breakdown.push({ questionId: q.id, type: q.type, status: summary.overallStatus, awarded });
      } else {
        breakdown.push({ questionId: q.id, type: q.type, status: 'No submission', awarded: 0 });
      }
    }
  }

  const existing = await db.prepare(`SELECT id FROM quiz_attempts WHERE quiz_id=? AND user_id=?`).get(req.params.id, req.user!.id);
  if (existing) {
    await db.prepare(`UPDATE quiz_attempts SET answers=?, score=?, max_score=?, submitted_at=? WHERE quiz_id=? AND user_id=?`)
      .run(JSON.stringify(answers), score, maxScore, nowIso(), req.params.id, req.user!.id);
  } else {
    await db.prepare(`INSERT INTO quiz_attempts (id, quiz_id, user_id, answers, score, max_score, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(newId('attempt'), req.params.id, req.user!.id, JSON.stringify(answers), score, maxScore, nowIso());
  }

  await db.prepare(`UPDATE users SET points = points + ? WHERE id=?`).run(score, req.user!.id);

  res.json({ score, maxScore, breakdown });
});

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

app.get('/api/leaderboard', async (_req, res) => {
  const rows = await db.prepare(`
    SELECT id, full_name, roll_number, star_rating, streak, points, easy_solved, medium_solved, hard_solved
    FROM users WHERE role='student'
    ORDER BY points DESC, (easy_solved + medium_solved + hard_solved) DESC
  `).all();
  res.json(rows.map((r: any, idx: number) => ({
    rank: idx + 1,
    studentId: r.id,
    fullName: r.full_name,
    rollNumber: r.roll_number,
    solvedCount: r.easy_solved + r.medium_solved + r.hard_solved,
    points: r.points,
    streak: r.streak,
    starRating: r.star_rating,
  })));
});

// ---------------------------------------------------------------------------
// Admin: student management + platform stats
// ---------------------------------------------------------------------------

app.get('/api/admin/students', requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.prepare(`SELECT * FROM users WHERE role='student' ORDER BY created_at DESC`).all();
  const ranked = await db.prepare(`SELECT id FROM users WHERE role='student' ORDER BY points DESC`).all();
  const rankMap = new Map(ranked.map((r: any, idx: number) => [r.id, idx + 1]));
  res.json(rows.map((r: any) => ({ ...toStudent(r), rank: rankMap.get(r.id) || 0 })));
});

app.put('/api/admin/students/:id', requireAuth, requireAdmin, async (req, res) => {
  const existing = await db.prepare(`SELECT * FROM users WHERE id=? AND role='student'`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found.' });
  const b = req.body || {};
  await db.prepare(`
    UPDATE users SET full_name=?, roll_number=?, email=?, star_rating=?, level=?, streak=?,
      easy_solved=?, medium_solved=?, hard_solved=?
    WHERE id=?
  `).run(
    b.fullName ?? existing.full_name, b.rollNumber ?? existing.roll_number, b.email ?? existing.email,
    b.starRating ?? existing.star_rating, b.level ?? existing.level, b.streak ?? existing.streak,
    b.problemsSolved?.easy ?? existing.easy_solved, b.problemsSolved?.medium ?? existing.medium_solved,
    b.problemsSolved?.hard ?? existing.hard_solved, req.params.id
  );
  const row = await db.prepare(`SELECT * FROM users WHERE id=?`).get(req.params.id);
  res.json(toStudent(row));
});

app.delete('/api/admin/students/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await db.prepare(`DELETE FROM users WHERE id=? AND role='student'`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Student not found.' });
  res.json({ success: true });
});

app.get('/api/admin/stats', requireAuth, requireAdmin, async (_req, res) => {
  const totalStudents = (await db.prepare(`SELECT COUNT(*)::int c FROM users WHERE role='student'`).get()).c;
  const totalProblems = (await db.prepare(`SELECT COUNT(*)::int c FROM problems`).get()).c;
  const totalQuizzes = (await db.prepare(`SELECT COUNT(*)::int c FROM quizzes`).get()).c;
  const totalSubmissions = (await db.prepare(`SELECT COUNT(*)::int c FROM submissions`).get()).c;

  // Real Postgres database size, not an estimate - so admins can actually watch usage trend
  // toward a free-tier limit (e.g. Supabase's 500MB) instead of finding out when it's too late.
  let databaseSizeBytes = 0;
  let largestTables: { table: string; bytes: number }[] = [];
  try {
    databaseSizeBytes = Number((await db.prepare(`SELECT pg_database_size(current_database()) AS b`).get()).b);
    const tableRows = await db.prepare(`
      SELECT relname AS table, pg_total_relation_size(relid) AS bytes
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY bytes DESC
      LIMIT 5
    `).all();
    largestTables = tableRows.map((r: any) => ({ table: r.table, bytes: Number(r.bytes) }));
  } catch {
    // pg_database_size/pg_statio_user_tables need SELECT privilege the DB role might not have
    // on some managed providers - degrade gracefully rather than failing the whole stats call.
  }

  res.json({ totalStudents, totalProblems, totalQuizzes, totalSubmissions, databaseSizeBytes, largestTables });
});

// ---------------------------------------------------------------------------
// Health check + static frontend serving (production)
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/contests', contestsRouter);

const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Global error-handling middleware - the last line of defense for any route handler that
// throws or rejects without its own try/catch. Express 4 doesn't auto-catch async errors, so
// without this (and the process-level handlers below), a single bad request that trips an
// unhandled DB error could crash the entire server process instead of just failing that one
// request - unacceptable if it happens mid-contest. Must be registered after all routes.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled route error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
});

// Last-resort safety net: if something still escapes the middleware above (e.g. an error in
// code that isn't part of the Express request/response cycle at all), log it and keep the
// process alive rather than let Node's default behavior take the whole server down.
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection (server staying up):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception (server staying up):', err);
});

async function start() {
  await initSchema();
  await seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`[server] SkillForge Code API listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
