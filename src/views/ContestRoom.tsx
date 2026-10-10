/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useDeferredValue, useMemo, useCallback } from 'react';
import { ArrowLeft, Trophy, Clock, ListOrdered, CheckCircle, Circle, Medal, ChevronLeft, ChevronRight, CircleDot, LockKeyhole, Laptop, Users, Search, RefreshCw, XCircle, Code2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
import { Contest, ContestProblemRef, ContestStandingEntry, CodingProblem, ProgrammingLanguage, Submission } from '../types';
import { contestsApi, submissionsApi, ApiError } from '../services/api';
import { CodeEditor } from '../components/CodeEditor';
import { useAuth } from '../context/AuthContext';

interface ContestRoomProps {
  contestId: string;
  onProblemViewChange: (active: boolean) => void;
  onNavigate: (view: string) => void;
  onExit: () => void;
  addToast: (title: string, type: any, desc?: string, duration?: number) => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

const difficultyColor: Record<string, string> = {
  Easy: 'text-emerald-600 dark:text-emerald-400',
  Medium: 'text-amber-600 dark:text-amber-400',
  Hard: 'text-rose-600 dark:text-rose-400',
};

type StandingsFilter = 'All' | 'Top 10' | 'My Rank' | 'Solved';

interface ContestStandingsProps {
  contest: Contest;
  standings: ContestStandingEntry[];
  myUserId?: string;
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  updatedAt: number | null;
  onRetry: () => void;
}

const ContestStandings = React.memo<ContestStandingsProps>(({ contest, standings, myUserId, isLoading, hasLoaded, error, updatedAt, onRetry }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StandingsFilter>('All');
  const [page, setPage] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const visibleStandings = useMemo(() => standings.filter((entry) => {
    if (filter === 'Top 10' && entry.rank > 10) return false;
    if (filter === 'My Rank' && entry.userId !== myUserId) return false;
    if (filter === 'Solved' && entry.solvedCount === 0) return false;
    return !deferredQuery || entry.fullName.toLocaleLowerCase().includes(deferredQuery);
  }), [standings, filter, deferredQuery, myUserId]);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(visibleStandings.length / pageSize));
  const activePage = Math.min(page, pageCount - 1);
  const pageStandings = visibleStandings.slice(activePage * pageSize, (activePage + 1) * pageSize);

  useEffect(() => {
    if (!updatedAt || contest.status !== 'Live') return;
    const interval = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(interval);
  }, [updatedAt, contest.status]);

  const retryButton = <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"><RefreshCw className="h-3.5 w-3.5" />Retry</button>;

  if (error && !hasLoaded) {
    return <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-rose-200 bg-white px-4 text-center dark:border-rose-900 dark:bg-[#11141d]">
      <XCircle className="h-6 w-6 text-rose-500" /><p className="text-sm font-bold">Unable to load standings.</p>{retryButton}
    </div>;
  }

  if (isLoading && !hasLoaded) {
    return <div aria-label="Loading standings" className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#11141d]">
      <div className="h-11 animate-pulse border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex h-14 animate-pulse items-center gap-4 border-b border-zinc-100 px-4 dark:border-zinc-800/70">
        <span className="h-3 w-8 rounded bg-zinc-200 dark:bg-zinc-800" /><span className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" /><span className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" /><span className="ml-auto h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>)}
    </div>;
  }

  if (standings.length === 0) {
    return <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-4 text-center dark:border-zinc-700 dark:bg-[#11141d]">
      <Users className="mb-3 h-7 w-7 text-zinc-400" /><p className="text-sm font-bold">No participants yet.</p><p className="mt-1 text-xs text-zinc-500">Be the first to compete.</p>
    </div>;
  }

  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search participant..." aria-label="Search participant" className="h-9 w-60 rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-zinc-700 dark:bg-[#11141d]" />
        </label>
        <div className="flex rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-[#11141d]" role="group" aria-label="Filter standings">
          {(['All', 'Top 10', 'My Rank', 'Solved'] as StandingsFilter[]).map((option) => <button key={option} onClick={() => { setFilter(option); setPage(0); }} aria-pressed={filter === option} className={`rounded px-2.5 py-1.5 text-[11px] font-bold ${filter === option ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>{option}</button>)}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        {contest.status === 'Live' ? <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />LIVE</span> : <span className="inline-flex items-center gap-1.5 font-bold text-zinc-600 dark:text-zinc-300"><Trophy className="h-3.5 w-3.5 text-amber-500" />FINAL STANDINGS</span>}
        {updatedAt && contest.status === 'Live' && <span>Updated {Math.floor((clock - updatedAt) / 1000) < 5 ? 'just now' : `${Math.floor((clock - updatedAt) / 1000)}s ago`}</span>}
        {error && hasLoaded && <span role="status" className="text-amber-600 dark:text-amber-400">Refresh delayed</span>}
        <button disabled title="Standings freeze is unavailable until backend support is added" className="hidden cursor-not-allowed items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-400 opacity-70 sm:inline-flex dark:border-zinc-700"><LockKeyhole className="h-3 w-3" />Freeze unavailable</button>
      </div>
    </div>

    <div className="standings-scroll overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#11141d]">
      <table className="standings-table w-full border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20 bg-zinc-50 text-[10px] font-extrabold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="standings-sticky-rank w-16 px-3 py-3 text-left">Rank</th>
            <th className="standings-sticky-participant w-60 px-3 py-3 text-left">Participant</th>
            <th className="px-3 py-3 text-center">Solved</th>
            {(contest.problems || []).map((problem, index) => <th key={problem.problemId} className="min-w-16 px-2 py-3 text-center" title={problem.title}>{problem.label || `P${index + 1}`}</th>)}
            <th className="standings-sticky-points px-3 py-3 text-right">Points</th>
            <th className="standings-sticky-penalty px-3 py-3 text-right">Penalty</th>
          </tr>
        </thead>
        <tbody>
          {pageStandings.map((entry) => {
            const isCurrentUser = entry.userId === myUserId;
            const initials = entry.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
            return <tr key={entry.userId} className={`standings-row ${isCurrentUser ? 'standings-current-user' : ''}`}>
              <td className="standings-sticky-rank whitespace-nowrap px-3 py-3 font-extrabold tabular-nums">{entry.rank <= 3 && <Medal aria-hidden="true" className={`mr-1 inline h-3.5 w-3.5 ${entry.rank === 1 ? 'text-amber-500' : entry.rank === 2 ? 'text-zinc-400' : 'text-orange-700'}`} />}#{entry.rank}</td>
              <td className="standings-sticky-participant min-w-60 px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${isCurrentUser ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{initials || '?'}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{entry.fullName}</span>
                    {isCurrentUser && <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">You</span>}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 text-center font-bold tabular-nums">{entry.solvedCount}</td>
              {(contest.problems || []).map((problem) => {
                const cell = entry.perProblem[problem.problemId];
                if (cell?.solved) return <td key={problem.problemId} className="px-2 py-3 text-center"><span title={`Accepted in ${cell.penaltyMinutes} minutes`} aria-label={`Accepted, ${cell.penaltyMinutes} minutes`} className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle className="h-3.5 w-3.5" /><span>+{cell.penaltyMinutes}m</span></span></td>;
                if (cell) return <td key={problem.problemId} className="px-2 py-3 text-center"><span title={`${cell.attempts} submission${cell.attempts === 1 ? '' : 's'} recorded; per-submission verdict is unavailable`} aria-label={`Attempted, ${cell.attempts} submission${cell.attempts === 1 ? '' : 's'}`} className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-amber-700 dark:text-amber-400"><CircleDot className="h-3.5 w-3.5" /><span>{cell.attempts}</span></span></td>;
                return <td key={problem.problemId} className="px-2 py-3 text-center text-zinc-400" aria-label="Not attempted" title="Not attempted">—</td>;
              })}
              <td className="standings-sticky-points px-3 py-3 text-right font-extrabold tabular-nums">{entry.totalPoints}</td>
              <td className="standings-sticky-penalty whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-zinc-500">{entry.totalPenaltyMinutes}m</td>
            </tr>;
          })}
          {visibleStandings.length === 0 && <tr><td colSpan={(contest.problems?.length || 0) + 5} className="px-4 py-10 text-center text-xs font-semibold text-zinc-500">No participants match this search or filter.</td></tr>}
        </tbody>
      </table>
    </div>
    {visibleStandings.length > pageSize && <div className="flex items-center justify-between text-[11px] text-zinc-500">
      <span>Showing {activePage * pageSize + 1}–{Math.min((activePage + 1) * pageSize, visibleStandings.length)} of {visibleStandings.length}</span>
      <div className="flex items-center gap-2"><button disabled={activePage === 0} onClick={() => setPage(activePage - 1)} className="rounded border border-zinc-200 px-2.5 py-1.5 font-bold disabled:opacity-40 dark:border-zinc-700">Previous</button><span>Page {activePage + 1} of {pageCount}</span><button disabled={activePage >= pageCount - 1} onClick={() => setPage(activePage + 1)} className="rounded border border-zinc-200 px-2.5 py-1.5 font-bold disabled:opacity-40 dark:border-zinc-700">Next</button></div>
    </div>}
  </section>;
});

export const ContestRoom: React.FC<ContestRoomProps> = ({ contestId, onProblemViewChange, onNavigate, onExit, addToast }) => {
  const { role, student, refreshStudent } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'problems' | 'standings' | 'submissions'>('standings');
  const [standings, setStandings] = useState<ContestStandingEntry[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsLoaded, setStandingsLoaded] = useState(false);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [standingsUpdatedAt, setStandingsUpdatedAt] = useState<number | null>(null);
  const [standingsRetry, setStandingsRetry] = useState(0);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState(false);
  const contestStatus = contest?.status;
  const [now, setNow] = useState(Date.now());
  const statusRefreshRequested = useRef(false);
  const [activeProblem, setActiveProblem] = useState<ContestProblemRef | null>(null);
  const [editorLanguage, setEditorLanguage] = useState<ProgrammingLanguage>('Python');
  const [splitPercent, setSplitPercent] = useState(42);
  const splitDrag = useRef<{ startX: number; startPercent: number } | null>(null);

  const loadContest = () => {
    contestsApi
      .get(contestId)
      .then(setContest)
      .catch((err) => addToast('Failed to Load Contest', 'error', err instanceof ApiError ? err.message : 'Server error.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadContest();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [contestId]);

  useEffect(() => {
    setIsLoading(true);
    setContest(null);
    setActiveProblem(null);
    setTab('standings');
    setStandings([]);
    setStandingsLoading(true);
    setStandingsLoaded(false);
    setStandingsError(null);
    setStandingsUpdatedAt(null);
    setMySubmissions([]);
    statusRefreshRequested.current = false;
  }, [contestId]);

  const contestEndTime = contest ? new Date(contest.endTime).getTime() : null;
  useEffect(() => {
    if (contestStatus !== 'Live' || contestEndTime === null || now < contestEndTime || statusRefreshRequested.current) return;
    statusRefreshRequested.current = true;
    loadContest();
  }, [contestStatus, contestEndTime, now, contestId]);

  useEffect(() => {
    if (contestStatus !== 'Ended' || contest?.profilePointsAwarded) return;

    const pollSettlement = () => {
      contestsApi.get(contestId).then(setContest).catch((err) => {
        addToast('Could Not Refresh Contest', 'error', err instanceof ApiError ? err.message : 'Server error.');
      });
    };
    const poll = window.setInterval(pollSettlement, 5000);
    return () => window.clearInterval(poll);
  }, [contest?.profilePointsAwarded, contestId, contestStatus]);

  useEffect(() => {
    if (role !== 'Student' || !contest?.profilePointsAwarded) return;
    refreshStudent().catch((err) => {
      addToast('Could Not Refresh Profile', 'error', err instanceof ApiError ? err.message : 'Server error.');
    });
  }, [addToast, contest?.profilePointsAwarded, refreshStudent, role]);

  useEffect(() => {
    onProblemViewChange(Boolean(activeProblem));
  }, [activeProblem, onProblemViewChange]);

  useEffect(() => {
    if (role !== 'Student') return;

    const preventClipboard = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const preventClipboardShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifierPressed = event.ctrlKey || event.metaKey;
      const isClipboardShortcut =
        (modifierPressed && ['c', 'x', 'v'].includes(key)) ||
        ((modifierPressed || event.shiftKey) && key === 'insert');

      if (isClipboardShortcut) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener('copy', preventClipboard, true);
    document.addEventListener('cut', preventClipboard, true);
    document.addEventListener('paste', preventClipboard, true);
    document.addEventListener('keydown', preventClipboardShortcuts, true);
    return () => {
      document.removeEventListener('copy', preventClipboard, true);
      document.removeEventListener('cut', preventClipboard, true);
      document.removeEventListener('paste', preventClipboard, true);
      document.removeEventListener('keydown', preventClipboardShortcuts, true);
    };
  }, [role]);

  useEffect(() => {
    if (tab !== 'standings' || !contestStatus || contestStatus === 'Upcoming') return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await contestsApi.leaderboard(contestId);
        if (cancelled) return;
        setStandings(result);
        setStandingsError(null);
        setStandingsLoaded(true);
        setStandingsUpdatedAt(Date.now());
      } catch (err) {
        if (!cancelled) setStandingsError(err instanceof ApiError ? err.message : 'Could not refresh standings.');
      } finally {
        if (!cancelled) setStandingsLoading(false);
      }
    };
    if (!standingsLoaded) setStandingsLoading(true);
    void refresh();
    const poll = contestStatus === 'Live' ? setInterval(() => void refresh(), 10000) : undefined;
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [tab, contestId, contestStatus, standingsRetry]);

  useEffect(() => {
    if (tab !== 'submissions' || !contest) return;
    let cancelled = false;
    setSubmissionsLoading(true);
    setSubmissionsError(false);
    submissionsApi.mine().then((rows) => {
      if (cancelled) return;
      const problemIds = new Set((contest.problems || []).map((problem) => problem.problemId));
      setMySubmissions(rows.filter((submission) => problemIds.has(submission.problemId)));
    }).catch(() => {
      if (!cancelled) setSubmissionsError(true);
    }).finally(() => {
      if (!cancelled) setSubmissionsLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab, contest]);

  const handleRegister = async () => {
    try {
      await contestsApi.register(contestId);
      addToast('Registered!', 'success', 'You are now registered for this contest.');
      loadContest();
    } catch (err) {
      addToast('Registration Failed', 'error', err instanceof ApiError ? err.message : 'Could not register.');
    }
  };

  const retryStandingsLoad = useCallback(() => {
    if (!standingsLoaded) setStandingsLoading(true);
    setStandingsError(null);
    setStandingsRetry((value) => value + 1);
  }, [standingsLoaded]);

  if (isLoading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-center text-xs font-bold text-zinc-400">Loading contest...</div>;
  }
  if (!contest) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-center text-xs font-bold text-zinc-400">Contest not found.</div>;
  }

  const startsIn = new Date(contest.startTime).getTime() - now;
  const endsIn = new Date(contest.endTime).getTime() - now;
  const isLive = contest.status === 'Live';
  const canSolve = isLive || contest.status === 'Ended';

  // Active problem solving view
  if (activeProblem) {
    const problemIndex = (contest.problems || []).findIndex((problem) => problem.problemId === activeProblem.problemId);
    const currentProblem = (contest.problems || [])[problemIndex] || activeProblem;
    const asCodingProblem: CodingProblem = {
      id: currentProblem.problemId,
      title: `${currentProblem.label}. ${currentProblem.title}`,
      difficulty: currentProblem.difficulty,
      category: currentProblem.category || '',
      statement: currentProblem.statement || '',
      inputFormat: currentProblem.inputFormat || '',
      outputFormat: currentProblem.outputFormat || '',
      constraints: currentProblem.constraints || '',
      examples: currentProblem.examples || [],
      starterTemplates: currentProblem.starterTemplates || {},
      testCases: (currentProblem.testCases || []).filter((testCase) => testCase.isPublic),
      solvedCount: 0,
      acceptanceRate: 0,
      status: currentProblem.status,
    };
    const timerTone = endsIn < 10 * 60 * 1000 ? 'critical' : endsIn <= 30 * 60 * 1000 ? 'warning' : 'normal';
    const selectProblem = (index: number) => {
      const nextProblem = (contest.problems || [])[index];
      if (nextProblem && (canSolve || contest.status === 'Ended')) setActiveProblem(nextProblem);
    };
    const renderMarkdown = (content: string) => (
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    );
    return (
      <div className="contest-room h-full min-h-0 flex flex-col bg-[#f5f6fa] text-zinc-900 dark:bg-[#090b12] dark:text-zinc-100">
        <header className="contest-header shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#11141d]">
          <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/logo.png" alt="SkillForge Code" className="h-8 w-8 shrink-0 object-contain" />
              <div className="min-w-0 border-l border-zinc-200 pl-3 dark:border-zinc-700">
                <div className="truncate text-xs font-extrabold">{contest.title}</div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-rose-500 animate-pulse' : contest.status === 'Ended' ? 'bg-zinc-400' : 'bg-amber-500'}`} />
                  {isLive ? 'Live contest' : contest.status === 'Ended' ? 'Contest ended' : 'Upcoming'}
                </div>
              </div>
            </div>
            <div className={`contest-timer timer-${timerTone} flex items-center gap-2 rounded-md px-3 py-1.5`} aria-live="off">
              <Clock className="h-4 w-4" />
              <div><div className="text-[9px] font-extrabold uppercase tracking-wider">{isLive ? 'Time left' : contest.status === 'Upcoming' ? 'Starts in' : 'Time left'}</div>
                <div className="font-mono text-base font-black tabular-nums leading-tight">{formatCountdown(isLive ? endsIn : contest.status === 'Upcoming' ? startsIn : 0)}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => setActiveProblem(null)} className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-zinc-300 dark:hover:bg-zinc-800" title="Back to contest overview">
                <ListOrdered className="h-4 w-4" /><span className="hidden sm:inline">Problems</span>
              </button>
              <button onClick={onExit} className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-zinc-300 dark:hover:bg-zinc-800" title="Exit contest">
                <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>
          <div className="contest-problem-nav flex items-center gap-1 overflow-x-auto border-t border-zinc-100 px-3 py-1.5 dark:border-zinc-800 sm:px-5" role="navigation" aria-label="Contest problems">
            {(contest.problems || []).map((problem, index) => {
              const selected = problem.problemId === currentProblem.problemId;
              const solved = problem.status === 'Solved';
              const attempted = problem.status === 'Attempted';
              const Icon = solved ? CheckCircle : attempted ? CircleDot : !canSolve && contest.status !== 'Ended' ? LockKeyhole : Circle;
              const label = solved ? 'Solved' : attempted ? 'Attempted' : !canSolve && contest.status !== 'Ended' ? 'Locked' : 'Not attempted';
              return <button key={problem.problemId} onClick={() => selectProblem(index)} disabled={!canSolve && contest.status !== 'Ended'} aria-current={selected ? 'page' : undefined} title={`${problem.label}: ${label}`} className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${selected ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'} disabled:cursor-not-allowed disabled:opacity-50`}>
                <span className="font-mono">{String(index + 1).padStart(2, '0')}</span><Icon className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">{label}</span>
              </button>;
            })}
            <span className="ml-auto hidden shrink-0 items-center gap-3 text-[10px] text-zinc-500 lg:flex" aria-label="Problem statuses">
              <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" />Solved</span><span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-amber-500" />Attempted</span><span className="flex items-center gap-1"><Circle className="h-3 w-3" />Unattempted</span>
            </span>
          </div>
        </header>

        <div className="contest-desktop-hint flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-xs text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200 md:hidden">
          <Laptop className="h-4 w-4 shrink-0" /> For the best contest experience, use a laptop or desktop.
        </div>
        <main className="contest-workspace flex min-h-0 flex-1 overflow-hidden" style={{ '--problem-pane': `${splitPercent}%` } as React.CSSProperties}>
          <section className="contest-problem-pane min-w-0 overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#10131b]" aria-label="Problem statement">
            <div className="mx-auto max-w-3xl px-5 py-6 sm:px-7">
              <div className="mb-5 flex items-start justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-indigo-50 px-2 py-1 font-mono text-[11px] font-extrabold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{currentProblem.label}</span>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${difficultyColor[currentProblem.difficulty] || 'text-zinc-500'}`}>{currentProblem.difficulty}</span>
                    {currentProblem.category && <span className="text-[10px] font-semibold text-zinc-400">{currentProblem.category}</span>}
                  </div>
                  <h1 className="text-xl font-extrabold leading-tight">{currentProblem.title}</h1>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => selectProblem(problemIndex - 1)} disabled={problemIndex <= 0 || (!canSolve && contest.status !== 'Ended')} className="rounded-md border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 disabled:opacity-35 dark:border-zinc-700 dark:hover:bg-zinc-800" title="Previous problem"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => selectProblem(problemIndex + 1)} disabled={problemIndex >= (contest.problems || []).length - 1 || (!canSolve && contest.status !== 'Ended')} className="rounded-md border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 disabled:opacity-35 dark:border-zinc-700 dark:hover:bg-zinc-800" title="Next problem"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <article className="contest-markdown">
                {renderMarkdown(currentProblem.statement || '')}
                {currentProblem.inputFormat && <><h2>Input Format</h2>{renderMarkdown(currentProblem.inputFormat)}</>}
                {currentProblem.outputFormat && <><h2>Output Format</h2>{renderMarkdown(currentProblem.outputFormat)}</>}
                {(currentProblem.examples || []).map((example, index) => <section className="contest-example" key={`${currentProblem.problemId}-example-${index}`}>
                  <h2>Example {index + 1}</h2><h3>Input</h3><pre><code>{example.input}</code></pre><h3>Output</h3><pre><code>{example.output}</code></pre>
                  {example.explanation && <><h3>Explanation</h3>{renderMarkdown(example.explanation)}</>}
                </section>)}
                {currentProblem.constraints && <><h2>Constraints</h2>{renderMarkdown(currentProblem.constraints)}</>}
              </article>
            </div>
          </section>
          <div
            className="contest-splitter"
            role="separator"
            aria-label="Resize problem and editor panels"
            aria-orientation="vertical"
            aria-valuenow={splitPercent}
            tabIndex={0}
            onPointerDown={(event) => { splitDrag.current = { startX: event.clientX, startPercent: splitPercent }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (!splitDrag.current) return; const delta = (event.clientX - splitDrag.current.startX) / Math.max(1, event.currentTarget.parentElement?.clientWidth || 1) * 100; setSplitPercent(Math.max(30, Math.min(65, splitDrag.current.startPercent + delta))); }}
            onPointerUp={() => { splitDrag.current = null; }}
            onKeyDown={(event) => { if (event.key === 'ArrowLeft') setSplitPercent((value) => Math.max(30, value - 2)); if (event.key === 'ArrowRight') setSplitPercent((value) => Math.min(65, value + 2)); }}
          />
          <section className="contest-editor-pane min-w-0 flex-1" aria-label="Code editor">
            <CodeEditor
              problem={asCodingProblem}
              selectedLanguage={editorLanguage}
              onLanguageChange={setEditorLanguage}
              contestId={contestId}
              contestMode
              disableClipboard={role === 'Student'}
              onSubmit={(_code, status) => {
                if (status === 'Accepted') {
                  addToast('Accepted!', 'success', `Problem ${currentProblem.label} solved. Standings will update shortly.`);
                  setActiveProblem((previous) => previous ? { ...previous, status: 'Solved' } : previous);
                  refreshStudent();
                  loadContest();
                } else {
                  setActiveProblem((previous) => previous && previous.status !== 'Solved' ? { ...previous, status: 'Attempted' } : previous);
                  addToast('Submission judged', 'info', status || 'The judge returned a verdict.');
                  loadContest();
                }
              }}
            />
          </section>
        </main>
      </div>
    );
  }

  const myStanding = student ? standings.find((entry) => entry.userId === student.id) : undefined;
  const problemCount = contest.problems?.length ?? contest.problemCount;
  const timerTone = endsIn < 10 * 60 * 1000 ? 'critical' : endsIn <= 30 * 60 * 1000 ? 'warning' : 'normal';
  const timeLabel = contest.status === 'Live' ? formatCountdown(endsIn) : contest.status === 'Upcoming' ? formatCountdown(startsIn) : 'Finished';
  const contestTabs: { id: typeof tab; label: string; icon: typeof Trophy }[] = [
    { id: 'overview', label: 'Overview', icon: Code2 },
    { id: 'problems', label: 'Problems', icon: Circle },
    { id: 'standings', label: 'Standings', icon: ListOrdered },
    { id: 'submissions', label: 'My Submissions', icon: CheckCircle },
  ];

  return (
    <div className="contest-hub min-h-screen bg-[#f5f6fa] px-3 py-4 text-zinc-900 dark:bg-[#090b12] dark:text-zinc-100 sm:px-5 sm:py-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt="SkillForge Code" className="h-9 w-9 shrink-0 object-contain" />
            <div className="shrink-0 leading-tight"><span className="block text-sm font-black">SkillForge</span><span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Code</span></div>
            <div className="min-w-0 border-l border-zinc-200 pl-3 dark:border-zinc-700">
              <h1 className="truncate text-sm font-extrabold sm:text-base">{contest.title}</h1>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'animate-pulse bg-rose-500' : contest.status === 'Upcoming' ? 'bg-amber-500' : 'bg-zinc-400'}`} />
                {isLive ? 'Live' : contest.status === 'Ended' ? 'Contest finished' : 'Upcoming'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`contest-timer timer-${timerTone} flex items-center gap-2 rounded-md px-3 py-1.5`}>
              {contest.status === 'Ended' ? <Trophy className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              <div><div className="text-[9px] font-extrabold uppercase tracking-wider">{contest.status === 'Upcoming' ? 'Starts in' : contest.status === 'Ended' ? 'Status' : 'Remaining'}</div><div className="font-mono text-sm font-black tabular-nums">{timeLabel}</div></div>
            </div>
            <button onClick={onExit} title="Exit contest" className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-600 hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-zinc-700 dark:bg-[#11141d] dark:text-zinc-300 dark:hover:text-indigo-300"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Exit</span></button>
          </div>
        </header>

        <nav className="contest-tabs flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800" aria-label="Contest navigation">
          {contestTabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${tab === id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
        </nav>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Contest statistics">
          <div className="contest-stat"><span>Participants</span><strong>{standingsLoaded ? standings.length : contest.registeredCount}</strong><Users className="h-4 w-4" /></div>
          <div className="contest-stat"><span>Problems</span><strong>{problemCount}</strong><Code2 className="h-4 w-4" /></div>
          <div className="contest-stat"><span>{contest.status === 'Upcoming' ? 'Starts in' : 'Remaining time'}</span><strong className="font-mono">{timeLabel}</strong><Clock className="h-4 w-4" /></div>
          <div className="contest-stat contest-rank-stat"><span>Your rank</span><strong>{myStanding ? `#${myStanding.rank}` : '—'}</strong><small>{myStanding ? `${myStanding.solvedCount} solved · ${myStanding.totalPoints} pts · ${myStanding.totalPenaltyMinutes}m` : student ? 'Not ranked yet' : 'Sign in to see your rank'}</small></div>
        </section>

        {role === 'Student' && contest.status === 'Upcoming' && !contest.isRegistered && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30"><p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Register to access contest problems and participate in standings.</p><button onClick={handleRegister} className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-indigo-700">Register for contest</button></div>}
        {role === 'Student' && contest.isRegistered && contest.status !== 'Live' && <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle className="mr-1 inline h-3.5 w-3.5" />You are registered</p>}

        {tab === 'overview' && <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#11141d]"><h2 className="text-sm font-extrabold">About this contest</h2><p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{contest.description || 'No contest description provided.'}</p><div className="mt-4 flex flex-wrap gap-5 text-[11px] text-zinc-500"><span>Starts <strong className="text-zinc-800 dark:text-zinc-200">{new Date(contest.startTime).toLocaleString()}</strong></span><span>Ends <strong className="text-zinc-800 dark:text-zinc-200">{new Date(contest.endTime).toLocaleString()}</strong></span></div></section>}

        {tab === 'problems' && <div className="space-y-2">
          {(contest.problems || []).map((problem) => <button key={problem.problemId} disabled={!canSolve && contest.status !== 'Ended'} onClick={() => canSolve || contest.status === 'Ended' ? setActiveProblem(problem) : undefined} className={`flex w-full items-center justify-between rounded-md border border-zinc-200 bg-white p-4 text-left dark:border-zinc-800 dark:bg-[#11141d] ${canSolve || contest.status === 'Ended' ? 'hover:border-indigo-400' : 'cursor-not-allowed opacity-60'}`}>
            <span className="flex items-center gap-3">{problem.status === 'Solved' ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" /> : problem.status === 'Attempted' ? <CircleDot className="h-4 w-4 shrink-0 text-amber-500" /> : <Circle className="h-4 w-4 shrink-0 text-zinc-400" />}<span><span className="block text-sm font-extrabold"><span className="mr-1.5 text-indigo-600 dark:text-indigo-400">{problem.label}.</span>{contest.status === 'Upcoming' ? 'Hidden until contest starts' : problem.title}</span>{contest.status !== 'Upcoming' && <span className={`text-[10px] font-bold uppercase ${difficultyColor[problem.difficulty] || 'text-zinc-400'}`}>{problem.difficulty}</span>}</span></span>
            <span className="text-xs font-black text-zinc-500">{problem.points} pts</span>
          </button>)}
          {(contest.problems || []).length === 0 && <div className="rounded-md border border-dashed border-zinc-300 py-12 text-center text-xs font-semibold text-zinc-500 dark:border-zinc-700">No problems have been added to this contest yet.</div>}
        </div>}

        {tab === 'standings' && contest.status === 'Upcoming' && <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white text-center dark:border-zinc-700 dark:bg-[#11141d]"><Clock className="mb-3 h-6 w-6 text-zinc-400" /><p className="text-sm font-bold">Standings open when the contest goes live.</p></div>}
        {tab === 'standings' && contest.status !== 'Upcoming' && <ContestStandings contest={contest} standings={standings} myUserId={student?.id} isLoading={standingsLoading} hasLoaded={standingsLoaded} error={standingsError} updatedAt={standingsUpdatedAt} onRetry={retryStandingsLoad} />}

        {tab === 'submissions' && <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#11141d]">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800"><h2 className="text-xs font-extrabold">My submissions</h2><span className="text-[10px] text-zinc-500">Recent submissions on problems in this contest</span></div>
          {submissionsLoading ? <div className="space-y-3 p-5">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-8 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />)}</div> : submissionsError ? <p role="alert" className="px-4 py-10 text-center text-xs font-semibold text-rose-600">Unable to load your submissions.</p> : mySubmissions.length === 0 ? <p className="px-4 py-10 text-center text-xs font-semibold text-zinc-500">No submissions for this contest yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-xs"><thead className="bg-zinc-50 text-[10px] font-extrabold uppercase text-zinc-500 dark:bg-zinc-900"><tr><th className="px-4 py-3 text-left">Problem</th><th className="px-4 py-3 text-left">Verdict</th><th className="px-4 py-3 text-left">Language</th><th className="px-4 py-3 text-left">Submitted</th><th className="px-4 py-3 text-right">Runtime</th><th className="px-4 py-3 text-right">Memory</th></tr></thead><tbody>{mySubmissions.map((submission) => <tr key={submission.id} className="border-t border-zinc-100 dark:border-zinc-800"><td className="px-4 py-3 font-bold">{contest.problems?.find((problem) => problem.problemId === submission.problemId)?.label || submission.problemTitle}</td><td className="px-4 py-3 font-bold">{submission.status}</td><td className="px-4 py-3">{submission.language}</td><td className="px-4 py-3 text-zinc-500">{new Date(submission.submittedAt).toLocaleString()}</td><td className="px-4 py-3 text-right tabular-nums">{submission.executionTimeMs} ms</td><td className="px-4 py-3 text-right tabular-nums">{(submission.memoryKb / 1024).toFixed(1)} MB</td></tr>)}</tbody></table></div>}
        </section>}
      </div>
    </div>
  );
};
