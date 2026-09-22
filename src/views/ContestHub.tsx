/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Calendar, ChevronRight, Timer } from 'lucide-react';
import { Contest } from '../types';
import { contestsApi, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ContestHubProps {
  onNavigate: (view: string) => void;
  onEnterContest: (contestId: string) => void;
  addToast: (title: string, type: any, desc?: string) => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return days > 0 ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

const statusStyles: Record<Contest['status'], string> = {
  Live: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  Ended: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/30',
};

export const ContestHub: React.FC<ContestHubProps> = ({ onNavigate, onEnterContest, addToast }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const { role } = useAuth();

  const loadContests = () => {
    contestsApi
      .list()
      .then(setContests)
      .catch((err) => addToast('Failed to Load Contests', 'error', err instanceof ApiError ? err.message : 'Server error.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadContests();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleRegister = async (contest: Contest, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await contestsApi.register(contest.id);
      addToast('Registered!', 'success', `You're locked in for "${contest.title}". Good luck.`);
      setContests((prev) => prev.map((c) => (c.id === contest.id ? { ...c, isRegistered: true, registeredCount: c.registeredCount + 1 } : c)));
    } catch (err) {
      addToast('Registration Failed', 'error', err instanceof ApiError ? err.message : 'Could not register.');
    }
  };

  const grouped = {
    Live: contests.filter((c) => c.status === 'Live'),
    Upcoming: contests.filter((c) => c.status === 'Upcoming'),
    Ended: contests.filter((c) => c.status === 'Ended'),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-indigo-600 flex items-center justify-center">
          <Trophy className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black">College Coding Contests</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">Timed, ranked, multi-problem contests — register, compete, climb the standings.</p>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-16 bg-white dark:bg-[#141414] border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <p className="text-xs text-zinc-400 font-bold">Loading contests...</p>
        </div>
      )}

      {!isLoading && contests.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-[#141414] border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <p className="text-xs text-zinc-400 font-bold">No contests have been scheduled yet. Check back soon.</p>
        </div>
      )}

      {(['Live', 'Upcoming', 'Ended'] as const).map((bucket) =>
        grouped[bucket].length > 0 ? (
          <div key={bucket} className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400">{bucket} Contests</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grouped[bucket].map((contest) => {
                const startsIn = new Date(contest.startTime).getTime() - now;
                const endsIn = new Date(contest.endTime).getTime() - now;
                return (
                  <button
                    key={contest.id}
                    onClick={() => onEnterContest(contest.id)}
                    className="text-left p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-extrabold text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{contest.title}</h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase ${statusStyles[contest.status]}`}>
                        {contest.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">{contest.description || 'No description provided.'}</p>

                    <div className="flex items-center gap-4 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-4">
                      <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" />{contest.problemCount} problems</span>
                    </div>

                    {contest.status === 'Upcoming' && (
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400 mb-3">
                        <Timer className="h-3.5 w-3.5" /> Starts in {formatCountdown(startsIn)}
                      </div>
                    )}
                    {contest.status === 'Live' && (
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 mb-3">
                        <Clock className="h-3.5 w-3.5" /> Ends in {formatCountdown(endsIn)}
                      </div>
                    )}
                    {contest.status === 'Ended' && (
                      <div className="flex items-center gap-1.5 text-xs font-black text-zinc-400 mb-3">
                        <Calendar className="h-3.5 w-3.5" /> Ended {new Date(contest.endTime).toLocaleDateString()}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      {role === 'Student' && contest.status !== 'Ended' ? (
                        contest.isRegistered ? (
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">✓ Registered</span>
                        ) : (
                          <span onClick={(e) => handleRegister(contest, e)} className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline">
                            Register Now
                          </span>
                        )
                      ) : (
                        <span className="text-xs font-black text-zinc-400">
                          {contest.status === 'Ended' ? 'View Results' : 'View Details'}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
};
