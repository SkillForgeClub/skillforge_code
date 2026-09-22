/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Save, 
  CheckCircle2, 
  ArrowLeft, 
  Sparkles
} from 'lucide-react';
import { Quiz, ProgrammingLanguage } from '../types';
import { CodeEditor } from '../components/CodeEditor';
import { quizzesApi, ApiError } from '../services/api';

interface QuizCenterProps {
  onNavigate: (view: string) => void;
  addToast: (title: string, type: any, desc?: string) => void;
}

export const QuizCenter: React.FC<QuizCenterProps> = ({
  onNavigate,
  addToast
}) => {
  const [timedQuizzesList, setTimedQuizzesList] = useState<Quiz[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true);
  const [quizActiveTab, setQuizActiveTab] = useState<'Upcoming' | 'Live' | 'Completed'>('Live');
  
  // Quiz taker states
  const [activeTimedQuiz, setActiveTimedQuiz] = useState<Quiz | null>(null);
  const [isLoadingActiveQuiz, setIsLoadingActiveQuiz] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [quizAnswersRecord, setQuizAnswersRecord] = useState<Record<string, string | number>>({});
  const [finalGradeResult, setFinalGradeResult] = useState<{ score: number; maxScore: number } | null>(null);
  
  // Timer States
  const [quizTimeLeft, setQuizTimeLeft] = useState<number>(3600); // in seconds
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const quizTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Editor language for coding questions
  const [editorSelectedLang, setEditorSelectedLang] = useState<ProgrammingLanguage>('Python');

  useEffect(() => {
    quizzesApi
      .list()
      .then(setTimedQuizzesList)
      .catch((err) => addToast('Failed to Load Quizzes', 'error', err instanceof ApiError ? err.message : 'Server error.'))
      .finally(() => setIsLoadingQuizzes(false));
  }, []);

  // Handle active countdown timer simulation
  useEffect(() => {
    if (activeTimedQuiz && !isQuizSubmitted) {
      // Set initial duration
      setQuizTimeLeft(activeTimedQuiz.durationMinutes * 60);
      
      quizTimerRef.current = setInterval(() => {
        setQuizTimeLeft((prev) => {
          if (prev <= 1) {
            // Auto submit
            if (quizTimerRef.current) clearInterval(quizTimerRef.current);
            handleAutoSubmission();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    };
  }, [activeTimedQuiz, isQuizSubmitted]);

  const formatQuizTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startQuizSession = async (quiz: Quiz) => {
    setIsLoadingActiveQuiz(true);
    try {
      const fullQuiz = await quizzesApi.get(quiz.id);
      setActiveTimedQuiz(fullQuiz);
      setCurrentQuestionIdx(0);
      setQuizAnswersRecord({});
      setFinalGradeResult(null);
      setIsQuizSubmitted(false);
      addToast('Quiz Session Initiated', 'success', `"${quiz.title}" has started. Countdown is active.`);
    } catch (err) {
      addToast('Failed to Start Quiz', 'error', err instanceof ApiError ? err.message : 'Could not load quiz.');
    } finally {
      setIsLoadingActiveQuiz(false);
    }
  };

  const handleMCQOptionSelection = (questionId: string, optionIdx: number) => {
    setQuizAnswersRecord((prev) => ({ ...prev, [questionId]: optionIdx }));
    addToast('Response Recorded', 'info', 'Saved and synchronized automatically.', 800);
  };

  const handleCodingEditorCodeChange = (questionId: string, code: string) => {
    setQuizAnswersRecord((prev) => ({ ...prev, [questionId]: code }));
  };

  // Progress calculations
  const quizTotalQuestions = activeTimedQuiz?.questions.length || 0;
  const answeredQuestionsCount = Object.keys(quizAnswersRecord).length;
  const quizProgressPercent = quizTotalQuestions > 0 ? (answeredQuestionsCount / quizTotalQuestions) * 100 : 0;

  const handleManualSubmission = () => {
    if (confirm('Are you absolutely sure you want to finish and submit your quiz answers for administrative grading?')) {
      handleAutoSubmission();
    }
  };

  const handleAutoSubmission = async () => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    if (!activeTimedQuiz) return;
    try {
      const result = await quizzesApi.submitAttempt(activeTimedQuiz.id, quizAnswersRecord);
      setFinalGradeResult({ score: result.score, maxScore: result.maxScore });
      setIsQuizSubmitted(true);
      addToast('Quiz Submitted Successfully', 'success', 'All solutions have been logged and graded.', 5000);
    } catch (err) {
      addToast('Submission Failed', 'error', err instanceof ApiError ? err.message : 'Could not submit quiz to the server.');
    }
  };

  const filterQuizzesList = timedQuizzesList.filter(q => q.status === quizActiveTab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all min-h-screen">
      
      {/* CASE A: DORMANT / HUB LIST VIEW */}
      {!activeTimedQuiz ? (
        <div className="space-y-8">
          
          {/* Header Banner */}
          <div className="space-y-1 pb-4 border-b border-zinc-200/50 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">Evaluation Modules</span>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Departmental Quiz Center</h2>
            <p className="text-xs text-zinc-400 font-medium max-w-xl">
              Participate in coordinated campus competitions, midterms, and weekly speedruns. View schedules, read constraints, and complete timed questions.
            </p>
          </div>

          {/* Tab selectors */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            {(['Live', 'Upcoming', 'Completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setQuizActiveTab(tab)}
                className={`px-6 py-3 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                  quizActiveTab === tab
                    ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-550 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {tab} Challenges
              </button>
            ))}
          </div>

          {/* List catalog */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoadingQuizzes && (
              <div className="md:col-span-2 text-center py-16 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <p className="text-xs text-zinc-400 font-bold">Loading quizzes...</p>
              </div>
            )}
            {filterQuizzesList.map((quiz) => (
              <div 
                key={quiz.id} 
                className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      quiz.status === 'Live' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                      quiz.status === 'Upcoming' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-550' :
                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {quiz.status}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      {quiz.durationMinutes} Minutes
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white leading-tight">{quiz.title}</h3>
                  <p className="text-xs text-zinc-450 leading-relaxed font-normal">{quiz.description}</p>
                </div>

                <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800/60 mt-4 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">{(quiz as any).questionCount ?? quiz.questions?.length ?? 0} Evaluation Tasks</span>
                  {quiz.status === 'Live' ? (
                    <button
                      onClick={() => startQuizSession(quiz)}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/10 transition-colors cursor-pointer"
                    >
                      Start Challenge
                    </button>
                  ) : quiz.status === 'Upcoming' ? (
                    <button
                      disabled
                      className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-xs font-bold"
                    >
                      Locked till starting time
                    </button>
                  ) : (
                    <div className="text-right">
                      <span className="block font-bold text-xs text-emerald-500">Graded Complete</span>
                      <span className="text-[9px] text-zinc-455 uppercase">Credits Logged</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filterQuizzesList.length === 0 && (
              <div className="md:col-span-2 text-center py-16 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <Clock className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                <h4 className="font-bold text-sm">No challenges available under this section.</h4>
                <p className="text-xs text-zinc-400 mt-1">Check back soon for coordinated schedule events.</p>
              </div>
            )}
          </div>

        </div>
      ) : (
        
        // CASE B: ACTIVE QUIZ WORKSPACE
        <div className="space-y-6">
          
          {/* Top telemetry control bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider animate-pulse">● Timed Evaluation Session</span>
              <h2 className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">{activeTimedQuiz.title}</h2>
            </div>

            {/* Overall quiz timer & manual submit */}
            {!isQuizSubmitted && (
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-mono text-sm font-extrabold flex-grow sm:flex-grow-0 justify-center">
                  <Clock className="h-4.5 w-4.5 text-rose-500 animate-spin" />
                  <span>Time Remaining: {formatQuizTimer(quizTimeLeft)}</span>
                </div>
                <button
                  onClick={handleManualSubmission}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md cursor-pointer flex-grow sm:flex-grow-0 text-center"
                >
                  Submit Challenge
                </button>
              </div>
            )}
          </div>

          {/* ACTIVE CONTENT SHEET */}
          {!isQuizSubmitted ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Navigator & active question statement */}
              <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between min-h-[500px]">
                
                <div>
                  {/* Progress Tracker header */}
                  <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-150 dark:border-zinc-800/80 flex items-center justify-between gap-4">
                    <div className="space-y-1 flex-grow">
                      <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase">
                        <span>Quiz Progress</span>
                        <span>{answeredQuestionsCount} / {quizTotalQuestions} Answered</span>
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${quizProgressPercent}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Question block body */}
                  <div className="p-6 space-y-6">
                    {/* Active Question metadata */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        Task {currentQuestionIdx + 1} of {quizTotalQuestions}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-500 uppercase">
                        {activeTimedQuiz.questions[currentQuestionIdx].points} Points
                      </span>
                    </div>

                    {/* Question Statement */}
                    <h3 className="text-sm font-extrabold text-zinc-905 dark:text-white leading-relaxed">
                      {activeTimedQuiz.questions[currentQuestionIdx].questionText}
                    </h3>

                    {/* TYPE 1: MULTIPLE CHOICE QUESTION OPTIONS */}
                    {activeTimedQuiz.questions[currentQuestionIdx].type === 'multiple-choice' && (
                      <div className="space-y-3 pt-2">
                        {activeTimedQuiz.questions[currentQuestionIdx].options?.map((option, idx) => {
                          const isSelected = quizAnswersRecord[activeTimedQuiz.questions[currentQuestionIdx].id] === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleMCQOptionSelection(activeTimedQuiz.questions[currentQuestionIdx].id, idx)}
                              className={`w-full text-left p-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all group ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                                  : 'bg-zinc-50 dark:bg-zinc-955 border-zinc-205 dark:border-zinc-850 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-850'
                              }`}
                            >
                              <span>{option}</span>
                              <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center transition-colors ${
                                isSelected ? 'border-white bg-white/20' : 'border-zinc-300 group-hover:border-zinc-400 bg-transparent'
                              }`}>
                                {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 2: CODING QUESTION WORKSPACE */}
                    {activeTimedQuiz.questions[currentQuestionIdx].type === 'coding' && (
                      <div className="space-y-4 pt-2 border-t">
                        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 p-3 rounded-xl text-xs font-medium">
                          <Sparkles className="h-4.5 w-4.5" />
                          <span>This is an active compiler task. Complete the code inside the workspace on the right side.</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-normal">Your active code compiles will be stored and assessed automatically when clicking Submit.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation footer buttons */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
                  <button
                    disabled={currentQuestionIdx === 0}
                    onClick={() => setCurrentQuestionIdx(currentQuestionIdx - 1)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-650 disabled:opacity-40 hover:bg-zinc-100"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>

                  {/* Auto save pulse message */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-455 font-bold uppercase tracking-wider">
                    <Save className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Auto-saving response to cloud server...</span>
                  </div>

                  <button
                    disabled={currentQuestionIdx === quizTotalQuestions - 1}
                    onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                    className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
                  >
                    <span>Next Task</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

              </div>

              {/* Right Column: Question Navigator List & Coding workspace panel */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Panel 1: Fast Question Selection navigator map */}
                <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Tasks Index Map</span>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {activeTimedQuiz.questions.map((q, idx) => {
                      const isActive = currentQuestionIdx === idx;
                      const isAnswered = quizAnswersRecord[q.id] !== undefined;
                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentQuestionIdx(idx)}
                          className={`py-3 rounded-xl text-center text-xs font-extrabold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                              : isAnswered
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-zinc-55 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-750 hover:bg-zinc-100'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Panel 2: Coding question editor container */}
                {activeTimedQuiz.questions[currentQuestionIdx].type === 'coding' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] uppercase font-bold text-zinc-400">Sandbox Playground</span>
                      <select
                        value={editorSelectedLang}
                        onChange={(e) => setEditorSelectedLang(e.target.value as ProgrammingLanguage)}
                        className="px-2 py-0.5 bg-white border rounded text-[10px]"
                      >
                        <option value="Python">Python</option>
                        <option value="C++">C++</option>
                        <option value="Java">Java</option>
                      </select>
                    </div>

                    <div className="h-[350px] border rounded-2xl overflow-hidden shadow-sm">
                      <CodeEditor
                        problem={activeTimedQuiz.questions[currentQuestionIdx].codingProblem!}
                        selectedLanguage={editorSelectedLang}
                        onLanguageChange={(lang) => setEditorSelectedLang(lang)}
                        submitMode="localOnly"
                        onRun={(code) => handleCodingEditorCodeChange(activeTimedQuiz.questions[currentQuestionIdx].id, code)}
                        onSubmit={(code) => handleCodingEditorCodeChange(activeTimedQuiz.questions[currentQuestionIdx].id, code)}
                      />
                    </div>
                  </div>
                )}

              </div>

            </div>
          ) : (
            
            // CASE C: AUTO-SUBMIT SUCCESS SCREEN
            <div className="max-w-2xl mx-auto py-12 text-center space-y-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl p-8 relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="space-y-3 flex flex-col items-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-205">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white">Timed Quiz Logged</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Your solutions for <span className="font-bold text-zinc-805 dark:text-zinc-200">"{activeTimedQuiz.title}"</span> have been securely compiled, archived, and synced for grading.
                </p>
              </div>

              {/* Score results card */}
              <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border rounded-2xl max-w-sm mx-auto space-y-4">
                <div className="flex justify-between text-xs border-b pb-2">
                  <span className="font-bold text-zinc-550">Questions Answered:</span>
                  <span className="font-extrabold text-zinc-900 dark:text-white">{answeredQuestionsCount} / {quizTotalQuestions}</span>
                </div>
                
                {/* Cumulative Score */}
                <div className="flex justify-between items-center text-sm font-black pt-1">
                  <span>Final Score:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {finalGradeResult?.score ?? 0} / {finalGradeResult?.maxScore ?? 0} pts
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => { setActiveTimedQuiz(null); setIsQuizSubmitted(false); onNavigate('student-dashboard'); }}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
