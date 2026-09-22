/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Clock, ListOrdered, CheckCircle, Circle, Medal } from 'lucide-react';
import { Contest, ContestProblemRef, ContestStandingEntry, CodingProblem, ProgrammingLanguage } from '../types';
import { contestsApi, ApiError } from '../services/api';
import { CodeEditor } from '../components/CodeEditor';
import { useAuth } from '../context/AuthContext';

interface ContestRoomProps {
  contestId: string;
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

export const ContestRoom: React.FC<ContestRoomProps> = ({ contestId, onNavigate, onExit, addToast }) => {
  const { role, refreshStudent } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'problems' | 'standings'>('problems');
  const [standings, setStandings] = useState<ContestStandingEntry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [activeProblem, setActiveProblem] = useState<ContestProblemRef | null>(null);
  const [editorLanguage, setEditorLanguage] = useState<ProgrammingLanguage>('Python');

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
    const asCodingProblem: CodingProblem = {
      id: activeProblem.problemId,
      title: `${activeProblem.label}. ${activeProblem.title}`,
      difficulty: activeProblem.difficulty,
      category: activeProblem.category || '',
      statement: activeProblem.statement || '',
      inputFormat: activeProblem.inputFormat || '',
      outputFormat: activeProblem.outputFormat || '',
      constraints: activeProblem.constraints || '',
      examples: activeProblem.examples || [],
      starterTemplates: activeProblem.starterTemplates || {},
      testCases: activeProblem.testCases || [],
      solvedCount: 0,
      acceptanceRate: 0,
      status: activeProblem.status,
    };
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setActiveProblem(null)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400">
            <ArrowLeft className="h-4 w-4" /> Back to {contest.title}
          </button>
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
              <Clock className="h-3.5 w-3.5" /> {formatCountdown(endsIn)} remaining
            </span>
          )}
        </div>
        <CodeEditor
          problem={asCodingProblem}
          selectedLanguage={editorLanguage}
          onLanguageChange={setEditorLanguage}
          contestId={contestId}
          onSubmit={(code, status) => {
            if (status === 'Accepted') {
              addToast('Accepted!', 'success', `Problem ${activeProblem.label} solved. Standings will update shortly.`);
              refreshStudent();
              loadContest();
            } else {
              addToast('Not Accepted', 'error', status || 'Some test cases failed.');
            }
          }}
        />
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
