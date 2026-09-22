/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileCode, 
  Award, 
  Trophy, 
  BadgeCheck, 
  Settings, 
  User, 
  LogOut,
  ChevronRight,
  Swords
} from 'lucide-react';

export type AdminTab = 
  | 'dashboard' 
  | 'students' 
  | 'problems' 
  | 'quizzes' 
  | 'contests'
  | 'leaderboard' 
  | 'certificates' 
  | 'settings' 
  | 'profile';

interface SidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onLogout
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'problems', label: 'Problems', icon: FileCode },
    { id: 'quizzes', label: 'Quizzes', icon: Award },
    { id: 'contests', label: 'Contests', icon: Swords },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'certificates', label: 'Certificates', icon: BadgeCheck },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
  ] as const;

  return (
    <aside className="w-full lg:w-64 flex-shrink-0 bg-white dark:bg-[#141414] border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-auto lg:h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
      {/* Admin metadata */}
      <div className="p-6 border-b border-zinc-150 dark:border-zinc-800/65 hidden lg:block">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-sm border border-indigo-200/50 dark:border-indigo-900/40">
            AD
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white leading-tight">Admin Console</h4>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Super User</span>
          </div>
        </div>
      </div>

      {/* Sidebar navigation */}
      <nav className="flex-grow p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left group ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-850/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-350'}`} />
                <span>{item.label}</span>
              </div>
              <ChevronRight className={`h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100 text-white' : 'text-zinc-400'}`} />
            </button>
          );
        })}
      </nav>

      {/* Logout/Exit Session */}
      <div className="p-4 border-t border-zinc-150 dark:border-zinc-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all text-left"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
};
