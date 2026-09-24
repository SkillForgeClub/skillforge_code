/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Toast, ToastMessage } from './components/Toast';
import { LandingPage } from './views/LandingPage';
import { AuthPortal } from './views/AuthPortal';
import { StudentConsole } from './views/StudentConsole';
import { AdminCommandCenter } from './views/AdminCommandCenter';
import { ProblemArena } from './views/ProblemArena';
import { QuizCenter } from './views/QuizCenter';
import { GlobalLeaderboard } from './views/GlobalLeaderboard';
import { ContestHub } from './views/ContestHub';
import { ContestRoom } from './views/ContestRoom';
import { TermsPage, SecurityPage, AboutPage, DepartmentPage } from './views/PolicyPages';
import { useAuth } from './context/AuthContext';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeViewRoute, setActiveViewRoute] = useState<string>('home');
  const [activeContestId, setActiveContestId] = useState<string | null>(null);
  const [isDarkModeActive, setIsDarkModeActive] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });
  const [toastNotificationsList, setToastNotificationsList] = useState<ToastMessage[]>([]);
  const { role, isLoading, logout } = useAuth();

  useEffect(() => {
    const path = location.pathname.replace(/^\/+|\/+$/g, '') || 'home';
    const viewMap: Record<string, string> = {
      home: 'home',
      student: 'student-dashboard',
      admin: 'admin-dashboard',
      problems: 'problems',
      quizzes: 'quizzes',
      leaderboard: 'leaderboard',
      contests: 'contests',
      'contest-room': 'contest-room',
      department: 'home',
      about: 'home',
      terms: 'home',
      security: 'home',
      login: 'login',
      register: 'register',
      'forgot-password': 'forgot-password',
    };

    setActiveViewRoute(viewMap[path] || 'home');
  }, [location.pathname]);

  // Toggle dark mode class on HTML document
  useEffect(() => {
    if (isDarkModeActive) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkModeActive]);

  // Handle toast notifications dispatching
  const dispatchToastNotification = (title: string, type: 'success' | 'error' | 'warning' | 'info', desc?: string, duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { id, title, type, description: desc };
    setToastNotificationsList((prev) => [...prev, newToast]);
    if (duration > 0) {
      setTimeout(() => {
        setToastNotificationsList((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  };

  const dismissToastNotification = (id: string) => {
    setToastNotificationsList((prev) => prev.filter((t) => t.id !== id));
  };

  // The navbar's role control now doubles as the real session logout action.
  const handleNavigate = (view: string) => {
    const routeMap: Record<string, string> = {
      home: '/',
      login: '/login',
      register: '/register',
      'forgot-password': '/forgot-password',
      'student-dashboard': '/student',
      'admin-dashboard': '/admin',
      problems: '/problems',
      quizzes: '/quizzes',
      leaderboard: '/leaderboard',
      contests: '/contests',
      'contest-room': '/contest-room',
    };

    setActiveViewRoute(view);
    navigate(routeMap[view] || '/');
  };

  const handleSessionRoleChange = (nextRole: 'Guest' | 'Student' | 'Admin') => {
    if (nextRole === 'Guest') {
      logout();
      handleNavigate('home');
      dispatchToastNotification('Logged Out', 'info', 'Your session has ended.');
    }
  };

  const handleAuthenticationSuccess = (authedRole: 'Student' | 'Admin', name: string) => {
    if (authedRole === 'Student') {
      handleNavigate('student-dashboard');
      dispatchToastNotification('Authenticated Successfully', 'success', `Welcome back to your workspace, ${name}!`);
    } else {
      handleNavigate('admin-dashboard');
      dispatchToastNotification('Administrator Verified', 'success', `Authorized credentials as evaluation coordinator.`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-400 text-xs font-bold uppercase tracking-widest">
        Loading SkillForge Code...
      </div>
    );
  }

  const pathname = location.pathname;

  const renderRoutePage = () => {
    if (pathname === '/terms') return <TermsPage />;
    if (pathname === '/security') return <SecurityPage />;
    if (pathname === '/about' || pathname === '/department') {
      return (
        <LandingPage
          onNavigate={(view) => {
            if ((view === 'problems' || view === 'quizzes') && role === 'Guest') {
              handleNavigate('login');
              dispatchToastNotification('Authentication Required', 'warning', 'Please register or log in to access compilation problems.');
            } else {
              handleNavigate(view);
            }
          }}
          onSelectRole={() => handleNavigate('login')}
        />
      );
    }
    if (pathname === '/student') {
      if (role === 'Guest') {
        return (
          <div className="max-w-md mx-auto py-16 px-4">
            <AuthPortal
              initialMode="login"
              onAuthSuccess={handleAuthenticationSuccess}
              onNavigate={handleNavigate}
              addToast={dispatchToastNotification}
            />
          </div>
        );
      }
      return (
        <StudentConsole
          onNavigate={handleNavigate}
          addToast={dispatchToastNotification}
        />
      );
    }
    if (pathname === '/admin') {
      if (role !== 'Admin') {
        return (
          <div className="max-w-md mx-auto py-16 px-4">
            <AuthPortal
              initialMode="login"
              onAuthSuccess={handleAuthenticationSuccess}
              onNavigate={handleNavigate}
              addToast={dispatchToastNotification}
            />
          </div>
        );
      }
      return (
        <AdminCommandCenter
          onNavigate={handleNavigate}
          addToast={dispatchToastNotification}
        />
      );
    }
    if (pathname === '/problems') {
      if (role === 'Guest') {
        return (
          <div className="max-w-md mx-auto py-16 px-4">
            <AuthPortal
              initialMode="login"
              onAuthSuccess={handleAuthenticationSuccess}
              onNavigate={handleNavigate}
              addToast={dispatchToastNotification}
            />
          </div>
        );
      }
      return (
        <ProblemArena
          onNavigate={handleNavigate}
          addToast={dispatchToastNotification}
        />
      );
    }
    if (pathname === '/quizzes') {
      if (role === 'Guest') {
        return (
          <div className="max-w-md mx-auto py-16 px-4">
            <AuthPortal
              initialMode="login"
              onAuthSuccess={handleAuthenticationSuccess}
              onNavigate={handleNavigate}
              addToast={dispatchToastNotification}
            />
          </div>
        );
      }
      return (
        <QuizCenter
          onNavigate={handleNavigate}
          addToast={dispatchToastNotification}
        />
      );
    }
    if (pathname === '/leaderboard') {
      return (
        <GlobalLeaderboard
          onNavigate={handleNavigate}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-[#e5e5e5] transition-colors selection:bg-indigo-500/30">
      
      {/* 1. GLOBAL PLATFORM NAVBAR */}
      <Navbar
        currentRole={role}
        onRoleChange={handleSessionRoleChange}
        currentView={activeViewRoute}
        onNavigate={handleNavigate}
        isDarkMode={isDarkModeActive}
        onToggleDarkMode={() => setIsDarkModeActive(!isDarkModeActive)}
      />

      {/* 2. ROUTER SWITCHER */}
      <div className="animate-fade-in">
        {renderRoutePage() || (
          <>
            {activeViewRoute === 'home' && (
              <LandingPage 
                onNavigate={(view) => {
                  if ((view === 'problems' || view === 'quizzes') && role === 'Guest') {
                    handleNavigate('login');
                    dispatchToastNotification('Authentication Required', 'warning', 'Please register or log in to access compilation problems.');
                  } else {
                    handleNavigate(view);
                  }
                }} 
                onSelectRole={() => handleNavigate('login')}
              />
            )}

            {activeViewRoute === 'login' && (
              <div className="max-w-md mx-auto py-16 px-4">
                <AuthPortal
                  initialMode="login"
                  onAuthSuccess={handleAuthenticationSuccess}
                  onNavigate={handleNavigate}
                  addToast={dispatchToastNotification}
                />
              </div>
            )}

            {activeViewRoute === 'register' && (
              <div className="max-w-md mx-auto py-12 px-4">
                <AuthPortal
                  initialMode="register"
                  onAuthSuccess={handleAuthenticationSuccess}
                  onNavigate={handleNavigate}
                  addToast={dispatchToastNotification}
                />
              </div>
            )}

            {activeViewRoute === 'forgot-password' && (
              <div className="max-w-md mx-auto py-16 px-4">
                <AuthPortal
                  initialMode="forgot"
                  onAuthSuccess={handleAuthenticationSuccess}
                  onNavigate={handleNavigate}
                  addToast={dispatchToastNotification}
                />
              </div>
            )}

            {activeViewRoute === 'student-dashboard' && role === 'Student' && (
              <StudentConsole
                onNavigate={handleNavigate}
                addToast={dispatchToastNotification}
              />
            )}

            {activeViewRoute === 'admin-dashboard' && role === 'Admin' && (
              <AdminCommandCenter
                onNavigate={handleNavigate}
                addToast={dispatchToastNotification}
              />
            )}

            {activeViewRoute === 'problems' && role !== 'Guest' && (
              <ProblemArena
                onNavigate={handleNavigate}
                addToast={dispatchToastNotification}
              />
            )}

            {activeViewRoute === 'quizzes' && role !== 'Guest' && (
              <QuizCenter
                onNavigate={handleNavigate}
                addToast={dispatchToastNotification}
              />
            )}

            {activeViewRoute === 'leaderboard' && (
              <GlobalLeaderboard
                onNavigate={handleNavigate}
              />
            )}

            {activeViewRoute === 'contests' && (
              <ContestHub
                onNavigate={handleNavigate}
                onEnterContest={(contestId) => {
                  if (role === 'Guest') {
                    handleNavigate('login');
                    dispatchToastNotification('Authentication Required', 'warning', 'Please register or log in to view contest details.');
                    return;
                  }
                  setActiveContestId(contestId);
                  handleNavigate('contest-room');
                }}
                addToast={dispatchToastNotification}
              />
            )}

            {activeViewRoute === 'contest-room' && activeContestId && role !== 'Guest' && (
              <ContestRoom
                contestId={activeContestId}
                onNavigate={handleNavigate}
                onExit={() => handleNavigate('contests')}
                addToast={dispatchToastNotification}
              />
            )}
          </>
        )}
      </div>

      {/* 3. DYNAMIC TOAST OUTLETS */}
      <Toast toasts={toastNotificationsList} onClose={dismissToastNotification} />

    </div>
  );
}
