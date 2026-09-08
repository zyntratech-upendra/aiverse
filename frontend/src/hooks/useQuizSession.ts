import { useState, useEffect, useRef, useCallback } from "react";
import type { Quiz, QuizSession, QuizDraftAnswers, AutosaveStatus } from "../types/quiz";
import { saveDraftAnswers } from "../services/quizService";
import { isOnline, onNetworkChange } from "../utils/networkStatus";
import { quizMonitor } from "../utils/quizMonitor";
import { quizLoadBalancer } from "../utils/quizLoadBalancer";

interface UseQuizSessionProps {
  quiz: Quiz;
  session: QuizSession;
  initialAnswers?: Record<string, string>;
  initialFlags?: string[];
  initialQuestionIndex?: number;
}

// Minimum delay after last answer change before an autosave is considered urgent
const ANSWER_CHANGE_DEBOUNCE_MS = 2_000;

export function useQuizSession({
  quiz,
  session,
  initialAnswers = {},
  initialFlags = [],
  initialQuestionIndex = 0
}: UseQuizSessionProps) {
  // Load any local storage cached answers for instantaneous restore
  const getInitialState = () => {
    let localAnswers = initialAnswers;
    let localFlags = initialFlags;
    let localIdx = initialQuestionIndex;
    let localViolations = session.violationsCount || 0;
    let localViolationLogs: import("../types/quiz").QuizViolationLog[] = session.violationLogs || [];

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`quiz_draft_${session.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed) {
            if (parsed.answers) localAnswers = { ...initialAnswers, ...parsed.answers };
            if (parsed.flaggedQuestions) localFlags = parsed.flaggedQuestions;
            if (typeof parsed.currentQuestionIndex === "number") {
              localIdx = parsed.currentQuestionIndex;
            }
            if (typeof parsed.violationsCount === "number" && parsed.violationsCount > localViolations) {
              localViolations = parsed.violationsCount;
            }
            if (Array.isArray(parsed.violationLogs) && parsed.violationLogs.length > localViolationLogs.length) {
              localViolationLogs = parsed.violationLogs;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    return { localAnswers, localFlags, localIdx, localViolations, localViolationLogs };
  };

  const { localAnswers, localFlags, localIdx, localViolations, localViolationLogs } = getInitialState();

  const [answers, setAnswers] = useState<Record<string, string>>(localAnswers);
  const [flaggedQuestions, setFlaggedQuestions] = useState<string[]>(localFlags);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(localIdx);
  const [violationsCount, setViolationsCount] = useState<number>(localViolations);
  const [violationLogs, setViolationLogs] = useState<import("../types/quiz").QuizViolationLog[]>(localViolationLogs);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number>(session.lastAutosavedAt || Date.now());

  // Ref tracking dirty state so we only autosave when answers or flags change
  const isDirtyRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const flagsRef = useRef(flaggedQuestions);
  flagsRef.current = flaggedQuestions;
  const indexRef = useRef(currentQuestionIndex);
  indexRef.current = currentQuestionIndex;
  const violationsCountRef = useRef(violationsCount);
  violationsCountRef.current = violationsCount;
  const violationLogsRef = useRef(violationLogs);
  violationLogsRef.current = violationLogs;
  
  // Save-in-progress guard to prevent overlapping autosave requests
  const saveInProgressRef = useRef(false);
  // Monotonic save version to prevent stale data overwriting newer data
  const saveVersionRef = useRef(0);
  // Track last answer change time for debouncing
  const lastChangeTimeRef = useRef(0);

  // Persist to local storage immediately on change (zero network cost, crash-proof)
  const syncLocalStorage = useCallback(() => {
    const draft: QuizDraftAnswers = {
      sessionId: session.id,
      quizId: quiz.id,
      userId: session.userId,
      answers: answersRef.current,
      flaggedQuestions: flagsRef.current,
      currentQuestionIndex: indexRef.current,
      violationsCount: violationsCountRef.current,
      violationLogs: violationLogsRef.current,
      lastAutosavedAt: Date.now(),
      clientTimestamp: Date.now()
    };
    quizLoadBalancer.recordLocalSnapshot(session.id, draft);
  }, [session.id, quiz.id, session.userId]);

  // Build save payload
  const buildPayload = useCallback((): QuizDraftAnswers => {
    return {
      sessionId: session.id,
      quizId: quiz.id,
      userId: session.userId,
      answers: answersRef.current,
      flaggedQuestions: flagsRef.current,
      currentQuestionIndex: indexRef.current,
      violationsCount: violationsCountRef.current,
      violationLogs: violationLogsRef.current,
      lastAutosavedAt: Date.now(),
      clientTimestamp: Date.now()
    };
  }, [session.id, quiz.id, session.userId]);

  // Execute Firestore Autosave (with overlapping request prevention and load balancer gating)
  const performSave = useCallback(async (isCritical = false): Promise<boolean> => {
    if (!isOnline()) {
      setSaveStatus("offline");
      return false;
    }

    if (!isDirtyRef.current && !isCritical) {
      return true;
    }

    // Prevent overlapping saves
    if (saveInProgressRef.current) {
      return false;
    }

    saveInProgressRef.current = true;
    const currentVersion = ++saveVersionRef.current;
    setSaveStatus("saving");

    try {
      const payload = buildPayload();
      const success = await quizLoadBalancer.executeGatedRequest(
        () => saveDraftAnswers(payload, 2),
        isCritical ? "high" : "normal"
      );
      
      // Only update state if this is still the latest save version
      if (currentVersion === saveVersionRef.current) {
        if (success) {
          isDirtyRef.current = false;
          setSaveStatus("saved");
          setLastSavedAt(Date.now());
          return true;
        } else {
          setSaveStatus("retrying");
          return false;
        }
      }
      return success;
    } catch {
      if (currentVersion === saveVersionRef.current) {
        setSaveStatus("error");
        quizMonitor.trackError("save_failure", "Autosave failed", { sessionId: session.id });
      }
      return false;
    } finally {
      saveInProgressRef.current = false;
    }
  }, [session.id, buildPayload]);

  // Log Proctoring Violation — coalesced with next autosave instead of immediate save
  const logViolation = useCallback((type: import("../types/quiz").QuizViolationLog["type"], message: string) => {
    const newLog: import("../types/quiz").QuizViolationLog = {
      type,
      message,
      timestamp: Date.now()
    };

    setViolationsCount(prev => {
      const nextCount = prev + 1;
      violationsCountRef.current = nextCount;
      return nextCount;
    });

    setViolationLogs(prev => {
      const nextLogs = [...prev, newLog];
      violationLogsRef.current = nextLogs;
      isDirtyRef.current = true;
      syncLocalStorage();
      return nextLogs;
    });

    // Instead of immediate Firestore save, just mark dirty.
    // The violation is already persisted in localStorage.
    // It will be synced on the next autosave cycle (within 45 seconds)
    // or when the page is hidden / closed.

    return violationsCountRef.current;
  }, [syncLocalStorage]);

  // Option selection handler (Instant UI, mark dirty, sync local backup)
  const selectOption = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionId };
      answersRef.current = next;
      isDirtyRef.current = true;
      lastChangeTimeRef.current = Date.now();
      syncLocalStorage();
      return next;
    });
  }, [syncLocalStorage]);

  // Clear answer
  const clearOption = useCallback((questionId: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      answersRef.current = next;
      isDirtyRef.current = true;
      lastChangeTimeRef.current = Date.now();
      syncLocalStorage();
      return next;
    });
  }, [syncLocalStorage]);

  // Toggle flag for review
  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions((prev) => {
      const next = prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId];
      flagsRef.current = next;
      isDirtyRef.current = true;
      syncLocalStorage();
      return next;
    });
  }, [syncLocalStorage]);

  // Navigate question
  const goToQuestion = useCallback((index: number) => {
    const total = quiz.questions?.length || 0;
    if (index >= 0 && index < total) {
      setCurrentQuestionIndex(index);
      indexRef.current = index;
      syncLocalStorage();
    }
  }, [quiz.questions?.length, syncLocalStorage]);

  // ─── Periodic Sharded Autosave (Staggered to prevent database hotspots) ─────────
  useEffect(() => {
    // Individualized, sharded interval per participant (e.g., 60s - 90s distributed)
    const shardedInterval = quizLoadBalancer.getShardedAutosaveDelay(
      session.userId || session.id,
      60_000,
      30_000
    );

    const intervalId = setInterval(() => {
      if (isDirtyRef.current) {
        // Debounce: skip if user changed answer within the last 2 seconds
        const timeSinceLastChange = Date.now() - lastChangeTimeRef.current;
        if (timeSinceLastChange >= ANSWER_CHANGE_DEBOUNCE_MS) {
          performSave();
        }
      }
    }, shardedInterval);

    return () => clearInterval(intervalId);
  }, [performSave, session.userId, session.id]);

  // ─── Online / Offline + Visibility + Unload Listeners ────────────────────
  useEffect(() => {
    // Network change handler
    const unsubNetwork = onNetworkChange((online) => {
      if (online) {
        if (isDirtyRef.current) {
          performSave(true);
        } else {
          setSaveStatus("saved");
        }
      } else {
        setSaveStatus("offline");
      }
    });

    // Save on page visibility change (tab hidden = user may be leaving)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isDirtyRef.current) {
        // First, ensure localStorage is current
        syncLocalStorage();
        // Then attempt Firestore save (may not complete if tab closes)
        performSave(true);
      }
    };

    // Save on beforeunload (synchronous localStorage backup)
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        syncLocalStorage();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubNetwork();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [performSave, syncLocalStorage]);

  return {
    answers,
    flaggedQuestions,
    currentQuestionIndex,
    violationsCount,
    violationLogs,
    saveStatus,
    lastSavedAt,
    selectOption,
    clearOption,
    toggleFlag,
    goToQuestion,
    logViolation,
    forceSave: () => performSave(true)
  };
}
