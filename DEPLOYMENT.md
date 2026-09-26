# Deployment Runbook: Vercel + Render + Supabase

This walks through deploying SkillForge Code on **Vercel** (frontend), **Render** (backend +
judge), and **Supabase** (Postgres database).

Each part below requires **your own account** on that service — I can't create accounts or
deploy on your behalf, only tell you exactly what to configure.

**One constraint worth knowing up front:** Render's standard web services don't support nested
Docker (no Docker-in-Docker), so the optional `JUDGE_RUNTIME=docker` container-isolation mode
for the code judge can't run *inside* the Render service itself. This is true of most PaaS
platforms (Heroku, Railway, Vercel share the same limitation) — it isn't a Render-specific gap.
The default judge mode (`host`, process-level isolation via resource limits + timeouts — already
tested and working) runs fully on Render with no extra setup; the `Dockerfile` in this repo
installs the compilers directly into the Render container for exactly that. If you specifically
need true per-submission container isolation, run the judge on a separate small VM with Docker
installed (see README "Docker judge isolation") instead of on Render.

---

## Part 1: Supabase (Postgres database)

1. Create a free account at [supabase.com](https://supabase.com) and a new project.
2. Once it's provisioned, go to **Project Settings → Database → Connection string** and copy
   the **URI** format connection string (it looks like
   `postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-xxxxx.pooler.supabase.com:6543/postgres`).
   Use the **pooled connection** (port 6543, not 5432) if offered — it handles many
   concurrent connections better, which matters at contest scale.
3. Replace `[YOUR-PASSWORD]` with your actual database password (set during project creation,
   or resettable in the same Database settings page).
4. Save this full string — it's your `DATABASE_URL` for Part 2.

You don't need to run any SQL manually — the app creates its own schema automatically on
first boot (`initSchema()` in `server/db.ts`), and connects via the standard `pg` Postgres
driver (not the Supabase JS SDK) — Supabase's Postgres is fully wire-compatible, so this
works with zero application code changes.

This app doesn't use Supabase Auth or Supabase Storage: authentication is a self-contained
JWT + bcrypt implementation (already working, already tested, not tied to any cloud provider),
and there's no file/object storage anywhere in the app to migrate. Nothing to configure there.

---

## Part 2: Render (API + judge)

### 2a. Create the service
1. Push your repo to GitHub/GitLab if it isn't already there.
2. Sign up at [render.com](https://render.com).
3. **New +** → **Blueprint**, point it at your repo — Render will read `render.yaml` in this
   repo and set up the API service automatically. (Alternatively: **New +** → **Web Service**,
   select "Docker" as the runtime, and set the Dockerfile path to `Dockerfile.api`.)

### 2b. Set environment variables
In the Render dashboard, under your service's **Environment** tab, set:
```
DATABASE_URL=<the Supabase connection string from Part 1>
JWT_SECRET=<generate one: openssl rand -hex 32>
ALLOWED_ORIGIN=https://your-app.vercel.app
```
Optional (see `.env.example` for the full list): `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` for real
password-reset emails, `JUDGE_CONCURRENCY`, `SUBMIT_MIN_GAP_MS`, `CONTEST_END_GRACE_MS`.

### 2c. Deploy
Click **Create Web Service** (or it deploys automatically from the Blueprint). Render builds
the API image with Node.js and the Python/gcc/g++/OpenJDK runtimes needed by the judge. The
frontend is not built or served by Render. This takes a few minutes on the first deploy.

Render gives you a URL like `https://skillforge-backend.onrender.com` with HTTPS already
handled — no separate certificate setup needed (unlike a raw VM).

Confirm it's up: `curl https://skillforge-backend.onrender.com/api/health` → `{"ok":true}`

### 2d. Health checks & auto-restart
Already configured via `render.yaml` (`healthCheckPath: /api/health`) — Render restarts the
service automatically if it becomes unresponsive, no systemd/process-manager setup needed.

### 2e. Free tier behavior worth knowing
Render's free web services **spin down after 15 minutes of no traffic** and take ~30-60
seconds to wake back up on the next request. Fine for development/testing; for a real contest,
either upgrade to a paid instance (keeps it always-on) or set up an uptime pinger (e.g.
UptimeRobot hitting `/api/health` every 10 minutes) to keep it warm — same idea as the
Supabase free-tier pause workaround.

### 2f. Set up automated backups (see README "Backups")
Render doesn't run cron jobs for you on the free tier — run the backup script from your own
machine or a scheduled GitHub Action pointed at your Supabase `DATABASE_URL`:
```bash
node scripts/backup-db.mjs --keep 100
```

---

## Part 3: Vercel (frontend)

1. At [vercel.com](https://vercel.com), **New Project** → import the repo.
2. Framework preset: **Vite**. Root directory: `.`. Build command: `npm run build`.
   Output directory: `dist`. The included `vercel.json` sends frontend routes to the SPA entry.
3. Under **Environment Variables**, add:
   ```
   VITE_API_URL = https://skillforge-backend.onrender.com
   ```
   (your actual Render URL from Part 2c — no trailing slash).
4. Deploy. Vercel gives you a `https://your-app.vercel.app` URL automatically, with HTTPS
   already handled.
5. Go back to Render's environment variables and confirm `ALLOWED_ORIGIN` matches this exact
   Vercel URL, then trigger a redeploy (Render redeploys automatically when you change env vars).

---

## Final architecture

```
   Vercel (frontend, static build)
          │  HTTPS, VITE_API_URL
          ▼
   Render (Express API + judge; API-only Docker image)
          │  DATABASE_URL (Postgres wire protocol)
          ▼
   Supabase (managed Postgres)
```

---

## Part 4: End-to-end verification checklist

Don't consider this done until every one of these actually passes:

- [ ] `curl https://skillforge-backend.onrender.com/api/health` → `{"ok":true}`
- [ ] Open `https://your-app.vercel.app` in a browser, open DevTools → Network tab, confirm
      API calls go to your Render URL and succeed (not blocked by CORS)
- [ ] Register a new account, log in, log out, log back in
- [ ] Submit a real solution in each of the 4 languages and confirm correct verdicts
- [ ] Register for a contest, submit inside it, confirm the live standings update
- [ ] In the Render dashboard, manually restart the service — confirm it comes back up cleanly
- [ ] Run `node scripts/loadtest.mjs --url https://skillforge-backend.onrender.com --users 100 --duration 60`
      against the real deployment and read the results before trusting it with a real contest
      (see README "Load testing") — Render's free tier has real CPU limits worth knowing before
      contest day, same reasoning as before, different platform
