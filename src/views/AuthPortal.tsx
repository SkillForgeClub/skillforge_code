/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  Hash, 
  KeyRound, 
  CheckCircle, 
  ArrowRight, 
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

interface AuthPortalProps {
  initialMode: 'login' | 'register' | 'forgot';
  onAuthSuccess: (role: 'Student' | 'Admin', name: string) => void;
  onNavigate: (view: string) => void;
  addToast: (title: string, type: 'success' | 'error' | 'warning' | 'info', desc?: string) => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({
  initialMode,
  onAuthSuccess,
  onNavigate,
  addToast
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<1 | 2 | 3>(1); // 1: Email, 2: OTP, 3: Reset
  const { login, register } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form input fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [rollNumberInput, setRollNumberInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Field level validation error flags
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateEmailFormat = (val: string) => {
    return /\S+@\S+\.\S+/.test(val);
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorsMap: Record<string, string> = {};
    
    if (!emailInput) {
      errorsMap.email = 'Email is required';
    } else if (!validateEmailFormat(emailInput)) {
      errorsMap.email = 'Invalid email address';
    }

    if (!passwordInput) {
      errorsMap.password = 'Password is required';
    } else if (passwordInput.length < 5) {
      errorsMap.password = 'Password must be at least 5 characters';
    }

    if (Object.keys(errorsMap).length > 0) {
      setValidationErrors(errorsMap);
      addToast('Validation Failed', 'error', 'Please fill in all credentials properly.');
      return;
    }

    setValidationErrors({});
    setIsSubmitting(true);
    try {
      const authedRole = await login(emailInput, passwordInput);
      if (authedRole === 'Admin') {
        addToast('Welcome Admin!', 'success', 'Logged into administrative console successfully.');
        onAuthSuccess('Admin', 'Administrator');
        onNavigate('admin-dashboard');
      } else {
        addToast('Login Successful', 'success', `Welcome back student coder!`);
        onAuthSuccess('Student', emailInput);
        onNavigate('student-dashboard');
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to reach the server. Please try again.';
      setValidationErrors({ password: message });
      addToast('Login Failed', 'error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorsMap: Record<string, string> = {};

    if (!fullNameInput) errorsMap.fullName = 'Full Name is required';
    if (!rollNumberInput) errorsMap.rollNumber = 'Roll Number is required';
    
    if (!emailInput) {
      errorsMap.email = 'Email is required';
    } else if (!validateEmailFormat(emailInput)) {
      errorsMap.email = 'Invalid email format';
    }

    if (!passwordInput) {
      errorsMap.password = 'Password is required';
    } else if (passwordInput.length < 6) {
      errorsMap.password = 'Password must be at least 6 characters';
    }

    if (passwordInput !== confirmPasswordInput) {
      errorsMap.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errorsMap).length > 0) {
      setValidationErrors(errorsMap);
      addToast('Registration Failed', 'error', 'Check missing fields or matching password.');
      return;
    }

    setValidationErrors({});
    setIsSubmitting(true);
    try {
      await register({ fullName: fullNameInput, rollNumber: rollNumberInput, email: emailInput, password: passwordInput });
      addToast('Account Created!', 'success', 'Your student account has been created. Access is now granted.');
      onAuthSuccess('Student', fullNameInput);
      onNavigate('student-dashboard');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to reach the server. Please try again.';
      setValidationErrors({ email: message });
      addToast('Registration Failed', 'error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordRecoveryStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !validateEmailFormat(emailInput)) {
      setValidationErrors({ email: 'Please enter a valid registered email' });
      addToast('Invalid Email', 'error');
      return;
    }
    setValidationErrors({});
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(emailInput);
      addToast('Verification Sent', 'success', 'If an account exists for that email, a reset code has been sent.');
      setForgotPasswordStep(2);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.';
      addToast('Request Failed', 'error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordRecoveryStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCodeInput.length !== 6 || !/^\d+$/.test(otpCodeInput)) {
      setValidationErrors({ otp: 'Please enter a valid 6-digit numeric code' });
      addToast('Invalid Code', 'error', 'OTP must be exactly 6 digits.');
      return;
    }
    setValidationErrors({});
    setIsSubmitting(true);
    try {
      await authApi.verifyResetCode(emailInput, otpCodeInput);
      addToast('OTP Verified', 'success', 'Code verified. Enter your new password.');
      setForgotPasswordStep(3);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.';
      setValidationErrors({ otp: message });
      addToast('Verification Failed', 'error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordRecoveryStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput || passwordInput.length < 6) {
      setValidationErrors({ password: 'Password must be at least 6 characters' });
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setValidationErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }
    setValidationErrors({});
    setIsSubmitting(true);
    try {
      await authApi.resetPassword(emailInput, otpCodeInput, passwordInput);
      addToast('Password Reset Successfully', 'success', 'Please sign in with your new credentials.');
      setAuthMode('login');
      setForgotPasswordStep(1);
      setPasswordInput('');
      setConfirmPasswordInput('');
      setOtpCodeInput('');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.';
      setValidationErrors({ password: message });
      addToast('Reset Failed', 'error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-zinc-50 dark:bg-zinc-950 transition-colors">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-md w-full relative z-10">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-8 rounded-2xl shadow-xl space-y-6">
          
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              {authMode === 'login' && 'Welcome Back'}
              {authMode === 'register' && 'Forge Your Account'}
              {authMode === 'forgot' && 'Reset Forge Access'}
            </h3>
            <p className="text-xs text-zinc-550 dark:text-zinc-400">
              {authMode === 'login' && 'Sign in to access your problems, quizzes and streaks.'}
              {authMode === 'register' && 'Create your credentials to join campus coders.'}
              {authMode === 'forgot' && 'Get back into your developmental environment.'}
            </p>
          </div>

          {/* MODE: LOGIN */}
          {authMode === 'login' && (
            <form onSubmit={handleUserLogin} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="email"
                    placeholder="student@college.edu or admin@college.edu"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {validationErrors.email && <p className="text-[10px] text-red-500 font-bold">{validationErrors.email}</p>}
                <p className="text-[10px] text-zinc-450 font-semibold italic">Demo student login: any seeded student email / student123. Demo admin: admin@skillforge.dev / admin123.</p>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Password</label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setForgotPasswordStep(1); setValidationErrors({}); }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-650"
                  >
                    {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {validationErrors.password && <p className="text-[10px] text-red-500 font-bold">{validationErrors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 transition-all"
              >
                <span>{isSubmitting ? 'Signing In...' : 'Login Securely'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-zinc-500">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setValidationErrors({}); }}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* MODE: REGISTER */}
          {authMode === 'register' && (
            <form onSubmit={handleUserRegistration} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {validationErrors.fullName && <p className="text-[10px] text-red-500 font-bold">{validationErrors.fullName}</p>}
              </div>

              {/* Roll Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Roll Number</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="e.g. 22CS8012"
                    value={rollNumberInput}
                    onChange={(e) => setRollNumberInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {validationErrors.rollNumber && <p className="text-[10px] text-red-500 font-bold">{validationErrors.rollNumber}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="email"
                    placeholder="name@college.edu"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {validationErrors.email && <p className="text-[10px] text-red-500 font-bold">{validationErrors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {validationErrors.password && <p className="text-[10px] text-red-500 font-bold">{validationErrors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {validationErrors.confirmPassword && <p className="text-[10px] text-red-500 font-bold">{validationErrors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-md transition-all animate-fade-in"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-zinc-550">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setValidationErrors({}); }}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* MODE: FORGOT PASSWORD FLOW */}
          {authMode === 'forgot' && (
            <div className="space-y-4">
              
              {/* Step indicator */}
              <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-450 uppercase">
                <span>Forgot Flow</span>
                <span>Step {forgotPasswordStep} of 3</span>
              </div>

              {/* STEP 1: Enter Registered Email */}
              {forgotPasswordStep === 1 && (
                <form onSubmit={handlePasswordRecoveryStep1} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Registered Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="email"
                        placeholder="student@college.edu"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    {validationErrors.email && <p className="text-[10px] text-red-500 font-bold">{validationErrors.email}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm transition-all"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Verification Code'}
                  </button>
                </form>
              )}

              {/* STEP 2: Enter 6-digit OTP Code */}
              {forgotPasswordStep === 2 && (
                <form onSubmit={handlePasswordRecoveryStep2} className="space-y-4">
                  <div className="space-y-1.5 text-center">
                    <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed mb-2">
                      Enter the 6-digit verification code sent to <br />
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{emailInput}</span>
                    </p>
                    
                    <div className="relative max-w-[200px] mx-auto">
                      <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        value={otpCodeInput}
                        onChange={(e) => setOtpCodeInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-center tracking-[0.5em] bg-zinc-55 dark:bg-zinc-950 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-extrabold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    {validationErrors.otp && <p className="text-[10px] text-red-500 font-bold text-center mt-1">{validationErrors.otp}</p>}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setOtpCodeInput('');
                        try {
                          await authApi.forgotPassword(emailInput);
                          addToast('Code Resent', 'success', 'A new code has been sent, if this email is registered.');
                        } catch (err) {
                          addToast('Resend Failed', 'error', err instanceof ApiError ? err.message : 'Could not reach the server.');
                        }
                      }}
                      className="flex-1 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-350 text-xs font-bold transition-all flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Resend</span>
                    </button>
                    
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-all"
                    >
                      {isSubmitting ? 'Verifying...' : 'Verify Code'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Reset Password */}
              {forgotPasswordStep === 3 && (
                <form onSubmit={handlePasswordRecoveryStep3} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    {validationErrors.password && <p className="text-[10px] text-red-500 font-bold">{validationErrors.password}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-zinc-55 dark:bg-zinc-950 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    {validationErrors.confirmPassword && <p className="text-[10px] text-red-500 font-bold">{validationErrors.confirmPassword}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm transition-all"
                  >
                    {isSubmitting ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setForgotPasswordStep(1); setValidationErrors({}); }}
                  className="text-xs font-bold text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-205 transition-colors bg-transparent border-none cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
