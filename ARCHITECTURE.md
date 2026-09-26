# SkillForge Code — Architecture

## System Overview

SkillForge Code is a competitive programming platform for college students.
It supports problem solving, timed contests, quizzes, leaderboards, and
multi-language code judging (Python, C, C++, Java).

```
                         INTERNET
                            │
                            ▼
                    ┌───────────────┐
                    │    VERCEL     │
                    │ React Frontend│
                    └───────┬───────┘
                            │ HTTPS
                            ▼
                    ┌───────────────┐
                    │     NGINX     │
                    │ Reverse Proxy │
                    └───────┬───────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │  Node.js/Express  │
                  │    Backend API    │
                  └─────────┬─────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
        PostgreSQL        Redis          JWT Auth
        (Supabase)      (BullMQ)
             │              │
             │              ▼
             │      ┌───────────────┐
             │      │  Judge Worker │
             │      │  (BullMQ)     │
             │      └───────┬───────┘
             │              │
             │       ┌──────┼──────┐
             │       ▼      ▼      ▼
             │    Docker  Docker  Docker
             │    Judge   Judge   Judge
             └───────┴──────┴──────┘
```

## Directory Structure

```
coding_contest/
├── server/                 Backend (Node.js/Express/TypeScript)
│   ├── index.ts            Main API server — all REST routes
│   ├── worker.ts           Standalone BullMQ judge worker process
│   ├── judge.ts            Docker/host code execution engine
│   ├── jobQueue.ts         BullMQ queue (Redis-backed, falls back to in-process)
│   ├── queue.ts            In-process semaphore queue (dev fallback)
│   ├── sse.ts              Server-Sent Events for real-time verdicts
│   ├── redis.ts            ioredis client with graceful fallback
│   ├── db.ts               Postgres connection + schema (pg pool)
│   ├── auth.ts             JWT sign/verify + Express middleware
│   ├── contests.ts         Contest routes (ICPC-style leaderboard)
│   ├── rateLimit.ts        Per-user submission throttle
│   ├── email.ts            SMTP password-reset emails
│   └── seed.ts             First-boot admin account creation
├── src/                    Frontend (React/TypeScript/Vite)
│   ├── views/              Page-level components
│   ├── components/         Shared UI components
│   ├── services/api.ts     Typed fetch client + SSE helper
│   ├── context/            React context (auth state)
│   └── types.ts            Shared TypeScript types
├── docker/
│   └── judge.Dockerfile    Judge sandbox image (Ubuntu + compilers)
├── nginx/
│   └── nginx.conf          Reverse proxy config
├── scripts/
│   ├── build-judge-image.sh
│   ├── verify-docker-judge.sh
│   ├── loadtest.mjs
│   └── backup-db.mjs
├── docker-compose.yml      Production: api + worker + redis + nginx
├── Dockerfile              Combined API+frontend image (Render)
├── .env.example            All environment variables documented
└── render.yaml             Render Blueprint for one-click deploy
```

## Database Architecture

**Engine**: PostgreSQL (Supabase managed, or self-hosted)

### Tables

| Table | Purpose |
|---|---|
| `users` | Students and admins |
| `problems` | Problem bank with per-problem time/memory limits |
| `test_cases` | Public and hidden test cases per problem |
| `submissions` | All code submissions with verdict + result JSON |
| `quizzes` | Timed quiz events |
| `quiz_questions` | MCQ and coding questions per quiz |
| `quiz_attempts` | Student quiz submissions |
| `contests` | Timed coding contests |
| `contest_problems` | Problems assigned to contests with labels/points |
| `contest_registrations` | Student contest registrations |
| `password_resets` | Temporary reset codes (TTL-enforced) |

### Key Indexes

```sql
idx_submissions_user       -- submissions(user_id)
idx_submissions_problem    -- submissions(problem_id)
idx_submissions_contest    -- submissions(contest_id)
idx_submissions_created    -- submissions(submitted_at DESC)
idx_users_email            -- users(email)
idx_users_points           -- users(points DESC)  -- leaderboard
idx_problems_difficulty    -- problems(difficulty)
idx_contest_reg_contest    -- contest_registrations(contest_id)
```

## API Architecture

All routes available at both `/api/*` and `/api/v1/*` (forward-compatible versioning).

### Auth
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/verify-reset-code
POST /api/auth/reset-password
```

### Problems
```
GET    /api/problems              paginated list
GET    /api/problems/:id          full detail (hidden tests filtered by role)
POST   /api/problems              admin: create
PUT    /api/problems/:id          admin: update
DELETE /api/problems/:id          admin: delete
POST   /api/problems/bulk         admin: bulk import
```

### Submissions
```
POST /api/submissions/run         run against public tests (async)
GET  /api/submissions/run/:runId  poll run result
POST /api/submissions/submit      submit against all tests (async, queued)
GET  /api/submissions/:id         poll submission result
GET  /api/submissions/mine        submission history (paginated)
GET  /api/submissions/queue-status queue depth stats
```

### Real-time
```
GET /api/events                   SSE stream (JWT via ?token= query param)
```

### Contests
```
GET  /api/contests
GET  /api/contests/:id
POST /api/contests/:id/register
GET  /api/contests/:id/leaderboard
POST /api/contests              admin: create
PUT  /api/contests/:id          admin: update
POST /api/contests/:id/extend   admin: extend end time
DELETE /api/contests/:id        admin: delete
```

### Admin
```
GET    /api/admin/students
PUT    /api/admin/students/:id
DELETE /api/admin/students/:id
GET    /api/admin/stats
```

### Health
```
GET /api/health    { ok, uptime, sseConnections, ts }
```

## Judge Architecture

### Execution Flow

```
POST /api/submissions/submit
  │
  ├─ Validate (auth, problem exists, contest rules, rate limit)
  ├─ INSERT submission (status=Queued)
  ├─ Enqueue job to BullMQ (Redis) or in-process queue
  └─ Return { submissionId, status: 'Queued' } immediately

BullMQ Worker (server/worker.ts):
  │
  ├─ Pull job from Redis queue
  ├─ UPDATE submission status=Running
  ├─ Emit SSE event to user (status: Running)
  ├─ Fetch test cases from DB
  ├─ judge() → Docker container per language
  │     ├─ Write source to temp dir
  │     ├─ Compile (C/C++/Java) inside container
  │     ├─ Run against each test case
  │     └─ Cleanup container + temp dir
  ├─ UPDATE submission with verdict
  ├─ Update problem/user stats if Accepted
  └─ Emit SSE event to user (final verdict)
```

### Docker Security

Each submission runs in a fresh container with:
- `--network none` — no internet access
- `--memory` — hard kernel-enforced memory cap
- `--memory-swap` — prevents swap abuse
- `--cpus 1` — CPU cap
- `--pids-limit 64` — fork bomb protection
- `--cap-drop ALL` — no Linux capabilities
- `--security-opt no-new-privileges` — no privilege escalation
- `--read-only` — read-only base filesystem
- `--tmpfs` — writable tmpfs for compilation only
- Non-root `judge` user inside container
- Automatic `--rm` cleanup after each run

### Resource Limits (env-configurable)

| Variable | Default | Purpose |
|---|---|---|
| `JUDGE_TIMEOUT_MS` | 5000 | Wall-clock execution timeout |
| `JUDGE_MEMORY_MB` | 256 | Memory limit per container |
| `JUDGE_CPU_LIMIT` | 1 | CPU cores |
| `JUDGE_PIDS_LIMIT` | 64 | Max processes (fork bomb) |
| `JUDGE_OUTPUT_LIMIT_KB` | 1024 | Max stdout size |
| `JUDGE_MAX_SOURCE_KB` | 256 | Max source code size |
| `JUDGE_COMPILE_TIMEOUT_MS` | 15000 | Compilation timeout |
| `JUDGE_CONCURRENCY` | CPU-1 | Parallel judge workers |

Per-problem overrides: `time_limit_ms` and `memory_limit_mb` columns in `problems` table.

## Queue Architecture

### With Redis (production)

- **BullMQ** backed by Redis
- Jobs persist across server restarts
- Retry on infrastructure failure (2 attempts, exponential backoff)
- Correct verdicts (WA/TLE/RE) are NOT retried — they are final
- Dead-letter: failed jobs visible in BullMQ dashboard
- Idempotent: `jobId = submissionId` prevents duplicate processing
- Separate worker process (`server/worker.ts`) — judge never runs in API process

### Without Redis (dev fallback)

- In-process semaphore (`server/queue.ts`)
- Lost on restart — acceptable for local dev
- Not shared across instances — single-instance only

## Real-time Architecture

**Server-Sent Events (SSE)** replace the 500ms polling loop:

1. Frontend connects to `GET /api/events?token=<jwt>`
2. Backend registers the connection in memory
3. When worker finishes a job, `sseEmit(userId, verdict)` pushes instantly
4. Frontend receives `submission.updated` event and updates UI
5. Heartbeat every 25s keeps connection alive through proxies

For multi-instance deployments: Redis pub/sub fan-out is implemented
(publishes to `sse:<userId>` channel when the local instance doesn't have
the client connection).

## Security Architecture

- **Passwords**: bcrypt (cost 10)
- **Sessions**: JWT (7-day expiry), secret from `JWT_SECRET` env var
- **Rate limiting**: express-rate-limit (20 req/min auth, 300 req/min API)
- **Submission throttle**: per-user min gap + max in-flight (in-process or Redis)
- **Input validation**: Zod on all API inputs (added progressively)
- **CORS**: restricted to `ALLOWED_ORIGIN` in production
- **Admin routes**: `requireAdmin` middleware on every admin endpoint
- **Hidden tests**: never sent to students (filtered server-side)
- **Source size limit**: rejects oversized submissions before judging
- **No stack traces in production**: global error handler sanitizes responses
- **Docker socket**: only mounted in worker container, never in API or judge containers

## Deployment Architecture

### Production (docker-compose)

```
nginx (80/443) → api (8787) → postgres (Supabase)
                           → redis (internal)
worker          → redis (internal)
worker          → /var/run/docker.sock (judge containers only)
```

### Split deployment (Vercel + Render)

- Frontend: Vercel (set `VITE_API_URL` at build time)
- Backend API: Render web service (Dockerfile)
- Worker: Render background worker or separate VM
- Database: Supabase
- Redis: Redis Cloud / Upstash free tier

## Scaling Strategy

The architecture is stateless at the API layer:

- **Horizontal API scaling**: multiple API instances behind a load balancer.
  Rate limiting moves to Redis (`express-rate-limit` with Redis store).
- **Horizontal worker scaling**: multiple worker instances pull from the same
  BullMQ queue. `JUDGE_CONCURRENCY` controls per-instance parallelism.
- **Database**: Supabase handles connection pooling via PgBouncer.
- **SSE fan-out**: Redis pub/sub propagates events across API instances.

### Capacity guidance (NOT guaranteed — load test your deployment)

| Setup | Estimated concurrent users |
|---|---|
| 1 API + 1 worker (2 CPU) | ~100-200 |
| 2 API + 2 workers (4 CPU each) | ~500-1000 |
| 4 API + 4 workers + Redis | ~1000+ |

Run `node scripts/loadtest.mjs` against your actual deployment to find real limits.
