/**
 * The Judge: compiles/runs untrusted code against test cases, asynchronously.
 *
 * Supported languages: Python, C, C++, Java.
 *
 * Two execution modes, controlled by JUDGE_RUNTIME (default 'host'):
 *
 * - 'host' (default): every run gets its own temp directory and a wall-clock timeout.
 *   On Linux/macOS, ulimit memory/CPU caps are applied via a bash wrapper.
 *   On Windows, processes are spawned directly (no bash/ulimit available).
 *
 * - 'docker' (opt-in): each compile/run step happens inside a fresh, --rm'd container
 *   with no network access, hard memory/CPU/pid caps enforced by the kernel cgroup.
 *   Requires Docker installed and the judge image built (see scripts/build-judge-image.sh).
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export type Language = 'Python' | 'C' | 'C++' | 'Java';

export interface RunResult {
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compilation Error' | 'Memory Limit Exceeded';
  stdout: string;
  stderr: string;
  timeMs: number;
  memoryKb: number;
}

// Defaults — all overridable via env vars or per-problem options
const DEFAULT_TIME_LIMIT_MS = Number(process.env.JUDGE_TIMEOUT_MS) || 5000;
const DEFAULT_MEMORY_LIMIT_MB = Number(process.env.JUDGE_MEMORY_MB) || 256;
const DEFAULT_PIDS_LIMIT = Number(process.env.JUDGE_PIDS_LIMIT) || 64;
const DEFAULT_CPU_LIMIT = process.env.JUDGE_CPU_LIMIT || '1';
const MAX_OUTPUT_BYTES = (Number(process.env.JUDGE_OUTPUT_LIMIT_KB) || 1024) * 1024;
const MAX_SOURCE_BYTES = (Number(process.env.JUDGE_MAX_SOURCE_KB) || 256) * 1024;
const COMPILE_TIMEOUT_MS = Number(process.env.JUDGE_COMPILE_TIMEOUT_MS) || 15000;

const JUDGE_RUNTIME = (process.env.JUDGE_RUNTIME || 'host') as 'host' | 'docker';
const JUDGE_IMAGE = process.env.JUDGE_IMAGE || 'skillforge-judge:latest';
const IS_WINDOWS = process.platform === 'win32';

function makeWorkDir(): string {
  const dir = path.join(os.tmpdir(), `skillforge-${crypto.randomBytes(8).toString('hex')}`);
  fs.mkdirSync(dir, { recursive: true });
  try { fs.chmodSync(dir, 0o777); } catch { /* Windows doesn't support chmod */ }
  return dir;
}

function cleanup(dir: string) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function toolAvailable(cmd: string): boolean {
  const res = spawnSync(IS_WINDOWS ? 'where' : 'which', [cmd]);
  return res.status === 0;
}

/**
 * Finds a working Python interpreter. On Windows, 'python3' may be a Microsoft Store
 * stub that exits immediately — we verify it actually runs before trusting it.
 */
function resolvePython(): string | null {
  const candidates = IS_WINDOWS ? ['python', 'python3'] : ['python3', 'python'];
  for (const cmd of candidates) {
    const res = spawnSync(cmd, ['-c', 'import sys; sys.exit(0)'], { timeout: 3000 });
    if (res.status === 0 && !res.error) return cmd;
  }
  return null;
}

interface RunOutcome {
  timedOut: boolean;
  hitMemoryLimit: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timeMs: number;
}

const DEAD_RUN: RunOutcome = { timedOut: false, hitMemoryLimit: false, stdout: '', stderr: '', exitCode: 1, timeMs: 0 };

// ---------------------------------------------------------------------------
// Docker execution helpers
// ---------------------------------------------------------------------------

function containerWorkDir(workDir: string): string {
  return `/tmp/${path.basename(workDir)}`;
}

function containerPath(workDir: string, filePath: string): string {
  const relativePath = path.relative(workDir, filePath).replace(/\\/g, '/');
  return path.posix.join(containerWorkDir(workDir), relativePath);
}

function dockerRunPrefixArgs(workDir: string, containerName: string, memMb: number): string[] {
  const mountedDir = containerWorkDir(workDir);
  const memBytes = memMb * 1024 * 1024;
  return [
    'run', '--rm', '--name', containerName,
    '-i',
    '--network', 'none',
    '--memory', `${memBytes}`,
    '--memory-swap', `${memBytes}`,
    '--cpus', DEFAULT_CPU_LIMIT,
    '--pids-limit', String(DEFAULT_PIDS_LIMIT),
    '--security-opt', 'no-new-privileges',
    '--cap-drop', 'ALL',
    '--read-only',
    '--tmpfs', `${mountedDir}:rw,noexec,nosuid,size=${memMb}m`,
    '-v', `${workDir}:${mountedDir}:rw`,
    '-w', mountedDir,
    JUDGE_IMAGE,
  ];
}

function dockerKill(containerName: string): Promise<void> {
  return new Promise((resolve) => {
    const p = spawn('docker', ['kill', containerName]);
    p.on('close', () => resolve());
    p.on('error', () => resolve());
  });
}

// ---------------------------------------------------------------------------
// Core process runner — spawns directly, no shell wrapper needed
// ---------------------------------------------------------------------------

/**
 * Spawns a process directly (argv-based, no shell) and feeds input via stdin.
 * On Linux host mode, wraps with bash+ulimit for resource caps.
 * On Windows host mode, spawns directly — no ulimit available, wall-clock timeout only.
 * In docker mode, runs inside a locked-down container.
 */
function runProcessAsync(
  cmd: string,
  args: string[],
  input: string,
  cwd: string,
  timeoutMs: number,
  memMb: number,
  useUlimit = false,
): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const start = Date.now();
    const containerName = `skillforge-run-${crypto.randomBytes(6).toString('hex')}`;

    let child: ReturnType<typeof spawn>;

    if (JUDGE_RUNTIME === 'docker') {
      child = spawn('docker', [...dockerRunPrefixArgs(cwd, containerName, memMb), cmd, ...args]);
    } else if (!IS_WINDOWS && useUlimit) {
      // Linux/macOS: wrap with bash + ulimit for memory/CPU caps
      const quotedArgs = [cmd, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
      const memKb = memMb * 1024;
      const timeSec = Math.ceil(timeoutMs / 1000);
      const shellCmd = `ulimit -v ${memKb}; ulimit -t ${timeSec}; exec ${quotedArgs}`;
      child = spawn('/bin/bash', ['-c', shellCmd], { cwd, detached: true });
    } else {
      // Windows host mode or no-ulimit: spawn directly
      child = spawn(cmd, args, { cwd });
    }

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let settled = false;
    let timedOut = false;
    let hitMemoryLimit = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (JUDGE_RUNTIME === 'docker') {
        dockerKill(containerName);
      } else if (!IS_WINDOWS && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* dead */ } }
      } else {
        try { child.kill(); } catch { /* dead */ }
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= MAX_OUTPUT_BYTES) stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
      if (stderr.length > 4000) stderr = stderr.slice(0, 4000);
    });

    child.stdin.on('error', () => { /* ignore EPIPE */ });
    child.stdin.write(input ?? '');
    child.stdin.end();

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!timedOut && (signal === 'SIGSEGV' || signal === 'SIGABRT') && /bad_alloc|out of memory|cannot allocate/i.test(stderr)) {
        hitMemoryLimit = true;
      } else if (!timedOut && JUDGE_RUNTIME === 'docker' && signal === 'SIGKILL') {
        hitMemoryLimit = true;
      }
      resolve({ timedOut, hitMemoryLimit, stdout, stderr, exitCode: code, timeMs: Date.now() - start });
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ timedOut: false, hitMemoryLimit: false, stdout: '', stderr: String(err), exitCode: 1, timeMs: Date.now() - start });
    });
  });
}

// ---------------------------------------------------------------------------
// Compiler — spawns directly (argv), no shell
// ---------------------------------------------------------------------------

async function compileAsync(cmd: string, args: string[], cwd: string, memMb: number): Promise<{ ok: boolean; stderr?: string }> {
  return new Promise((resolve) => {
    const containerName = `skillforge-compile-${crypto.randomBytes(6).toString('hex')}`;
    const remapArg = (a: string) => {
      const rel = path.relative(cwd, a);
      return (!rel.startsWith('..') && !path.isAbsolute(rel))
        ? path.posix.join(containerWorkDir(cwd), rel.replace(/\\/g, '/'))
        : a;
    };
    const child = JUDGE_RUNTIME === 'docker'
      ? spawn('docker', [...dockerRunPrefixArgs(cwd, containerName, memMb), cmd, ...args.map(remapArg)])
      : spawn(cmd, args, { cwd });

    let stderr = '';
    const timer = setTimeout(() => {
      if (JUDGE_RUNTIME === 'docker') dockerKill(containerName);
      else { try { child.kill('SIGKILL'); } catch { /* noop */ } }
    }, COMPILE_TIMEOUT_MS);

    child.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf-8'); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stderr: code === 0 ? undefined : (stderr || 'Compilation failed.') });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stderr: String(err) });
    });
  });
}

// ---------------------------------------------------------------------------
// Language preparation — writes source, compiles if needed, returns a run fn
// ---------------------------------------------------------------------------

interface CompileOutcome {
  ok: boolean;
  stderr?: string;
  run: (input: string) => Promise<RunOutcome>;
}

export interface JudgeOptions {
  timeLimitMs?: number;
  memoryLimitMb?: number;
}

async function prepare(language: Language, code: string, workDir: string, opts: JudgeOptions = {}): Promise<CompileOutcome> {
  const timeLimitMs = opts.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  const memMb = opts.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  const javaHeapMb = Math.min(memMb, 512);
  if (JUDGE_RUNTIME === 'docker' && !toolAvailable('docker')) {
    return {
      ok: false,
      stderr: 'JUDGE_RUNTIME=docker is set but the `docker` command is not available on this server.',
      run: () => Promise.resolve(DEAD_RUN),
    };
  }

  switch (language) {
    case 'Python': {
      const file = path.join(workDir, 'main.py');
      fs.writeFileSync(file, code);
      if (JUDGE_RUNTIME === 'docker') {
        const execFile = containerPath(workDir, file);
        return { ok: true, run: (input) => runProcessAsync('python3', [execFile], input, workDir, timeLimitMs, memMb, true) };
      }
      const python = resolvePython();
      if (!python) {
        return { ok: false, stderr: 'Python interpreter is not installed on this server.', run: () => Promise.resolve(DEAD_RUN) };
      }
      return { ok: true, run: (input) => runProcessAsync(python, [file], input, workDir, timeLimitMs, memMb, true) };
    }

    case 'C': {
      const src = path.join(workDir, 'main.c');
      const exe = path.join(workDir, IS_WINDOWS ? 'main.exe' : 'main.out');
      fs.writeFileSync(src, code);
      if (JUDGE_RUNTIME !== 'docker' && !toolAvailable('gcc')) {
        return { ok: false, stderr: 'C compiler (gcc) is not installed on this server.', run: () => Promise.resolve(DEAD_RUN) };
      }
      const compiled = await compileAsync('gcc', [src, '-O2', '-o', exe, '-lm'], workDir, memMb);
      if (!compiled.ok) return { ok: false, stderr: compiled.stderr, run: () => Promise.resolve(DEAD_RUN) };
      const cExe = JUDGE_RUNTIME === 'docker' ? containerPath(workDir, exe) : exe;
      return { ok: true, run: (input) => runProcessAsync(cExe, [], input, workDir, timeLimitMs, memMb, true) };
    }

    case 'C++': {
      const src = path.join(workDir, 'main.cpp');
      const exe = path.join(workDir, IS_WINDOWS ? 'main.exe' : 'main.out');
      fs.writeFileSync(src, code);
      if (JUDGE_RUNTIME !== 'docker' && !toolAvailable('g++')) {
        return { ok: false, stderr: 'C++ compiler (g++) is not installed on this server.', run: () => Promise.resolve(DEAD_RUN) };
      }
      const compiled = await compileAsync('g++', [src, '-O2', '-std=c++17', '-o', exe], workDir, memMb);
      if (!compiled.ok) return { ok: false, stderr: compiled.stderr, run: () => Promise.resolve(DEAD_RUN) };
      const cppExe = JUDGE_RUNTIME === 'docker' ? containerPath(workDir, exe) : exe;
      return { ok: true, run: (input) => runProcessAsync(cppExe, [], input, workDir, timeLimitMs, memMb, true) };
    }

    case 'Java': {
      const src = path.join(workDir, 'Solution.java');
      fs.writeFileSync(src, code);
      if (JUDGE_RUNTIME !== 'docker' && !toolAvailable('javac')) {
        return { ok: false, stderr: 'Java compiler (javac) is not installed on this server.', run: () => Promise.resolve(DEAD_RUN) };
      }
      const compiled = await compileAsync('javac', [src], workDir, memMb);
      if (!compiled.ok) return { ok: false, stderr: compiled.stderr, run: () => Promise.resolve(DEAD_RUN) };
      const classPath = JUDGE_RUNTIME === 'docker' ? containerWorkDir(workDir) : workDir;
      return {
        ok: true,
        run: (input) => runProcessAsync(
          'java',
          [`-Xmx${javaHeapMb}m`, '-XX:+UseSerialGC', '-cp', classPath, 'Solution'],
          input, workDir, timeLimitMs, memMb, false
        ),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Output normalisation + public judge API
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n').trim().split('\n').map(l => l.trimEnd()).join('\n');
}

export interface JudgeCase { input: string; expectedOutput: string; isPublic?: boolean }
export interface JudgeCaseResult extends RunResult { input: string; expected: string; passed: boolean; isPublic?: boolean }

export interface JudgeSummary {
  overallStatus: RunResult['status'];
  compileError?: string;
  cases: JudgeCaseResult[];
  timeMs: number;
  memoryKb: number;
}

export async function judge(language: Language, code: string, cases: JudgeCase[], opts: JudgeOptions = {}): Promise<JudgeSummary> {
  // Validate source size before doing anything
  if (Buffer.byteLength(code, 'utf-8') > MAX_SOURCE_BYTES) {
    const msg = `Source code exceeds maximum allowed size (${Math.round(MAX_SOURCE_BYTES / 1024)}KB).`;
    return {
      overallStatus: 'Compilation Error',
      compileError: msg,
      cases: cases.map(c => ({ input: c.input, expected: c.expectedOutput, passed: false, isPublic: c.isPublic, status: 'Compilation Error' as const, stdout: '', stderr: msg, timeMs: 0, memoryKb: 0 })),
      timeMs: 0, memoryKb: 0,
    };
  }
  const workDir = makeWorkDir();
  try {
    const compiled = await prepare(language, code, workDir, opts);
    if (!compiled.ok) {
      return {
        overallStatus: 'Compilation Error',
        compileError: compiled.stderr,
        cases: cases.map(c => ({
          input: c.input, expected: c.expectedOutput, passed: false, isPublic: c.isPublic,
          status: 'Compilation Error' as const, stdout: '', stderr: compiled.stderr || '', timeMs: 0, memoryKb: 0,
        })),
        timeMs: 0,
        memoryKb: 0,
      };
    }

    const results: JudgeCaseResult[] = [];
    let maxTime = 0;
    let overall: RunResult['status'] = 'Accepted';

    for (const c of cases) {
      const r = await compiled.run(c.input);
      maxTime = Math.max(maxTime, r.timeMs);

      let status: RunResult['status'];
      let passed: boolean;
      if (r.timedOut) {
        status = 'Time Limit Exceeded'; passed = false;
      } else if (r.hitMemoryLimit) {
        status = 'Memory Limit Exceeded'; passed = false;
      } else if (r.exitCode !== 0) {
        status = 'Runtime Error'; passed = false;
      } else if (normalize(r.stdout) === normalize(c.expectedOutput)) {
        status = 'Accepted'; passed = true;
      } else {
        status = 'Wrong Answer'; passed = false;
      }

      if (status !== 'Accepted' && overall === 'Accepted') overall = status;

      results.push({
        input: c.input, expected: c.expectedOutput, passed, isPublic: c.isPublic,
        status, stdout: r.stdout, stderr: r.stderr, timeMs: r.timeMs, memoryKb: 0,
      });
    }

    return { overallStatus: overall, cases: results, timeMs: maxTime, memoryKb: 0 };
  } finally {
    cleanup(workDir);
  }
}

export async function runCustom(language: Language, code: string, input: string, opts: JudgeOptions = {}): Promise<RunResult> {
  if (Buffer.byteLength(code, 'utf-8') > MAX_SOURCE_BYTES) {
    return { status: 'Compilation Error', stdout: '', stderr: 'Source code exceeds maximum allowed size.', timeMs: 0, memoryKb: 0 };
  }
  const workDir = makeWorkDir();
  try {
    const compiled = await prepare(language, code, workDir, opts);
    if (!compiled.ok) {
      return { status: 'Compilation Error', stdout: '', stderr: compiled.stderr || '', timeMs: 0, memoryKb: 0 };
    }
    const r = await compiled.run(input);
    let status: RunResult['status'] = 'Accepted';
    if (r.timedOut) status = 'Time Limit Exceeded';
    else if (r.hitMemoryLimit) status = 'Memory Limit Exceeded';
    else if (r.exitCode !== 0) status = 'Runtime Error';
    return { status, stdout: r.stdout, stderr: r.stderr, timeMs: r.timeMs, memoryKb: 0 };
  } finally {
    cleanup(workDir);
  }
}
