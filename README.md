# SkillForge Code — Full-Stack Coding Contest Platform

A complete coding-judge and quiz platform: React/TypeScript frontend + a real
Express/Postgres backend with an actual multi-language code judge (Python, C,
C++, Java).

Everything in this app is now real:
- **Real accounts** — register/login with bcrypt-hashed passwords and JWT sessions (no more "type admin in the email to become admin").
- **Real contests** — time-boxed, multi-problem contests with registration, an ICPC-style live leaderboard (points for solved problems, ranked by points then penalty time — 20 penalty minutes per wrong attempt before an accept, same model as Codeforces/ICPC), and problems that stay hidden until the contest actually starts.
- **Real code execution, queued like a real judge** — submissions kick off asynchronously (HTTP responds in milliseconds, not after the judge finishes), run through a concurrency-limited worker pool, and the frontend polls live status (`Queued → Running → verdict`), showing queue position and how many judge workers are busy — the same basic model CodeChef/LeetCode use.
- **Per-user rate limiting** — a minimum gap between submissions and a one-in-flight-submission cap per student, so one person spamming Submit can't starve the queue during a live contest.
- **Real persistence** — problems, students, submissions, quizzes, contests, and scores are stored in **Postgres** (see "Database" below for why this replaced the original SQLite setup, and how to point it at your own Postgres instance).
- **Real grading** — quiz MCQs, quiz coding questions, and contest submissions are all graded on the server using the same judge queue.

## Database: Postgres (migrated from SQLite)

This app originally used SQLite for zero-setup local development. It's since been migrated to
**Postgres**, because SQLite only allows one writer at a time — fine for a single classroom, a
real constraint at real contest scale (thousands of concurrent submissions writing to the DB at
once). Postgres handles concurrent writes properly and is what you actually want for a
15,000-student college deployment.

`server/db.ts` connects via a single `DATABASE_URL` environment variable — point it at:
- **A local Postgres** for development (see setup below), or
- **A managed free-tier Postgres** for deployment — [Supabase](https://supabase.com) is a solid
  choice (free tier, generous limits, one-click provisioning, gives you a ready-to-use
  `DATABASE_URL` immediately).

The schema, all queries, and the whole app behave identically either way — only the connection
string changes.

### Watching usage (so a free-tier limit never surprises you)

**Admin Console → Dashboard** shows the real Postgres database size (via `pg_database_size`,
not an estimate) with a progress bar against a 500MB reference point (Supabase's free tier),
plus a breakdown of your five largest tables — so you can see submissions growth trending
toward a limit months before it matters, instead of finding out when the app suddenly can't
write anymore. `GET /api/admin/stats` exposes the same numbers if you want to script an alert.

## Run locally

**Prerequisites:** Node.js 18+, a running Postgres instance. For full language support, `gcc`, `g++`, and a JDK (`javac`/`java`) should be on `PATH` — Python-only grading still works if some compilers are missing (that language will show "Compilation Error: compiler not installed").

1. Set up Postgres (skip if you already have one — just grab its connection string):
   ```
   sudo apt install postgresql postgresql-contrib   # or your OS's equivalent
   sudo service postgresql start
   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
   sudo -u postgres psql -c "CREATE DATABASE skillforge;"
   ```
2. Create a `.env` file in the project root:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skillforge
   ```
   (For Supabase or another managed Postgres, use the connection string they give you instead.)
3. Install dependencies:
   ```
   npm install
   ```
4. Start both the API server and the Vite dev server together:
   ```
   npm run dev:all
   ```
   This runs the Express API on `http://localhost:8787` and the Vite dev
   server on `http://localhost:3000` (proxying `/api/*` to the backend).
   Open `http://localhost:3000`.

   Or run them in two terminals if you prefer:
   ```
   npm run dev:server   # API on :8787
   npm run dev          # Vite on :3000
   ```

3. The database is created and seeded automatically on first boot, including 3 demo contests
   (one Upcoming, one Live, one Ended) so you can see all three states immediately. Demo accounts:
   - **Admin:** `admin@skillforge.dev` / `admin123`
   - **Student:** any seeded student email (e.g. `rahul.sharma@college.edu`) / `student123`
   - Or just register a brand-new student account from the UI.

## Production build

```
npm run build   # builds the frontend into dist/
npm start       # runs the Express server, which also serves dist/ as static files
```
In production, everything (API + frontend) is served from a single Express
process on `$PORT` (default `8787`).

**Deploying frontend and backend separately instead** (e.g. Vercel for the frontend + Render
for the backend, since the judge needs real compilers that pure serverless functions can't
provide)? See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full walkthrough — Supabase, Render,
Vercel, and how they're wired together (`VITE_API_URL` on the frontend build, `ALLOWED_ORIGIN`
on the backend, HTTPS handled automatically by both Vercel and Render).

## Architecture

```
server/
  index.ts    - Express app: all REST routes (auth, problems, submissions, quizzes, leaderboard, admin)
  contests.ts - Contest routes: list/detail, registration, ICPC-style live leaderboard, admin CRUD
  db.ts       - SQLite schema (better-sqlite3, zero external DB server needed)
  judge.ts    - Compiles/runs untrusted code (Python/C/C++/Java) asynchronously, with ulimit/timeout resource caps
  queue.ts    - Concurrency-limited worker pool (semaphore) - judge jobs queue instead of blocking the server
  rateLimit.ts - Per-user submission throttle (min gap + one in-flight submission), protects the queue during contests
  auth.ts     - JWT issuing/verification, bcrypt password hashing
  seed.ts     - Seeds demo problems/students/quizzes/contests on first boot

src/
  services/api.ts       - Typed fetch client; submissionsApi.run/submit kick off a job and poll it to completion
  context/AuthContext.tsx - React auth/session state (JWT stored in localStorage)
  views/ContestHub.tsx   - Browse Live/Upcoming/Ended contests, register
  views/ContestRoom.tsx  - Solve contest problems, live-polling standings table
  views/, components/   - Original UI, now wired to the real API instead of mock data
```

## Problem bank

Ships with 21 original coding problems (`data/sample-problems-bulk-import.json` plus 5 in the
base seed) spanning Easy/Medium/Hard across arrays, strings, hashing, stacks, sliding window,
binary search, dynamic programming, graphs, and heaps. Every test case was generated by
actually executing a real reference solution against crafted inputs, not hand-typed - so the
expected outputs are verified correct, not guessed. **These are original problems written for
this platform, not reproductions of any other platform's content** - copying a specific
platform's proprietary problem set at scale isn't something this tool will do, regardless of
what name it's given.

### Growing the bank

Admins can add problems one at a time (Admin Console → Problems → Create), or in bulk:
**Admin Console → Problems → Bulk Import (JSON)** — paste or upload a JSON array in the same
shape as `data/sample-problems-bulk-import.json`. Each entry needs a `title`, `statement`, and
at least one public test case; the endpoint (`POST /api/problems/bulk`) reports success/failure
per item, so one bad entry doesn't block the rest of a large batch. Good sources for growing
this further: problems your own faculty/students write for the platform, or open-licensed
academic problem sets - not another platform's copyrighted content.

## Contests: how they work

- Admins create a contest with a title, start/end time, and an ordered list of problems each
  worth a point value (via the Admin Console's **Contests** tab).
- Students **register** for a contest any time before it ends. Problem statements stay hidden
  (title only) until the contest status flips to **Live**.
- While live, submissions made from inside the contest room are tagged with the contest ID and
  scored ICPC-style: solving a problem earns its point value; the tiebreaker is total penalty
  time (minutes-since-contest-start when you solved it, plus 20 penalty minutes per wrong
  attempt on that problem before the accept).
- The **standings** tab polls every 10 seconds during the contest, so rankings update live as
  people solve problems - no page refresh needed.
- Submissions outside a contest (regular Problem Arena / Quiz practice) are unaffected and don't
  touch contest scoring.

## How the judge queue works (concurrency, like CodeChef/LeetCode)

`POST /api/submissions/submit` and `/run` return **immediately** (a few milliseconds) with
`{ status: 'Queued' }` instead of blocking until the code finishes running. The actual
compile+run happens in the background through a small worker pool (`server/queue.ts`):
by default `max(2, CPU cores - 1)` submissions can be judged at the same time; anything
beyond that waits its turn. The frontend polls `GET /api/submissions/:id` (or
`GET /api/submissions/run/:runId`) every ~500ms and shows live "Queued — N ahead of you" /
"X/Y judge workers busy" status until a verdict comes back.

This means the server stays responsive under load - browsing, login, and the leaderboard
never freeze while other students' code is being judged - and several submissions are
judged in true parallel instead of one at a time. Tested under load: 5 simultaneous
submissions all acknowledged in under 150ms total, then judged 2-at-a-time with the rest
queued, exactly as expected.

You can tune the worker count with an environment variable:
```
JUDGE_CONCURRENCY=4 npm start
```

Other tunable env vars: `SUBMIT_MIN_GAP_MS` (default 3000 - minimum gap between a student's
submissions), `SUBMIT_MAX_PENDING` (default 1 - max in-flight submissions per student),
`CONTEST_END_GRACE_MS` (default 5000 - how many milliseconds past a contest's official end time
a submission can still be *accepted for judging* if it was kicked off right at the wire; this
absorbs queueing jitter from last-second submission spikes without extending how long students
can keep attempting problems).

## Known simplifications (given the scope of this platform)

- **Password reset delivery**: fully real end-to-end (real generated codes, real expiry, real attempt-limiting, real password changes, and now real email delivery via SMTP - see `server/email.ts` and the `SMTP_*` env vars in `.env.example`). Verified with an actual test SMTP server: the app sends a genuine email, and the flow completes correctly using the code from that email. Without `SMTP_HOST` set, it falls back to logging the code to the server console - fine for local dev, not for real students.

- **Judge sandboxing**: code runs in a fresh temp directory with a `ulimit`-enforced memory/CPU cap and a wall-clock timeout, on the trusted single-tenant server process. This is fine for a college contest platform run by trusted staff, but it is **not** container-level sandboxing (no Docker/gVisor/seccomp). Don't expose it to anonymous public internet traffic without adding that - see "Going further" below.
- **Java** requires a JDK with `javac` on the server's `PATH`. If missing, Java submissions return "Compilation Error: Java compiler (javac) is not installed on this server."
- **Quiz MCQ answers** are sent to the client when a student opens a quiz (needed for the current UI's instant-feedback design), but grading is authoritative on the server — the score you see is always server-computed, not just client-side.
- The landing page's "Live Quiz Preview" and "Top Coders" widgets show sample data for visitors who aren't logged in yet; everything inside the actual Student/Admin consoles is live data from the database.

## Backups (do this during every real contest)

`scripts/backup-db.mjs` takes a safe, online, point-in-time backup of the live database while
the server keeps running - it uses `better-sqlite3`'s native `.backup()` API rather than a raw
file copy, which matters because the database runs in WAL mode: recent writes can sit in a
separate `-wal` file, so copying just `skillforge.db` while the server is live risks grabbing a
half-written, inconsistent snapshot. This script doesn't have that problem.

**One-off backup:**
```
node scripts/backup-db.mjs
```
Writes a timestamped copy to `server/data/backups/`. Tested and confirmed to produce a fully
valid, independently-readable database file with correct data, taken while the server was live
and actively writing.

**Continuous backups for the duration of a contest** (recommended - run this in the background
for the whole contest window):
```
node scripts/backup-db.mjs --interval 300 --keep 50 &
```
Backs up every 5 minutes, keeps the last 50 (auto-pruning older ones).

**Restoring from a backup** (defaults to a dry run for safety - it won't touch anything until
you add `--force`):
```
node scripts/backup-db.mjs --restore server/data/backups/skillforge-<timestamp>.db --force
```
Stop the server first. This automatically saves a safety copy of whatever's currently in the
live DB location before overwriting it (so a bad restore isn't itself unrecoverable), clears
stale WAL/SHM sidecar files so the restored database loads cleanly, then copies the backup into
place. Start the server again afterward. Verified end-to-end: restored a backup over a
deliberately corrupted live DB file and confirmed the server booted cleanly with the correct
data afterward.



`scripts/loadtest.mjs` simulates realistic contest traffic against a running server: it creates
a throwaway contest and a pool of synthetic student accounts, registers them, then submits code
in a trickle-then-spike pattern (steady submissions through the contest, then a burst in the
final minutes - the real shape of contest traffic, since everyone hammers Submit right before
the deadline). It reports real latency numbers instead of guesses, and cleans up after itself.

```
node scripts/loadtest.mjs --users 200 --duration 120 --spike-window 20 --cleanup
```

Key flags: `--users` (virtual students), `--duration` (contest length in seconds),
`--spike-window` / `--spike-fraction` (how the last-minute rush is shaped), `--submit-concurrency`
(how many submissions run in parallel), `--url` (point it at your real deployment). The full flag
list with defaults is documented in the comment block at the top of the script.

**What we found running it against this dev sandbox (1 CPU, `JUDGE_CONCURRENCY=2`):** with 60
students making 3 submissions each and 60% of them clustered into a 12-second end-of-contest
spike at 25-way submission concurrency, roughly 40% of the spike submissions arrived late enough
that their kickoff itself landed after the contest deadline (even with a 5-second grace period)
and were correctly rejected. That's the judge queue genuinely running out of headroom under
contention - exactly the kind of result this tool exists to surface, and exactly why "it worked
in my dev test" is not the same claim as "it's ready for 15,000 students." **Run this against
your actual deployment hardware, at a concurrency close to your real expected peak, before
trusting contest-day capacity.**

## Docker judge isolation (opt-in, real per-submission container sandboxing)

By default (`JUDGE_RUNTIME` unset or `host`) the judge runs submissions as regular OS
processes with `ulimit` resource caps - fine for a trusted classroom, not real isolation
between students. Setting `JUDGE_RUNTIME=docker` switches every compile/run step to happen
inside a fresh, `--rm`'d Docker container instead:

- `--network none` - no network access at all, nothing to exfiltrate to or download from
- `--memory` / `--memory-swap` - a hard, kernel-enforced memory cap (256MB), stronger than
  `ulimit -v` (which some allocation paths can slip past)
- `--pids-limit 64` - fork bombs are capped, not a host-wide incident
- `--cap-drop ALL` + `--security-opt no-new-privileges` + a non-root user inside the image -
  defense in depth beyond the container boundary itself
- Each submission's temp directory is bind-mounted into its own container and nothing else -
  one student's code cannot see another's, or anything on the host

### Setup

1. Install Docker on a real, Docker-capable machine — this needs to be a genuine VM, **not**
   Render's standard web services (no Docker-in-Docker there), nor Vercel/Cloudflare Workers
   serverless functions (can't run Docker or arbitrary compilers at all). Any small cloud VM
   with Docker installed works — a DigitalOcean droplet, an AWS/GCP instance, etc. Point this
   app's `JUDGE_RUNTIME=docker` + backend traffic at that machine instead of (or as a proxy in
   front of) Render if you need this level of isolation.
2. Build the sandbox image:
   ```
   ./scripts/build-judge-image.sh
   ```
3. **Verify it, for real, before trusting it**:
   ```
   ./scripts/verify-docker-judge.sh
   ```
   This actually runs code in the sandbox and checks: all four languages execute correctly,
   network access is blocked, the memory cap is enforced, a fork bomb is capped, the
   container can't write outside its bind-mounted sandbox, and containers clean up properly
   after each run. Every check should print PASS. If any print FAIL, do not use
   `JUDGE_RUNTIME=docker` for a real contest until you've fixed it.
4. Set the environment variable and start the server:
   ```
   JUDGE_RUNTIME=docker npm start
   ```

### Honest status of this feature

This was built and reviewed carefully, but the environment that built it had no Docker
available to run it against - **it has not been runtime-verified by the author**. The host
mode (default) has been extensively tested end-to-end and is known-working; treat Docker
mode as reviewed-but-unverified until you personally run `scripts/verify-docker-judge.sh`
and see every check pass on your own machine. That script exists specifically so you don't
have to take this on faith.

## Going further: horizontal scale

Docker mode closes the isolation gap. The other piece real CodeChef/LeetCode-scale platforms
have that this doesn't: **horizontal scaling** across multiple machines running judge workers,
coordinated through a real distributed queue (Redis/SQS) instead of the in-process one here.
That matters once one server's CPU core count genuinely can't keep up with your peak submission
rate - use `scripts/loadtest.mjs` against your real deployment to find out whether you're
actually at that point before building it; it's a real infrastructure project, not a small
addition.

