/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, 
  Send, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2, 
  Settings, 
  Terminal, 
  RefreshCw, 
  VolumeX,
  Cpu,
  Clock,
  CheckCircle,
  XCircle,
  FileCode2,
  Lock
} from 'lucide-react';
import { ProgrammingLanguage, CodingProblem, TestCase } from '../types';
import { submissionsApi, ApiError } from '../services/api';

interface CodeEditorProps {
  problem: CodingProblem;
  selectedLanguage: ProgrammingLanguage;
  onLanguageChange: (lang: ProgrammingLanguage) => void;
  onRun?: (code: string, customInput: string) => void;
  onSubmit?: (code: string, status?: string) => void;
  contestId?: string;
  /**
   * 'judge' (default): Submit runs the real backend judge against all test cases, persists a
   *   graded submission, and updates the student's solved-count/points/streak - used for the
   *   Problem Arena and Contest Room, where "Submit" is a genuine, scored attempt.
   * 'localOnly': Submit does NOT call the backend judge or persist anything - it just hands the
   *   code to onSubmit so the caller can decide what to do with it. Used when this editor is
   *   embedded inside a quiz question: quiz coding answers are graded once, when the whole quiz
   *   is submitted (see QuizCenter), not as a side-channel real submission every time the
   *   student clicks Submit while still working through the quiz.
   */
  submitMode?: 'judge' | 'localOnly';
}

function draftKey(problemId: string, language: ProgrammingLanguage): string {
  return `skillforge_draft_v2_${problemId}_${language}`;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  problem,
  selectedLanguage,
  onLanguageChange,
  onRun,
  onSubmit,
  contestId,
  submitMode = 'judge'
}) => {
  const [code, setCode] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [fontSize, setFontSize] = useState<number>(14);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState<string>('Just now');
  
  // Custom execution state
  const [customInput, setCustomInput] = useState<string>('');
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'testcases' | 'custom'>('testcases');
  
  // Output logs
  const [outputLogs, setOutputLogs] = useState<{
    status: 'idle' | 'queued' | 'running' | 'success' | 'failed' | 'error';
    verdict?: string;
    summary?: string;
    stdout?: string;
    timeMs?: number;
    memoryKb?: number;
    testCasesChecked?: { input: string; expected: string; actual: string; passed: boolean; isPublic: boolean }[];
    queuePosition?: number;
    workersActive?: number;
    workersTotal?: number;
  }>({ status: 'idle' });

  // Update starter template on problem/language change - restore any locally saved draft first.
  useEffect(() => {
    if (problem && problem.starterTemplates) {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey(problem.id, selectedLanguage)) : null;
      setCode(saved !== null ? saved : (problem.starterTemplates[selectedLanguage] || ''));
    }
  }, [problem, selectedLanguage]);

  // Real auto-save: persists the current draft to localStorage every 15s, per problem+language,
  // so refreshing or navigating away doesn't lose in-progress code.
  useEffect(() => {
    if (!autoSaveEnabled || !problem) return;
    const interval = setInterval(() => {
      window.localStorage.setItem(draftKey(problem.id, selectedLanguage), code);
      const now = new Date();
      setLastSaved(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 15000);
    return () => clearInterval(interval);
  }, [autoSaveEnabled, code, problem, selectedLanguage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code', err);
    }
  };

  const mapMonacoLanguage = (lang: ProgrammingLanguage): string => {
    switch (lang) {
      case 'C': return 'c';
      case 'C++': return 'cpp';
      case 'Java': return 'java';
      case 'Python': return 'python';
      default: return 'python';
    }
  };

  // Run code against public test cases (or custom stdin) via the real backend judge queue.
  const handleRunCode = async () => {
    setIsRunning(true);
    setActiveTab('results');
    setOutputLogs({ status: 'queued' });

    try {
      const result = await submissionsApi.run(
        {
          problemId: problem.id,
          language: selectedLanguage,
          code,
          customInput: useCustomInput ? customInput : undefined,
        },
        (progress) => {
          setOutputLogs((prev) => ({
            ...prev,
            status: progress.status === 'Queued' ? 'queued' : 'running',
            queuePosition: progress.queued,
            workersActive: progress.running,
            workersTotal: progress.concurrency,
          }));
        }
      );

      if (result.mode === 'custom') {
        setOutputLogs({
          status: result.status === 'Accepted' ? 'success' : result.status === 'Compilation Error' ? 'error' : 'failed',
          verdict: result.status,
          summary: result.status,
          stdout: result.compileError
            ? result.compileError
            : `${result.stdout || ''}${result.stderr ? `\nstderr:\n${result.stderr}` : ''}`,
          timeMs: result.timeMs,
          memoryKb: result.memoryKb,
        });
      } else {
        const cases = result.testCasesChecked || [];
        const allPassed = cases.every(c => c.passed);
        setOutputLogs({
          status: result.status === 'Compilation Error' ? 'error' : allPassed ? 'success' : 'failed',
          verdict: result.status,
          summary: result.compileError || (allPassed ? 'All Public Test Cases Passed' : `${result.status}: some test cases failed.`),
          timeMs: result.timeMs,
          memoryKb: result.memoryKb,
          testCasesChecked: cases,
        });
      }

      if (onRun) onRun(code, useCustomInput ? customInput : '');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not reach the judge server. Please try again.';
      setOutputLogs({ status: 'error', summary: message });
    } finally {
      setIsRunning(false);
    }
  };

  // Submit code against ALL test cases (public + hidden) via the real backend judge queue and persist the result.
  // In 'localOnly' mode (embedded in a quiz question), this just hands the code to the caller instead -
  // quiz coding answers are graded once, when the whole quiz is submitted, not as a standalone real submission.
  const handleSubmitCode = async () => {
    if (submitMode === 'localOnly') {
      if (onSubmit) onSubmit(code);
      setActiveTab('results');
      setOutputLogs({ status: 'success', summary: 'Saved as your answer for this question. It will be graded when you submit the quiz.' });
      return;
    }

    setIsSubmitting(true);
    setActiveTab('results');
    setOutputLogs({ status: 'queued' });

    try {
      const result = await submissionsApi.submit(
        { problemId: problem.id, language: selectedLanguage, code, contestId },
        (progress) => {
          setOutputLogs((prev) => ({
            ...prev,
            status: progress.status === 'Queued' ? 'queued' : 'running',
            queuePosition: progress.queued,
            workersActive: progress.running,
            workersTotal: progress.concurrency,
          }));
        }
      );
      const cases = result.testCasesChecked || [];
      const passedCount = cases.filter(c => c.passed).length;

      let status: 'success' | 'failed' | 'error' = 'success';
      let summary = 'Solution Accepted! Excellent Work.';
      if (result.status === 'Compilation Error') {
        status = 'error';
        summary = result.compileError || 'Compilation Error.';
      } else if (result.status !== 'Accepted') {
        status = 'failed';
        summary = `${passedCount}/${cases.length} Test Cases Passed. ${result.status}.`;
      }

      setOutputLogs({ status, verdict: result.status, summary, timeMs: result.timeMs, memoryKb: result.memoryKb, testCasesChecked: cases });

      if (onSubmit) onSubmit(code, result.status);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not reach the judge server. Please try again.';
      setOutputLogs({ status: 'error', summary: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden shadow-md transition-all ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-[650px]'
    }`}>
      {/* Editor Header Control Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 gap-2">
        {/* Left Controls: Lang & Save status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-xs">
            <FileCode2 className="h-3.5 w-3.5 text-indigo-500" />
            <span>Workspace</span>
          </div>
          
          <select
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value as ProgrammingLanguage)}
            className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs font-semibold border-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="Python">Python 3</option>
            <option value="C++">C++ (GCC 14)</option>
            <option value="Java">Java (JDK 21)</option>
            <option value="C">C (Clang 18)</option>
          </select>

          {/* Auto save visual */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                autoSaveEnabled 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}
            >
              {autoSaveEnabled ? 'Auto-save: ON' : 'Auto-save: OFF'}
            </button>
            {autoSaveEnabled && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                Saved at {lastSaved}
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: Settings, maximize, copy */}
        <div className="flex items-center gap-2">
          {/* Theme Selector */}
          <button
            onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
            title="Switch Editor Theme"
            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          {/* Font Size */}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs font-medium border-none cursor-pointer"
            title="Editor Font Size"
          >
            <option value={12}>12px</option>
            <option value={14}>14px</option>
            <option value={16}>16px</option>
            <option value={18}>18px</option>
          </select>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold transition-all"
            title="Copy Code to Clipboard"
          >
            {isCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Editor'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Editor Split View */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left Side: Interactive Monaco Editor */}
        <div className="flex-grow flex flex-col min-w-0 bg-zinc-950">
          <Editor
            height="100%"
            language={mapMonacoLanguage(selectedLanguage)}
            theme={editorTheme}
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              fontSize: fontSize,
              lineNumbers: showLineNumbers ? 'on' : 'off',
              minimap: { enabled: false },
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: 4,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 12, bottom: 12 }
            }}
            loading={
              <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400 bg-zinc-950">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                <p className="text-xs font-medium">Preparing Forge Workspace...</p>
              </div>
            }
          />
        </div>

        {/* Right Side / Bottom: Interactive Output Console */}
        <div className="w-full md:w-[360px] border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-[280px] md:h-auto min-h-0">
          {/* Console tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-2 bg-zinc-50 dark:bg-zinc-950">
            <button
              onClick={() => setActiveTab('testcases')}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'testcases'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Public Test Cases
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'custom'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Custom Input
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors relative ${
                activeTab === 'results'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Console Output
              {outputLogs.status !== 'idle' && (
                <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                  outputLogs.status === 'running' || outputLogs.status === 'queued' ? 'bg-amber-400 animate-ping' :
                  outputLogs.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                }`} />
              )}
            </button>
          </div>

          {/* Consol panel body */}
          <div className="flex-grow overflow-y-auto p-4 font-mono text-xs text-zinc-800 dark:text-zinc-200 min-h-0">
            {/* TAB: Public Test Cases */}
            {activeTab === 'testcases' && (
              <div className="space-y-4">
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
                  Pre-configured inputs to verify your code structure.
                </p>
                {problem.testCases.filter(tc => tc.isPublic).map((tc, idx) => (
                  <div key={tc.id} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-zinc-600 dark:text-zinc-400">Case {idx + 1}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-500 uppercase font-bold">Public</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-zinc-400">Input:</span>
                        <pre className="bg-white dark:bg-zinc-900 p-1.5 rounded border border-zinc-100 dark:border-zinc-800 text-[11px] overflow-x-auto whitespace-pre">
                          {tc.input}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400">Expected Output:</span>
                        <pre className="bg-white dark:bg-zinc-900 p-1.5 rounded border border-zinc-100 dark:border-zinc-800 text-[11px] overflow-x-auto whitespace-pre text-indigo-600 dark:text-indigo-400">
                          {tc.expectedOutput}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Custom Input */}
            {activeTab === 'custom' && (
              <div className="space-y-3 h-full flex flex-col">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useCustomInput}
                    onChange={(e) => setUseCustomInput(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Enable Custom Input</span>
                </label>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  disabled={!useCustomInput}
                  placeholder="Enter inputs here..."
                  className={`w-full flex-grow p-3 rounded-lg border focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-mono resize-none ${
                    useCustomInput 
                      ? 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100' 
                      : 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-400 cursor-not-allowed'
                  }`}
                  rows={6}
                />
              </div>
            )}

            {/* TAB: Results / Terminal logs */}
            {activeTab === 'results' && (
              <div className="space-y-3">
                {outputLogs.status === 'idle' && (
                  <div className="flex flex-col items-center justify-center text-center py-8 text-zinc-400 dark:text-zinc-500">
                    <Terminal className="h-8 w-8 mb-2 opacity-50" />
                    <p className="font-semibold text-xs">Console is dormant.</p>
                    <p className="text-[10px] mt-1 max-w-[200px]">Click "Run" or "Submit Solution" to trigger compilation.</p>
                  </div>
                )}

                {outputLogs.status === 'queued' && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
                    <span className="text-zinc-500 font-semibold text-xs">
                      {(outputLogs.queuePosition ?? 0) > 0
                        ? `Queued — ${outputLogs.queuePosition} submission${outputLogs.queuePosition === 1 ? '' : 's'} ahead of you...`
                        : 'Waiting for a free judge worker...'}
                    </span>
                    {outputLogs.workersTotal !== undefined && (
                      <span className="text-[10px] text-zinc-400">
                        {outputLogs.workersActive}/{outputLogs.workersTotal} judge workers busy
                      </span>
                    )}
                  </div>
                )}

                {outputLogs.status === 'running' && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
                    <span className="text-zinc-500 font-semibold text-xs">Compiling & Executing Code...</span>
                  </div>
                )}

                {(outputLogs.status === 'success' || outputLogs.status === 'failed' || outputLogs.status === 'error') && (
                  <div className="space-y-4">
                    {/* Status header */}
                    <div className={`p-3 rounded-lg flex items-center justify-between border ${
                      outputLogs.status === 'success' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                        : outputLogs.status === 'error'
                        ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        {outputLogs.status === 'success' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span className="font-bold text-xs uppercase tracking-wide">
                          {outputLogs.verdict || (outputLogs.status === 'success' ? 'Accepted' : outputLogs.status === 'error' ? 'Compilation Error' : 'Wrong Answer')}
                        </span>
                      </div>
                      <span className="text-[10px] opacity-75 font-semibold">
                        {outputLogs.timeMs !== undefined ? `${outputLogs.timeMs}ms` : 'Judged'}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {outputLogs.summary}
                    </p>

                    {/* Telemetry info */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5 p-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
                        <Clock className="h-3 w-3" />
                        <span>Time: {outputLogs.timeMs} ms</span>
                      </div>
                      <div className="flex items-center gap-1.5 p-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
                        <Cpu className="h-3 w-3" />
                        <span>Memory: {(outputLogs.memoryKb! / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>

                    {/* Stdout custom print */}
                    {outputLogs.stdout && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase">Stdout:</span>
                        <pre className="p-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 overflow-x-auto text-[10px] whitespace-pre-wrap">
                          {outputLogs.stdout}
                        </pre>
                      </div>
                    )}

                    {/* Individual testcase breakdowns */}
                    {outputLogs.testCasesChecked && (
                      <div className="space-y-2">
                        <span className="text-[10px] text-zinc-400 uppercase font-semibold">Test Case Validation:</span>
                        <div className="space-y-1.5">
                          {outputLogs.testCasesChecked.map((tc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-500">Case {idx + 1}</span>
                                {!tc.isPublic && (
                                  <span className="flex items-center gap-0.5 px-1 py-0.2 bg-indigo-500/10 text-indigo-500 text-[9px] rounded font-semibold uppercase">
                                    <Lock className="h-2.5 w-2.5" /> Hidden
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 font-bold">
                                {tc.passed ? (
                                  <span className="text-emerald-500">Passed</span>
                                ) : (
                                  <span className="text-red-500">Failed</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <span className="text-[10px] text-zinc-400 font-medium">Console Ready</span>
            <div className="flex gap-2">
              <button
                onClick={handleRunCode}
                disabled={isRunning || isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-bold transition-all disabled:opacity-55"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Run Code</span>
              </button>
              <button
                onClick={handleSubmitCode}
                disabled={isRunning || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-55"
              >
                <Send className="h-3 w-3" />
                <span>Submit Solution</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
