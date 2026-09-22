/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Search, 
  Star, 
  Flame, 
  Crown
} from 'lucide-react';
import { LeaderboardEntry } from '../types';
import { leaderboardApi, ApiError } from '../services/api';

interface GlobalLeaderboardProps {
  onNavigate: (view: string) => void;
}

export const GlobalLeaderboard: React.FC<GlobalLeaderboardProps> = ({ onNavigate }) => {
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [starRatingFilter, setStarRatingFilter] = useState<number | 'All'>('All');

  useEffect(() => {
    leaderboardApi
      .list()
      .then(setLeaderboardEntries)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load the leaderboard.'))
      .finally(() => setIsLoading(false));
  }, []);

  // Sort standard rankings
  const sortedRankingEntries = [...leaderboardEntries].sort((a, b) => a.rank - b.rank);

  // Top podium winners
  const firstPlaceWinner = sortedRankingEntries.find(e => e.rank === 1);
  const secondPlaceWinner = sortedRankingEntries.find(e => e.rank === 2);
  const thirdPlaceWinner = sortedRankingEntries.find(e => e.rank === 3);

  const filteredRankingEntries = sortedRankingEntries.filter((entry) => {
    const matchesSearch = entry.fullName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                          entry.rollNumber.toLowerCase().includes(studentSearchQuery.toLowerCase());
    
    const matchesStar = starRatingFilter === 'All' || entry.starRating === starRatingFilter;
    return matchesSearch && matchesStar;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-zinc-50 dark:bg-[#0a0a0a] transition-colors min-h-screen">
      
      {/* Platform Banner */}
      <div className="space-y-1 pb-4 border-b border-zinc-200/50 dark:border-zinc-850 text-center md:text-left">
        <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center justify-center md:justify-start gap-1">
          <Trophy className="h-3.5 w-3.5" /> Campus Leaderboard
        </span>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Competitive Standings</h2>
        <p className="text-xs text-zinc-400 font-medium max-w-xl">
          Track real-time points, streak Sentinel logs, and star ratings across all registered college departments.
        </p>
      </div>

      {/* 1. PODIUM CARDS (Top 3 Visual Display) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-6 max-w-4xl mx-auto">
        
        {/* SECOND PLACE (Podium Left) */}
        {secondPlaceWinner && (
          <div className="order-2 md:order-1 p-6 bg-white dark:bg-[#141414] rounded-2xl border border-zinc-200 dark:border-zinc-800/80 text-center space-y-4 shadow-sm md:h-[240px] flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-zinc-550 border-2 border-zinc-300 relative">
                  2
                  <span className="absolute -top-1.5 right-1.5 text-xs">🥈</span>
                </div>
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white leading-tight">{secondPlaceWinner.fullName}</h4>
                <span className="text-[10px] text-zinc-400">{secondPlaceWinner.rollNumber}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="block font-black text-sm text-indigo-600 dark:text-indigo-400">{secondPlaceWinner.points} Pts</span>
              <span className="text-[9px] uppercase font-bold text-zinc-450 block">{secondPlaceWinner.solvedCount} Problems Solved</span>
            </div>
          </div>
        )}

        {/* FIRST PLACE (Podium Center, Styled Larger) */}
        {firstPlaceWinner && (
          <div className="order-1 md:order-2 p-8 bg-gradient-to-b from-indigo-950 to-indigo-900 text-white rounded-3xl border border-indigo-950 text-center space-y-4 shadow-lg md:h-[280px] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-2 relative z-10">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-amber-400/20 flex items-center justify-center font-black text-amber-300 border-2 border-amber-400 relative">
                  <Crown className="h-6 w-6 text-amber-400" />
                  <span className="absolute -top-1 right-1 text-xs">🥇</span>
                </div>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white leading-tight">{firstPlaceWinner.fullName}</h4>
                <span className="text-[10px] text-indigo-200">{firstPlaceWinner.rollNumber}</span>
              </div>
            </div>

            <div className="space-y-1 relative z-10">
              <span className="block font-black text-lg text-amber-300">{firstPlaceWinner.points} Pts</span>
              <span className="text-[9px] uppercase font-bold text-indigo-200 block">{firstPlaceWinner.solvedCount} Problems Solved</span>
              <div className="flex justify-center gap-0.5 pt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current text-amber-400" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* THIRD PLACE (Podium Right) */}
        {thirdPlaceWinner && (
          <div className="order-3 p-6 bg-white dark:bg-[#141414] rounded-2xl border border-zinc-200 dark:border-zinc-800/80 text-center space-y-4 shadow-sm md:h-[240px] flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-amber-700 border-2 border-amber-600/70 relative">
                  3
                  <span className="absolute -top-1.5 right-1.5 text-xs">🥉</span>
                </div>
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white leading-tight">{thirdPlaceWinner.fullName}</h4>
                <span className="text-[10px] text-zinc-400">{thirdPlaceWinner.rollNumber}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="block font-black text-sm text-indigo-600 dark:text-indigo-400">{thirdPlaceWinner.points} Pts</span>
              <span className="text-[9px] uppercase font-bold text-zinc-450 block">{thirdPlaceWinner.solvedCount} Problems Solved</span>
            </div>
          </div>
        )}

      </div>

      {/* 2. FILTER & SEARCH CONTROL ROW */}
      <div className="p-5 bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search student rank index..."
            value={studentSearchQuery}
            onChange={(e) => setStudentSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Quick star chips */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] font-bold uppercase text-zinc-400 whitespace-nowrap">Filter rating:</span>
          <div className="flex flex-wrap gap-1">
            {['All', 5, 4, 3].map((starOption) => {
              const isSelected = starRatingFilter === starOption;
              return (
                <button
                  key={starOption}
                  onClick={() => setStarRatingFilter(starOption as any)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-650 hover:bg-zinc-205'
                  }`}
                >
                  {starOption === 'All' ? 'All tiers' : `${starOption} ★`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. DETAILED SCORES TABLE */}
      <div className="bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#0a0a0a] text-[10px] font-bold text-zinc-450 uppercase border-b border-zinc-150">
                <th className="px-6 py-4">Global Rank</th>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Roll Number</th>
                <th className="px-6 py-4">Code Solves</th>
                <th className="px-6 py-4">Streak Status</th>
                <th className="px-6 py-4">Star Level</th>
                <th className="px-6 py-4 text-right">Forge Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredRankingEntries.map((entry) => {
                return (
                  <tr key={entry.studentId} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`font-black text-xs ${
                        entry.rank === 1 ? 'text-amber-500' :
                        entry.rank === 2 ? 'text-zinc-450' :
                        entry.rank === 3 ? 'text-amber-700' :
                        'text-zinc-400'
                      }`}>
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-extrabold text-zinc-900 dark:text-white block">{entry.fullName}</span>
                    </td>
                    <td className="px-6 py-4 font-mono">{entry.rollNumber}</td>
                    <td className="px-6 py-4 font-semibold">{entry.solvedCount} problems</td>
                    <td className="px-6 py-4">
                      {entry.streak > 0 ? (
                        <span className="text-amber-600 dark:text-amber-455 font-bold flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5 fill-current text-amber-500" />
                          {entry.streak} Days
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-0.5">
                        {Array.from({ length: entry.starRating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current text-amber-400" />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-400">
                      {entry.points}
                    </td>
                  </tr>
                );
              })}

              {filteredRankingEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                    No students found matching current query parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
