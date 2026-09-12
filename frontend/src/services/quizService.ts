import * as api from "./apiClient";
import type { 
  Quiz, 
  QuizSession, 
  QuizDraftAnswers, 
  QuizSubmission 
} from "../types/quiz";
import { quizMonitor } from "../utils/quizMonitor";
import { retryWithBackoff } from "../utils/networkStatus";
import { quizLoadBalancer } from "../utils/quizLoadBalancer";
import { dataCache } from "../utils/dataCache";


// ─── In-Memory Cache ─────────────────────────────────────────────────────────

const quizMemoryCache = new Map<string, { data: Quiz; cachedAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Request Deduplication ───────────────────────────────────────────────────
// Prevents multiple concurrent fetches for the same quiz ID
const inflightRequests = new Map<string, Promise<Quiz | null>>();

/**
 * Fetch quiz with in-memory caching AND request deduplication.
 * If two components call getQuizById("abc") concurrently, only one Firestore read fires.
 */
export async function getQuizById(quizId: string, forceRefresh = false): Promise<Quiz | null> {
  const cleanId = quizId.trim();
  if (!cleanId) return null;

  // 1. Check in-memory cache
  if (!forceRefresh) {
    const cached = quizMemoryCache.get(cleanId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 2. Check SessionStorage cache
  if (!forceRefresh && typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(`quiz_cache_${cleanId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.data && Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
          quizMemoryCache.set(cleanId, parsed);
          return parsed.data;
        }
      }
    } catch {
      // sessionStorage unavailable or parse failed
    }
  }

  // 3. Deduplicate in-flight requests
  const existing = inflightRequests.get(cleanId);
  if (existing) {
    return existing;
  }

  const fetchPromise = fetchQuizFromApi(cleanId);
  inflightRequests.set(cleanId, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inflightRequests.delete(cleanId);
  }
}

async function fetchQuizFromApi(cleanId: string): Promise<Quiz | null> {
  try {
    const raw = await api.fetchQuiz(cleanId);
    const quiz: Quiz = {
      id: raw.id || cleanId,
      title: raw.title || "AI Verse Quiz",
      description: raw.description || "",
      eventId: raw.eventId || "",
      eventTitle: raw.eventTitle || "",
      track: raw.track || "General",
      durationMinutes: Number(raw.durationMinutes) || 30,
      totalMarks: Number(raw.totalMarks) || (raw.questions?.length ? raw.questions.length * 2 : 50),
      passingMarks: Number(raw.passingMarks) || 20,
      instructions: Array.isArray(raw.instructions) && raw.instructions.length > 0 ? raw.instructions : [
        "Each question has 4 options with single correct answer.",
        "Your answers are automatically saved periodically in the background.",
        "You can navigate freely between questions using the Question Palette.",
        "Once submitted or when the timer expires, no further modifications are allowed.",
        "Do not close or switch browser tabs to ensure an uninterrupted session."
      ],
      status: raw.status || "active",
      scheduledStartTime: raw.scheduledStartTime || 0,
      scheduledEndTime: raw.scheduledEndTime || 0,
      questionsCount: Number(raw.questionsCount) || (raw.questions?.length || 0),
      shuffleQuestions: !!raw.shuffleQuestions,
      shuffleOptions: !!raw.shuffleOptions,
      questions: raw.questions || [],
      createdAt: raw.createdAt || Date.now(),
      updatedAt: raw.updatedAt || Date.now(),
      createdBy: raw.createdBy || "",
      resultsPublished: Boolean(raw.resultsPublished),
      overriddenScores: raw.overriddenScores
    };

    // Cache locally
    const cacheEntry = { data: quiz, cachedAt: Date.now() };
    quizMemoryCache.set(cleanId, cacheEntry);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(`quiz_cache_${cleanId}`, JSON.stringify(cacheEntry));
      } catch {
        // quota exceeded or private mode
      }
    }

    quizMonitor.trackSuccess("load_failure");
    return quiz;
  } catch (err) {
    quizMonitor.trackError("load_failure", `Error fetching quiz ${cleanId}`, { error: String(err) });
    throw err;
  }
}

/**
 * Fetch all available quizzes for participants or faculty (0ms Stale-While-Revalidate)
 */
export async function getAllQuizzes(): Promise<Quiz[]> {
  const cached = dataCache.get<Quiz[]>("all_quizzes");
  if (cached && cached.length > 0) {
    // Background refresh without blocking UI
    api.fetchAllQuizzes().then((freshQuizzes: Quiz[]) => {
      dataCache.set("all_quizzes", freshQuizzes, 60_000);
    }).catch(() => {});
    return cached;
  }

  try {
    const quizzes = await api.fetchAllQuizzes();
    dataCache.set("all_quizzes", quizzes, 60_000);
    return quizzes;
  } catch (err) {
    quizMonitor.trackError("load_failure", "Error fetching quizzes list", { error: String(err) });
    return [];
  }
}

/**
 * Deterministic Session ID generation
 * Guaranteed 1 session per user per quiz, preventing multi-tab duplication
 */
export function getDeterministicSessionId(quizId: string, userId: string): string {
  return `${quizId.trim()}_${userId.trim()}`;
}

/**
 * Initialize or restore authoritative Quiz Session
 */
export async function getOrCreateQuizSession(
  quiz: Quiz, 
  _user: { uid: string; email?: string | null; displayName?: string | null; name?: string | null },
  team?: { id?: string; name?: string }
): Promise<QuizSession> {
  // Use backend API to create or restore authoritative session
  try {
    const session = await api.createSession(quiz.id, team);
    return session as QuizSession;
  } catch (err) {
    quizMonitor.trackError("api_error", "Error initializing quiz session via API", { error: String(err) });
    throw err;
  }
}

/**
 * Reset a single participant's session and submission, allowing them to retake the quiz cleanly
 */
export async function resetParticipantQuizSession(quizId: string, userId: string): Promise<void> {
  const sessionId = getDeterministicSessionId(quizId, userId);
  try {
    await api.resetParticipant(quizId, userId);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`quiz_draft_${sessionId}`);
    }
  } catch (err) {
    quizMonitor.trackError("api_error", `Error resetting session for ${sessionId}`, { error: String(err) });
    throw err;
  }
}

/**
 * Reset all submissions and sessions for a quiz
 */
export async function resetAllQuizSubmissions(quizId: string): Promise<void> {
  try {
    await api.resetAllQuizzes(quizId);
  } catch (err) {
    quizMonitor.trackError("api_error", `Error resetting all submissions for quiz ${quizId}`, { error: String(err) });
    throw err;
  }
}

/**
 * Permanently delete a quiz and all its related submissions, sessions, and answers (Cascading Delete)
 */
export async function deleteQuizCascading(quizId: string): Promise<void> {
  try {
    await resetAllQuizSubmissions(quizId);
    await api.deleteQuizById(quizId);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`quiz_cache_${quizId}`);
    }
  } catch (err) {
    quizMonitor.trackError("api_error", `Error deleting quiz ${quizId} cascading`, { error: String(err) });
    throw err;
  }
}

/**
 * Delete all quizzes and associated data for a specific event (Event Cascading Delete)
 */
export async function deleteQuizzesByEventId(eventId: string, eventTitle?: string): Promise<number> {
  if (!eventId && !eventTitle) return 0;
  try {
    const res = await api.deleteQuizzesByEvent(eventId, eventTitle);
    return res.deletedCount || 0;
  } catch (err) {
    quizMonitor.trackError("api_error", `Error deleting quizzes for event ${eventId}`, { error: String(err) });
    return 0;
  }
}

/**
 * Load draft answers for an active session
 */
export async function loadDraftAnswers(sessionId: string): Promise<QuizDraftAnswers | null> {
  try {
    const res = await api.loadDraft(sessionId);
    return res || null;
  } catch (err) {
    quizMonitor.trackError("load_failure", "Warning loading draft answers", { sessionId, error: String(err) });
    return null;
  }
}

/**
 * Idempotent Autosave — Single Firestore Write
 * 
 * OPTIMIZATION: Writes ONLY to `quizAnswers/{sessionId}`.
 * The redundant `quizSessions` timestamp update has been removed to halve
 * write volume (saves ~1,500 writes per autosave cycle at scale).
 */
export async function saveDraftAnswers(
  draft: QuizDraftAnswers, 
  maxRetries = 2
): Promise<boolean> {
  const sessionId = draft.sessionId;
  
  try {
    return await retryWithBackoff(async () => {
      const now = Date.now();
      const payload: QuizDraftAnswers = {
        ...draft,
        lastAutosavedAt: now,
        clientTimestamp: now
      };

      await api.saveDraft(sessionId, payload.answers || payload, payload.clientTimestamp || now);
      quizMonitor.trackSuccess("save_failure");
      return true;
    }, maxRetries, 500);
  } catch (err) {
    quizMonitor.trackError("save_failure", `Autosave failed for session ${sessionId}`, { error: String(err) });
    return false;
  }
}

/**
 * Evaluates participant answers against a Quiz question set
 */
export function evaluateQuizAnswers(
  quiz: Quiz,
  answers: Record<string, string> = {}
): {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  passed: boolean;
} {
  const questions = quiz.questions || [];
  const defaultPts = Number(quiz.pointsPerQuestion) || 2;
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  if (questions.length === 0) {
    const answered = Object.keys(answers).filter(k => !!answers[k]).length;
    const totalQ = quiz.questionsCount || (quiz.totalMarks ? Math.round(quiz.totalMarks / defaultPts) : answered);
    return {
      score: 0,
      maxScore: quiz.totalMarks || (totalQ * defaultPts) || 50,
      percentage: 0,
      correctCount: 0,
      incorrectCount: answered,
      unansweredCount: Math.max(0, totalQ - answered),
      passed: false
    };
  }

  questions.forEach((q) => {
    const qPts = Number(q.points) || defaultPts;
    maxScore += qPts;
    const selected = answers[q.id];
    
    if (selected && selected.trim().length > 0) {
      if (
        q.correctOptionId &&
        selected.trim().toLowerCase() === q.correctOptionId.trim().toLowerCase()
      ) {
        score += qPts;
        correctCount++;
      } else {
        incorrectCount++;
      }
    } else {
      unansweredCount++;
    }
  });

  if (maxScore === 0) {
    maxScore = Number(quiz.totalMarks) || (questions.length * defaultPts) || 50;
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passingMarks = Number(quiz.passingMarks) || (maxScore > 0 ? Math.round(maxScore * 0.4) : 0);
  const passed = score >= passingMarks;

  return {
    score,
    maxScore,
    percentage,
    correctCount,
    incorrectCount,
    unansweredCount,
    passed
  };
}

// ─── Submission Lock ─────────────────────────────────────────────────────────
// Prevents concurrent submission calls from timer-expiry + manual-submit race
let submissionInFlight = new Set<string>();

/**
 * Atomic Final Submission with Double-Submit Prevention Lock, Retry, & Instant Score Evaluation
 */
export async function submitQuizFinal(
  session: QuizSession,
  answers: Record<string, string>,
  totalQuestions: number,
  isAutoSubmitted = false,
  violationsCount = 0,
  violationLogs: import("../types/quiz").QuizViolationLog[] = [],
  providedQuiz?: Quiz | null
): Promise<QuizSubmission> {
  const sessionId = session.id;
  const now = Date.now();

  // Concurrency lock: prevent timer + manual submit race
  if (submissionInFlight.has(sessionId)) {
    // Wait for the existing submission to complete and return its result
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (!submissionInFlight.has(sessionId)) {
          clearInterval(check);
          resolve(undefined);
        }
      }, 200);
      // Safety timeout
      setTimeout(() => { clearInterval(check); resolve(undefined); }, 10000);
    });
    // Fetch the already-created submission from API
    try {
      const existing = await api.fetchSubmission(sessionId);
      if (existing) return existing as QuizSubmission;
    } catch {
      // ignore
    }
  }

  submissionInFlight.add(sessionId);

  try {
    // Fetch quiz if not provided or missing questions to ensure score is calculated
    let targetQuiz = providedQuiz;
    if (!targetQuiz || !targetQuiz.questions || targetQuiz.questions.length === 0) {
      try {
        targetQuiz = await getQuizById(session.quizId);
      } catch {
        // ignore
      }
    }

    // 1. Check if already submitted to prevent duplicates
    try {
      const existing = await api.fetchSubmission(sessionId);
      if (existing) return existing as QuizSubmission;
    } catch {
      // ignore
    }

    const answeredCount = Object.keys(answers).filter(k => !!answers[k]).length;
    const totalQCount = totalQuestions || targetQuiz?.questions?.length || targetQuiz?.questionsCount || answeredCount;
    const unansweredCount = Math.max(0, totalQCount - answeredCount);
    const timeSpentSeconds = Math.max(1, Math.floor((now - session.startTime) / 1000));

    // Compute evaluation score
    let evalResult = {
      score: 0,
      maxScore: targetQuiz?.totalMarks || (totalQCount * 2) || 50,
      percentage: 0,
      correctCount: 0,
      incorrectCount: answeredCount,
      unansweredCount,
      passed: false
    };

    if (targetQuiz) {
      evalResult = evaluateQuizAnswers(targetQuiz, answers);
    }

    const submissionPayload: QuizSubmission = {
      id: sessionId,
      sessionId,
      quizId: session.quizId,
      quizTitle: session.quizTitle,
      userId: session.userId,
      userEmail: session.userEmail,
      userName: session.userName,
      teamId: session.teamId,
      teamName: session.teamName,
      answers,
      answeredCount,
      unansweredCount: evalResult.unansweredCount ?? unansweredCount,
      totalQuestions: totalQCount,
      timeSpentSeconds,
      startTime: session.startTime,
      submittedAt: now,
      isAutoSubmitted,
      isFinal: true,
      violationsCount,
      violationLogs,
      score: evalResult.score,
      maxScore: evalResult.maxScore,
      percentage: evalResult.percentage,
      correctCount: evalResult.correctCount,
      incorrectCount: evalResult.incorrectCount,
      passed: evalResult.passed,
      evaluatedAt: now
    };

    // 1. Instantly stage submission in persistent Outbox & Local Receipt (0ms Zero Data Loss)
    quizLoadBalancer.stageSubmissionInOutbox(sessionId, submissionPayload);

    // 2. Perform atomic batch write with Load Balancer Concurrency Gate & Exponential Jitter
    try {
      await quizLoadBalancer.executeGatedRequest(async () => {
        return await retryWithBackoff(async () => {
          await api.submitFinal(sessionId, submissionPayload.answers, isAutoSubmitted);
        }, 3, 1000);
      }, "high");

      // Clear from outbox once confirmed
      quizLoadBalancer.clearOutbox(sessionId);
    } catch (writeErr) {
      console.warn("[QuizService] Staged submission in local Outbox for resilient background sync:", writeErr);
      // Trigger background sync worker to deliver when connectivity stabilizes
      quizLoadBalancer.flushOutbox();
    }

    // Clear local draft caches
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`quiz_draft_${sessionId}`);
      } catch {
        // ignore
      }
    }

    quizMonitor.trackSuccess("submission_failure");
    return submissionPayload;
  } catch (err) {
    quizMonitor.trackError("submission_failure", `Final submission processed with outbox for ${sessionId}`, { error: String(err) });
    // Check if staged receipt exists
    const localReceipt = quizLoadBalancer.getLocalReceipt(sessionId);
    if (localReceipt) {
      return {
        id: sessionId,
        sessionId,
        quizId: session.quizId,
        quizTitle: session.quizTitle,
        userId: session.userId,
        userEmail: session.userEmail,
        userName: session.userName,
        teamId: session.teamId,
        teamName: session.teamName,
        answers,
        answeredCount: Object.keys(answers).length,
        unansweredCount: 0,
        totalQuestions: totalQuestions || 0,
        timeSpentSeconds: Math.max(1, Math.floor((Date.now() - session.startTime) / 1000)),
        startTime: session.startTime,
        submittedAt: Date.now(),
        isAutoSubmitted,
        isFinal: true,
        violationsCount,
        violationLogs,
        score: localReceipt.score || 0,
        percentage: localReceipt.percentage || 0,
        maxScore: 50,
        correctCount: 0,
        incorrectCount: 0,
        passed: (localReceipt.percentage || 0) >= 40,
        evaluatedAt: Date.now()
      };
    }
    throw err;
  } finally {
    submissionInFlight.delete(sessionId);
  }
}
