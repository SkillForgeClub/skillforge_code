import { db, pool } from './db.js';

const STAR_THRESHOLDS = [1500, 2500, 4000, 5500, 6500];

function computeStarRating(points: number): number {
  let stars = 1;
  for (let index = 1; index < STAR_THRESHOLDS.length; index++) {
    if (points >= STAR_THRESHOLDS[index]) stars = index + 1;
  }
  return stars;
}

export async function getContestPointMode(submissionId: string): Promise<'legacy' | 'deferred' | 'ineligible'> {
  let row: any;
  try {
    row = await db.prepare(`
      SELECT s.submitted_at, c.start_time, c.end_time, c.profile_points_eligible_from
      FROM submissions s JOIN contests c ON c.id=s.contest_id
      WHERE s.id=?
    `).get(submissionId);
  } catch (error) {
    console.error('[contest-points] Could not classify submission; deferring its profile points:', error);
    return 'deferred';
  }
  if (!row) return 'ineligible';

  const submittedAt = new Date(row.submitted_at).getTime();
  const startTime = new Date(row.start_time).getTime();
  const endTime = new Date(row.end_time).getTime();
  if (submittedAt < startTime || submittedAt > endTime) return 'ineligible';

  const eligibleFrom = new Date(row.profile_points_eligible_from || row.start_time).getTime();
  return submittedAt < eligibleFrom ? 'legacy' : 'deferred';
}

export async function settleCompletedContestPoints(contestId?: string): Promise<number> {
  const settledAt = new Date().toISOString();
  const settlementCutoff = new Date(Date.now() - (Number(process.env.CONTEST_END_GRACE_MS) || 5000)).toISOString();
  const contests = contestId
    ? await db.prepare(`SELECT id FROM contests WHERE id=? AND end_time<=? AND profile_points_awarded_at IS NULL`).all(contestId, settlementCutoff)
    : await db.prepare(`SELECT id FROM contests WHERE end_time<=? AND profile_points_awarded_at IS NULL`).all(settlementCutoff);

  let settledCount = 0;
  for (const contest of contests) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lockedContest = await client.query(
        `SELECT id, start_time, end_time, profile_points_eligible_from FROM contests
         WHERE id=$1 AND end_time<=$2 AND profile_points_awarded_at IS NULL
         FOR UPDATE`,
        [contest.id, settlementCutoff]
      );
      const row = lockedContest.rows[0];
      if (!row) {
        await client.query('COMMIT');
        continue;
      }

      const pending = await client.query(
        `SELECT 1 FROM submissions
         WHERE contest_id=$1 AND submitted_at<=$2 AND status IN ('Queued','Running')
         LIMIT 1`,
        [contest.id, row.end_time]
      );
      if (pending.rowCount) {
        await client.query('COMMIT');
        continue;
      }

      const awards = await client.query(
        `SELECT accepted.user_id, SUM(cp.points)::int AS points
         FROM (
           SELECT DISTINCT ON (s.user_id, s.problem_id) s.user_id, s.problem_id
           FROM submissions s
           WHERE s.contest_id=$1 AND s.status='Accepted'
             AND s.submitted_at >= $2 AND s.submitted_at <= $3
           ORDER BY s.user_id, s.problem_id, s.submitted_at ASC, s.id ASC
         ) accepted
         JOIN contest_problems cp ON cp.contest_id=$1 AND cp.problem_id=accepted.problem_id
         GROUP BY accepted.user_id
         ORDER BY accepted.user_id`,
        [contest.id, row.profile_points_eligible_from || row.start_time, row.end_time]
      );

      for (const award of awards.rows) {
        const user = await client.query(`SELECT points FROM users WHERE id=$1 FOR UPDATE`, [award.user_id]);
        if (!user.rows[0]) continue;
        const pointsToAdd = Number(award.points) || 0;
        const newPoints = Number(user.rows[0].points) + pointsToAdd;
        await client.query(
          `UPDATE users SET points=points+$1, star_rating=GREATEST(star_rating, $2) WHERE id=$3`,
          [pointsToAdd, computeStarRating(newPoints), award.user_id]
        );
      }

      await client.query(
        `UPDATE contests SET profile_points_awarded_at=$1 WHERE id=$2`,
        [settledAt, contest.id]
      );
      await client.query('COMMIT');
      settledCount++;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return settledCount;
}