/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle, 
  ArrowLeft, 
  FileText, 
  Activity
} from 'lucide-react';
import { CodingProblem, Difficulty, ProgrammingLanguage } from '../types';
import { CodeEditor } from '../components/CodeEditor';
import { problemsApi, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ProblemArenaProps {
  onNavigate: (view: string) => void;
  addToast: (title: string, type: any, desc?: string) => void;
}

export const ProblemArena: React.FC<ProblemArenaProps> = ({
  onNavigate,
  addToast
}) => {
  // Problems database, loaded from the backend
  const [codingProblemsList, setCodingProblemsList] = useState<CodingProblem[]>([]);
  const [isLoadingProblems, setIsLoadingProblems] = useState(true);
  const { refreshStudent } = useAuth();
  
  // Selection state (null means list view, object means active problem being solved)
  const [activeCodingProblem, setActiveCodingProblem] = useState<CodingProblem | null>(null);
  const [isLoadingActiveProblem, setIsLoadingActiveProblem] = useState(false);
  const [editorLanguage, setEditorLanguage] = useState<ProgrammingLanguage>('Python');

  useEffect(() => {
    problemsApi
      .list()
      .then(setCodingProblemsList)
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : 'Could not load the problem bank.';
        addToast('Failed to Load Problems', 'error', message);
      })
      .finally(() => setIsLoadingProblems(false));
  }, []);

  // Search & filters states
  const [searchFilterQuery, setSearchFilterQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Pagination
  const [problemsCurrentPage, setProblemsCurrentPage] = useState(1);
  const itemsPerPageLimit = 4;

  const problemCategories = ['All', 'Arrays & Hashing', 'Strings', 'Two Pointers', 'Binary Search'];

  // Handle filtrations
  const filteredProblemsList = codingProblemsList.filter((prob) => {
    const matchesSearch = prob.title.toLowerCase().includes(searchFilterQuery.toLowerCase()) ||
                          prob.category.toLowerCase().includes(searchFilterQuery.toLowerCase()) ||
                          prob.statement.toLowerCase().includes(searchFilterQuery.toLowerCase());
    
    const matchesDifficulty = selectedDifficulty === 'All' || prob.difficulty === selectedDifficulty;
    const matchesCategory = selectedCategory === 'All' || prob.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || 
                          (selectedStatus === 'Solved' && prob.status === 'Solved') ||
                          (selectedStatus === 'Attempted' && prob.status === 'Attempted') ||
                          (selectedStatus === 'Unsolved' && (!prob.status || prob.status === 'Unsolved'));

    return matchesSearch && matchesDifficulty && matchesCategory && matchesStatus;
  });

  const paginatedProblemsList = filteredProblemsList.slice(
    (problemsCurrentPage - 1) * itemsPerPageLimit, 
    problemsCurrentPage * itemsPerPageLimit
  );
  const totalPagesCount = Math.ceil(filteredProblemsList.length / itemsPerPageLimit);

  const handleChooseProblem = async (prob: CodingProblem) => {
    setIsLoadingActiveProblem(true);
    try {
      const full = await problemsApi.get(prob.id);
      setActiveCodingProblem(full);
      addToast('Environment Loaded', 'success', `Loaded sandbox workspace for "${full.title}".`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not load this problem.';
      addToast('Failed to Load Problem', 'error', message);
    } finally {
      setIsLoadingActiveProblem(false);
    }
  };

  const handleReturnToList = () => {
    setActiveCodingProblem(null);
  };

  const handleRealSubmission = (code: string, status?: string) => {
    if (!activeCodingProblem) return;
    if (status === 'Accepted') {
      setCodingProblemsList(prev => prev.map(p => p.id === activeCodingProblem.id ? { ...p, status: 'Solved' } : p));
      setActiveCodingProblem(p => p ? { ...p, status: 'Solved' } : null);
      addToast('Accepted Solution!', 'success', 'All hidden compilation test cases verified and approved.', 6000);
      refreshStudent();
    } else {
      setCodingProblemsList(prev => prev.map(p => p.id === activeCodingProblem.id && p.status !== 'Solved' ? { ...p, status: 'Attempted' } : p));
      setActiveCodingProblem(p => p && p.status !== 'Solved' ? { ...p, status: 'Attempted' } : p);
      addToast('Evaluation Terminated', 'error', `${status || 'Incorrect logic or compilation failures.'} See output console.`, 5000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all min-h-screen">
      
      {/* VIEW A: PROBLEMS LIST VIEW */}
      {!activeCodingProblem ? (
        <div className="space-y-8">
          
          {/* Section banner */}
          <div className="space-y-1 pb-4 border-b border-zinc-200/50 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">Evaluation Hub</span>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Coding Problem Bank</h2>
            <p className="text-xs text-zinc-400 leading-normal font-medium max-w-xl">
              Sharpen your core engineering skills. Filter through categories, review complexity targets, and compile answers in our sandbox.
            </p>
          </div>

          {/* Filtering Layout panel */}
          <div className="bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 p-5 rounded-2xl shadow-sm space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search input */}
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search problem sets..."
                  value={searchFilterQuery}
                  onChange={(e) => { setSearchFilterQuery(e.target.value); setProblemsCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-[#0a0a0a] text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Difficulty selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-zinc-450 whitespace-nowrap">Difficulty:</span>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => { setSelectedDifficulty(e.target.value); setProblemsCurrentPage(1); }}
                  className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-[#0a0a0a] text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                >
                  <option value="All">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              {/* Category selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-zinc-455 whitespace-nowrap">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setProblemsCurrentPage(1); }}
                  className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-[#0a0a0a] text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                >
                  {problemCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Status selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-zinc-450 whitespace-nowrap">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setProblemsCurrentPage(1); }}
                  className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-[#0a0a0a] text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                >
                  <option value="All">All statuses</option>
                  <option value="Solved">Solved</option>
                  <option value="Attempted">Attempted</option>
                  <option value="Unsolved">Unsolved</option>
                </select>
              </div>
            </div>

          </div>

          {/* Catalog Lists Table/Cards */}
          <div className="grid grid-cols-1 gap-4">
            {isLoadingProblems && (
              <div className="text-center py-16 bg-white dark:bg-[#141414] border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-3xl">
                <p className="text-xs text-zinc-400 font-bold">Loading problem bank...</p>
              </div>
            )}
            {paginatedProblemsList.map((prob) => (
              <div 
                key={prob.id} 
                onClick={() => handleChooseProblem(prob)}
                className="p-5 bg-white dark:bg-[#141414] border border-zinc-205 dark:border-zinc-800/80 rounded-2xl hover:border-indigo-500/50 hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {prob.status === 'Solved' && (
                      <CheckCircle className="h-4 w-4 text-emerald-500" title="Solved problem" />
                    )}
                    {prob.status === 'Attempted' && (
                      <AlertCircle className="h-4 w-4 text-amber-500" title="Attempted problem" />
                    )}
                    {(!prob.status || prob.status === 'Unsolved') && (
                      <HelpCircle className="h-4 w-4 text-zinc-300 dark:text-zinc-700" title="Unsolved problem" />
                    )}

                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {prob.title}
                    </h3>
                    
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      prob.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      prob.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-450' :
                      'bg-rose-500/10 text-rose-600 dark:text-rose-455'
                    }`}>
                      {prob.difficulty}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {prob.category}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 max-w-2xl leading-relaxed">
                    {prob.statement}
                  </p>
                </div>

                <div className="flex items-center gap-6 text-right self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                  <div className="text-left sm:text-right">
                    <span className="block font-bold text-xs text-zinc-800 dark:text-zinc-200">
                      {prob.solvedCount.toLocaleString()} Solves
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Acceptance: {prob.acceptanceRate}%
                    </span>
                  </div>
                  <button className="px-4 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-bold transition-all whitespace-nowrap">
                    Solve
                  </button>
                </div>
              </div>
            ))}

            {paginatedProblemsList.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-[#141414] border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-3xl">
                <HelpCircle className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                <h4 className="font-bold text-sm">No problem sets match your filter parameters.</h4>
                <p className="text-xs text-zinc-400 mt-1">Try adjusting the search input or choosing other difficulties.</p>
              </div>
            )}
          </div>

          {/* Pagination index */}
          {totalPagesCount > 1 && (
            <div className="flex justify-between items-center bg-white dark:bg-[#141414] px-6 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800/80">
              <button
                disabled={problemsCurrentPage === 1}
                onClick={() => setProblemsCurrentPage(problemsCurrentPage - 1)}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold text-zinc-500 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Page {problemsCurrentPage} of {totalPagesCount}</span>
              <button
                disabled={problemsCurrentPage === totalPagesCount}
                onClick={() => setProblemsCurrentPage(problemsCurrentPage + 1)}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold text-zinc-500 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

        </div>
      ) : (
        
        // VIEW B: ACTIVE LEETCODE-STYLE PROBLEM SOLVING ARENA
        <div className="space-y-6">
          {/* Top navigation row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={handleReturnToList}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-350 text-xs font-bold transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Problems</span>
            </button>

            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                activeCodingProblem.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                activeCodingProblem.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                'bg-rose-500/10 text-rose-600'
              }`}>
                {activeCodingProblem.difficulty}
              </span>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">{activeCodingProblem.category}</span>
            </div>
          </div>

          {/* Active solving layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Problem Details */}
            <div className="lg:col-span-5 bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-sm p-6 space-y-6 overflow-y-auto max-h-[650px]">
              
              {/* Problem Statement Head */}
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Solving Challenge</span>
                <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-tight">
                  {activeCodingProblem.title}
                </h2>
                {activeCodingProblem.status === 'Solved' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase">
                    <CheckCircle className="h-3 w-3" /> Solved
                  </span>
                )}
              </div>

              {/* MD Statement */}
              <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal whitespace-pre-wrap pb-4 border-b">
                {activeCodingProblem.statement}
              </div>

              {/* Input Output constraints formats */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Input Format
                  </h4>
                  <pre className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed border border-zinc-150 dark:border-zinc-850">
                    {activeCodingProblem.inputFormat}
                  </pre>
                </div>

                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Output Format
                  </h4>
                  <pre className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed border border-zinc-150 dark:border-zinc-850">
                    {activeCodingProblem.outputFormat}
                  </pre>
                </div>

                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Constraints
                  </h4>
                  <pre className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed border border-zinc-150 dark:border-zinc-850 text-indigo-600 dark:text-indigo-400">
                    {activeCodingProblem.constraints}
                  </pre>
                </div>
              </div>

              {/* Static Example blocks */}
              <div className="space-y-4 border-t pt-4">
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">Verification Examples</span>
                {activeCodingProblem.examples.map((ex, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 space-y-3">
                    <span className="font-extrabold text-[10px] text-zinc-500 uppercase tracking-wide">Example {idx + 1}</span>
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-zinc-400">Input:</span>
                        <pre className="p-2 rounded bg-white dark:bg-zinc-900 border text-[11px] overflow-x-auto whitespace-pre">
                          {ex.input}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400">Output:</span>
                        <pre className="p-2 rounded bg-white dark:bg-zinc-900 border text-[11px] overflow-x-auto whitespace-pre text-indigo-600 dark:text-indigo-400">
                          {ex.output}
                        </pre>
                      </div>
                      {ex.explanation && (
                        <div>
                          <span className="text-[10px] text-zinc-400 italic">Explanation:</span>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{ex.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Right Column: Code Editor & Console */}
            <div className="lg:col-span-7">
              <CodeEditor
                problem={activeCodingProblem}
                selectedLanguage={editorLanguage}
                onLanguageChange={(lang) => setEditorLanguage(lang)}
                onSubmit={handleRealSubmission}
              />
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
