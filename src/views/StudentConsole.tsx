/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Flame, 
  ChevronRight, 
  Bell, 
  CheckCircle, 
  AlertCircle,
  FileCode2,
  ExternalLink,
  Star,
  Lock,
  Unlock,
  Download
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Student, Submission, Quiz, CodingProblem, STAR_THRESHOLDS } from '../types';
import { useAuth } from '../context/AuthContext';
import { submissionsApi, quizzesApi, problemsApi, ApiError } from '../services/api';

interface StudentConsoleProps {
  onNavigate: (view: string) => void;
  addToast: (title: string, type: any, desc?: string) => void;
}

interface CoreAchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedBg: string;
  unlockedText: string;
  unlockedBorder: string;
  lockedBg: string;
  lockedText: string;
  lockedBorder: string;
  criteria: string;
  checkUnlocked: (student: Student) => boolean;
}

// Extensible core badges list
const CORE_ACHIEVEMENT_BADGES: CoreAchievementBadge[] = [
  {
    id: 'badge-bronze',
    title: 'Bronze Coding Badge',
    description: 'Recognizes core progress. Unlocked by solving at least 100 coding problems.',
    icon: '🥉',
    unlockedBg: 'bg-orange-500/10 dark:bg-orange-950/20',
    unlockedText: 'text-orange-600 dark:text-orange-400',
    unlockedBorder: 'border-orange-500/25 dark:border-orange-500/10',
    lockedBg: 'bg-zinc-100/50 dark:bg-zinc-950/20',
    lockedText: 'text-zinc-400 dark:text-zinc-650',
    lockedBorder: 'border-zinc-200 dark:border-zinc-800/80',
    criteria: 'Solve 100+ Problems',
    checkUnlocked: (student) => {
      const totalSolved = student.problemsSolved.easy + student.problemsSolved.medium + student.problemsSolved.hard;
      return totalSolved >= 100;
    }
  },
  {
    id: 'badge-silver',
    title: 'Silver Coding Badge',
    description: 'Demonstrates algorithms competency. Unlocked by solving at least 500 coding problems.',
    icon: '🥈',
    unlockedBg: 'bg-slate-500/10 dark:bg-slate-950/20',
    unlockedText: 'text-slate-600 dark:text-slate-400',
    unlockedBorder: 'border-slate-500/25 dark:border-slate-500/10',
    lockedBg: 'bg-zinc-100/50 dark:bg-zinc-950/20',
    lockedText: 'text-zinc-400 dark:text-zinc-650',
    lockedBorder: 'border-zinc-200 dark:border-zinc-800/80',
    criteria: 'Solve 500+ Problems',
    checkUnlocked: (student) => {
      const totalSolved = student.problemsSolved.easy + student.problemsSolved.medium + student.problemsSolved.hard;
      return totalSolved >= 500;
    }
  },
  {
    id: 'badge-gold',
    title: 'Gold Coding Badge',
    description: 'Marks advanced software expertise. Unlocked by solving at least 1000 coding problems.',
    icon: '🥇',
    unlockedBg: 'bg-amber-500/10 dark:bg-amber-950/20',
    unlockedText: 'text-amber-600 dark:text-amber-400',
    unlockedBorder: 'border-amber-500/25 dark:border-amber-500/10',
    lockedBg: 'bg-zinc-100/50 dark:bg-zinc-950/20',
    lockedText: 'text-zinc-400 dark:text-zinc-650',
    lockedBorder: 'border-zinc-200 dark:border-zinc-800/80',
    criteria: 'Solve 1000+ Problems',
    checkUnlocked: (student) => {
      const totalSolved = student.problemsSolved.easy + student.problemsSolved.medium + student.problemsSolved.hard;
      return totalSolved >= 1000;
    }
  },
  {
    id: 'badge-platinum',
    title: 'Premium Coding Badge',
    description: 'Granted to elite tier competitors. Unlocked by solving at least 1500 coding problems.',
    icon: '💎',
    unlockedBg: 'bg-cyan-500/10 dark:bg-cyan-950/20',
    unlockedText: 'text-cyan-600 dark:text-cyan-400',
    unlockedBorder: 'border-cyan-500/25 dark:border-cyan-500/10',
    lockedBg: 'bg-zinc-100/50 dark:bg-zinc-950/20',
    lockedText: 'text-zinc-400 dark:text-zinc-650',
    lockedBorder: 'border-zinc-200 dark:border-zinc-800/80',
    criteria: 'Solve 1500+ Problems',
    checkUnlocked: (student) => {
      const totalSolved = student.problemsSolved.easy + student.problemsSolved.medium + student.problemsSolved.hard;
      return totalSolved >= 1500;
    }
  },
  {
    id: 'badge-diamond',
    title: 'Diamond Coding Badge',
    description: 'Highest competitive rank. Unlocked by solving at least 2000 coding problems.',
    icon: '👑',
    unlockedBg: 'bg-indigo-500/10 dark:bg-indigo-950/20',
    unlockedText: 'text-indigo-600 dark:text-indigo-400',
    unlockedBorder: 'border-indigo-500/25 dark:border-indigo-500/10',
    lockedBg: 'bg-zinc-100/50 dark:bg-zinc-950/20',
    lockedText: 'text-zinc-400 dark:text-zinc-650',
    lockedBorder: 'border-zinc-200 dark:border-zinc-800/80',
    criteria: 'Solve 2000+ Problems',
    checkUnlocked: (student) => {
      const totalSolved = student.problemsSolved.easy + student.problemsSolved.medium + student.problemsSolved.hard;
      return totalSolved >= 2000;
    }
  }
];

function downloadAchievementBadge(badge: CoreAchievementBadge, student: Student) {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context) return;

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, '#111827');
  background.addColorStop(1, '#312e81');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = 'rgba(255, 255, 255, 0.08)';
  context.beginPath();
  context.arc(1330, 130, 330, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(180, 820, 260, 0, Math.PI * 2);
  context.fill();

  context.textAlign = 'center';
  context.font = '110px sans-serif';
  context.fillText(badge.icon, canvas.width / 2, 250);

  context.fillStyle = '#ffffff';
  context.font = '700 54px sans-serif';
  context.fillText(badge.title, canvas.width / 2, 370);

  context.fillStyle = '#c7d2fe';
  context.font = '500 32px sans-serif';
  context.fillText(`Awarded to ${student.fullName}`, canvas.width / 2, 450);

  context.fillStyle = '#e0e7ff';
  context.font = '700 30px sans-serif';
  context.fillText(badge.criteria.toUpperCase(), canvas.width / 2, 535);

  context.fillStyle = '#a5b4fc';
  context.font = '500 24px sans-serif';
  context.fillText('SkillForge Code | Verified Achievement', canvas.width / 2, 770);
  context.fillStyle = '#ffffff';
  context.font = '700 22px sans-serif';
  context.fillText(new Date().toLocaleDateString(), canvas.width / 2, 820);

  const link = document.createElement('a');
  const safeStudentName = student.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student';
  const safeBadgeName = badge.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'badge';
  link.download = `${safeStudentName}-${safeBadgeName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export const StudentConsole: React.FC<StudentConsoleProps> = ({
  onNavigate,
  addToast
}) => {
  // Real, logged-in student pulled from the session
  const { student, refreshStudent } = useAuth();
  const activeStudent: Student = student ?? {
    id: '', fullName: 'Student', rollNumber: '', email: '', starRating: 0, level: 1, rank: 0,
    problemsSolved: { easy: 0, medium: 0, hard: 0 }, streak: 0, points: 0, certificates: [], badges: [],
  };
  const [submissionsLog, setSubmissionsLog] = useState<Submission[]>([]);
  const [problemsCatalog, setProblemsCatalog] = useState<CodingProblem[]>([]);
  const [quizzesCatalog, setQuizzesCatalog] = useState<Quiz[]>([]);

  useEffect(() => {
    refreshStudent();
    submissionsApi.mine().then(setSubmissionsLog).catch((err) => {
      const message = err instanceof ApiError ? err.message : 'Could not load your submission history.';
      addToast('Failed to Load Submissions', 'error', message);
    });
    quizzesApi.list().then(setQuizzesCatalog).catch(() => {});
    problemsApi.list().then(setProblemsCatalog).catch(() => {});
  }, []);
  
  const [studentNotificationsList, setStudentNotificationsList] = useState<{ id: string; text: string; type: string; time: string; read: boolean }[]>([]);

  const markAllNotificationsAsRead = () => {
    setStudentNotificationsList(prev => prev.map(n => ({ ...n, read: true })));
    addToast('Notifications Cleared', 'success', 'All messages marked as read.');
  };

  // Solved Stats values
  const solvedEasyProblemsCount = activeStudent.problemsSolved.easy;
  const solvedMediumProblemsCount = activeStudent.problemsSolved.medium;
  const solvedHardProblemsCount = activeStudent.problemsSolved.hard;
  const totalSolvedProblemsCount = solvedEasyProblemsCount + solvedMediumProblemsCount + solvedHardProblemsCount;
  
  // Real totals from the platform's actual problem bank, so these progress bars reflect
  // genuine progress (e.g. "3/5 Easy solved") instead of an arbitrary fake goal number.
  const targetEasyCount = Math.max(1, problemsCatalog.filter(p => p.difficulty === 'Easy').length);
  const targetMediumCount = Math.max(1, problemsCatalog.filter(p => p.difficulty === 'Medium').length);
  const targetHardCount = Math.max(1, problemsCatalog.filter(p => p.difficulty === 'Hard').length);

  // Recharts Pie dataset
  const rechartsPieDataset = [
    { name: 'Easy', value: solvedEasyProblemsCount, color: '#10B981' },
    { name: 'Medium', value: solvedMediumProblemsCount, color: '#F59E0B' },
    { name: 'Hard', value: solvedHardProblemsCount, color: '#EF4444' }
  ];

  // Daily submissions activity history, computed from this student's real submission timestamps
  // (last 7 days, oldest to newest, ending today).
  const submissionsWeeklyData = (() => {
    const days: { day: string; count: number }[] = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const count = submissionsLog.filter((s) => new Date(s.submittedAt).toDateString() === key).length;
      days.push({ day: dayLabels[d.getDay()], count });
    }
    return days;
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-zinc-50 dark:bg-[#0a0a0a] transition-colors min-h-screen">
      
      {/* 1. Welcome Card Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-indigo-900 to-indigo-700 text-white p-6 sm:p-8 overflow-hidden shadow-xl border border-indigo-950">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-200">Student Portal</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {activeStudent.fullName}!
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-xl font-medium leading-relaxed">
              Your coding streak is thriving at <span className="font-bold text-amber-300">{activeStudent.streak} Days</span>. Complete today's daily code challenge to level up!
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center min-w-[85px]">
              <span className="block text-2xl font-extrabold text-amber-300">Level {activeStudent.level}</span>
              <span className="text-[9px] uppercase font-bold text-indigo-200">Current Level</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center min-w-[85px]">
              <span className="block text-2xl font-extrabold text-white">#{activeStudent.rank}</span>
              <span className="text-[9px] uppercase font-bold text-indigo-200">College Rank</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Solved Stats, Activity, Submissions (8 Cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* STATS OVERVIEW: SOLVING COUNTS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Easy Solved */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Easy Problems</span>
                <span className="text-[10px] text-zinc-400">{solvedEasyProblemsCount}/{targetEasyCount}</span>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">{solvedEasyProblemsCount}</span>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(solvedEasyProblemsCount / targetEasyCount) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Medium Solved */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Medium Problems</span>
                <span className="text-[10px] text-zinc-400">{solvedMediumProblemsCount}/{targetMediumCount}</span>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">{solvedMediumProblemsCount}</span>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(solvedMediumProblemsCount / targetMediumCount) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Hard Solved */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-455">Hard Problems</span>
                <span className="text-[10px] text-zinc-400">{solvedHardProblemsCount}/{targetHardCount}</span>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-white">{solvedHardProblemsCount}</span>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full" style={{ width: `${(solvedHardProblemsCount / targetHardCount) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* SPLIT CHARTS PANEL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Visual breakdown pie */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
              <h4 className="font-extrabold text-xs uppercase text-zinc-400 tracking-wider mb-4">Solved Distribution</h4>
              <div className="h-44 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rechartsPieDataset}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {rechartsPieDataset.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text overlay */}
                <div className="absolute text-center">
                  <span className="block text-2xl font-black text-zinc-900 dark:text-white">{totalSolvedProblemsCount}</span>
                  <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Total</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex justify-center gap-6 text-[10px] font-bold pt-3">
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Easy ({solvedEasyProblemsCount})</div>
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Medium ({solvedMediumProblemsCount})</div>
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Hard ({solvedHardProblemsCount})</div>
              </div>
            </div>

            {/* Weekly Commit Activity */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-extrabold text-xs uppercase text-zinc-400 tracking-wider mb-2">Weekly Activity</h4>
                <p className="text-[10px] text-zinc-400 font-semibold mb-4">Your compiler submissions over the last 7 days</p>
              </div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={submissionsWeeklyData}>
                    <XAxis dataKey="day" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: 10, background: '#18181b', color: '#fff', border: 'none', borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* TASK 2: DEDICATED ACHIEVEMENT BADGES SECTION */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
              <div>
                <h3 className="font-extrabold text-sm uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  Achievement Badges
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Solve problems and level up your ratings to unlock badges</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold uppercase">
                {CORE_ACHIEVEMENT_BADGES.filter(b => b.checkUnlocked(activeStudent)).length} / {CORE_ACHIEVEMENT_BADGES.length} Unlocked
              </span>
            </div>

            {/* Badges Cards Grid Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {CORE_ACHIEVEMENT_BADGES.map((badge) => {
                const isUnlocked = badge.checkUnlocked(activeStudent);
                
                return (
                  <motion.div
                    key={badge.id}
                    whileHover={{ y: -3, scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`relative group p-4 rounded-2xl border flex flex-col justify-between min-h-[140px] shadow-sm transition-all ${
                      isUnlocked 
                        ? `${badge.unlockedBg} ${badge.unlockedBorder}` 
                        : `${badge.lockedBg} ${badge.lockedBorder} opacity-60`
                    }`}
                  >
                    {/* Hover tooltip with criteria */}
                    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-zinc-950 text-white dark:bg-zinc-800 text-[10px] rounded-xl shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 text-center border border-zinc-850 dark:border-zinc-700">
                      <p className="font-extrabold uppercase text-[8px] tracking-widest text-indigo-400 mb-0.5">Criteria</p>
                      <p className="font-bold text-[10px] text-zinc-100">{badge.criteria}</p>
                      <p className="text-zinc-400 mt-1 leading-normal text-[9px] font-normal">{badge.description}</p>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-950 dark:border-t-zinc-800" />
                    </div>

                    <div className="flex items-start justify-between">
                      <span className="text-3xl filter drop-shadow-sm select-none">{badge.icon}</span>
                      
                      {/* Lock Status Pill */}
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wide flex items-center gap-1 border ${
                        isUnlocked 
                          ? `bg-emerald-500/10 text-emerald-600 border-emerald-500/20` 
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-450 border-zinc-200 dark:border-zinc-800'
                      }`}>
                        {isUnlocked ? (
                          <>
                            <Unlock className="h-2.5 w-2.5 text-emerald-500" />
                            <span>Unlocked</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-2.5 w-2.5" />
                            <span>Locked</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="space-y-1 mt-4">
                      <h5 className={`font-extrabold text-xs leading-tight ${isUnlocked ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        {badge.title}
                      </h5>
                      <span className="text-[9px] font-semibold text-zinc-450 dark:text-zinc-500 block uppercase tracking-wider">
                        {badge.criteria}
                      </span>
                      {isUnlocked && (
                        <button
                          type="button"
                          onClick={() => downloadAchievementBadge(badge, activeStudent)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-indigo-700"
                        >
                          <Download className="h-3 w-3" />
                          Download Badge
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ACTIVE LIVE QUIZZES & RECENT SUBMISSIONS */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/50 dark:border-zinc-800">
              <h3 className="font-extrabold text-base tracking-tight">Recent Activity Logs</h3>
              <button
                onClick={() => onNavigate('problems')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
              >
                <span>Browse problem arena</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Active Quiz Card */}
            {quizzesCatalog.filter(q => q.status === 'Live').map(quiz => (
              <div key={quiz.id} className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-455">Live Quiz Active</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{quiz.title}</h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">{quiz.description}</p>
                </div>
                <button
                  onClick={() => onNavigate('quizzes')}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-sm shadow-rose-600/10 transition-colors whitespace-nowrap self-stretch sm:self-auto text-center cursor-pointer border-none"
                >
                  Enter Quiz Room
                </button>
              </div>
            ))}

            {/* Recent Submissions List */}
            <div className="bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0a0a0a] flex items-center justify-between">
                <span className="font-extrabold text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <FileCode2 className="h-4 w-4 text-indigo-500" />
                  Your Submission History
                </span>
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Real-time log</span>
              </div>
              
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {submissionsLog.map((sub) => (
                  <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-850/20 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-zinc-900 dark:text-white hover:underline cursor-pointer" onClick={() => onNavigate('problems')}>
                          {sub.problemTitle}
                        </span>
                        <span className="text-[10px] px-2 py-0.2 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400 font-semibold">{sub.language}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        {new Date(sub.submittedAt).toLocaleDateString()} • {sub.executionTimeMs}ms • {(sub.memoryKb / 1024).toFixed(1)} MB
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        sub.status === 'Accepted'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Star ratings, Certificates, Notifications (4 Cols) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* STAR RATING STATUS & LEVEL */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-4">
            <h4 className="font-extrabold text-xs uppercase text-zinc-400 tracking-wider">Star Level Ranking</h4>
            
            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#0a0a0a] p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star 
                  key={i} 
                  className={`h-6 w-6 ${
                    i < activeStudent.starRating 
                      ? 'fill-current text-amber-400 animate-pulse' 
                      : 'text-zinc-300 dark:text-zinc-700'
                  }`} 
                />
              ))}
              <span className="font-black text-sm ml-2 text-zinc-800 dark:text-zinc-200">
                {activeStudent.starRating}-Star
              </span>
            </div>

            <div className="space-y-1">
              {activeStudent.starRating >= 5 ? (
                <p className="text-[10px] text-emerald-500 font-bold italic pt-1">Maximum rating achieved — you're a 5-Star!</p>
              ) : (
                <>
                  {(() => {
                    const nextThreshold = STAR_THRESHOLDS[activeStudent.starRating]; // points needed for the *next* star
                    const prevThreshold = STAR_THRESHOLDS[activeStudent.starRating - 1] ?? 0;
                    const pointsIntoLevel = Math.max(0, activeStudent.points - prevThreshold);
                    const pointsNeededForLevel = Math.max(1, nextThreshold - prevThreshold);
                    const progressPct = Math.min(100, (pointsIntoLevel / pointsNeededForLevel) * 100);
                    const pointsRemaining = Math.max(0, nextThreshold - activeStudent.points);
                    return (
                      <>
                        <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase">
                          <span>Next Milestone</span>
                          <span>{activeStudent.points} / {nextThreshold} Points</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${progressPct}%` }} />
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                          Earn {pointsRemaining} more points to unlock {activeStudent.starRating + 1}-Star status.
                        </p>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>

          {/* NOTIFICATIONS PANEL */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-xs uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-indigo-500" />
                Alert Notifications
              </h4>
              <button
                onClick={markAllNotificationsAsRead}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-transparent border-none cursor-pointer"
              >
                Mark all read
              </button>
            </div>

            <div className="space-y-3">
              {studentNotificationsList.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-3 rounded-xl border text-xs leading-relaxed transition-all flex gap-2.5 ${
                    notif.read 
                      ? 'bg-zinc-50/50 dark:bg-zinc-950/20 border-zinc-100 dark:border-zinc-850 text-zinc-550 dark:text-zinc-400' 
                      : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/40 text-zinc-850 dark:text-zinc-200 font-medium'
                  }`}
                >
                  <div className="mt-0.5">
                    {notif.type === 'live' && <span className="h-2 w-2 rounded-full bg-rose-500 block animate-pulse" />}
                    {notif.type === 'success' && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                    {notif.type === 'upcoming' && <AlertCircle className="h-3.5 w-3.5 text-indigo-500" />}
                  </div>
                  <div className="flex-grow">
                    <p>{notif.text}</p>
                    <span className="text-[9px] text-zinc-400 mt-0.5 block">{notif.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* UNLOCKED BADGES (Quick Summary list preserved for compatibility/quick reference) */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h4 className="font-extrabold text-xs uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-500" />
              Special Badges Earned
            </h4>

            {activeStudent.badges.length === 0 ? (
              <div className="text-center py-6 text-zinc-400">
                <p className="text-xs">No special badges unlocked yet.</p>
                <p className="text-[10px] mt-1">Submit compile codes to earn badges!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {activeStudent.badges.map((badge) => (
                  <div key={badge.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/60 flex items-center gap-3">
                    <span className="text-2xl select-none">{badge.icon}</span>
                    <div>
                      <h5 className="font-bold text-xs text-zinc-900 dark:text-white leading-tight">{badge.name}</h5>
                      <p className="text-[10px] text-zinc-555 dark:text-zinc-400 leading-normal">{badge.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VERIFIED CERTIFICATES */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h4 className="font-extrabold text-xs uppercase text-zinc-400 tracking-wider">Verified Credentials</h4>

            {activeStudent.certificates.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                <p className="text-xs">No certificates issued yet.</p>
                <p className="text-[10px] mt-0.5">Reach 3-Star standing or higher to trigger evaluation.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeStudent.certificates.map((cert) => (
                  <div key={cert.id} className="p-3.5 rounded-xl border border-zinc-250 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950 space-y-2">
                    <div>
                      <h5 className="font-extrabold text-xs text-zinc-900 dark:text-white">{cert.title}</h5>
                      <span className="text-[10px] text-zinc-400">Issued {new Date(cert.issueDate).toLocaleDateString()}</span>
                    </div>
                    <button
                      onClick={() => addToast('Downloading Certificate', 'info', 'Academic credential is being retrieved.')}
                      className="w-full py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-55 dark:hover:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Verify Credential Link</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
