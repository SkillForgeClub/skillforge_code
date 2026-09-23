/**
 * PostgreSQL database setup for SkillForge Code.
 *
 * Migrated from SQLite (better-sqlite3) to Postgres (node-postgres / `pg`) for real
 * concurrent-write throughput at scale - see README "Database: SQLite vs Postgres"
 * for why and when this matters.
 *
 * `db.prepare(sql).get/all/run(...params)` below is a thin async-compatible shim over
 * `pg`, deliberately shaped like better-sqlite3's API. This let the migration replace the
 * driver without hand-rewriting the SQL text at all ~110 call sites across the server -
 * every call site just needed `await` added in front of it. Query text keeps using `?`
 * placeholders (translated to Postgres's `$1, $2, ...` automatically); `run()` returns
 * `{ changes }` instead of SQLite's `{ changes, lastInsertRowid }` since every table here
 * uses application-generated string IDs, never autoincrement.
 *
 * Connects via DATABASE_URL (e.g. a Supabase connection string). Falls back to a local
 * `skillforge` database on localhost for development, matching this repo's default setup.
 */
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/skillforge';

export const pool = new Pool({
  connectionString,
  // Supabase (and most managed Postgres) requires TLS; skip only for plain localhost dev.
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle Postgres client', err);
});

/** Translates SQLite-style `?` placeholders to Postgres's `$1, $2, ...` in call order. */
function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

class Statement {
  constructor(private sql: string) {}

  async run(...params: any[]): Promise<{ changes: number }> {
    const res = await pool.query(toPgPlaceholders(this.sql), params);
    return { changes: res.rowCount ?? 0 };
  }

  async get(...params: any[]): Promise<any> {
    const res = await pool.query(toPgPlaceholders(this.sql), params);
    return res.rows[0];
  }

  async all(...params: any[]): Promise<any[]> {
    const res = await pool.query(toPgPlaceholders(this.sql), params);
    return res.rows;
  }
}

export const db = {
  prepare(sql: string): Statement {
    return new Statement(sql);
  },
  /** Runs a block of DDL/multiple statements (schema setup) with no parameters. */
  async exec(sql: string): Promise<void> {
    await pool.query(sql);
  },
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  roll_number TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','admin')),
  star_rating INTEGER NOT NULL DEFAULT 1,
  level INTEGER NOT NULL DEFAULT 1,
  streak INTEGER NOT NULL DEFAULT 0,
  last_solved_date TEXT,
  easy_solved INTEGER NOT NULL DEFAULT 0,
  medium_solved INTEGER NOT NULL DEFAULT 0,
  hard_solved INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  certificates TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  category TEXT NOT NULL,
  statement TEXT NOT NULL,
  input_format TEXT NOT NULL DEFAULT '',
  output_format TEXT NOT NULL DEFAULT '',
  constraints TEXT NOT NULL DEFAULT '',
  examples TEXT NOT NULL DEFAULT '[]',
  starter_templates TEXT NOT NULL DEFAULT '{}',
  solved_count INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  time_limit_ms INTEGER,
  memory_limit_mb INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input TEXT NOT NULL DEFAULT '',
  expected_output TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0,
  ord INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  memory_kb INTEGER NOT NULL DEFAULT 0,
  result_json TEXT NOT NULL DEFAULT '{}',
  contest_id TEXT,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'Upcoming',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('multiple-choice','coding')),
  options TEXT,
  correct_option INTEGER,
  coding_problem_id TEXT,
  points INTEGER NOT NULL DEFAULT 5,
  difficulty TEXT DEFAULT 'Easy',
  ord INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers TEXT NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL,
  UNIQUE (quiz_id, user_id)
);

CREATE TABLE IF NOT EXISTS contests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contest_problems (
  contest_id TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'A',
  points INTEGER NOT NULL DEFAULT 100,
  ord INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, problem_id)
);

CREATE TABLE IF NOT EXISTS contest_registrations (
  contest_id TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at TEXT NOT NULL,
  PRIMARY KEY (contest_id, user_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contest ON submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_testcases_problem ON test_cases(problem_id);
CREATE INDEX IF NOT EXISTS idx_quizquestions_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_contestproblems_contest ON contest_problems(contest_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_points ON users(points DESC);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_contest_reg_contest ON contest_registrations(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_reg_user ON contest_registrations(user_id);
`;

/** Creates every table/index if missing. Safe to run on every boot. */
export async function initSchema(): Promise<void> {
  await db.exec(SCHEMA_SQL);
}
