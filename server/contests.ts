/**
 * Contest module: time-boxed, multi-problem coding contests with registration
 * and an ICPC-style live leaderboard (points for solved problems, ranked by
 * total points then total penalty time - wrong attempts before an accept add
 * a time penalty, same model Codeforces/ICPC use).
 */
import express from 'express';
import crypto from 'crypto';
import { db } from './db.js';
import { requireAuth, requireAdmin, optionalAuth, AuthedRequest } from './auth.js';

export const contestsRouter = express.Router();

function newId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}
function nowIso() {
  return new Date().toISOString();
}

const PENALTY_MINUTES_PER_WRONG_ATTEMPT = 20;

function contestStatus(row: any): 'Upcoming' | 'Live' | 'Ended' {
  const now = Date.now();
  const start = new Date(row.start_time).getTime();
  const end = new Date(row.end_time).getTime();
  if (now < start) return 'Upcoming';
  if (now > end) return 'Ended';
  return 'Live';
}

async function toContestSummary(row: any, userId?: string) {
  const problemCount = (await db.prepare(`SELECT COUNT(*)::int c FROM contest_problems WHERE contest_id=?`).get(row.id)).c;
  const registeredCount = (await db.prepare(`SELECT COUNT(*)::int c FROM contest_registrations WHERE contest_id=?`).get(row.id)).c;
  const isRegistered = userId
    ? !!(await db.prepare(`SELECT 1 FROM contest_registrations WHERE contest_id=? AND user_id=?`).get(row.id, userId))
    : false;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    status: contestStatus(row),
    problemCount,
    registeredCount,
    isRegistered,
  };
}

// ---------------------------------------------------------------------------
// List / detail
// ---------------------------------------------------------------------------

contestsRouter.get('/', optionalAuth, async (req: AuthedRequest, res) => {
  const rows = await db.prepare(`SELECT * FROM contests ORDER BY start_time DESC`).all();
  const userId = req.user?.role === 'student' ? req.user.id : undefined;
  res.json(await Promise.all(rows.map((r: any) => toContestSummary(r, userId))));
});

contestsRouter.get('/:id', optionalAuth, async (req: AuthedRequest, res) => {
  const row = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Contest not found.' });

  const status = contestStatus(row);
  const userId = req.user?.role === 'student' ? req.user.id : undefined;
  const isRegistered = userId ? !!(await db.prepare(`SELECT 1 FROM contest_registrations WHERE contest_id=? AND user_id=?`).get(row.id, userId)) : false;
  const isAdmin = req.user?.role === 'admin';

  const problemRows = await db.prepare(`
    SELECT cp.*, p.title, p.difficulty, p.category, p.statement, p.input_format, p.output_format, p.constraints, p.examples, p.starter_templates
    FROM contest_problems cp JOIN problems p ON p.id = cp.problem_id
    WHERE cp.contest_id=? ORDER BY cp.ord ASC
  `).all(req.params.id);

  // Before the contest starts (and unless you're an admin), problems are listed but not revealed.
  const revealDetails = status !== 'Upcoming' || isAdmin;

  const problems = await Promise.all(problemRows.map(async (p: any) => {
    let solveStatus: 'Solved' | 'Attempted' | 'Unsolved' = 'Unsolved';
    if (userId) {
      const solved = await db.prepare(`SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND contest_id=? AND status='Accepted' LIMIT 1`).get(userId, p.problem_id, row.id);
      if (solved) solveStatus = 'Solved';
      else {
        const attempted = await db.prepare(`SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND contest_id=? LIMIT 1`).get(userId, p.problem_id, row.id);
        if (attempted) solveStatus = 'Attempted';
      }
    }
    const base: any = { problemId: p.problem_id, label: p.label, points: p.points, title: p.title, difficulty: p.difficulty, status: solveStatus };
    if (revealDetails) {
      const allCases = await db.prepare(`SELECT * FROM test_cases WHERE problem_id=? ORDER BY ord ASC`).all(p.problem_id);
      const testCases = allCases
        .filter((tc: any) => isAdmin || tc.is_public)
        .map((tc: any) => ({ id: tc.id, input: tc.input, expectedOutput: tc.expected_output, isPublic: !!tc.is_public }));
      Object.assign(base, {
        category: p.category, statement: p.statement, inputFormat: p.input_format, outputFormat: p.output_format,
        constraints: p.constraints, examples: JSON.parse(p.examples || '[]'), starterTemplates: JSON.parse(p.starter_templates || '{}'),
        testCases,
      });
    }
    return base;
  }));

  res.json({ ...(await toContestSummary(row, userId)), problems, isRegistered });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

contestsRouter.post('/:id/register', requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role !== 'student') return res.status(403).json({ error: 'Only students can register for contests.' });
  const row = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Contest not found.' });
  if (contestStatus(row) === 'Ended') return res.status(400).json({ error: 'This contest has already ended.' });

  try {
    await db.prepare(`INSERT INTO contest_registrations (contest_id, user_id, registered_at) VALUES (?, ?, ?)`).run(req.params.id, req.user!.id, nowIso());
  } catch {
    // Already registered - fine, treat as idempotent.
  }
  res.json({ success: true, isRegistered: true });
});

// ---------------------------------------------------------------------------
// Live leaderboard (ICPC-style: points desc, penalty minutes asc)
// ---------------------------------------------------------------------------

contestsRouter.get('/:id/leaderboard', async (req, res) => {
  const contest = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Contest not found.' });

  const contestProblems = await db.prepare(`SELECT problem_id, label, points FROM contest_problems WHERE contest_id=?`).all(req.params.id);
  const registered = await db.prepare(`
    SELECT u.id, u.full_name, u.roll_number FROM contest_registrations cr
    JOIN users u ON u.id = cr.user_id WHERE cr.contest_id=?
  `).all(req.params.id);

  const contestStart = new Date(contest.start_time).getTime();

  const standings = await Promise.all(registered.map(async (user: any) => {
    let totalPoints = 0;
    let totalPenaltyMinutes = 0;
    let solvedCount = 0;
    const perProblem: Record<string, { solved: boolean; attempts: number; points: number; penaltyMinutes: number }> = {};

    for (const cp of contestProblems) {
      const subs = await db.prepare(`
        SELECT status, submitted_at FROM submissions
        WHERE user_id=? AND problem_id=? AND contest_id=?
        ORDER BY submitted_at ASC
      `).all(user.id, cp.problem_id, req.params.id);

      let wrongBeforeAccept = 0;
      let acceptedAt: number | null = null;
      for (const s of subs) {
        if (s.status === 'Accepted') { acceptedAt = new Date(s.submitted_at).getTime(); break; }
        if (s.status !== 'Queued' && s.status !== 'Running') wrongBeforeAccept++;
      }

      if (acceptedAt !== null) {
        const minutesToSolve = Math.max(0, Math.round((acceptedAt - contestStart) / 60000));
        const penalty = wrongBeforeAccept * PENALTY_MINUTES_PER_WRONG_ATTEMPT;
        totalPoints += cp.points;
        totalPenaltyMinutes += minutesToSolve + penalty;
        solvedCount++;
        perProblem[cp.problem_id] = { solved: true, attempts: wrongBeforeAccept + 1, points: cp.points, penaltyMinutes: minutesToSolve + penalty };
      } else if (subs.length > 0) {
        perProblem[cp.problem_id] = { solved: false, attempts: subs.length, points: 0, penaltyMinutes: 0 };
      }
    }

    return {
      userId: user.id,
      fullName: user.full_name,
      rollNumber: user.roll_number,
      solvedCount,
      totalPoints,
      totalPenaltyMinutes,
      perProblem,
    };
  }));

  standings.sort((a, b) => b.totalPoints - a.totalPoints || a.totalPenaltyMinutes - b.totalPenaltyMinutes);
  res.json(standings.map((s, idx) => ({ rank: idx + 1, ...s })));
});

// ---------------------------------------------------------------------------
// Admin: create / update / delete
// ---------------------------------------------------------------------------

contestsRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.startTime || !b.endTime) return res.status(400).json({ error: 'Title, start time, and end time are required.' });
  const id = newId('contest');
  await db.prepare(`INSERT INTO contests (id, title, description, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, b.title, b.description || '', b.startTime, b.endTime, nowIso());

  const insertCP = db.prepare(`INSERT INTO contest_problems (contest_id, problem_id, label, points, ord) VALUES (?, ?, ?, ?, ?)`);
  for (const [idx, p] of (b.problems || []).entries()) {
    await insertCP.run(id, p.problemId, p.label || String.fromCharCode(65 + idx), p.points || 100, idx);
  }

  const row = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(id);
  res.status(201).json(await toContestSummary(row));
});

contestsRouter.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const existing = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contest not found.' });
  const b = req.body || {};
  await db.prepare(`UPDATE contests SET title=?, description=?, start_time=?, end_time=? WHERE id=?`)
    .run(b.title, b.description || '', b.startTime, b.endTime, req.params.id);

  if (Array.isArray(b.problems)) {
    await db.prepare(`DELETE FROM contest_problems WHERE contest_id=?`).run(req.params.id);
    const insertCP = db.prepare(`INSERT INTO contest_problems (contest_id, problem_id, label, points, ord) VALUES (?, ?, ?, ?, ?)`);
    for (const [idx, p] of b.problems.entries()) {
      await insertCP.run(req.params.id, p.problemId, p.label || String.fromCharCode(65 + idx), p.points || 100, idx);
    }
  }
  const row = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(req.params.id);
  res.json(await toContestSummary(row));
});

/**
 * Quick admin action for contest-day recovery: extend (or shorten) a contest's end time by
 * N minutes, without needing to edit start time / problems / anything else. Built for the
 * "server hiccupped, everyone lost 10 minutes" scenario - a fast, low-risk fix during a live
 * event, distinct from the full edit form.
 */
contestsRouter.post('/:id/extend', requireAuth, requireAdmin, async (req, res) => {
  const existing = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contest not found.' });
  const minutes = Number(req.body?.minutes);
  if (!Number.isFinite(minutes) || minutes === 0) {
    return res.status(400).json({ error: 'Provide a non-zero number of minutes to extend (or shorten) by.' });
  }
  const newEndTime = new Date(new Date(existing.end_time).getTime() + minutes * 60000).toISOString();
  if (newEndTime <= existing.start_time) {
    return res.status(400).json({ error: 'This would make the contest end before it starts.' });
  }
  await db.prepare(`UPDATE contests SET end_time=? WHERE id=?`).run(newEndTime, req.params.id);
  const row = await db.prepare(`SELECT * FROM contests WHERE id=?`).get(req.params.id);
  res.json(await toContestSummary(row));
});

contestsRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await db.prepare(`DELETE FROM contests WHERE id=?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contest not found.' });
  res.json({ success: true });
});
