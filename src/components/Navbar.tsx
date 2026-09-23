/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Flame, 
  Menu, 
  X, 
  User, 
  ShieldAlert, 
  Moon, 
  Sun, 
  LogOut, 
  LayoutDashboard, 
  BookOpen, 
  Award, 
  Trophy,
  Users,
  Swords
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentRole: 'Guest' | 'Student' | 'Admin';
  onRoleChange: (role: 'Guest' | 'Student' | 'Admin') => void;
  currentView: string;
  onNavigate: (view: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  currentView,
  onNavigate,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const { student, admin } = useAuth();
  const displayName = currentRole === 'Student' ? student?.fullName : currentRole === 'Admin' ? admin?.fullName : '';

  const navItems = [
    { id: 'home', label: 'Home', icon: BookOpen, roles: ['Guest', 'Student', 'Admin'] },
    { id: 'contests', label: 'Contests', icon: Swords, roles: ['Guest', 'Student', 'Admin'] },
    { id: 'problems', label: 'Problems', icon: FileCodeIcon, roles: ['Student', 'Admin'] },
    { id: 'quizzes', label: 'Quizzes', icon: Award, roles: ['Student', 'Admin'] },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, roles: ['Student', 'Admin'] },
  ];

  function FileCodeIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="m10 13-2 2 2 2" />
        <path d="m14 17 2-2-2-2" />
      </svg>
    );
  }

  const handleNavClick = (viewId: string) => {
    onNavigate(viewId);
    setIsOpen(false);
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/80 dark:bg-[#141414]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNavClick('home')}>
            <img
              src="/logo.png"
              alt="SkillForge Code logo"
              className="h-10 w-10 object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.22)]"
            />
            <div>
              <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white">
                SkillForge
              </span>
              <span className="text-[10px] block font-bold text-indigo-600 dark:text-indigo-400 tracking-wider -mt-1 uppercase">
                Code
              </span>
            </div>
          </div>

          {/* Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-1.5">
            {navItems
              .filter(item => item.roles.includes(currentRole))
              .map(item => {
                const Icon = item.icon;
                const isActive = currentView === item.id || (item.id === 'problems' && currentView.startsWith('problem-')) || (item.id === 'contests' && currentView === 'contest-room');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

            {/* Quick dashboard shortcuts depending on role */}
            {currentRole === 'Student' && (
              <button
                onClick={() => handleNavClick('student-dashboard')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentView === 'student-dashboard'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </button>
            )}

            {currentRole === 'Admin' && (
              <button
                onClick={() => handleNavClick('admin-dashboard')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentView.startsWith('admin-') || currentView === 'admin-dashboard'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Admin Panel</span>
              </button>
            )}
          </div>

          {/* Desktop Right Settings & Role Switcher */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Toggle Dark/Light Mode"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Live streak indicator */}
            {currentRole === 'Student' && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold" title="Daily Coding Streak">
                <Flame className="h-4 w-4 fill-current text-amber-500 animate-pulse" />
                <span>{student?.streak ?? 0} Days Streak</span>
              </div>
            )}

            {/* Account menu: shows real logged-in user + logout */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 text-xs font-bold transition-colors"
              >
                <User className="h-4 w-4" />
                <span>{currentRole === 'Guest' ? 'Guest' : displayName || currentRole}</span>
              </button>

              <AnimatePresence>
                {showRoleDropdown && currentRole !== 'Guest' && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowRoleDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-52 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 p-1.5 space-y-1"
                    >
                      <div className="px-2.5 py-1 text-[10px] text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5 mb-1">
                        {currentRole === 'Student' ? 'Student Account' : 'Administrator Account'}
                      </div>
                      <button
                        onClick={() => { onRoleChange('Guest'); setShowRoleDropdown(false); onNavigate('home'); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Log Out</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {currentRole === 'Guest' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleNavClick('login')}
                  className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-350 text-xs font-bold transition-all"
                >
                  Login
                </button>
                <button
                  onClick={() => handleNavClick('register')}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all"
                >
                  Register
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onToggleDarkMode}
              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 space-y-1.5 shadow-inner"
          >
            {navItems
              .filter(item => item.roles.includes(currentRole))
              .map(item => {
                const Icon = item.icon;
                const isActive = currentView === item.id || (item.id === 'contests' && currentView === 'contest-room');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

            {/* Quick dashboard shortcuts depending on role */}
            {currentRole === 'Student' && (
              <button
                onClick={() => handleNavClick('student-dashboard')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${
                  currentView === 'student-dashboard'
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <LayoutDashboard className="h-4.5 w-4.5" />
                <span>Student Dashboard</span>
              </button>
            )}

            {currentRole === 'Admin' && (
              <button
                onClick={() => handleNavClick('admin-dashboard')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${
                  currentView.startsWith('admin-')
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <ShieldAlert className="h-4.5 w-4.5" />
                <span>Admin Panel</span>
              </button>
            )}

            {/* Account row for mobile */}
            {currentRole !== 'Guest' && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 mt-2">
                <div className="px-3 py-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  Signed in as {displayName || currentRole}
                </div>
                <button
                  onClick={() => { onRoleChange('Guest'); setIsOpen(false); onNavigate('home'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span>Log Out</span>
                </button>
              </div>
            )}

            {currentRole === 'Guest' && (
              <div className="flex gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-2">
                <button
                  onClick={() => handleNavClick('login')}
                  className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-350 text-xs font-bold text-center"
                >
                  Login
                </button>
                <button
                  onClick={() => handleNavClick('register')}
                  className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold text-center"
                >
                  Register
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
