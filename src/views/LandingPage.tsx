/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Terminal, 
  Code2, 
  Cpu, 
  Award, 
  Trophy, 
  CheckCircle2, 
  ArrowRight, 
  ChevronRight,
  Flame,
  Calendar,
  Zap,
  Shield,
  Star
} from 'lucide-react';
import { Quiz, LeaderboardEntry } from '../types';
import { quizzesApi, leaderboardApi, problemsApi } from '../services/api';

interface LandingPageProps {
  onNavigate: (view: string) => void;
  onSelectRole?: (role: 'Student' | 'Admin') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, onSelectRole }) => {
  const [previewQuizzes, setPreviewQuizzes] = useState<Quiz[]>([]);
  const [previewLeaderboard, setPreviewLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState({ problems: 0 });

  useEffect(() => {
    quizzesApi.list().then((all) => {
      const live = all.filter(q => q.status === 'Live');
      setPreviewQuizzes((live.length > 0 ? live : all).slice(0, 2));
    }).catch(() => {});
    leaderboardApi.list().then((entries) => setPreviewLeaderboard(entries.slice(0, 3))).catch(() => {});
    problemsApi.list().then((problems) => {
      setStats((currentStats) => ({ ...currentStats, problems: problems.length }));
    }).catch(() => {});
  }, []);

  const navigateToProblemArena = () => {
    if (onSelectRole) {
      onSelectRole('Student');
    }
    onNavigate('problems');
  };

  return (
    <div className="bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-[#e5e5e5] min-h-screen transition-colors overflow-hidden">
      {/* HERO SECTION */}
      <section className="relative pt-10 pb-20 md:pt-16 md:pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-200/40 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold leading-none">
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>Forge Your Potential, Master the Code</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              The Premier College <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500 dark:from-indigo-400 dark:to-violet-400">
                Coding Forge
              </span>
            </h1>

            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Empower your campus programmers with a professional, LeetCode-level testing arena. Practice algorithmic thinking, compete in timed live-ranking quizzes, and earn certified coding credentials.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                onClick={navigateToProblemArena}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <span>Enter Code Arena</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => onNavigate('login')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-extrabold text-sm transition-all"
              >
                Sign In
              </button>
            </div>

            {/* Quick stats inline summary */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-zinc-200/60 dark:border-zinc-800/50 max-w-lg mx-auto lg:mx-0">
              <div>
                <span className="block text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">1107+</span>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Problems</span>
              </div>
              <div>
                <span className="block text-2xl font-extrabold text-zinc-800 dark:text-white">4 Lang</span>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Languages</span>
              </div>
              <div>
                <span className="block text-2xl font-extrabold text-zinc-800 dark:text-white">5 Star</span>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Skill Rating</span>
              </div>
            </div>
          </div>

          {/* Hero Right: Sleek Interactive Code Mockup */}
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-3xl blur-3xl -z-10" />
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-900 shadow-2xl p-4 font-mono text-xs text-indigo-400 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-850 mb-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500 block" />
                  <span className="h-3 w-3 rounded-full bg-amber-500 block" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500 block" />
                </div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">SKILLFORGE.exe</span>
              </div>
              <pre className="text-zinc-300 space-y-1 select-none overflow-x-auto text-[11px]">
                <code>
                  {`BOOTING DATA SCIENCE...\n\n`}
                  <span className="text-emerald-400">✓</span> CODE<br />
                  <span className="text-emerald-400">✓</span> DATA<br />
                  <span className="text-emerald-400">✓</span> AI<br />
                  <span className="text-emerald-400">✓</span> INNOVATION<br />
                  <br />
                  {`student.learn()\n`}
                  {`student.build()\n`}
                  {`student.innovate()\n\n`}
                  <span className="text-indigo-400">DATA → AI → IMPACT</span><br />
                  <br />
                  <span className="text-emerald-400">&gt;&gt;&gt; SYSTEM STATUS: UNLIMITED!!</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT SKILLFORGE CODE */}
      <section className="py-16 bg-white dark:bg-[#141414] border-y border-zinc-200 dark:border-zinc-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-455">About the Forge</span>
              <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Standardizing Campus Competitive Programming
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                SkillForge Code is a next-generation academic evaluation and coding practice hub. It serves as an industrial-standard sandbox designed specifically to foster computational talent inside computer science departments.
              </p>
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Zero-latency compilation simulations</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Curriculum-aligned student logs and tracking</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Departmental certificates with verification hash</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80">
                <Code2 className="h-8 w-8 text-indigo-500 mb-3" />
                <h4 className="font-extrabold text-sm mb-1">Interactive Sandbox</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-450 leading-relaxed">
                  Fully operational Monaco Editor workspace supporting multi-language themes, full-screen setups, autocomplete configurations, and immediate code submission loops.
                </p>
              </div>
              
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80">
                <Trophy className="h-8 w-8 text-amber-500 mb-3" />
                <h4 className="font-extrabold text-sm mb-1">Ranked Leaderboards</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-450 leading-relaxed">
                  Live point calculation indices. Filter by rolls, branches, and star rating levels to promote collaborative motivation.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80">
                <Calendar className="h-8 w-8 text-sky-500 mb-3" />
                <h4 className="font-extrabold text-sm mb-1">Timed Quiz Modules</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-450 leading-relaxed">
                  Auto-saving question blocks and auto-submit timers protecting execution boundaries. Includes multiple choice logic and code compiler slots.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80">
                <Shield className="h-8 w-8 text-emerald-500 mb-3" />
                <h4 className="font-extrabold text-sm mb-1">Admin Control Room</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-450 leading-relaxed">
                  Comprehensive dashboard monitoring student pagination tables, configuring hidden test parameters, and creating dynamic timed challenges.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES TIMELINE */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-12">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-455">Features</span>
          <h2 className="text-3xl font-extrabold tracking-tight">Engineered for Academic Success</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto">
            SkillForge Code implements industrial mechanics into an agile collegiate wrapper to build premium habits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-455">
                <Terminal className="h-5 w-5" />
              </div>
              <h4 className="text-base font-extrabold">Professional IDE Experience</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Configure your line numbers, font sizing, code themes, and fullscreen layout. No distractions, just pure focus.
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4 flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-455 cursor-pointer" onClick={navigateToProblemArena}>
              <span>Solve coding problems</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-455">
                <Calendar className="h-5 w-5" />
              </div>
              <h4 className="text-base font-extrabold">Coordinated Quiz Schedules</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Take timed quizzes with MCQs and active code assignments. Includes automatic save tracking and countdown warnings.
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4 flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-455 cursor-pointer" onClick={() => onNavigate('quizzes')}>
              <span>View upcoming schedule</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-450">
                <Award className="h-5 w-5" />
              </div>
              <h4 className="text-base font-extrabold">Verified Certificates</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Achieve star milestones (1-Star to 5-Star levels) based on verified problem counts, unlocking college-level credentials.
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4 flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-455 cursor-pointer" onClick={() => onNavigate('leaderboard')}>
              <span>Check top leaderboard ranks</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </section>

      {/* SUPPORTED PROGRAMMING LANGUAGES */}
      <section className="py-12 bg-zinc-100 dark:bg-[#141414]/60 border-t border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <p className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-widest">Compiler Environment Languages</p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
              <span className="font-extrabold text-lg text-blue-600 dark:text-blue-400 font-mono">C</span>
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-450">C (GCC)</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
              <span className="font-extrabold text-lg text-indigo-600 dark:text-indigo-455 font-mono">C++</span>
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-450">C++17 (G++)</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
              <span className="font-extrabold text-lg text-amber-600 dark:text-amber-455 font-mono">Java</span>
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-450">Java 17 (OpenJDK)</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
              <span className="font-extrabold text-lg text-emerald-600 dark:text-emerald-455 font-mono">Python</span>
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-450">Python 3</span>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM STATISTICS GRID */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-10">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-455">Platform Statistics</span>
          <h2 className="text-3xl font-extrabold tracking-tight">Active Platform Benchmarks</h2>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 text-center space-y-1">
            <span className="block text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">{stats.problems}</span>
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Total Problems</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">From Easy to Hard</span>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 text-center space-y-1">
            <span className="block text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">{previewQuizzes.length > 0 ? 'Live' : 'Soon'}</span>
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Quiz Status</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Midterms & challenges</span>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 text-center space-y-1">
            <span className="block text-4xl font-extrabold text-indigo-600 dark:text-indigo-450">99.9%</span>
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Uptime Reliability</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Compiler sandboxes active</span>
          </div>
        </div>
      </section>

      {/* UPCOMING CODING QUIZZES (Interactive preview list) */}
      <section className="py-16 bg-white dark:bg-[#141414] border-t border-zinc-200 dark:border-zinc-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 gap-4">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-455">Quiz Arena</span>
              <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">Scheduled Evaluations</h2>
            </div>
            <button
              onClick={() => onNavigate('quizzes')}
              className="flex items-center gap-1 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <span>View full quiz center</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {previewQuizzes.length === 0 && (
              <div className="md:col-span-2 text-center py-10 text-xs font-bold text-zinc-400">No quizzes scheduled right now — check back soon.</div>
            )}
            {previewQuizzes.map((quiz) => (
              <div 
                key={quiz.id} 
                className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      quiz.status === 'Live'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {quiz.status}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-bold flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {quiz.durationMinutes} Minutes
                    </span>
                  </div>

                  <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mb-2">{quiz.title}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">{quiz.description}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50 mt-2">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                    {quiz.questionCount ?? quiz.questions?.length ?? 0} Evaluation Tasks
                  </span>
                  <button
                    onClick={() => onNavigate('quizzes')}
                    className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-bold transition-all"
                  >
                    {quiz.status === 'Live' ? 'Enter Quiz Now' : 'Check Details'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEADERBOARD PREVIEW */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-4 space-y-4 text-center lg:text-left">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-455">Global Competition</span>
            <h2 className="text-3xl font-extrabold tracking-tight">The Leaderboard Arena</h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Every solved problem accumulates Forge Points. Maintain streaks, push through hardest algorithms, and climb up the rankings. Top 3 students receive a verified 5-Star coder certificate.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onNavigate('leaderboard')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
              >
                Launch Leaderboard
              </button>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-855 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
              <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
                <span className="font-extrabold text-xs text-zinc-700 dark:text-zinc-300">Top 3 Student Coders</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wide">Elite Tier</span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {previewLeaderboard.length === 0 && (
                  <div className="px-5 py-10 text-center text-xs font-bold text-zinc-400">No ranked students yet — be the first to solve a problem.</div>
                )}
                {previewLeaderboard.map((entry) => (
                  <div key={entry.studentId} className="px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-850/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`h-6 w-6 rounded-full flex items-center justify-center font-extrabold text-xs ${
                        entry.rank === 1 ? 'bg-amber-400 text-zinc-950' :
                        entry.rank === 2 ? 'bg-zinc-300 text-zinc-900' :
                        'bg-amber-700 text-white'
                      }`}>
                        {entry.rank}
                      </span>
                      <div>
                        <h5 className="font-extrabold text-xs text-zinc-900 dark:text-white leading-tight">{entry.fullName}</h5>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{entry.rollNumber} • {entry.starRating}★ Rated</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <span className="block font-bold text-xs text-zinc-800 dark:text-zinc-200">{entry.solvedCount} Solved</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">{entry.points} Points</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: entry.starRating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current text-amber-400" />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-zinc-900 text-zinc-400 border-t border-zinc-800 py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="SkillForge Code logo"
                  className="h-8 w-8 object-contain rounded-lg"
                />
                <span className="font-black text-sm text-white tracking-wider">SkillForge Code</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Academic coding platform for students
              </p>
            </div>
            
            <div className="space-y-3">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Platform Links</h5>
              <ul className="space-y-1.5 text-[11px]">
                <li><Link to="/problems" onClick={() => onNavigate('problems')} className="hover:text-white transition-colors text-zinc-400 hover:text-white">Problem Arena</Link></li>
                <li><Link to="/quizzes" onClick={() => onNavigate('quizzes')} className="hover:text-white transition-colors text-zinc-400 hover:text-white">Quiz Modules</Link></li>
                <li><Link to="/leaderboard" onClick={() => onNavigate('leaderboard')} className="hover:text-white transition-colors text-zinc-400 hover:text-white">Rank Leaderboard</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Testing Controls</h5>
              <ul className="space-y-1.5 text-[11px]">
                <li><Link to="/student" onClick={() => { if (onSelectRole) onSelectRole('Student'); onNavigate('student-dashboard'); }} className="hover:text-white transition-colors text-zinc-400 hover:text-white">Student View</Link></li>
                <li><Link to="/admin" onClick={() => { if (onSelectRole) onSelectRole('Admin'); onNavigate('admin-dashboard'); }} className="hover:text-white transition-colors text-zinc-400 hover:text-white">Admin View</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Support Info</h5>
              <ul className="space-y-1.5 text-[11px]">
                <li><Link to="/department" onClick={() => onNavigate('home')} className="hover:text-white transition-colors text-zinc-400 hover:text-white">Department of Data Science</Link></li>
                <li><Link to="/about" onClick={() => onNavigate('home')} className="hover:text-white transition-colors text-zinc-400 hover:text-white">SkillForge Academic Portal</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-zinc-800">
            <div className="text-center text-[11px] text-zinc-500 mb-4">
              <span>Made with </span>
              <span aria-label="love">💙</span>
              <span> by </span>
              <Link to="/about" onClick={() => onNavigate('home')} className="text-indigo-400 hover:text-indigo-300 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 transition-colors">SkillForge Team</Link>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-zinc-500">
              <p>© 2026 SkillForge Code. Developed for College Coding Platform.</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link to="/terms" onClick={() => onNavigate('home')} className="hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 rounded-sm">Terms of Service</Link>
                <Link to="/security" onClick={() => onNavigate('home')} className="hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 rounded-sm">Security Sandbox Rules</Link>
                <a
                  href="https://www.skillforge.net.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/50 bg-indigo-600/10 text-indigo-200 font-semibold shadow-sm transition-all duration-200 hover:bg-indigo-500 hover:text-white hover:border-indigo-400 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                  aria-label="Visit SkillForge website"
                >
                  Visit Us <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
