/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

// Points required for 1★ through 5★ star ratings. Must match STAR_THRESHOLDS in server/index.ts -
// points come from solving problems (10/25/50 for Easy/Medium/Hard).
export const STAR_THRESHOLDS = [0, 50, 150, 350, 700];

export type ProgrammingLanguage = 'C' | 'C++' | 'Java' | 'Python';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
}

export interface CodingProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  category: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  starterTemplates: Record<ProgrammingLanguage, string>;
  testCases: TestCase[];
  solvedCount: number;
  acceptanceRate: number; // percentage
  status?: 'Unsolved' | 'Attempted' | 'Solved';
}

export interface Student {
  id: string;
  fullName: string;
  rollNumber: string;
  email: string;
  starRating: number; // 1 to 5
  level: number;
  rank: number;
  problemsSolved: {
    easy: number;
    medium: number;
    hard: number;
  };
  streak: number; // in days
  points: number;
  certificates: {
    id: string;
    title: string;
    issueDate: string;
    credentialUrl: string;
  }[];
  badges: {
    id: string;
    name: string;
    icon: string;
    description: string;
    unlockedAt: string;
  }[];
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  type: 'multiple-choice' | 'coding';
  options?: string[]; // for MCQs
  correctOption?: number; // 0-indexed index of correct MCQ option
  codingProblem?: CodingProblem; // for coding questions in quiz
  points: number;
  difficulty?: Difficulty;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  startTime: string; // ISO format or string
  endTime: string;
  durationMinutes: number;
  status: 'Upcoming' | 'Live' | 'Completed';
  participantsCount: number;
  /** Only present when fetched via quizzesApi.get(id) (full detail). List endpoints only return questionCount. */
  questions?: QuizQuestion[];
  questionCount?: number;
}

export interface Submission {
  id: string;
  problemId: string;
  problemTitle: string;
  language: ProgrammingLanguage;
  code: string;
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compilation Error';
  submittedAt: string;
  executionTimeMs: number;
  memoryKb: number;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  fullName: string;
  rollNumber: string;
  solvedCount: number;
  points: number;
  streak: number;
  starRating: number;
}

export interface ContestProblemRef {
  problemId: string;
  label: string;
  points: number;
  title: string;
  difficulty: Difficulty;
  status: 'Solved' | 'Attempted' | 'Unsolved';
  category?: string;
  statement?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  examples?: { input: string; output: string; explanation?: string }[];
  starterTemplates?: Record<string, string>;
  testCases?: TestCase[];
}

export interface Contest {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: 'Upcoming' | 'Live' | 'Ended';
  problemCount: number;
  registeredCount: number;
  isRegistered: boolean;
  problems?: ContestProblemRef[];
}

export interface ContestStandingEntry {
  rank: number;
  userId: string;
  fullName: string;
  rollNumber: string;
  solvedCount: number;
  totalPoints: number;
  totalPenaltyMinutes: number;
  perProblem: Record<string, { solved: boolean; attempts: number; points: number; penaltyMinutes: number }>;
}
