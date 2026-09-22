#!/usr/bin/env node
/**
 * Contest load test.
 *
 * Simulates realistic contest-day traffic against a running SkillForge Code
 * server: a pool of virtual students register for a temporary test contest,
 * then submit code in a trickle-then-spike pattern (steady submissions
 * through the contest, then a burst in the final minutes - the real shape
 * of contest traffic, since everyone hammers Submit right before the
 * deadline). Reports real latency/error numbers instead of guesses.
 *
 * This does NOT touch your real contests or student accounts: it creates
 * its own throwaway contest and throwaway student accounts (prefixed
 * "loadtest-"), and can clean them up afterwards with --cleanup.
 *
 * Usage:
 *   node scripts/loadtest.mjs --url http://localhost:8787 --users 200 --duration 120 --spike-fraction 0.4 --spike-window 20
 *
 * Flags:
 *   --url             Base URL of the server (default: http://localhost:8787)
 *   --users           Number of virtual students to simulate (default: 100)
 *   --duration        Simulated contest length in seconds (default: 180)
 *   --spike-window    Seconds before contest end where submissions cluster (default: 20)
 *   --spike-fraction  Fraction of all submissions that land in the spike window, 0-1 (default: 0.5)
 *   --submits-per-user  How many submissions each user makes over the contest (default: 3)
 *   --account-concurrency  How many account-creation/registration requests run in parallel (default: 20)
 *   --submit-concurrency   Max in-flight submission+poll cycles at once (default: 30)
 *   --admin-email / --admin-password  Admin credentials (default: admin@skillforge.dev / admin123)
 *   --problem-id      Problem to submit against (default: prob-1)
 *   --language        Language to submit in (default: Python)
 *   --cleanup         Delete the test contest and accounts when done
 *   --report          Path to write a JSON report (default: none, summary printed to stdout only)
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const argv = parseArgs();
const BASE_URL = argv.url || 'http://localhost:8787';
const NUM_USERS = Number(argv.users) || 100;
const DURATION_SEC = Number(argv.duration) || 180;
const SPIKE_WINDOW_SEC = Number(argv['spike-window']) || 20;
const SPIKE_FRACTION = argv['spike-fraction'] !== undefined ? Number(argv['spike-fraction']) : 0.5;
const SUBMITS_PER_USER = Number(argv['submits-per-user']) || 3;
const ACCOUNT_CONCURRENCY = Number(argv['account-concurrency']) || 20;
const SUBMIT_CONCURRENCY = Number(argv['submit-concurrency']) || 30;
const ADMIN_EMAIL = argv['admin-email'] || 'admin@skillforge.dev';
const ADMIN_PASSWORD = argv['admin-password'] || 'admin123';
const PROBLEM_ID = argv['problem-id'] || 'prob-1';
const LANGUAGE = argv.language || 'Python';
const DO_CLEANUP = !!argv.cleanup;
const REPORT_PATH = argv.report;

const RUN_TAG = Date.now().toString(36);

// A trivially correct solution for prob-1 (Two Sum, stdin: n / nums / target -> "i j").
// If you point --problem-id at a different problem, override --code-file or edit this.
const DEFAULT_CODE = {
  Python: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        c = target - num
        if c in seen:
            return (seen[c], i)
        seen[num] = i

n = int(input())
nums = list(map(int, input().split()))
target = int(input())
a, b = two_sum(nums, target)
print(a, b)
`,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function nowMs() { return Date.now(); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function api(method, path, { token, body } = {}) {
  const start = nowMs();
  let res, json, error;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    try { json = await res.json(); } catch { json = null; }
  } catch (e) {
    error = String(e);
  }
  const latencyMs = nowMs() - start;
  return { ok: res ? res.ok : false, status: res ? res.status : 0, json, latencyMs, error };
}

/** Runs `items` through `worker` with at most `concurrency` in flight at once. */
async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runNext() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, runNext);
  await Promise.all(workers);
  return results;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label, values) {
  if (values.length === 0) return `${label}: no samples`;
  const sorted = [...values].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return `${label}: n=${sorted.length} avg=${avg.toFixed(0)}ms p50=${percentile(sorted, 50)}ms p90=${percentile(sorted, 90)}ms p99=${percentile(sorted, 99)}ms max=${sorted[sorted.length - 1]}ms`;
}

// ---------------------------------------------------------------------------
// Metrics collection
// ---------------------------------------------------------------------------

const metrics = {
  accountCreateLatencies: [],
  accountCreateErrors: 0,
  registerLatencies: [],
  registerErrors: 0,
  kickoffLatencies: [],
  kickoffErrors: 0,
  kickoffErrorMessages: {},
  kickoffRateLimited: 0,
  verdictLatencies: [],   // time from kickoff to final verdict, per submission
  verdictErrors: 0,
  verdictTimeouts: 0,
  verdictsByStatus: {},
  maxObservedQueueDepth: 0,
  httpErrorsByStatus: {},
};

function recordHttpOutcome(res) {
  if (!res.ok) {
    metrics.httpErrorsByStatus[res.status] = (metrics.httpErrorsByStatus[res.status] || 0) + 1;
  }
}

// ---------------------------------------------------------------------------
// Phase 1: admin login + create a throwaway test contest
// ---------------------------------------------------------------------------

async function setup() {
  console.log(`\n=== Contest Load Test (run ${RUN_TAG}) ===`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Simulating ${NUM_USERS} students, ${SUBMITS_PER_USER} submissions each (${NUM_USERS * SUBMITS_PER_USER} total), over ${DURATION_SEC}s`);
  console.log(`Spike: ${(SPIKE_FRACTION * 100).toFixed(0)}% of submissions land in the final ${SPIKE_WINDOW_SEC}s\n`);

  const health = await api('GET', '/api/health');
  if (!health.ok) {
    console.error(`✗ Server not reachable at ${BASE_URL} (${health.error || health.status}). Is it running?`);
    process.exit(1);
  }
  console.log('✓ Server is reachable');

  const adminLogin = await api('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (!adminLogin.ok) {
    console.error(`✗ Admin login failed: ${adminLogin.json?.error || adminLogin.status}`);
    process.exit(1);
  }
  const adminToken = adminLogin.json.token;
  console.log('✓ Admin authenticated');

  const startTime = new Date(Date.now() + 3000).toISOString(); // starts almost immediately
  const endTime = new Date(Date.now() + 3000 + DURATION_SEC * 1000).toISOString();

  const createContest = await api('POST', '/api/contests', {
    token: adminToken,
    body: {
      title: `[loadtest-${RUN_TAG}] Synthetic Load Test Contest`,
      description: 'Auto-generated by scripts/loadtest.mjs - safe to delete.',
      startTime,
      endTime,
      problems: [{ problemId: PROBLEM_ID, label: 'A', points: 100 }],
    },
  });
  if (!createContest.ok) {
    console.error(`✗ Could not create test contest: ${createContest.json?.error || createContest.status}`);
    process.exit(1);
  }
  const contestId = createContest.json.id;
  console.log(`✓ Created test contest ${contestId} (starts in 3s, runs ${DURATION_SEC}s)`);

  return { adminToken, contestId, contestStartTime: new Date(startTime).getTime() };
}

// ---------------------------------------------------------------------------
// Phase 2: create + register N virtual students
// ---------------------------------------------------------------------------

async function createAndRegisterStudents(contestId) {
  console.log(`\n--- Creating ${NUM_USERS} virtual students (concurrency ${ACCOUNT_CONCURRENCY}) ---`);
  const indices = Array.from({ length: NUM_USERS }, (_, i) => i);

  const students = await runPool(indices, ACCOUNT_CONCURRENCY, async (i) => {
    const email = `loadtest-${RUN_TAG}-${i}@synthetic.test`;
    const res = await api('POST', '/api/auth/register', {
      body: { fullName: `Load Test Student ${i}`, rollNumber: `LT${RUN_TAG}${i}`, email, password: 'loadtest123' },
    });
    metrics.accountCreateLatencies.push(res.latencyMs);
    recordHttpOutcome(res);
    if (!res.ok) { metrics.accountCreateErrors++; return null; }
    return { email, token: res.json.token, userId: res.json.user.id };
  });

  const validStudents = students.filter(Boolean);
  console.log(`✓ ${validStudents.length}/${NUM_USERS} accounts created (${metrics.accountCreateErrors} failed)`);
  console.log(summarize('  account creation latency', metrics.accountCreateLatencies));

  console.log(`\n--- Registering ${validStudents.length} students for the test contest ---`);
  await runPool(validStudents, ACCOUNT_CONCURRENCY, async (student) => {
    const res = await api('POST', `/api/contests/${contestId}/register`, { token: student.token });
    metrics.registerLatencies.push(res.latencyMs);
    recordHttpOutcome(res);
    if (!res.ok) metrics.registerErrors++;
  });
  console.log(`✓ Registration complete (${metrics.registerErrors} failed)`);
  console.log(summarize('  registration latency', metrics.registerLatencies));

  return validStudents;
}

// ---------------------------------------------------------------------------
// Phase 3: schedule submissions in a trickle-then-spike pattern
// ---------------------------------------------------------------------------

function buildSubmissionSchedule(students) {
  // Each (student, attempt#) gets a target offset (seconds from contest start) to fire at.
  const schedule = [];
  const spikeStart = DURATION_SEC - SPIKE_WINDOW_SEC;

  for (const student of students) {
    for (let attempt = 0; attempt < SUBMITS_PER_USER; attempt++) {
      const inSpike = Math.random() < SPIKE_FRACTION;
      const offsetSec = inSpike
        ? spikeStart + Math.random() * SPIKE_WINDOW_SEC
        : Math.random() * spikeStart;
      schedule.push({ student, offsetSec });
    }
  }
  schedule.sort((a, b) => a.offsetSec - b.offsetSec);
  return schedule;
}

async function submitAndTrackVerdict(student, contestId) {
  const code = DEFAULT_CODE[LANGUAGE] || DEFAULT_CODE.Python;
  const kickoffStart = nowMs();
  const kickoff = await api('POST', '/api/submissions/submit', {
    token: student.token,
    body: { problemId: PROBLEM_ID, language: LANGUAGE, code, contestId },
  });
  metrics.kickoffLatencies.push(kickoff.latencyMs);
  recordHttpOutcome(kickoff);

  if (kickoff.status === 429) { metrics.kickoffRateLimited++; return; }
  if (!kickoff.ok) {
    metrics.kickoffErrors++;
    const msg = kickoff.json?.error || `HTTP ${kickoff.status}`;
    metrics.kickoffErrorMessages[msg] = (metrics.kickoffErrorMessages[msg] || 0) + 1;
    return;
  }
  if (kickoff.json.queued !== undefined) {
    metrics.maxObservedQueueDepth = Math.max(metrics.maxObservedQueueDepth, kickoff.json.queued);
  }

  const submissionId = kickoff.json.submissionId;
  const deadline = kickoffStart + 45000; // give up waiting after 45s
  while (nowMs() < deadline) {
    await sleep(600);
    const poll = await api('GET', `/api/submissions/${submissionId}`, { token: student.token });
    recordHttpOutcome(poll);
    if (!poll.ok) continue;
    if (poll.json.status !== 'Queued' && poll.json.status !== 'Running') {
      metrics.verdictLatencies.push(nowMs() - kickoffStart);
      metrics.verdictsByStatus[poll.json.status] = (metrics.verdictsByStatus[poll.json.status] || 0) + 1;
      return;
    }
    if (poll.json.queued !== undefined) {
      metrics.maxObservedQueueDepth = Math.max(metrics.maxObservedQueueDepth, poll.json.queued);
    }
  }
  metrics.verdictTimeouts++;
}

async function runTrafficPhase(students, contestId, contestStartTime) {
  console.log(`\n--- Running traffic simulation (${DURATION_SEC}s, submit concurrency ${SUBMIT_CONCURRENCY}) ---`);
  const schedule = buildSubmissionSchedule(students);
  console.log(`  ${schedule.length} submissions scheduled across the contest window`);

  // Wait until the contest has actually started before firing any scheduled submissions,
  // so offsetSec=0 lines up with the server's own notion of "contest start" - otherwise
  // account-creation/registration time eats into the buffer and early submissions get
  // legitimately rejected as "not live yet" (that's the server working correctly, but it
  // pollutes the load-test numbers rather than measuring real traffic behavior).
  const waitMs = contestStartTime - nowMs();
  if (waitMs > 0) {
    console.log(`  Waiting ${(waitMs / 1000).toFixed(1)}s for the contest to actually start...\n`);
    await sleep(waitMs + 200);
  } else {
    console.log('');
  }

  const phaseStart = nowMs();
  let inFlight = 0;
  let completed = 0;
  const total = schedule.length;

  const progressTimer = setInterval(() => {
    const elapsed = ((nowMs() - phaseStart) / 1000).toFixed(0);
    process.stdout.write(`\r  [t=${elapsed}s] completed ${completed}/${total} | in-flight ${inFlight} | rate-limited ${metrics.kickoffRateLimited} | timeouts ${metrics.verdictTimeouts}   `);
  }, 1000);

  async function fireOne(entry) {
    const targetMs = phaseStart + entry.offsetSec * 1000;
    const waitMs = targetMs - nowMs();
    if (waitMs > 0) await sleep(waitMs);
    inFlight++;
    await submitAndTrackVerdict(entry.student, contestId);
    inFlight--;
    completed++;
  }

  // Bucket the schedule and release work respecting SUBMIT_CONCURRENCY, but let the
  // sleep-until-target-time inside fireOne handle actual pacing/spike clustering.
  await runPool(schedule, SUBMIT_CONCURRENCY, fireOne);

  clearInterval(progressTimer);
  console.log(`\n✓ Traffic simulation complete (${completed}/${total} submissions processed)\n`);
}

// ---------------------------------------------------------------------------
// Phase 4: report
// ---------------------------------------------------------------------------

function printReport() {
  console.log('=== RESULTS ===\n');

  console.log('Account creation:');
  console.log(`  ${summarize('latency', metrics.accountCreateLatencies)}`);
  console.log(`  errors: ${metrics.accountCreateErrors}\n`);

  console.log('Contest registration:');
  console.log(`  ${summarize('latency', metrics.registerLatencies)}`);
  console.log(`  errors: ${metrics.registerErrors}\n`);

  console.log('Submission kickoff (POST /submissions/submit — should stay fast even under load):');
  console.log(`  ${summarize('latency', metrics.kickoffLatencies)}`);
  console.log(`  errors: ${metrics.kickoffErrors} | rate-limited (expected under spam): ${metrics.kickoffRateLimited}`);
  if (Object.keys(metrics.kickoffErrorMessages).length > 0) {
    console.log(`  error breakdown: ${JSON.stringify(metrics.kickoffErrorMessages)}`);
  }
  console.log('');

  console.log('Time-to-verdict (kickoff → final judged result — this is what students actually feel):');
  console.log(`  ${summarize('latency', metrics.verdictLatencies)}`);
  console.log(`  timed out waiting >45s: ${metrics.verdictTimeouts}`);
  console.log(`  verdict breakdown: ${JSON.stringify(metrics.verdictsByStatus)}\n`);

  console.log(`Max observed queue depth (submissions waiting for a free judge worker): ${metrics.maxObservedQueueDepth}\n`);

  const httpErrorEntries = Object.entries(metrics.httpErrorsByStatus);
  if (httpErrorEntries.length > 0) {
    console.log('HTTP errors by status code:');
    for (const [status, count] of httpErrorEntries) console.log(`  ${status}: ${count}`);
  } else {
    console.log('No unexpected HTTP errors.');
  }

  console.log('\n=== READ THIS: what these numbers mean ===');
  const p99Verdict = (() => {
    const sorted = [...metrics.verdictLatencies].sort((a, b) => a - b);
    return percentile(sorted, 99);
  })();
  console.log(`- 99% of students got a verdict within ${(p99Verdict / 1000).toFixed(1)}s of clicking Submit, at this concurrency.`);
  console.log(`- This test ran on WHATEVER MACHINE the server was running on when you ran this script.`);
  console.log(`  Re-run this against your actual deployment hardware, at a concurrency close to your`);
  console.log(`  real expected peak (e.g. ~5-10% of 15,000 hitting Submit in the final spike window),`);
  console.log(`  before trusting real contest-day numbers. This local run is a sanity check that the`);
  console.log(`  tool and the server behave correctly under load, not a capacity guarantee at scale.`);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanup(adminToken, contestId, students) {
  console.log('\n--- Cleaning up test data ---');
  const delContest = await api('DELETE', `/api/contests/${contestId}`, { token: adminToken });
  console.log(delContest.ok ? '✓ Test contest deleted' : `✗ Could not delete test contest: ${delContest.json?.error}`);

  let deleted = 0;
  await runPool(students, ACCOUNT_CONCURRENCY, async (student) => {
    const res = await api('DELETE', `/api/admin/students/${student.userId}`, { token: adminToken });
    if (res.ok) deleted++;
  });
  console.log(`✓ Deleted ${deleted}/${students.length} synthetic student accounts`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { adminToken, contestId, contestStartTime } = await setup();
  const students = await createAndRegisterStudents(contestId);

  if (students.length === 0) {
    console.error('✗ No students were successfully created - aborting traffic phase.');
    process.exit(1);
  }

  await runTrafficPhase(students, contestId, contestStartTime);
  printReport();

  if (REPORT_PATH) {
    const fs = await import('fs');
    fs.writeFileSync(REPORT_PATH, JSON.stringify({ config: { BASE_URL, NUM_USERS, DURATION_SEC, SPIKE_WINDOW_SEC, SPIKE_FRACTION, SUBMITS_PER_USER }, metrics }, null, 2));
    console.log(`\nJSON report written to ${REPORT_PATH}`);
  }

  if (DO_CLEANUP) {
    await cleanup(adminToken, contestId, students);
  } else {
    console.log(`\n(Test contest ${contestId} and ${students.length} synthetic accounts left in place — re-run with --cleanup to remove them.)`);
  }
}

main().catch((err) => {
  console.error('\nLoad test crashed:', err);
  process.exit(1);
});
