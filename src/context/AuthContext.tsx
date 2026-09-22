/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Student } from '../types';
import { authApi, getToken, setToken } from '../services/api';

type AdminUser = { id: string; fullName: string; email: string };

interface AuthContextValue {
  role: 'Guest' | 'Student' | 'Admin';
  student: Student | null;
  admin: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<'Student' | 'Admin'>;
  register: (data: { fullName: string; rollNumber: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshStudent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<'Guest' | 'Student' | 'Admin'>('Guest');
  const [student, setStudent] = useState<Student | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        if (res.role === 'admin') {
          setAdmin(res.user as AdminUser);
          setRole('Admin');
        } else {
          setStudent(res.user as Student);
          setRole('Student');
        }
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setToken(res.token);
    if (res.role === 'admin') {
      setAdmin(res.user as AdminUser);
      setRole('Admin');
      return 'Admin' as const;
    }
    setStudent(res.user as Student);
    setRole('Student');
    return 'Student' as const;
  }, []);

  const register = useCallback(async (data: { fullName: string; rollNumber: string; email: string; password: string }) => {
    const res = await authApi.register(data);
    setToken(res.token);
    setStudent(res.user as Student);
    setRole('Student');
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setStudent(null);
    setAdmin(null);
    setRole('Guest');
  }, []);

  const refreshStudent = useCallback(async () => {
    if (!getToken()) return;
    const res = await authApi.me();
    if (res.role === 'student') setStudent(res.user as Student);
  }, []);

  return (
    <AuthContext.Provider value={{ role, student, admin, isLoading, login, register, logout, refreshStudent }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
