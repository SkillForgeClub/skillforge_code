/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileCode, 
  Award, 
  Activity, 
  Search, 
  Plus, 
  Upload,
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Save,
  Sliders,
  Star,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sidebar, AdminTab } from '../components/Sidebar';
import { CodingProblem, Quiz, Difficulty, QuizQuestion, Student } from '../types';
import { adminApi, problemsApi, quizzesApi, leaderboardApi, contestsApi, ApiError, BulkImportResult } from '../services/api';
import { Contest } from '../types';
import { useAuth } from '../context/AuthContext';

interface AdminCommandCenterProps {
  onNavigate: (view: string) => void;
  addToast: (title: string, type: any, desc?: string) => void;
}

// Zod schemas for quiz validation
const quizQuestionSchema = z.object({
  id: z.string(),
  questionText: z.string().min(5, 'Question text must be at least 5 characters'),
  type: z.enum(['multiple-choice', 'coding']),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  points: z.number().min(1, 'Points must be at least 1'),
  options: z.array(z.string().min(1, 'Option content cannot be empty')).length(4).optional(),
  correctOption: z.number().min(0).max(3).optional(),
  codingProblemId: z.string().optional(),
});

const quizFormSchema = z.object({
  id: z.string(),
  title: z.string().min(5, 'Quiz Title must be at least 5 characters'),
  description: z.string().min(10, 'Quiz Description must be at least 10 characters'),
  durationMinutes: z.number().min(5, 'Quiz Duration must be at least 5 minutes'),
  status: z.enum(['Upcoming', 'Live', 'Completed']),
  questions: z.array(quizQuestionSchema).min(1, 'You must add at least one question to the quiz'),
});

type QuizFormValues = z.infer<typeof quizFormSchema>;
type QuizQuestionValues = z.infer<typeof quizQuestionSchema>;

export const AdminCommandCenter: React.FC<AdminCommandCenterProps> = ({
  onNavigate,
  addToast
}) => {
  const { logout } = useAuth();
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('dashboard');

  // Live data loaded from the backend
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [problemsList, setProblemsList] = useState<CodingProblem[]>([]);
  const [quizzesList, setQuizzesList] = useState<Quiz[]>([]);
  const [contestsList, setContestsList] = useState<Contest[]>([]);
  const [isContestFormActive, setIsContestFormActive] = useState(false);
  const [extendingContestId, setExtendingContestId] = useState<string | null>(null);
  const [contestForm, setContestForm] = useState<{
    id?: string; title: string; description: string; startTime: string; endTime: string;
    problems: { problemId: string; label: string; points: number }[];
  }>({ title: '', description: '', startTime: '', endTime: '', problems: [] });
  const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState({
    totalStudents: 0, totalProblems: 0, totalQuizzes: 0, totalSubmissions: 0,
    databaseSizeBytes: 0, largestTables: [] as { table: string; bytes: number }[],
  });
  const [certificateDraft, setCertificateDraft] = useState({
    studentId: '',
    title: '',
    issueDate: new Date().toISOString().slice(0, 10),
  });

  const reloadStudents = () => adminApi.students().then(setStudentsList).catch((err) => {
    addToast('Failed to Load Students', 'error', err instanceof ApiError ? err.message : 'Server error.');
  });
  const reloadProblems = () => problemsApi.list().then(setProblemsList).catch((err) => {
    addToast('Failed to Load Problems', 'error', err instanceof ApiError ? err.message : 'Server error.');
  });
  const reloadQuizzes = () => quizzesApi.list().then(setQuizzesList).catch((err) => {
    addToast('Failed to Load Quizzes', 'error', err instanceof ApiError ? err.message : 'Server error.');
  });
  const reloadContests = () => contestsApi.list().then(setContestsList).catch((err) => {
    addToast('Failed to Load Contests', 'error', err instanceof ApiError ? err.message : 'Server error.');
  });

  useEffect(() => {
    reloadStudents();
    reloadProblems();
    reloadQuizzes();
    reloadContests();
    leaderboardApi.list().then(setLeaderboardEntries).catch(() => {});
    adminApi.stats().then(setAdminStats).catch(() => {});
  }, []);
  
  // Search states
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [problemSearchInput, setProblemSearchInput] = useState('');
  const [quizSearchInput, setQuizSearchInput] = useState('');

  // Pagination states
  const [studentListPage, setStudentListPage] = useState(1);
  const itemsPerPageLimit = 4;

  // Modals / Editors state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [creatingProblem, setCreatingProblem] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResult | null>(null);
  const [editingProblem, setEditingProblem] = useState<CodingProblem | null>(null);
  const [isQuizFormActive, setIsQuizFormActive] = useState(false);
  const [isQuizEditMode, setIsQuizEditMode] = useState(false);

  // Zod + React Hook Form Setup
  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: {
      id: '',
      title: '',
      description: '',
      durationMinutes: 60,
      status: 'Upcoming',
      questions: []
    }
  });

  const { fields, append, remove, move, update } = useFieldArray({
    control,
    name: 'questions'
  });

  // Modal question builder state
  const [questionModal, setQuestionModal] = useState<{
    isOpen: boolean;
    index: number; // -1 for adding a new question, or the index in the fields array
    data: QuizQuestionValues;
  }>({
    isOpen: false,
    index: -1,
    data: {
      id: '',
      questionText: '',
      type: 'multiple-choice',
      difficulty: 'Easy',
      points: 5,
      options: ['', '', '', ''],
      correctOption: 0,
      codingProblemId: ''
    }
  });

  const [modalValidationErrors, setModalValidationErrors] = useState<Record<string, string>>({});

  // Problems Form States (original simplified form preserved)
  const [problemForm, setProblemForm] = useState({
    id: undefined as string | undefined,
    title: '',
    difficulty: 'Easy' as Difficulty,
    category: 'Algorithms',
    statement: '',
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    publicInput: '',
    publicOutput: '',
    hiddenInput: '',
    hiddenOutput: '',
  });

  // Settings states
  const [compileTimeoutValue, setCompileTimeoutValue] = useState(2.0);
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [allowUnauthenticatedGuestAccess, setAllowUnauthenticatedGuestAccess] = useState(true);

  // Stats
  const statMetricCardsList = [
    { label: 'Total Students', value: studentsList.length, icon: Users, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-205' },
    { label: 'Total Problems', value: problemsList.length, icon: FileCode, color: 'text-emerald-600 bg-emerald-55 dark:bg-emerald-950/40 border-emerald-200' },
    { label: 'Total Quizzes', value: quizzesList.length, icon: Award, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
    { label: 'Uptime Submissions', value: adminStats.totalSubmissions, icon: Activity, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200' },
  ];

  const eligibleStudents = studentsList.filter((student) => student.starRating >= 3);

  useEffect(() => {
    if (!certificateDraft.studentId && eligibleStudents.length > 0) {
      setCertificateDraft((prev) => ({ ...prev, studentId: eligibleStudents[0].id }));
    }
  }, [eligibleStudents, certificateDraft.studentId]);

  const handleIssueCertificate = () => {
    if (!certificateDraft.studentId) {
      addToast('Validation Error', 'error', 'Select an eligible student to issue a certificate.');
      return;
    }

    if (!certificateDraft.title.trim()) {
      addToast('Validation Error', 'error', 'Certification title is required.');
      return;
    }

    const student = studentsList.find((entry) => entry.id === certificateDraft.studentId);
    if (!student) {
      addToast('Student Not Found', 'error', 'Unable to find the selected student profile.');
      return;
    }

    const title = certificateDraft.title.trim();
    const certificateId = `cert-${Date.now()}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skillforge-certificate';
    const newCredential = {
      id: certificateId,
      title,
      issueDate: certificateDraft.issueDate,
      credentialUrl: `/credentials/${student.rollNumber}-${slug}`,
    };

    setStudentsList((prev) => prev.map((entry) =>
      entry.id === student.id
        ? { ...entry, certificates: [newCredential, ...entry.certificates] }
        : entry
    ));

    addToast('Certificate Issued Successfully', 'success', `Verified credential issued to ${student.fullName}.`);
    setCertificateDraft((prev) => ({
      ...prev,
      title: '',
      issueDate: new Date().toISOString().slice(0, 10),
    }));
  };

  const handleRemoveCertificate = (studentId: string, certificateId: string, title: string) => {
    setStudentsList((prev) => prev.map((entry) =>
      entry.id === studentId
        ? { ...entry, certificates: entry.certificates.filter((cert) => cert.id !== certificateId) }
        : entry
    ));

    addToast('Certificate Removed', 'warning', `Removed credential: ${title}.`);
  };

  // 1. Actions: Student Manager
  const handleEditStudentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const updated = await adminApi.updateStudent(editingStudent.id, editingStudent);
      setStudentsList(prev => prev.map(s => s.id === updated.id ? updated : s));
      addToast('Student Updated', 'success', `Saved configuration changes for ${updated.fullName}.`);
      setEditingStudent(null);
    } catch (err) {
      addToast('Update Failed', 'error', err instanceof ApiError ? err.message : 'Could not save changes.');
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove student ${name} from the SkillForge platform database?`)) {
      try {
        await adminApi.deleteStudent(id);
        setStudentsList(prev => prev.filter(s => s.id !== id));
        addToast('Student Removed', 'warning', `${name} is deleted from college rosters.`);
      } catch (err) {
        addToast('Delete Failed', 'error', err instanceof ApiError ? err.message : 'Could not delete student.');
      }
    }
  };

  // 2. Actions: Problem Manager
  const resetProblemForm = () => setProblemForm({
    id: undefined, title: '', difficulty: 'Easy', category: 'Algorithms', statement: '', inputFormat: '', outputFormat: '', constraints: '',
    publicInput: '', publicOutput: '', hiddenInput: '', hiddenOutput: ''
  });

  const handleBulkImport = async () => {
    let parsed: any[];
    try {
      parsed = JSON.parse(bulkImportText);
      if (!Array.isArray(parsed)) throw new Error('Top-level JSON must be an array.');
    } catch (err) {
      addToast('Invalid JSON', 'error', err instanceof Error ? err.message : 'Could not parse the pasted JSON.');
      return;
    }
    setIsBulkImporting(true);
    setBulkImportResult(null);
    try {
      const result = await problemsApi.bulkImport(parsed);
      setBulkImportResult(result);
      addToast(
        result.failed === 0 ? 'Import Complete' : 'Import Finished With Errors',
        result.failed === 0 ? 'success' : 'warning',
        `${result.succeeded}/${result.total} problems imported.`
      );
      if (result.succeeded > 0) reloadProblems();
    } catch (err) {
      addToast('Import Failed', 'error', err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setIsBulkImporting(false);
    }
  };

  const handleBulkImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkImportText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleEditProblemClick = async (prob: CodingProblem) => {
    try {
      const full = await problemsApi.get(prob.id);
      const publicCase = full.testCases.find(tc => tc.isPublic);
      const hiddenCase = full.testCases.find(tc => !tc.isPublic);
      setProblemForm({
        id: full.id,
        title: full.title,
        difficulty: full.difficulty,
        category: full.category,
        statement: full.statement,
        inputFormat: full.inputFormat,
        outputFormat: full.outputFormat,
        constraints: full.constraints,
        publicInput: publicCase?.input || '',
        publicOutput: publicCase?.expectedOutput || '',
        hiddenInput: hiddenCase?.input || '',
        hiddenOutput: hiddenCase?.expectedOutput || '',
      });
      setCreatingProblem(true);
    } catch (err) {
      addToast('Failed to Load Problem', 'error', err instanceof ApiError ? err.message : 'Could not load problem details.');
    }
  };

  const handleCreateProblemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemForm.title || !problemForm.statement) {
      addToast('Validation Error', 'error', 'Problem Title and Statement are required.');
      return;
    }

    const payload = {
      title: problemForm.title,
      difficulty: problemForm.difficulty,
      category: problemForm.category,
      statement: problemForm.statement,
      inputFormat: problemForm.inputFormat,
      outputFormat: problemForm.outputFormat,
      constraints: problemForm.constraints || 'None',
      examples: [
        { input: problemForm.publicInput, output: problemForm.publicOutput, explanation: 'Example execution' }
      ],
      starterTemplates: {
        'Python': 'def solve():\n    # Write your logic here\n    pass',
        'C++': '#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}',
        'Java': 'public class Solution {\n    public static void main(String[] args) {}\n}',
        'C': '#include <stdio.h>\nint main() { return 0; }'
      },
      testCases: [
        { id: '', input: problemForm.publicInput, expectedOutput: problemForm.publicOutput, isPublic: true },
        { id: '', input: problemForm.hiddenInput, expectedOutput: problemForm.hiddenOutput, isPublic: false }
      ],
    };

    try {
      if (problemForm.id) {
        const updated = await problemsApi.update(problemForm.id, payload);
        setProblemsList(prev => prev.map(p => p.id === updated.id ? updated : p));
        addToast('Problem Updated', 'success', `"${updated.title}" has been saved.`);
      } else {
        const newProblem = await problemsApi.create(payload);
        setProblemsList(prev => [newProblem, ...prev]);
        addToast('New Problem Created', 'success', `"${newProblem.title}" has been successfully appended to the Problem Bank.`);
      }
      setCreatingProblem(false);
      resetProblemForm();
    } catch (err) {
      addToast(problemForm.id ? 'Update Failed' : 'Creation Failed', 'error', err instanceof ApiError ? err.message : 'Could not save problem.');
    }
  };

  const handleDeleteProblem = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete coding problem: "${title}"?`)) {
      try {
        await problemsApi.remove(id);
        setProblemsList(prev => prev.filter(p => p.id !== id));
        addToast('Problem Deleted', 'warning', `"${title}" has been removed.`);
      } catch (err) {
        addToast('Delete Failed', 'error', err instanceof ApiError ? err.message : 'Could not delete problem.');
      }
    }
  };

  // 3. Actions: Quiz Manager (Zod Validated Save submission)
  const mapFormValuesToQuiz = (values: QuizFormValues) => {
    return {
      id: values.id,
      title: values.title,
      description: values.description,
      durationMinutes: values.durationMinutes,
      status: values.status,
      questions: values.questions.map(q => {
        const question: any = {
          id: q.id,
          questionText: q.questionText,
          type: q.type,
          points: q.points,
          difficulty: q.difficulty
        };

        if (q.type === 'multiple-choice') {
          question.options = q.options;
          question.correctOption = q.correctOption;
        } else if (q.type === 'coding') {
          question.codingProblemId = q.codingProblemId;
        }

        return question;
      })
    };
  };

  const onQuizFormSubmit = async (values: QuizFormValues) => {
    const payload = mapFormValuesToQuiz(values);

    try {
      if (isQuizEditMode) {
        const updated = await quizzesApi.update(payload.id, payload);
        setQuizzesList(prev => prev.map(q => q.id === updated.id ? updated : q));
        addToast('Quiz Saved', 'success', `Successfully updated timed quiz "${updated.title}".`);
      } else {
        const created = await quizzesApi.create(payload);
        setQuizzesList(prev => [created, ...prev]);
        addToast('Quiz Created', 'success', `Successfully scheduled timed quiz "${created.title}".`);
      }
      setIsQuizFormActive(false);
      setIsQuizEditMode(false);
    } catch (err) {
      addToast('Save Failed', 'error', err instanceof ApiError ? err.message : 'Could not save quiz.');
    }
  };

  const handleEditQuizClick = async (quiz: Quiz) => {
    setIsQuizEditMode(true);
    setIsQuizFormActive(true);

    try {
      const fullQuiz = await quizzesApi.get(quiz.id);
      const mappedQuestions = fullQuiz.questions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        type: q.type,
        difficulty: q.difficulty || 'Easy',
        points: q.points,
        options: q.options || ['', '', '', ''],
        correctOption: q.correctOption || 0,
        codingProblemId: q.codingProblem?.id || ''
      }));

      reset({
        id: fullQuiz.id,
        title: fullQuiz.title,
        description: fullQuiz.description,
        durationMinutes: fullQuiz.durationMinutes,
        status: fullQuiz.status,
        questions: mappedQuestions
      });
    } catch (err) {
      addToast('Failed to Load Quiz', 'error', err instanceof ApiError ? err.message : 'Could not load quiz details.');
      setIsQuizFormActive(false);
    }
  };

  const handleCreateQuizClick = () => {
    setIsQuizEditMode(false);
    setIsQuizFormActive(true);
    reset({
      id: `quiz-${Date.now()}`,
      title: '',
      description: '',
      durationMinutes: 60,
      status: 'Upcoming',
      questions: []
    });
  };

  const handleApplyQuestionModalChanges = () => {
    const errsMap: Record<string, string> = {};
    const modalQuestionData = questionModal.data;

    if (!modalQuestionData.questionText || modalQuestionData.questionText.trim().length < 5) {
      errsMap.questionText = 'Question text must be at least 5 characters';
    }

    if (modalQuestionData.type === 'multiple-choice') {
      if (!modalQuestionData.options || modalQuestionData.options.some(o => o.trim() === '')) {
        errsMap.options = 'All four option fields must be filled';
      }
    } else if (modalQuestionData.type === 'coding') {
      if (!modalQuestionData.codingProblemId || modalQuestionData.codingProblemId.trim() === '') {
        errsMap.codingProblemId = 'You must select a coding problem';
      }
    }

    if (Object.keys(errsMap).length > 0) {
      setModalValidationErrors(errsMap);
      return;
    }

    setModalValidationErrors({});

    if (questionModal.index === -1) {
      append(modalQuestionData);
      addToast('Question Appended', 'success', 'Appended new question to quiz form.');
    } else {
      update(questionModal.index, modalQuestionData);
      addToast('Question Updated', 'success', 'Updated question parameters.');
    }

    setQuestionModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleDeleteQuiz = async (id: string, title: string) => {
    if (confirm(`Remove scheduled quiz: "${title}"?`)) {
      try {
        await quizzesApi.remove(id);
        setQuizzesList(prev => prev.filter(q => q.id !== id));
        addToast('Quiz Deleted', 'warning', `"${title}" has been removed.`);
      } catch (err) {
        addToast('Delete Failed', 'error', err instanceof ApiError ? err.message : 'Could not delete quiz.');
      }
    }
  };

  // 4. Actions: Contest Manager
  const resetContestForm = () => setContestForm({ title: '', description: '', startTime: '', endTime: '', problems: [] });

  const handleAddContestProblemRow = () => {
    setContestForm(prev => ({
      ...prev,
      problems: [...prev.problems, { problemId: problemsList[0]?.id || '', label: String.fromCharCode(65 + prev.problems.length), points: 100 }]
    }));
  };

  const handleRemoveContestProblemRow = (idx: number) => {
    setContestForm(prev => ({ ...prev, problems: prev.problems.filter((_, i) => i !== idx) }));
  };

  const handleContestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contestForm.title || !contestForm.startTime || !contestForm.endTime) {
      addToast('Validation Error', 'error', 'Title, start time, and end time are required.');
      return;
    }
    if (contestForm.problems.length === 0) {
      addToast('Validation Error', 'error', 'Add at least one problem to this contest.');
      return;
    }
    try {
      const payload = {
        title: contestForm.title,
        description: contestForm.description,
        startTime: new Date(contestForm.startTime).toISOString(),
        endTime: new Date(contestForm.endTime).toISOString(),
        problems: contestForm.problems,
      };
      if (contestForm.id) {
        const updated = await contestsApi.update(contestForm.id, payload);
        setContestsList(prev => prev.map(c => c.id === updated.id ? updated : c));
        addToast('Contest Updated', 'success', `"${updated.title}" has been saved.`);
      } else {
        const created = await contestsApi.create(payload);
        setContestsList(prev => [created, ...prev]);
        addToast('Contest Created', 'success', `"${created.title}" is now scheduled.`);
      }
      setIsContestFormActive(false);
      resetContestForm();
    } catch (err) {
      addToast('Save Failed', 'error', err instanceof ApiError ? err.message : 'Could not save contest.');
    }
  };

  const handleExtendContest = async (id: string, title: string) => {
    setExtendingContestId(id);
    try {
      const updated = await contestsApi.extend(id, 15);
      setContestsList(prev => prev.map(c => c.id === updated.id ? updated : c));
      addToast('Contest Extended', 'success', `"${title}" now ends 15 minutes later than before.`);
    } catch (err) {
      addToast('Extend Failed', 'error', err instanceof ApiError ? err.message : 'Could not extend contest.');
    } finally {
      setExtendingContestId(null);
    }
  };

  const handleDeleteContest = async (id: string, title: string) => {
    if (confirm(`Delete contest: "${title}"? This also removes its standings.`)) {
      try {
        await contestsApi.remove(id);
        setContestsList(prev => prev.filter(c => c.id !== id));
        addToast('Contest Deleted', 'warning', `"${title}" has been removed.`);
      } catch (err) {
        addToast('Delete Failed', 'error', err instanceof ApiError ? err.message : 'Could not delete contest.');
      }
    }
  };

  // Filters for lists
  const filteredStudentsList = studentsList.filter(s => 
    s.fullName.toLowerCase().includes(studentSearchInput.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(studentSearchInput.toLowerCase())
  );

  const paginatedStudents = filteredStudentsList.slice((studentListPage - 1) * itemsPerPageLimit, studentListPage * itemsPerPageLimit);
  const totalStudentPagesCount = Math.ceil(filteredStudentsList.length / itemsPerPageLimit);

  const filteredProblems = problemsList.filter(p => 
    p.title.toLowerCase().includes(problemSearchInput.toLowerCase()) ||
    p.category.toLowerCase().includes(problemSearchInput.toLowerCase())
  );

  const filteredQuizzes = quizzesList.filter(q => 
    q.title.toLowerCase().includes(quizSearchInput.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-[#0a0a0a] transition-colors">
      
      {/* Dynamic Sidebar navigation */}
      <Sidebar 
        activeTab={activeAdminTab} 
        onTabChange={(tab) => { 
          setActiveAdminTab(tab); 
          setEditingStudent(null); 
          setCreatingProblem(false); 
          setEditingProblem(null); 
          setIsQuizFormActive(false); 
        }} 
        onLogout={() => { logout(); onNavigate('home'); addToast('Admin Logged Out', 'info'); }}
      />

      {/* Main Command Center Slot */}
      <main className="flex-grow p-6 sm:p-8 space-y-8 overflow-y-auto max-w-7xl">
        
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/50 dark:border-zinc-800">
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">SkillForge Admin Command</span>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mt-0.5">
              Welcome back, Administrator
            </h1>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">
            Node status: <span className="text-emerald-500 font-extrabold animate-pulse">● Active</span>
          </div>
        </div>

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeAdminTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statMetricCardsList.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div key={idx} className="p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{stat.label}</span>
                      <span className="block text-3xl font-black text-zinc-900 dark:text-white leading-none">{stat.value}</span>
                    </div>
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center border ${stat.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Real Postgres database size - watch this trend toward your provider's free-tier limit */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-zinc-400">Database Size</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Real size reported by Postgres, not an estimate.</p>
                </div>
                <span className="text-2xl font-black text-zinc-900 dark:text-white">
                  {(adminStats.databaseSizeBytes / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              {(() => {
                const FREE_TIER_MB = 500; // Supabase free tier reference point - see README "Database"
                const usedMb = adminStats.databaseSizeBytes / (1024 * 1024);
                const pct = Math.min(100, (usedMb / FREE_TIER_MB) * 100);
                return (
                  <>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full ${pct > 85 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      {pct.toFixed(1)}% of a {FREE_TIER_MB}MB free-tier reference (e.g. Supabase) - adjust this
                      assumption if you're on a different plan.
                    </p>
                  </>
                );
              })()}
              {adminStats.largestTables.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {adminStats.largestTables.map((t) => (
                    <div key={t.table} className="text-center">
                      <p className="text-[10px] text-zinc-400 uppercase font-bold truncate">{t.table}</p>
                      <p className="text-xs font-extrabold text-zinc-700 dark:text-zinc-200">{(t.bytes / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick logs & compilation monitoring queue */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* System Overview */}
              <div className="lg:col-span-7 bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400">Sandbox System Analytics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-55 dark:bg-[#0a0a0a] border border-zinc-150 dark:border-zinc-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-805 dark:text-zinc-200 leading-tight">Compiler Timeout limit</h4>
                      <p className="text-[10px] text-zinc-400">Current execution sandbox cutoff timer</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{compileTimeoutValue} seconds</span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-55 dark:bg-[#0a0a0a] border border-zinc-150 dark:border-zinc-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-805 dark:text-zinc-200 leading-tight">College Maintenance State</h4>
                      <p className="text-[10px] text-zinc-400">Lock down public access during active test hours</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${isMaintenanceActive ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isMaintenanceActive ? 'Locked' : 'Available'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-55 dark:bg-[#0a0a0a] border border-zinc-150 dark:border-zinc-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-805 dark:text-zinc-200 leading-tight">Guest Sandbox Accounts</h4>
                      <p className="text-[10px] text-zinc-400">Allow evaluation testing without credentials</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{allowUnauthenticatedGuestAccess ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>

              {/* Server activity log */}
              <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400">Live Compilation Logs</h3>
                
                <div className="space-y-3 font-mono text-[10px] leading-relaxed">
                  <div className="p-2.5 rounded bg-zinc-955 border border-zinc-800 text-emerald-400">
                    <span className="text-zinc-550">[06:44:31 UTC]</span> - Rahul Sharma submitted Python on "Two Sum". <span className="font-bold">STATUS: Accepted.</span>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-955 border border-zinc-800 text-emerald-450">
                    <span className="text-zinc-550">[06:40:12 UTC]</span> - Priya Patel submitted C++ on "Valid Palindrome". <span className="font-bold">STATUS: Accepted.</span>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-955 border border-zinc-800 text-amber-400">
                    <span className="text-zinc-550">[06:38:51 UTC]</span> - Vikram Singh submitted Java on "Two Sum". <span className="font-bold">STATUS: TLE.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STUDENTS MANAGEMENT */}
        {activeAdminTab === 'students' && (
          <div className="space-y-6">
            
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search students by roll or name..."
                  value={studentSearchInput}
                  onChange={(e) => { setStudentSearchInput(e.target.value); setStudentListPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <span className="text-xs font-bold text-zinc-400">{filteredStudentsList.length} Students listed</span>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-955 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                      <th className="px-6 py-4">Student Profile</th>
                      <th className="px-6 py-4">Roll Number</th>
                      <th className="px-6 py-4">Level</th>
                      <th className="px-6 py-4">Star Rank</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-105 dark:divide-zinc-800 text-xs">
                    {paginatedStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/25 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-extrabold text-zinc-900 dark:text-white block">{student.fullName}</span>
                            <span className="text-[10px] text-zinc-400">{student.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{student.rollNumber}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-bold text-[10px] text-zinc-650 dark:text-zinc-300">
                            Lvl {student.level}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-0.5">
                            {Array.from({ length: student.starRating }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current text-amber-400" />
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingStudent(student)}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-350 transition-colors"
                              title="Edit Student Roster"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id, student.fullName)}
                              className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 transition-colors"
                              title="Delete Student Profile"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {paginatedStudents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-405">
                          No matching student programmers found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {totalStudentPagesCount > 1 && (
                <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
                  <button
                    disabled={studentListPage === 1}
                    onClick={() => setStudentListPage(studentListPage - 1)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 disabled:opacity-45 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-all"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <span className="text-[10px] text-zinc-405 font-bold">Page {studentListPage} of {totalStudentPagesCount}</span>
                  <button
                    disabled={studentListPage === totalStudentPagesCount}
                    onClick={() => setStudentListPage(studentListPage + 1)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 disabled:opacity-45 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-all"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Editing student modal simulation inline */}
            {editingStudent && (
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-800">
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">Edit Student Profile: {editingStudent.fullName}</h4>
                  <button onClick={() => setEditingStudent(null)} className="text-zinc-400 text-xs font-bold">Cancel</button>
                </div>
                <form onSubmit={handleEditStudentSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-405">Programmer Name</label>
                    <input
                      type="text"
                      value={editingStudent.fullName}
                      onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-850 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-405">Roll Number</label>
                    <input
                      type="text"
                      value={editingStudent.rollNumber}
                      onChange={(e) => setEditingStudent({ ...editingStudent, rollNumber: e.target.value })}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-855 text-xs text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-405">Star Rating (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={editingStudent.starRating}
                      onChange={(e) => setEditingStudent({ ...editingStudent, starRating: Math.min(5, Math.max(1, Number(e.target.value))) })}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-855 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingStudent(null)}
                      className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs rounded-lg text-zinc-600 dark:text-zinc-300 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-bold shadow-sm"
                    >
                      Save Configuration
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}

        {/* TAB 3: PROBLEMS BANK MANAGEMENT */}
        {activeAdminTab === 'problems' && (
          <div className="space-y-6">
            
            {/* Header controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search problems by title, tag..."
                  value={problemSearchInput}
                  onChange={(e) => setProblemSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => { if (creatingProblem) { resetProblemForm(); } setCreatingProblem(!creatingProblem); }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer border-none"
              >
                <Plus className="h-4 w-4" />
                <span>Create Coding Problem</span>
              </button>
              <button
                onClick={() => setIsBulkImportOpen(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Bulk Import (JSON)</span>
              </button>
            </div>

            {isBulkImportOpen && (
              <div className="p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm">Bulk Import Problems</h4>
                  <button onClick={() => { setIsBulkImportOpen(false); setBulkImportResult(null); }} className="text-zinc-400 text-xs font-bold">Close</button>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Paste a JSON array of problems (same shape as the single-create form: title, difficulty,
                  category, statement, inputFormat, outputFormat, constraints, examples, starterTemplates,
                  testCases). Each entry needs a title, statement, and at least one public test case.
                </p>
                <textarea
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  placeholder='[{"title": "...", "difficulty": "Easy", "statement": "...", "testCases": [{"input": "...", "expectedOutput": "...", "isPublic": true}]}]'
                  rows={8}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkImport}
                    disabled={isBulkImporting}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs rounded-xl font-bold shadow-md cursor-pointer border-none"
                  >
                    {isBulkImporting ? 'Importing...' : 'Import'}
                  </button>
                  <label className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-xs rounded-xl font-bold cursor-pointer">
                    Load from file
                    <input type="file" accept=".json" className="hidden" onChange={handleBulkImportFileChange} />
                  </label>
                </div>
                {bulkImportResult && (
                  <div className="text-xs space-y-1.5 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                    <p className="font-extrabold">
                      {bulkImportResult.succeeded}/{bulkImportResult.total} imported successfully
                      {bulkImportResult.failed > 0 && <span className="text-rose-500"> ({bulkImportResult.failed} failed)</span>}
                    </p>
                    {bulkImportResult.results.filter(r => !r.success).map((r) => (
                      <p key={r.index} className="text-rose-500">
                        #{r.index + 1} {r.title ? `"${r.title}"` : ''}: {r.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CREATOR / EDITOR PANEL */}
            {creatingProblem && (
              <form onSubmit={handleCreateProblemSubmit} className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900 shadow-lg space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-800">
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{problemForm.id ? 'Edit Coding Problem' : 'Create New Coding Problem'}</h4>
                  <button type="button" onClick={() => { setCreatingProblem(false); resetProblemForm(); }} className="text-zinc-400 text-xs font-bold">Close</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Problem Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Reverse Integer"
                      value={problemForm.title}
                      onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-105 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Difficulty</label>
                    <select
                      value={problemForm.difficulty}
                      onChange={(e) => setProblemForm({ ...problemForm, difficulty: e.target.value as Difficulty })}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Category Tag</label>
                    <input
                      type="text"
                      placeholder="e.g. Strings, Trees"
                      value={problemForm.category}
                      onChange={(e) => setProblemForm({ ...problemForm, category: e.target.value })}
                      className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Problem Statement</label>
                  <textarea
                    rows={4}
                    placeholder="Write problem details in markdown here..."
                    value={problemForm.statement}
                    onChange={(e) => setProblemForm({ ...problemForm, statement: e.target.value })}
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Input Format</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. First line represents T..."
                      value={problemForm.inputFormat}
                      onChange={(e) => setProblemForm({ ...problemForm, inputFormat: e.target.value })}
                      className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Output Format</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Print space-separated indices"
                      value={problemForm.outputFormat}
                      onChange={(e) => setProblemForm({ ...problemForm, outputFormat: e.target.value })}
                      className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Constraints</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 1 <= N <= 10^5"
                      value={problemForm.constraints}
                      onChange={(e) => setProblemForm({ ...problemForm, constraints: e.target.value })}
                      className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                    />
                  </div>
                </div>

                {/* TEST CASES */}
                <div className="border-t border-zinc-150 dark:border-zinc-800 pt-4 space-y-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Compiler Test Parameters</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Public test */}
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-850 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-505">Public Test Case 1</span>
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="Input (e.g. '3\n1 2 3')"
                          value={problemForm.publicInput}
                          onChange={(e) => setProblemForm({ ...problemForm, publicInput: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Expected Output (e.g. 'true')"
                          value={problemForm.publicOutput}
                          onChange={(e) => setProblemForm({ ...problemForm, publicOutput: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Hidden test */}
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-850 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-505">Hidden Test Case 1</span>
                        <span className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-500 rounded text-[9px] font-bold">Secure Compiler</span>
                      </div>
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="Hidden Input parameters"
                          value={problemForm.hiddenInput}
                          onChange={(e) => setProblemForm({ ...problemForm, hiddenInput: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Expected Output values"
                          value={problemForm.hiddenOutput}
                          onChange={(e) => setProblemForm({ ...problemForm, hiddenOutput: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => { setCreatingProblem(false); resetProblemForm(); }}
                    className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-650 border-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm border-none cursor-pointer"
                  >
                    {problemForm.id ? 'Save Changes' : 'Commit Problem'}
                  </button>
                </div>
              </form>
            )}

            {/* Problems list */}
            <div className="grid grid-cols-1 gap-4">
              {filteredProblems.map((prob) => (
                <div key={prob.id} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{prob.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        prob.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        prob.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-rose-500/10 text-rose-600'
                      }`}>
                        {prob.difficulty}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-500 uppercase">{prob.category}</span>
                    </div>
                    <p className="text-xs text-zinc-405 line-clamp-1 leading-relaxed max-w-2xl">{prob.statement}</p>
                    <p className="text-[10px] text-zinc-400">Includes {(prob as any).testCaseCount ?? prob.testCases?.length ?? 0} total compiler validation parameters.</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditProblemClick(prob)}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-55 text-zinc-500 cursor-pointer"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProblem(prob.id, prob.title)}
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-955/20 text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB 4: Timed QUIZZES PLANNING */}
        {activeAdminTab === 'quizzes' && (
          <div className="space-y-6">
            
            {/* Displaying Quizzes List or showing Quiz Creator/Editor form */}
            {!isQuizFormActive ? (
              <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search quizzes..."
                      value={quizSearchInput}
                      onChange={(e) => setQuizSearchInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleCreateQuizClick}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border-none"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Schedule Timed Quiz</span>
                  </button>
                </div>

                {/* Quizzes List grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                  {filteredQuizzes.map((quiz) => (
                    <div key={quiz.id} className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            quiz.status === 'Live' ? 'bg-rose-500/10 text-rose-600' :
                            quiz.status === 'Upcoming' ? 'bg-zinc-100 text-zinc-550' :
                            'bg-emerald-500/10 text-emerald-600'
                          }`}>
                            {quiz.status}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-bold">{quiz.durationMinutes} Mins</span>
                        </div>

                        <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white leading-snug">{quiz.title}</h4>
                        <p className="text-xs text-zinc-450 leading-normal line-clamp-2">{quiz.description}</p>
                        <p className="text-[10px] text-zinc-400">Includes {(quiz as any).questionCount ?? quiz.questions?.length ?? 0} total integrated tasks.</p>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                        <button
                          onClick={() => handleEditQuizClick(quiz)}
                          className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-[10px] font-bold text-zinc-650 rounded-lg flex items-center gap-1 cursor-pointer border-none"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Edit Quiz</span>
                        </button>
                        <button
                          onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                          className="p-1.5 border border-rose-200 dark:border-rose-900 hover:bg-rose-55 text-rose-500 rounded-lg cursor-pointer bg-transparent"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              
              /* advanced form builder and reorder setup using react hook form */
              <form onSubmit={handleSubmit(onQuizFormSubmit)} className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-205 dark:border-zinc-800 shadow-xl space-y-6 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-850">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-405">Quiz Editor Engine</span>
                    <h4 className="font-extrabold text-sm text-zinc-905 dark:text-white mt-0.5">
                      {isQuizEditMode ? `Modify timed quiz settings` : 'Configure new campus quiz schedule'}
                    </h4>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setIsQuizFormActive(false); setIsQuizEditMode(false); }} 
                    className="px-3 py-1 rounded-lg border text-xs font-bold text-zinc-400 hover:text-zinc-600"
                  >
                    Back to Quizzes
                  </button>
                </div>

                {/* Form general fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-450 uppercase">Quiz Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Algorithmic Speedrun #5"
                      {...register('title')}
                      className="w-full px-3 py-1.5 bg-zinc-55 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                    />
                    {errors.title && (
                      <p className="text-[9px] text-red-500 font-semibold">{errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-450 uppercase">Duration (Minutes)</label>
                    <input
                      type="number"
                      placeholder="e.g. 60"
                      {...register('durationMinutes', { valueAsNumber: true })}
                      className="w-full px-3 py-1.5 bg-zinc-55 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    {errors.durationMinutes && (
                      <p className="text-[9px] text-red-500 font-semibold">{errors.durationMinutes.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-450 uppercase">Status State</label>
                    <select
                      {...register('status')}
                      className="w-full px-3 py-1.5 bg-zinc-55 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Live">Live (Active Now)</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-450 uppercase">Quiz Description</label>
                  <textarea
                    rows={2}
                    placeholder="Provide evaluation coverage parameters..."
                    {...register('description')}
                    className="w-full p-2.5 bg-zinc-55 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  {errors.description && (
                    <p className="text-[9px] text-red-500 font-semibold">{errors.description.message}</p>
                  )}
                </div>

                {/* Sub questions array list */}
                <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Integrated Quiz Questions ({fields.length})</span>
                      <p className="text-[9px] text-zinc-450 mt-0.5">MCQ validation tasks or active compiler problem tasks</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuestionModal({
                        isOpen: true,
                        index: -1,
                        data: {
                          id: `q-${Date.now()}`,
                          questionText: '',
                          type: 'multiple-choice',
                          difficulty: 'Easy',
                          points: 5,
                          options: ['', '', '', ''],
                          correctOption: 0,
                          codingProblemId: ''
                        }
                      })}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer border-none shadow-sm shadow-indigo-600/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Question Task</span>
                    </button>
                  </div>

                  {errors.questions && (
                    <p className="text-xs text-red-500 font-bold p-2 bg-red-500/10 border border-red-500/20 rounded-xl">{errors.questions.message}</p>
                  )}

                  {/* Array loop */}
                  <div className="space-y-3">
                    {fields.map((field, idx) => {
                      return (
                        <div key={field.id} className="p-4 rounded-2xl bg-zinc-55 dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-850 flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-zinc-400">TASK {idx + 1}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${
                                field.type === 'multiple-choice' ? 'bg-blue-500/10 text-blue-550 border border-blue-500/20' : 'bg-purple-500/10 text-purple-550 border border-purple-500/20'
                              }`}>
                                {field.type === 'multiple-choice' ? 'MCQ' : 'Coding'}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-[8px] font-extrabold text-zinc-500 uppercase">{field.difficulty}</span>
                              <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-[8px] font-extrabold text-zinc-500">{field.points} Points</span>
                            </div>
                            <h5 className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 line-clamp-1">{field.questionText}</h5>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Reorder Buttons */}
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => move(idx, idx - 1)}
                              className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 disabled:opacity-40 text-zinc-600 dark:text-zinc-350 cursor-pointer border-none"
                              title="Move Up"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === fields.length - 1}
                              onClick={() => move(idx, idx + 1)}
                              className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 disabled:opacity-40 text-zinc-600 dark:text-zinc-350 cursor-pointer border-none"
                              title="Move Down"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {/* Edit Action */}
                            <button
                              type="button"
                              onClick={() => setQuestionModal({
                                isOpen: true,
                                index: idx,
                                data: {
                                  id: field.id,
                                  questionText: field.questionText,
                                  type: field.type,
                                  difficulty: field.difficulty,
                                  points: field.points,
                                  options: field.options || ['', '', '', ''],
                                  correctOption: field.correctOption || 0,
                                  codingProblemId: field.codingProblemId || ''
                                }
                              })}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                              title="Edit Question Task"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete Action */}
                            <button
                              type="button"
                              onClick={() => remove(idx)}
                              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 cursor-pointer"
                              title="Delete Question"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {fields.length === 0 && (
                      <div className="text-center py-8 border border-dashed rounded-2xl text-zinc-400">
                        No questions compiled inside this quiz. Click "Add Question Task" above.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => { setIsQuizFormActive(false); setIsQuizEditMode(false); }}
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-xs rounded-xl text-zinc-650 font-bold border-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-bold shadow-md cursor-pointer border-none"
                  >
                    Save Timed Quiz
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

        {/* TAB: CONTESTS */}
        {activeAdminTab === 'contests' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400">Coding Contests</h3>
              <button
                onClick={() => { resetContestForm(); setIsContestFormActive(true); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-bold shadow-md"
              >
                + Schedule Contest
              </button>
            </div>

            {!isContestFormActive && (
              <div className="space-y-3">
                {contestsList.map((contest) => (
                  <div key={contest.id} className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold">{contest.title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 font-black uppercase text-zinc-500">{contest.status}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-semibold">{contest.problemCount} problems · {contest.registeredCount} registered · {new Date(contest.startTime).toLocaleString()} → {new Date(contest.endTime).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {contest.status === 'Live' && (
                        <button
                          onClick={() => handleExtendContest(contest.id, contest.title)}
                          disabled={extendingContestId === contest.id}
                          className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs rounded-lg font-bold disabled:opacity-60"
                          title="Quick fix for a live contest running late or interrupted - just pushes the end time back."
                        >
                          {extendingContestId === contest.id ? 'Extending...' : '+15 min'}
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const full = await contestsApi.get(contest.id);
                          setContestForm({
                            id: full.id, title: full.title, description: full.description,
                            startTime: full.startTime.slice(0, 16), endTime: full.endTime.slice(0, 16),
                            problems: (full.problems || []).map(p => ({ problemId: p.problemId, label: p.label, points: p.points })),
                          });
                          setIsContestFormActive(true);
                        }}
                        className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs rounded-lg font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteContest(contest.id, contest.title)}
                        className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs rounded-lg font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {contestsList.length === 0 && (
                  <div className="text-center py-12 text-xs font-bold text-zinc-400">No contests scheduled yet.</div>
                )}
              </div>
            )}

            {isContestFormActive && (
              <form onSubmit={handleContestFormSubmit} className="space-y-4 p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80">
                <div>
                  <label className="text-[11px] font-bold text-zinc-500">Contest Title</label>
                  <input
                    value={contestForm.title}
                    onChange={(e) => setContestForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                    placeholder="e.g. College Coding Championship 2026"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-500">Description</label>
                  <textarea
                    value={contestForm.description}
                    onChange={(e) => setContestForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-500">Start Time</label>
                    <input
                      type="datetime-local"
                      value={contestForm.startTime}
                      onChange={(e) => setContestForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-500">End Time</label>
                    <input
                      type="datetime-local"
                      value={contestForm.endTime}
                      onChange={(e) => setContestForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-zinc-500">Problems (in order)</label>
                    <button type="button" onClick={handleAddContestProblemRow} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">+ Add Problem</button>
                  </div>
                  <div className="space-y-2">
                    {contestForm.problems.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-black w-6">{p.label}</span>
                        <select
                          value={p.problemId}
                          onChange={(e) => setContestForm(prev => ({ ...prev, problems: prev.problems.map((pp, i) => i === idx ? { ...pp, problemId: e.target.value } : pp) }))}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
                        >
                          {problemsList.map(prob => <option key={prob.id} value={prob.id}>{prob.title}</option>)}
                        </select>
                        <input
                          type="number"
                          value={p.points}
                          onChange={(e) => setContestForm(prev => ({ ...prev, problems: prev.problems.map((pp, i) => i === idx ? { ...pp, points: Number(e.target.value) } : pp) }))}
                          className="w-20 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
                        />
                        <button type="button" onClick={() => handleRemoveContestProblemRow(idx)} className="text-rose-500 text-xs font-bold px-2">✕</button>
                      </div>
                    ))}
                    {contestForm.problems.length === 0 && (
                      <p className="text-[11px] text-zinc-400">No problems added yet.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button type="button" onClick={() => { setIsContestFormActive(false); resetContestForm(); }} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-xs rounded-xl text-zinc-650 font-bold border-none">
                    Cancel
                  </button>
                  <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-bold shadow-md border-none">
                    {contestForm.id ? 'Save Contest' : 'Create Contest'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 5: LEADERBOARD OVERVIEW */}
        {activeAdminTab === 'leaderboard' && (
          <div className="space-y-6">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400">Competitive Standings Preview</h3>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-955 text-[10px] font-bold text-zinc-500 uppercase border-b border-zinc-150">
                    <th className="px-6 py-4">Global Rank</th>
                    <th className="px-6 py-4">Student Programmer</th>
                    <th className="px-6 py-4">Roll Number</th>
                    <th className="px-6 py-4">Problems Solved</th>
                    <th className="px-6 py-4">Streak</th>
                    <th className="px-6 py-4 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {leaderboardEntries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/30 transition-colors">
                      <td className="px-6 py-4 font-black">#{entry.rank}</td>
                      <td className="px-6 py-4 font-bold">{entry.fullName}</td>
                      <td className="px-6 py-4 font-mono">{entry.rollNumber}</td>
                      <td className="px-6 py-4 font-semibold">{entry.solvedCount}</td>
                      <td className="px-6 py-4 text-amber-500 font-bold">🔥 {entry.streak} Days</td>
                      <td className="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-400">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: CERTIFICATES ISSUANCE */}
        {activeAdminTab === 'certificates' && (
          <div className="space-y-6">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400">Issue Academic Standing Certificates</h3>
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 space-y-5">
              <p className="text-xs text-zinc-500">Approve standalone academic credentials for students with 3-Star standing or above.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Choose Eligible Student</label>
                  <select
                    value={certificateDraft.studentId}
                    onChange={(e) => setCertificateDraft((prev) => ({ ...prev, studentId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="">Select student</option>
                    {eligibleStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName} ({student.rollNumber}) - {student.starRating} Stars
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Standing Title</label>
                  <input
                    type="text"
                    value={certificateDraft.title}
                    onChange={(e) => setCertificateDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Master Coder"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                  />
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Issue Date</label>
                  <input
                    type="date"
                    value={certificateDraft.issueDate}
                    onChange={(e) => setCertificateDraft((prev) => ({ ...prev, issueDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleIssueCertificate}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm border-none cursor-pointer"
                >
                  Sign and Issue Credential
                </button>
                <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                  {eligibleStudents.length} eligible students
                </span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-zinc-400">Issued Credentials</h4>

              {eligibleStudents.length === 0 ? (
                <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-6 text-center text-xs text-zinc-400">
                  No students currently qualify for a certificate.
                </div>
              ) : (
                <div className="space-y-3">
                  {eligibleStudents.map((student) => (
                    <div key={student.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="font-extrabold text-xs text-zinc-900 dark:text-white">{student.fullName}</p>
                          <p className="text-[10px] text-zinc-500">{student.rollNumber} • {student.starRating} Stars</p>
                        </div>
                        <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold px-2 py-1 uppercase">
                          {student.certificates.length} issued
                        </span>
                      </div>

                      {student.certificates.length === 0 ? (
                        <p className="text-[10px] text-zinc-400">No credentials issued yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {student.certificates.map((cert) => (
                            <div key={cert.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2">
                              <div>
                                <p className="font-bold text-[11px] text-zinc-900 dark:text-white">{cert.title}</p>
                                <p className="text-[10px] text-zinc-500">Issued {new Date(cert.issueDate).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <a
                                  href={cert.credentialUrl}
                                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => handleRemoveCertificate(student.id, cert.id, cert.title)}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-500"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: PLATFORM SETTINGS */}
        {activeAdminTab === 'settings' && (
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-6">
            <div className="space-y-1 pb-2 border-b">
              <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400">Forge Sandbox Environment Settings</h3>
              <p className="text-[11px] text-zinc-500">Fine-tune evaluation sandbox behavior for active compiles</p>
            </div>

            <div className="space-y-4 max-w-xl">
              {/* Timeout limit */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Compiler Timeout Limit (Seconds)</span>
                  <span className="font-mono text-indigo-600 font-bold">{compileTimeoutValue}s</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="10.0"
                  step="0.5"
                  value={compileTimeoutValue}
                  onChange={(e) => setCompileTimeoutValue(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Maintenance state */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border text-xs">
                <div>
                  <span className="block font-bold">Maintenance state</span>
                  <span className="text-[10px] text-zinc-400">Toggle lock status for timed evaluations</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsMaintenanceActive(!isMaintenanceActive); addToast(isMaintenanceActive ? 'Maintenance inactive' : 'Platform Locked', 'warning'); }}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border-none cursor-pointer ${
                    isMaintenanceActive ? 'bg-amber-500 text-white' : 'bg-zinc-200 text-zinc-650'
                  }`}
                >
                  {isMaintenanceActive ? 'Locked' : 'Available'}
                </button>
              </div>

              {/* Allow guest solves */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-955 border text-xs">
                <div>
                  <span className="block font-bold">Allow Guest solves</span>
                  <span className="text-[10px] text-zinc-400">Let unauthenticated roles browse compiler solutions</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setAllowUnauthenticatedGuestAccess(!allowUnauthenticatedGuestAccess); addToast(allowUnauthenticatedGuestAccess ? 'Guest Solves disabled' : 'Guest Solves enabled', 'info'); }}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border-none cursor-pointer ${
                    allowUnauthenticatedGuestAccess ? 'bg-indigo-600 text-white' : 'bg-zinc-200 text-zinc-650'
                  }`}
                >
                  {allowUnauthenticatedGuestAccess ? 'Allowed' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: PROFILE */}
        {activeAdminTab === 'profile' && (
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 space-y-4 max-w-md">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400">Admin Account Profile</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-zinc-55 border">
                <span className="text-[10px] text-zinc-400 block font-bold uppercase">Admin Designation</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">Department Evaluation Coordinator</span>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-55 border">
                <span className="text-[10px] text-zinc-400 block font-bold uppercase">Assigned Email</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">admin@college.edu</span>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-55 border">
                <span className="text-[10px] text-zinc-400 block font-bold uppercase">Platform Version</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">SkillForge Code Core v1.2.0</span>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Advanced Question Editor Modal Dialog */}
      {questionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-850">
              <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                {questionModal.index === -1 ? 'Add New Question Task' : `Edit Question Task #${questionModal.index + 1}`}
              </h4>
              <button
                type="button"
                onClick={() => setQuestionModal(prev => ({ ...prev, isOpen: false }))}
                className="text-zinc-450 text-xs font-bold hover:text-zinc-650 bg-transparent border-none cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {/* Question Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-450 uppercase">Question Type</label>
                <select
                  value={questionModal.data.type}
                  onChange={(e) => setQuestionModal(prev => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      type: e.target.value as any,
                      options: e.target.value === 'multiple-choice' ? ['', '', '', ''] : undefined,
                      correctOption: e.target.value === 'multiple-choice' ? 0 : undefined,
                      codingProblemId: e.target.value === 'coding' ? problemsList[0]?.id : undefined
                    }
                  }))}
                  className="w-full px-3 py-1.5 bg-zinc-55 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-100"
                >
                  <option value="multiple-choice">Multiple Choice (MCQ)</option>
                  <option value="coding">Coding Problem Task</option>
                </select>
              </div>

              {/* Question Text */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-450 uppercase">Question Text / Statement</label>
                <textarea
                  rows={2}
                  value={questionModal.data.questionText}
                  onChange={(e) => setQuestionModal(prev => ({
                    ...prev,
                    data: { ...prev.data, questionText: e.target.value }
                  }))}
                  placeholder="Enter the question query details here..."
                  className="w-full p-2.5 bg-zinc-55 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                {modalValidationErrors.questionText && (
                  <p className="text-[9px] text-red-500 font-semibold">{modalValidationErrors.questionText}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Difficulty */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-450 uppercase">Difficulty</label>
                  <select
                    value={questionModal.data.difficulty}
                    onChange={(e) => setQuestionModal(prev => ({
                      ...prev,
                      data: { ...prev.data, difficulty: e.target.value as any }
                    }))}
                    className="w-full px-3 py-1.5 bg-zinc-55 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-105"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                {/* Points */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-450 uppercase">Points (Marks)</label>
                  <input
                    type="number"
                    min={1}
                    value={questionModal.data.points}
                    onChange={(e) => setQuestionModal(prev => ({
                      ...prev,
                      data: { ...prev.data, points: Math.max(1, Number(e.target.value)) }
                    }))}
                    className="w-full px-3 py-1.5 bg-zinc-55 dark:bg-zinc-955 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* MCQ specific options */}
              {questionModal.data.type === 'multiple-choice' && (
                <div className="space-y-3 pt-2 border-t">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-450">Multiple Choice Options</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, oIdx) => (
                      <div key={oIdx} className="space-y-1">
                        <input
                          type="text"
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                          value={questionModal.data.options?.[oIdx] || ''}
                          onChange={(e) => {
                            const newOpts = [...(questionModal.data.options || ['', '', '', ''])];
                            newOpts[oIdx] = e.target.value;
                            setQuestionModal(prev => ({
                              ...prev,
                              data: { ...prev.data, options: newOpts }
                            }));
                          }}
                          className="w-full px-3 py-1.5 bg-zinc-55 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  {modalValidationErrors.options && (
                    <p className="text-[9px] text-red-500 font-semibold">{modalValidationErrors.options}</p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] font-bold text-zinc-450 uppercase">Correct option index:</span>
                    <select
                      value={questionModal.data.correctOption}
                      onChange={(e) => setQuestionModal(prev => ({
                        ...prev,
                        data: { ...prev.data, correctOption: Number(e.target.value) }
                      }))}
                      className="px-2 py-1 border rounded text-xs bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                    >
                      <option value={0}>Option A</option>
                      <option value={1}>Option B</option>
                      <option value={2}>Option C</option>
                      <option value={3}>Option D</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Coding specific link */}
              {questionModal.data.type === 'coding' && (
                <div className="space-y-3 pt-2 border-t">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-450">Link Coding Problem</span>
                  <select
                    value={questionModal.data.codingProblemId}
                    onChange={(e) => setQuestionModal(prev => ({
                      ...prev,
                      data: { ...prev.data, codingProblemId: e.target.value }
                    }))}
                    className="w-full px-3 py-1.5 bg-zinc-55 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-805 dark:text-zinc-105 rounded-lg outline-none"
                  >
                    <option value="">-- Select Coding Problem --</option>
                    {problemsList.map(p => (
                      <option key={p.id} value={p.id}>{p.title} ({p.difficulty})</option>
                    ))}
                  </select>
                  {modalValidationErrors.codingProblemId && (
                    <p className="text-[9px] text-red-500 font-semibold">{modalValidationErrors.codingProblemId}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setQuestionModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs rounded-lg text-zinc-650 font-bold border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyQuestionModalChanges}
                className="px-5 py-1.5 bg-indigo-650 hover:bg-indigo-755 text-white text-xs rounded-lg font-extrabold shadow-sm border-none cursor-pointer"
              >
                Apply Question Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
