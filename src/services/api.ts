/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodingProblem, Quiz, Student, LeaderboardEntry, Submission, ProgrammingLanguage, Contest, ContestStandingEntry } from '../types';

const TOKEN_KEY = 'skillforge_token';

// In a split deployment (Vercel frontend + a separate backend server), set VITE_API_URL at
// build time to the backend's full origin (e.g. https://api.yourdomain.com). Left unset, API
// calls stay relative (/api/...) - correct for local dev and for a combined single-server
// deployment where Express serves both the API and the built frontend (see README "Production
// build"). Trailing slashes are stripped so both "https://x.com" and "https://x.com/" work.
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthResponse {
  token: string;
  role: 'student' | 'admin';
  user: Student | { id: string; fullName: string; email: string };
}

export const authApi = {
  register: (data: { fullName: string; rollNumber: string; email: string; password: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<Omit<AuthResponse, 'token'>>('/auth/me'),
  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyResetCode: (email: string, code: string) =>
    request<{ valid: boolean }>('/auth/verify-reset-code', { method: 'POST', body: JSON.stringify({ email, code }) }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) }),
};

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------

export interface BulkImportResult {
  total: number;
  succeeded: number;
  failed: number;
  results: { index: number; title?: string; success: boolean; id?: string; error?: string }[];
}

export const problemsApi = {
  list: () => request<CodingProblem[]>('/problems'),
  get: (id: string) => request<CodingProblem>(`/problems/${id}`),
  create: (data: Partial<CodingProblem> & { testCases: any[] }) =>
    request<CodingProblem>('/problems', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CodingProblem> & { testCases?: any[] }) =>
    request<CodingProblem>(`/problems/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/problems/${id}`, { method: 'DELETE' }),
  bulkImport: (problems: any[]) =>
    request<BulkImportResult>('/problems/bulk', { method: 'POST', body: JSON.stringify({ problems }) }),
};

// ---------------------------------------------------------------------------
// Submissions / Judge
// ---------------------------------------------------------------------------

export interface JudgeCaseResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  isPublic: boolean;
}

export interface RunResponse {
  mode: 'custom' | 'public-tests';
  status: string;
  stdout?: string;
  stderr?: string;
  compileError?: string;
  timeMs: number;
  memoryKb: number;
  testCasesChecked?: JudgeCaseResult[];
}

export interface SubmitResponse {
  status: Submission['status'];
  compileError?: string;
  timeMs: number;
  memoryKb: number;
  submissionId: string;
  testCasesChecked: JudgeCaseResult[];
}

export interface QueueStats {
  running: number;
  queued: number;
  concurrency: number;
}

export interface QueuedJobStatus extends QueueStats {
  status: 'Queued' | 'Running';
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls a "kick off a job, then poll for the result" endpoint until it reaches a terminal state.
 * Calls onProgress with live queue position/running info on every poll while still Queued/Running.
 */
async function pollUntilDone<T extends { status: string }>(
  fetchStatus: () => Promise<T>,
  isTerminal: (result: T) => boolean,
  onProgress?: (result: T) => void,
  intervalMs = 500,
  maxWaitMs = 60000
): Promise<T> {
  const start = Date.now();
  while (true) {
    const result = await fetchStatus();
    if (isTerminal(result)) return result;
    onProgress?.(result);
    if (Date.now() - start > maxWaitMs) {
      throw new ApiError('Judging is taking longer than expected. Please try again in a moment.', 504);
    }
    await delay(intervalMs);
  }
}

export const submissionsApi = {
  queueStatus: () => request<QueueStats>('/submissions/queue-status'),

  /** Kicks off a run job and polls until it's done, reporting live queue status via onProgress. */
  run: async (
    data: { problemId: string; language: ProgrammingLanguage; code: string; customInput?: string },
    onProgress?: (status: QueuedJobStatus) => void
  ): Promise<RunResponse> => {
    const kicked = await request<{ runId: string; status: 'Queued' } & QueueStats>('/submissions/run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    onProgress?.({ status: 'Queued', running: kicked.running, queued: kicked.queued, concurrency: kicked.concurrency });

    const final = await pollUntilDone(
      () => request<any>(`/submissions/run/${kicked.runId}`),
      (r) => r.jobState === 'Done' || r.jobState === 'Error',
      (r) => onProgress?.({ status: r.jobState ?? 'Queued', running: r.running ?? 0, queued: r.queued ?? 0, concurrency: r.concurrency ?? 1 })
    );
    if (final.jobState === 'Error') throw new ApiError(final.error || 'The judge encountered an error.', 500);
    return final as RunResponse;
  },

  /** Kicks off a submit job and polls until it's graded, reporting live queue status via onProgress. */
  submit: async (
    data: { problemId: string; language: ProgrammingLanguage; code: string; contestId?: string },
    onProgress?: (status: QueuedJobStatus) => void
  ): Promise<SubmitResponse> => {
    const kicked = await request<{ submissionId: string; status: 'Queued' } & QueueStats>('/submissions/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    onProgress?.({ status: 'Queued', running: kicked.running, queued: kicked.queued, concurrency: kicked.concurrency });

    const final = await pollUntilDone(
      () => request<any>(`/submissions/${kicked.submissionId}`),
      (r) => r.status !== 'Queued' && r.status !== 'Running',
      (r) => onProgress?.({ status: r.status, running: r.running ?? 0, queued: r.queued ?? 0, concurrency: r.concurrency ?? 1 })
    );
    return final as SubmitResponse;
  },

  mine: () => request<Submission[]>('/submissions/mine'),
};

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

export const quizzesApi = {
  list: () => request<Quiz[]>('/quizzes'),
  get: (id: string) => request<Quiz & { myAttempt: { score: number; maxScore: number; submittedAt: string; answers: Record<string, any> } | null }>(`/quizzes/${id}`),
  create: (data: Partial<Quiz> & { questions: any[] }) =>
    request<Quiz>('/quizzes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Quiz> & { questions?: any[] }) =>
    request<Quiz>(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/quizzes/${id}`, { method: 'DELETE' }),
  submitAttempt: (id: string, answers: Record<string, string | number>) =>
    request<{ score: number; maxScore: number; breakdown: any[] }>(`/quizzes/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
};

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export const leaderboardApi = {
  list: () => request<LeaderboardEntry[]>('/leaderboard'),
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminApi = {
  students: () => request<Student[]>('/admin/students'),
  updateStudent: (id: string, data: Partial<Student>) =>
    request<Student>(`/admin/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  issueCertificate: (id: string, data: { title: string; issueDate: string }) =>
    request<Student>(`/admin/students/${id}/certificates`, { method: 'POST', body: JSON.stringify(data) }),
  removeCertificate: (studentId: string, certificateId: string) =>
    request<Student>(`/admin/students/${studentId}/certificates/${certificateId}`, { method: 'DELETE' }),
  deleteStudent: (id: string) => request<{ success: boolean }>(`/admin/students/${id}`, { method: 'DELETE' }),
  stats: () => request<{
    totalStudents: number; totalProblems: number; totalQuizzes: number; totalSubmissions: number;
    databaseSizeBytes: number; largestTables: { table: string; bytes: number }[];
  }>('/admin/stats'),
  recentSubmissions: () => request<Array<{
    id: string;
    studentName: string;
    problemTitle: string;
    language: string;
    status: string;
    submittedAt: string;
  }>>('/admin/recent-submissions'),
};

// ---------------------------------------------------------------------------
// Server-Sent Events — real-time submission status
// ---------------------------------------------------------------------------

/**
 * Opens an SSE connection to the backend. Returns a cleanup function.
 * The backend pushes 'submission.updated' events when a verdict is ready.
 */
export function connectSSE(
  onEvent: (data: Record<string, unknown>) => void,
  onError?: () => void
): () => void {
  const token = getToken();
  if (!token) return () => {};

  const url = `${API_BASE_URL}/api/events`;
  const es = new EventSource(url + `?token=${encodeURIComponent(token)}`);

  es.addEventListener('submission.updated', (e: MessageEvent) => {
    try { onEvent(JSON.parse(e.data)); } catch { /* ignore malformed */ }
  });

  es.onerror = () => {
    onError?.();
    // EventSource auto-reconnects — no manual retry needed
  };

  return () => es.close();
}

export const contestsApi = {
  list: () => request<Contest[]>('/contests'),
  createProblem: (data: any) => request<CodingProblem>('/contests/problem', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<Contest>(`/contests/${id}`),
  register: (id: string) => request<{ success: boolean; isRegistered: boolean }>(`/contests/${id}/register`, { method: 'POST' }),
  leaderboard: (id: string) => request<ContestStandingEntry[]>(`/contests/${id}/leaderboard`),
  create: (data: { title: string; description?: string; startTime: string; endTime: string; problems: { problemId: string; label: string; points: number }[] }) =>
    request<Contest>('/contests', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ title: string; description: string; startTime: string; endTime: string; problems: { problemId: string; label: string; points: number }[] }>) =>
    request<Contest>(`/contests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/contests/${id}`, { method: 'DELETE' }),
  extend: (id: string, minutes: number) =>
    request<Contest>(`/contests/${id}/extend`, { method: 'POST', body: JSON.stringify({ minutes }) }),
};
