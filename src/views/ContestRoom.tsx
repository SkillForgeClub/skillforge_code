/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trophy, Clock, ListOrdered, CheckCircle, Circle, Medal, ChevronLeft, ChevronRight, CircleDot, LockKeyhole, Laptop } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
import { Contest, ContestProblemRef, ContestStandingEntry, CodingProblem, ProgrammingLanguage } from '../types';
import { contestsApi, ApiError } from '../services/api';
import { CodeEditor } from '../components/CodeEditor';
import { useAuth } from '../context/AuthContext';

interface ContestRoomProps {
  contestId: string;
  onProblemViewChange: (active: boolean) => void;
  onNavigate: (view: string) => void;
  onExit: () => void;
  addToast: (title: string, type: any, desc?: string) => void;
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

export const ContestRoom: React.FC<ContestRoomProps> = ({ contestId, onProblemViewChange, onNavigate, onExit, addToast }) => {
  const { role, refreshStudent } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'problems' | 'standings'>('problems');
  const [standings, setStandings] = useState<ContestStandingEntry[]>([]);
  const [now, setNow] = useState(Date.now());
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
    onProblemViewChange(Boolean(activeProblem));
  }, [activeProblem, onProblemViewChange]);

  useEffect(() => {
    if (tab === 'standings' && contest?.status !== 'Upcoming') {
      contestsApi.leaderboard(contestId).then(setStandings).catch(() => {});
      const poll = setInterval(() => contestsApi.leaderboard(contestId).then(setStandings).catch(() => {}), 10000);
      return () => clearInterval(poll);
    }
  }, [tab, contestId, contest?.status]);

  const handleRegister = async () => {
    try {
      await contestsApi.register(contestId);
      addToast('Registered!', 'success', 'You are now registered for this contest.');
      loadContest();
    } catch (err) {
      addToast('Registration Failed', 'error', err instanceof ApiError ? err.message : 'Could not register.');
    }
  };

  if (isLoading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-center text-xs font-bold text-zinc-400">Loading contest...</div>;
  }
  if (!contest) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-center text-xs font-bold text-zinc-400">Contest not found.</div>;
  }

  const startsIn = new Date(contest.startTime).getTime() - now;
  const endsIn = new Date(contest.endTime).getTime() - now;
  const isLive = contest.status === 'Live';
  const canSolve = isLive && contest.isRegistered;

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <button onClick={onExit} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400">
        <ArrowLeft className="h-4 w-4" /> All Contests
      </button>

      <div className="p-6 rounded-3xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-black mb-1">{contest.title}</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl">{contest.description}</p>
          </div>
          <div className="text-right shrink-0">
            {contest.status === 'Upcoming' && (
              <>
                <div className="text-[10px] font-bold uppercase text-zinc-400 mb-0.5">Starts In</div>
                <div className="text-lg font-mono font-black text-amber-600 dark:text-amber-400">{formatCountdown(startsIn)}</div>
              </>
            )}
            {contest.status === 'Live' && (
              <>
                <div className="text-[10px] font-bold uppercase text-zinc-400 mb-0.5">Time Remaining</div>
                <div className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400">{formatCountdown(endsIn)}</div>
              </>
            )}
            {contest.status === 'Ended' && (
              <div className="text-xs font-black text-zinc-400">Contest Ended</div>
            )}
          </div>
        </div>

        {role === 'Student' && contest.status !== 'Ended' && !contest.isRegistered && (
          <button onClick={handleRegister} className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold">
            Register for this Contest
          </button>
        )}
        {role === 'Student' && contest.isRegistered && (
          <span className="mt-4 inline-block text-xs font-black text-emerald-600 dark:text-emerald-400">✓ You are registered</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setTab('problems')}
          className={`px-4 py-2 text-xs font-black border-b-2 -mb-px transition-colors ${tab === 'problems' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-400'}`}
        >
          Problems
        </button>
        <button
          onClick={() => setTab('standings')}
          className={`px-4 py-2 text-xs font-black border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${tab === 'standings' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-400'}`}
        >
          <ListOrdered className="h-3.5 w-3.5" /> Live Standings
        </button>
      </div>

      {tab === 'problems' && (
        <div className="space-y-2">
          {(contest.problems || []).map((p) => (
            <button
              key={p.problemId}
              disabled={!canSolve && contest.status !== 'Ended'}
              onClick={() => canSolve || contest.status === 'Ended' ? setActiveProblem(p) : undefined}
              className={`w-full text-left flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 ${
                canSolve || contest.status === 'Ended' ? 'hover:border-indigo-400 dark:hover:border-indigo-500/50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                {p.status === 'Solved' ? (
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4.5 w-4.5 text-zinc-300 dark:text-zinc-700 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-extrabold">
                    <span className="text-indigo-500 mr-1.5">{p.label}.</span>
                    {contest.status === 'Upcoming' ? 'Hidden until contest starts' : p.title}
                  </div>
                  {contest.status !== 'Upcoming' && (
                    <div className={`text-[10px] font-bold uppercase ${difficultyColor[p.difficulty] || 'text-zinc-400'}`}>{p.difficulty}</div>
                  )}
                </div>
              </div>
              <span className="text-xs font-black text-zinc-400">{p.points} pts</span>
            </button>
          ))}
          {(contest.problems || []).length === 0 && (
            <div className="text-center py-12 text-xs font-bold text-zinc-400">No problems have been added to this contest yet.</div>
          )}
          {!canSolve && contest.status === 'Live' && role === 'Student' && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold text-center pt-2">Register above to unlock these problems.</p>
          )}
        </div>
      )}

      {tab === 'standings' && contest.status === 'Upcoming' && (
        <div className="text-center py-16 bg-white dark:bg-[#141414] border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <Clock className="h-6 w-6 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
          <p className="text-xs font-bold text-zinc-400">Standings will appear once the contest goes live.</p>
        </div>
      )}

      {tab === 'standings' && contest.status !== 'Upcoming' && (
        <div className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-[10px] uppercase text-zinc-400 font-black">
              <tr>
                <th className="text-left py-2.5 px-4">Rank</th>
                <th className="text-left py-2.5 px-4">Participant</th>
                <th className="text-center py-2.5 px-4">Solved</th>
                {(contest.problems || []).map((p) => (
                  <th key={p.problemId} className="text-center py-2.5 px-2">{p.label}</th>
                ))}
                <th className="text-right py-2.5 px-4">Points</th>
                <th className="text-right py-2.5 px-4">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s) => (
                <tr key={s.userId} className="border-t border-zinc-100 dark:border-zinc-800/70">
                  <td className="py-2.5 px-4 font-black">
                    {s.rank <= 3 ? <Medal className={`h-3.5 w-3.5 inline mr-1 ${s.rank === 1 ? 'text-amber-500' : s.rank === 2 ? 'text-zinc-400' : 'text-orange-700'}`} /> : null}
                    {s.rank}
                  </td>
                  <td className="py-2.5 px-4 font-bold">{s.fullName} <span className="text-zinc-400 font-medium">({s.rollNumber})</span></td>
                  <td className="py-2.5 px-4 text-center font-bold">{s.solvedCount}</td>
                  {(contest.problems || []).map((p) => {
                    const cell = s.perProblem[p.problemId];
                    return (
                      <td key={p.problemId} className="py-2.5 px-2 text-center">
                        {cell?.solved ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-black">+{cell.penaltyMinutes}m</span>
                        ) : cell ? (
                          <span className="text-rose-500 font-black">-{cell.attempts}</span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-4 text-right font-black">{s.totalPoints}</td>
                  <td className="py-2.5 px-4 text-right text-zinc-400 font-bold">{s.totalPenaltyMinutes}m</td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr><td colSpan={20} className="text-center py-10 text-zinc-400 font-bold">No registered participants yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
