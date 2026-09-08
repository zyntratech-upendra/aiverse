export interface QuizOption {
  id: string; // e.g. "opt_a", "opt_b"
  text: string;
}

export interface QuizQuestion {
  id: string; // deterministic or uuid
  questionNumber: number;
  text: string;
  codeSnippet?: string;
  codeLanguage?: string;
  imageUrl?: string;
  options: QuizOption[];
  correctOptionId?: string; // Hidden from client payload in strict mode or evaluated post-exam
  points?: number;
  explanation?: string;
  category?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  eventId?: string;
  eventTitle?: string;
  track?: string;
  durationMinutes: number;
  totalMarks: number;
  pointsPerQuestion?: number;
  passingMarks?: number;
  instructions: string[];
  status: "draft" | "scheduled" | "active" | "completed" | "archived";
  scheduledStartTime?: number; // timestamp in ms
  scheduledEndTime?: number; // timestamp in ms
  questionsCount: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  questions?: QuizQuestion[]; // embedded question set for immutable batch loading
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface QuizViolationLog {
  type: "fullscreen_exit" | "tab_switch" | "copy_attempt" | "paste_attempt" | "right_click" | "dev_tools" | "shortcut_attempt";
  message: string;
  timestamp: number;
}

export interface QuizSession {
  id: string; // deterministic format: `${quizId}_${userId}`
  quizId: string;
  quizTitle: string;
  userId: string;
  userEmail: string;
  userName: string;
  teamId?: string;
  teamName?: string;
  startTime: number; // authoritative server start timestamp
  endTime: number; // authoritative server deadline timestamp
  durationMinutes: number;
  status: "in_progress" | "submitted" | "expired";
  lastAutosavedAt: number;
  submittedAt?: number;
  ipAddress?: string;
  userAgent?: string;
  violationsCount?: number;
  violationLogs?: QuizViolationLog[];
  createdAt: number;
  updatedAt: number;
}

export interface QuizDraftAnswers {
  sessionId: string;
  quizId: string;
  userId: string;
  answers: Record<string, string>; // questionId -> selectedOptionId
  flaggedQuestions: string[]; // array of flagged question IDs
  currentQuestionIndex: number;
  violationsCount?: number;
  violationLogs?: QuizViolationLog[];
  lastAutosavedAt: number;
  clientTimestamp: number;
}

export interface QuizSubmission {
  id: string; // typically matches sessionId
  sessionId: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  userEmail: string;
  userName: string;
  teamId?: string;
  teamName?: string;
  answers: Record<string, string>; // questionId -> selectedOptionId
  answeredCount: number;
  unansweredCount: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  startTime: number;
  submittedAt: number;
  isAutoSubmitted: boolean;
  isFinal: boolean;
  violationsCount?: number;
  violationLogs?: QuizViolationLog[];
  score?: number;
  maxScore?: number;
  percentage?: number;
  correctCount?: number;
  incorrectCount?: number;
  passed?: boolean;
  evaluatedAt?: number;
}

export type AutosaveStatus = "saved" | "saving" | "retrying" | "offline" | "error";
