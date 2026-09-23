import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  getQuizById, 
  getOrCreateQuizSession, 
  submitQuizFinal,
  selectSeededCategorizedQuestions
} from "../../services/quizService";
import type { Quiz, QuizSession, QuizQuestion, QuizViolationLog } from "../../types/quiz";
import { useQuizTimer } from "../../hooks/useQuizTimer";
import { useQuizSession } from "../../hooks/useQuizSession";
import { quizLoadBalancer } from "../../utils/quizLoadBalancer";
import { formatPseudocodeText } from "../../utils/pdfExtractor";
import SEO from "../../components/layout/SEO";
import { 
  Clock, 
  Check, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  AlertCircle, 
  Loader2, 
  ShieldAlert,
  X,
  Lightbulb,
  Network,
  Layers,
  ChevronDown,
  Maximize2,
  AlertTriangle,
  Lock,
  EyeOff,
  MousePointer,
  Copy
} from "lucide-react";

export const QuizTakingPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState<boolean>(false);

  // Fullscreen and Proctoring State
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState<boolean>(true);
  const [showFullscreenExitModal, setShowFullscreenExitModal] = useState<boolean>(false);
  const [activeViolationToast, setActiveViolationToast] = useState<{ id: number; message: string; type: string } | null>(null);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastViolationTimeRef = useRef<number>(0);

  // 1. Initial Load: Quiz & Authoritative Session
  useEffect(() => {
    if (!quizId || !user) return;

    let isMounted = true;
    const initExam = async () => {
      try {
        setLoading(true);
        setError(null);

        const quizData = await getQuizById(quizId, true);
        if (!quizData || !quizData.questions || quizData.questions.length === 0) {
          throw new Error("Quiz questions are not available for this session.");
        }

        const now = Date.now();
        const isLive = Boolean(
          quizData &&
          (quizData.status?.toLowerCase() === "active" || (quizData as any).isLive === true) &&
          (!quizData.scheduledStartTime || quizData.scheduledStartTime <= now) &&
          (!quizData.scheduledEndTime || quizData.scheduledEndTime > now)
        );

        // If quiz is not live or scheduled for later, redirect to waiting lobby
        if (!isLive) {
          navigate(`/participant/quiz/${quizId}/lobby`, { replace: true });
          return;
        }

        const userSession = await getOrCreateQuizSession(quizData, {
          uid: user.uid,
          email: user.email,
          displayName: user.name || user.email
        }, {
          name: user.teamName
        });

        // If session was already finalized, redirect to completion receipt
        if (userSession.status === "submitted") {
          navigate(`/participant/quiz/${quizId}/completed`, { replace: true });
          return;
        }

        let activeQuiz = { ...quizData };
        let displayQuestions = activeQuiz.questions || [];

        // If quiz is configured with categoryDistribution or questionsToDisplayCount subset
        const hasCategoryDist = activeQuiz.categoryDistribution &&
          typeof activeQuiz.categoryDistribution === 'object' &&
          Object.values(activeQuiz.categoryDistribution).some(v => Number(v) > 0);

        const hasGlobalSubset = Boolean(
          activeQuiz.questionsToDisplayCount &&
          activeQuiz.questionsToDisplayCount > 0
        );

        if (hasCategoryDist || hasGlobalSubset) {
          let chosenIds = userSession.assignedQuestionIds || [];
          let needsReassignment = !chosenIds || chosenIds.length === 0 || (activeQuiz.questionsToDisplayCount > 0 && chosenIds.length !== activeQuiz.questionsToDisplayCount);

          if (!needsReassignment && hasCategoryDist) {
            const qMap = new Map(displayQuestions.map(q => [q.id, q]));
            const catCounts: Record<string, number> = {};
            for (const id of chosenIds) {
              const qObj = qMap.get(id);
              const c = (qObj && qObj.category && qObj.category.trim()) || "General";
              catCounts[c] = (catCounts[c] || 0) + 1;
            }
            for (const [cat, quota] of Object.entries(activeQuiz.categoryDistribution || {})) {
              const numQuota = Number(quota);
              if (numQuota > 0 && catCounts[cat] !== numQuota) {
                needsReassignment = true;
                break;
              }
            }
          }

          if (needsReassignment) {
            const randomSubset = selectSeededCategorizedQuestions(
              displayQuestions,
              activeQuiz.categoryDistribution,
              activeQuiz.questionsToDisplayCount,
              userSession.id
            );
            chosenIds = randomSubset.map(q => q.id);
            userSession.assignedQuestionIds = chosenIds;
          }

          const questionMap = new Map(displayQuestions.map(q => [q.id, q]));
          const assignedList: QuizQuestion[] = [];
          for (const qId of chosenIds) {
            const found = questionMap.get(qId);
            if (found) assignedList.push(found);
          }

          if (assignedList.length > 0) {
            displayQuestions = assignedList;
          } else {
            displayQuestions = selectSeededCategorizedQuestions(
              displayQuestions,
              activeQuiz.categoryDistribution,
              activeQuiz.questionsToDisplayCount,
              userSession.id
            );
          }

          // CRITICAL: Ensure questions are strictly sorted and separated category-by-category!
          const categoryOrder: string[] = [];
          const groupedByCat = new Map<string, QuizQuestion[]>();
          for (const q of displayQuestions) {
            const cat = (q.category && q.category.trim()) || "General";
            if (!groupedByCat.has(cat)) {
              groupedByCat.set(cat, []);
              categoryOrder.push(cat);
            }
            groupedByCat.get(cat)!.push(q);
          }

          const sortedCategorizedQuestions: QuizQuestion[] = [];
          for (const cat of categoryOrder) {
            sortedCategorizedQuestions.push(...groupedByCat.get(cat)!);
          }

          // Renumber questions sequentially 1..N for clean UI palette and taking experience
          displayQuestions = sortedCategorizedQuestions.map((q, idx) => ({
            ...q,
            questionNumber: idx + 1
          }));

          // Update assignedQuestionIds in session to reflect the clean category-grouped order
          userSession.assignedQuestionIds = displayQuestions.map(q => q.id);

          const effectiveTotalMarks = displayQuestions.reduce(
            (sum, q) => sum + (Number(q.points) || Number(activeQuiz.pointsPerQuestion) || 2),
            0
          );

          activeQuiz = {
            ...activeQuiz,
            questions: displayQuestions,
            questionsCount: displayQuestions.length,
            totalMarks: effectiveTotalMarks
          };
        }

        if (isMounted) {
          setQuiz(activeQuiz);
          setSession(userSession);
          
          // Check if already in fullscreen
          const isFs = !!(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement
          );
          setShowFullscreenPrompt(!isFs);
        }
      } catch (err: any) {
        console.error("Error initializing exam session:", err);
        if (isMounted) {
          setError(err.message || "Failed to load examination environment.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initExam();
    return () => { isMounted = false; };
  }, [quizId, user, navigate]);

  // Poll for remote admin stop during examination with Adaptive Load Balancing & Jitter
  // Dynamic intervals (45s -> 15s) with randomized jitter prevents 1,000-user database spikes
  useEffect(() => {
    if (!quizId || !session || session.status !== "in_progress") return;

    let isMounted = true;
    let pollTimeout: NodeJS.Timeout | null = null;

    const checkQuizStatus = async () => {
      try {
        const data = await getQuizById(quizId, false).catch(() => null);
        if (!data || !isMounted) return;
        const isStopped = data.status === "completed" || (data.scheduledEndTime && data.scheduledEndTime <= Date.now());
        if (isStopped && !isSubmitting && isMounted) {
          setShowTimeoutModal(true);
          handleFinalSubmit(true);
          return;
        }
      } catch {
        // Silently ignore polling errors — quiz continues uninterrupted with timer
      }

      if (isMounted) {
        const remaining = session?.endTime ? Math.max(0, Math.floor((session.endTime - Date.now()) / 1000)) : 1800;
        const nextDelay = quizLoadBalancer.getAdaptivePollInterval(remaining);
        pollTimeout = setTimeout(checkQuizStatus, nextDelay);
      }
    };

    // Initial adaptive schedule
    const remaining = session?.endTime ? Math.max(0, Math.floor((session.endTime - Date.now()) / 1000)) : 1800;
    const initialDelay = quizLoadBalancer.getAdaptivePollInterval(remaining);
    pollTimeout = setTimeout(checkQuizStatus, initialDelay);

    // Also check on tab becoming visible
    const handleVisCheck = () => {
      if (document.visibilityState === "visible") {
        checkQuizStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisCheck);

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
      document.removeEventListener("visibilitychange", handleVisCheck);
    };
  }, [quizId, session, isSubmitting]);

  // Fallback safe objects for hooks
  const safeQuiz: Quiz = quiz || {
    id: quizId || "",
    title: "",
    description: "",
    durationMinutes: 30,
    totalMarks: 50,
    instructions: [],
    status: "active",
    questionsCount: 0,
    questions: [],
    createdAt: 0,
    updatedAt: 0
  };

  const safeSession: QuizSession = session || {
    id: "",
    quizId: quizId || "",
    quizTitle: "",
    userId: user?.uid || "",
    userEmail: user?.email || "",
    userName: user?.name || "Participant",
    startTime: Date.now(),
    endTime: Date.now() + 30 * 60 * 1000,
    durationMinutes: 30,
    status: "in_progress",
    lastAutosavedAt: Date.now(),
    violationsCount: 0,
    violationLogs: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 2. Client Session & Autosave State Hook with Proctoring Support
  const {
    answers,
    currentQuestionIndex,
    violationsCount,
    violationLogs,
    saveStatus,
    selectOption,
    goToQuestion,
    logViolation,
    forceSave
  } = useQuizSession({
    quiz: safeQuiz,
    session: safeSession
  });

  // Trigger violation with toast notification & debouncing
  const triggerViolation = useCallback((type: QuizViolationLog["type"], message: string) => {
    if (isSubmitting || session?.status !== "in_progress") return;

    const now = Date.now();
    // Debounce rapid duplicate trigger within 800ms
    if (now - lastViolationTimeRef.current < 800) return;
    lastViolationTimeRef.current = now;

    logViolation(type, message);

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActiveViolationToast({
      id: now,
      message: `${message} (Violation recorded)`,
      type
    });

    toastTimerRef.current = setTimeout(() => {
      setActiveViolationToast(null);
    }, 4000);
  }, [isSubmitting, session?.status, logViolation]);

  // Fullscreen Request Handler
  const enterFullscreen = async () => {
    try {
      const el = document.documentElement as any;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
      setShowFullscreenPrompt(false);
      setShowFullscreenExitModal(false);
    } catch (err) {
      console.warn("Fullscreen request error:", err);
      setShowFullscreenPrompt(false);
      setShowFullscreenExitModal(false);
    }
  };

  // 3. Proctoring Event Listeners (Fullscreen, Tab Switch, Right-Click, Copy-Paste, DevTools)
  useEffect(() => {
    if (loading || !quiz || !session || session.status !== "in_progress" || isSubmitting) return;

    const handleFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isFs && !isSubmitting) {
        setShowFullscreenExitModal(true);
        triggerViolation("fullscreen_exit", "Exited full-screen examination mode");
      } else if (isFs) {
        setShowFullscreenExitModal(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitting) {
        triggerViolation("tab_switch", "Tab switch or background window detected");
      }
    };

    const handleWindowBlur = () => {
      if (!isSubmitting && !document.hidden) {
        triggerViolation("tab_switch", "Window lost focus / application switch detected");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerViolation("right_click", "Right-click context menu is disabled");
      return false;
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerViolation("copy_attempt", "Copying assessment content is prohibited");
      return false;
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerViolation("copy_attempt", "Cutting assessment content is prohibited");
      return false;
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerViolation("paste_attempt", "Pasting content into assessment is prohibited");
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Block Ctrl+C / Cmd+C (Copy)
      if (isCtrlOrCmd && key === "c") {
        e.preventDefault();
        triggerViolation("copy_attempt", "Ctrl+C copy shortcut is disabled");
        return;
      }

      // Block Ctrl+V / Cmd+V (Paste)
      if (isCtrlOrCmd && key === "v") {
        e.preventDefault();
        triggerViolation("paste_attempt", "Ctrl+V paste shortcut is disabled");
        return;
      }

      // Block Ctrl+X / Cmd+X (Cut)
      if (isCtrlOrCmd && key === "x") {
        e.preventDefault();
        triggerViolation("copy_attempt", "Ctrl+X cut shortcut is disabled");
        return;
      }

      // Block Ctrl+A / Cmd+A (Select All)
      if (isCtrlOrCmd && key === "a") {
        e.preventDefault();
        return;
      }

      // Block Ctrl+U / Cmd+U (View Source)
      if (isCtrlOrCmd && key === "u") {
        e.preventDefault();
        triggerViolation("dev_tools", "View source shortcut is disabled");
        return;
      }

      // Block Ctrl+P / Cmd+P (Print)
      if (isCtrlOrCmd && key === "p") {
        e.preventDefault();
        triggerViolation("shortcut_attempt", "Print shortcut is disabled");
        return;
      }

      // Block DevTools shortcuts (F12, Ctrl+Shift+I/J/C)
      if (e.key === "F12") {
        e.preventDefault();
        triggerViolation("dev_tools", "F12 Developer Tools shortcut is disabled");
        return;
      }

      if (isCtrlOrCmd && e.shiftKey && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        triggerViolation("dev_tools", "Developer Tools inspection shortcut is disabled");
        return;
      }

      // Block Alt+Tab
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        triggerViolation("shortcut_attempt", "Alt+Tab switch attempt detected");
        return;
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("cut", handleCut, true);
    document.addEventListener("paste", handlePaste, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("cut", handleCut, true);
      document.removeEventListener("paste", handlePaste, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [loading, quiz, session, isSubmitting, triggerViolation]);

  // 4. Final Submission Handler
  const handleFinalSubmit = useCallback(async (isAuto = false) => {
    if (!quiz || !session || isSubmitting) return;

    try {
      setIsSubmitting(true);
      // Synchronize latest draft state immediately before submit
      await forceSave();

      const result = await submitQuizFinal(
        session,
        answers,
        quiz.questions?.length || 0,
        isAuto,
        violationsCount,
        violationLogs,
        quiz
      );

      // Exit fullscreen mode cleanly if active
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore
        }
      }

      // Navigate to confirmation receipt
      navigate(`/participant/quiz/${quiz.id}/completed`, { 
        replace: true,
        state: { submission: result } 
      });
    } catch (err: any) {
      console.error("Final submission encountered network issue:", err);

      // Check if staged in local-first outbox
      const localReceipt = quizLoadBalancer.getLocalReceipt(session.id);
      if (localReceipt) {
        if (document.fullscreenElement) {
          try { await document.exitFullscreen(); } catch {}
        }
        navigate(`/participant/quiz/${quiz.id}/completed`, { 
          replace: true,
          state: { 
            submission: {
              id: session.id,
              sessionId: session.id,
              quizId: quiz.id,
              quizTitle: quiz.title,
              userId: session.userId,
              userEmail: session.userEmail,
              userName: session.userName,
              teamId: session.teamId,
              teamName: session.teamName,
              answers,
              answeredCount: Object.keys(answers).length,
              unansweredCount: Math.max(0, (quiz.questions?.length || 0) - Object.keys(answers).length),
              totalQuestions: quiz.questions?.length || 0,
              timeSpentSeconds: Math.max(1, Math.floor((Date.now() - session.startTime) / 1000)),
              startTime: session.startTime,
              submittedAt: Date.now(),
              isAutoSubmitted: isAuto,
              isFinal: true,
              violationsCount,
              violationLogs,
              score: localReceipt.score || 0,
              percentage: localReceipt.percentage || 0,
              maxScore: quiz.totalMarks || 50,
              correctCount: 0,
              incorrectCount: 0,
              passed: (localReceipt.percentage || 0) >= 40,
              evaluatedAt: Date.now()
            },
            isStagedOffline: true
          } 
        });
        return;
      }

      setIsSubmitting(false);
      setSubmitError(err.message || "Network error. Your answers are saved locally and will auto-submit when connectivity resumes.");
      setShowSubmitModal(false);
    }
  }, [quiz, session, isSubmitting, answers, violationsCount, violationLogs, forceSave, navigate]);

  // 5. Authoritative Server Timer Hook
  const handleTimeExpired = useCallback(() => {
    if (!session || session.status !== "in_progress" || isSubmitting) return;
    setShowTimeoutModal(true);
    handleFinalSubmit(true);
  }, [session, isSubmitting, handleFinalSubmit]);

  const { formattedTime, isUrgent } = useQuizTimer({
    endTime: session && session.status === "in_progress" ? session.endTime : 0,
    onTimeExpired: handleTimeExpired
  });

  // Calculate quick stats
  const questionsList = useMemo(() => quiz?.questions || [], [quiz]);
  const currentQuestion: QuizQuestion | undefined = questionsList[currentQuestionIndex];
  const totalQuestions = questionsList.length;
  const answeredCount = useMemo(() => Object.keys(answers).filter(k => !!answers[k]).length, [answers]);
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  // Compute unique categories in the exact order they appear in questionsList
  const categories = useMemo(() => {
    if (!quiz?.questions) return [];
    const orderedCats: string[] = [];
    quiz.questions.forEach(q => {
      const c = (q.category && q.category.trim()) || "General";
      if (!orderedCats.includes(c)) orderedCats.push(c);
    });
    return orderedCats;
  }, [quiz]);

  const currentCategory = (currentQuestion?.category && currentQuestion.category.trim()) || "General";
  const currentCategoryIndex = categories.indexOf(currentCategory);

  // Filter questions for the active/selected category
  const currentCatQuestionsWithIndices = useMemo(() => {
    return questionsList
      .map((q, idx) => ({ q, idx }))
      .filter(item => ((item.q.category && item.q.category.trim()) || "General") === currentCategory);
  }, [questionsList, currentCategory]);

  const currentCatQuestions = useMemo(() => {
    return currentCatQuestionsWithIndices.map(item => item.q);
  }, [currentCatQuestionsWithIndices]);

  const currentCatAnsweredCount = useMemo(() => {
    return currentCatQuestionsWithIndices.filter(item => !!answers[item.q.id]).length;
  }, [currentCatQuestionsWithIndices, answers]);

  const isCurrentCatCompleted = currentCatQuestionsWithIndices.length > 0 && currentCatAnsweredCount === currentCatQuestionsWithIndices.length;

  const localIndexInCat = useMemo(() => {
    if (!currentQuestion || currentCatQuestions.length === 0) return 1;
    const idx = currentCatQuestions.findIndex(q => q.id === currentQuestion.id);
    return idx !== -1 ? idx + 1 : 1;
  }, [currentCatQuestions, currentQuestion]);

  // Option select with auto-progression to next category when current category is completed
  const handleOptionSelect = useCallback((questionId: string, optionId: string) => {
    selectOption(questionId, optionId);

    // Check if answering this question completes all questions in the active category
    const updatedAnswers = { ...answers, [questionId]: optionId };
    const allCatCompleted = currentCatQuestionsWithIndices.every(
      item => !!updatedAnswers[item.q.id]
    );

    // If all questions in this category are completed and there is a subsequent category, advance smoothly
    if (allCatCompleted && currentCategoryIndex !== -1 && currentCategoryIndex < categories.length - 1) {
      const nextCategory = categories[currentCategoryIndex + 1];
      const nextCategoryFirstIdx = questionsList.findIndex(
        q => ((q.category && q.category.trim()) || "General") === nextCategory
      );
      if (nextCategoryFirstIdx !== -1) {
        setTimeout(() => {
          goToQuestion(nextCategoryFirstIdx);
        }, 550);
      }
    }
  }, [selectOption, answers, currentCatQuestionsWithIndices, currentCategoryIndex, categories, questionsList, goToQuestion]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex flex-col items-center justify-center p-6 text-white">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold">Securing Exam Session...</h2>
        <p className="text-xs text-slate-400 mt-1">Fetching questions and syncing authoritative timer</p>
      </div>
    );
  }

  if (error || !quiz || !session || !currentQuestion) {
    return (
      <div className="min-h-screen bg-[#F4F7FC] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-extrabold text-[#0F172A]">Exam Session Error</h2>
          <p className="text-xs text-slate-500">{error || "Could not load quiz questions."}</p>
          <button
            onClick={() => navigate("/participant/dashboard")}
            className="bg-[#0F172A] text-white font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased select-none">
      <SEO 
        title={`Assessment: ${quiz.title} - AI Verse`}
        description="Active examination environment with autosave and authoritative countdown timer." 
      />

      {/* ================= SUBMISSION ERROR BANNER ================= */}
      {submitError && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{submitError}</span>
          </div>
          <button
            onClick={() => { setSubmitError(null); handleFinalSubmit(false); }}
            className="bg-white text-red-700 font-bold text-xs px-4 py-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Retry Submit
          </button>
        </div>
      )}

      {/* ================= PROCTORING VIOLATION TOAST ================= */}
      {activeViolationToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300 max-w-lg w-full px-4 pointer-events-auto">
          <div className="bg-[#1E0808]/95 text-white border-2 border-red-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 ring-4 ring-red-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-400 block">
                  ⚠️ Proctoring Violation Logged
                </span>
                <p className="text-xs font-bold text-white mt-0.5">
                  {activeViolationToast.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveViolationToast(null)}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= TOP NAV BAR ================= */}
      <header className="h-16 px-4 sm:px-8 border-b border-slate-200 bg-white flex flex-col justify-center relative sticky top-0 z-30">
        <div className="flex items-center justify-between w-full">
          {/* Left Brand & Quiz Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[#0F172A] truncate tracking-tight">{quiz.title}</h1>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                {quiz.description || "Module Assessment"}
              </p>
            </div>
          </div>

          {/* Right: Proctoring status, Autosave Pill & Save/Exit */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Live Proctoring Badge */}
            {violationsCount === 0 ? (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                <span>Proctored (0 Violations)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-300 animate-pulse shadow-xs">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>{violationsCount} Violation{violationsCount > 1 ? "s" : ""}</span>
              </div>
            )}

            {/* Autosave Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100/80">
              {saveStatus === "saving" && <span className="text-blue-600 text-[11px] font-bold">Saving...</span>}
              {saveStatus === "saved" && <span className="text-slate-500 text-[11px] font-medium">Saved</span>}
              {saveStatus === "offline" && <span className="text-amber-600 text-[11px] font-bold">Offline</span>}
            </div>

            <button
              onClick={async () => {
                if (document.fullscreenElement) {
                  try {
                    await document.exitFullscreen();
                  } catch {
                    // ignore
                  }
                }
                navigate("/participant/dashboard");
              }}
              className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Save & Exit</span>
            </button>
          </div>
        </div>
        
        {/* Progress Bar (Bottom of Header) */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100">
          <div 
            className="h-full bg-blue-600 transition-all duration-300 ease-out" 
            style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
          />
        </div>
      </header>

      {/* ================= MAIN EXAMINATION GRID ================= */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start select-none">
        
        {/* ================= LEFT COLUMN: QUESTION CONTENT (8 COLS) ================= */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Category / Section Select Dropdown (In place of top red box) */}
          {categories.length > 1 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Category:</span>
                </span>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  Section {currentCategoryIndex + 1} of {categories.length}
                </span>
              </div>

              <div className="relative min-w-[280px] max-w-sm flex-1 sm:flex-initial">
                <select
                  value={currentCategory}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    const firstIdx = questionsList.findIndex(q => ((q.category && q.category.trim()) || "General") === chosen);
                    if (firstIdx !== -1) {
                      goToQuestion(firstIdx);
                    }
                  }}
                  className="w-full bg-slate-50 hover:bg-slate-100/90 border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer outline-none appearance-none pr-9 shadow-2xs"
                >
                  {categories.map((cat, catIdx) => {
                    const catQuestions = questionsList.filter(q => ((q.category && q.category.trim()) || "General") === cat);
                    const catAnswered = catQuestions.filter(q => !!answers[q.id]).length;
                    return (
                      <option key={cat} value={cat}>
                        Section {catIdx + 1}: {cat} ({catAnswered}/{catQuestions.length} Answered)
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Top Info Pill */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bg-blue-600 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-full shadow-2xs">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
              
              {currentQuestion.category && (
                <span className="bg-white border border-slate-200/90 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                  <Network className="w-3.5 h-3.5 text-blue-600" />
                  <span>Category: <strong className="text-slate-900">{currentQuestion.category}</strong></span>
                  <span className="text-blue-600 font-extrabold text-[11px] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    Q{localIndexInCat} of {currentCatQuestions.length}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-4 pt-2">
            {(() => {
              const formatted = formatPseudocodeText(currentQuestion.text);
              const lines = formatted.split("\n");
              if (lines.length > 1) {
                const promptLine = lines[0];
                const codeLines = lines.slice(1).join("\n");
                return (
                  <div className="space-y-3">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] leading-tight">
                      {promptLine}
                    </h2>
                    <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-sm sm:text-base leading-relaxed overflow-x-auto border border-slate-800 shadow-sm whitespace-pre">
                      {codeLines}
                    </div>
                  </div>
                );
              }
              return (
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight tracking-tight whitespace-pre-wrap">
                  {formatted}
                </h2>
              );
            })()}

            {/* Code Snippet Block (if question has code) */}
            {currentQuestion.codeSnippet && (
              <div className="bg-[#0F172A] text-blue-100 rounded-2xl p-5 font-mono text-sm overflow-x-auto shadow-inner mt-4">
                <pre className="whitespace-pre">{currentQuestion.codeSnippet}</pre>
              </div>
            )}
          </div>

          {/* Options List */}
          <div className="space-y-3 pt-6">
            {currentQuestion.options.map((option) => {
              const isSelected = answers[currentQuestion.id] === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleOptionSelect(currentQuestion.id, option.id)}
                  className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/50 border-blue-600 shadow-sm ring-1 ring-blue-600"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Option Circular Radio */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "border-blue-600"
                      : "border-slate-300"
                  }`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                  </div>

                  {/* Option Text */}
                  <span className={`text-base sm:text-lg ${
                    isSelected ? "text-[#0F172A] font-semibold" : "text-slate-700"
                  }`}>
                    {option.text}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Question Navigation Controls */}
          <div className="flex items-center justify-between pt-8 gap-3">
            <button
              onClick={() => goToQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm py-2 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {(() => {
              const nextQ = questionsList[currentQuestionIndex + 1];
              const isLast = currentQuestionIndex === totalQuestions - 1;
              const isNextCat = nextQ && (((nextQ.category && nextQ.category.trim()) || "General") !== ((currentQuestion.category && currentQuestion.category.trim()) || "General"));

              return (
                <button
                  onClick={() => {
                    if (isLast) {
                      setShowSubmitModal(true);
                    } else {
                      goToQuestion(currentQuestionIndex + 1);
                    }
                  }}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>
                    {isLast
                      ? "Review & Submit"
                      : isNextCat
                      ? `Next Section: ${nextQ.category || "Next"}`
                      : "Next Question"}
                  </span>
                  {!isLast && <ArrowRight className="w-4 h-4" />}
                </button>
              );
            })()}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: SIDEBAR (4 COLS) ================= */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Time Remaining Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col items-center justify-center">
            <div className={`flex flex-col items-center justify-center transition-all ${isUrgent ? "text-red-500 animate-pulse" : "text-[#0F172A]"}`}>
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs tracking-widest uppercase mb-2">
                <Clock className="w-4 h-4" />
                <span>Time Remaining</span>
              </div>
              <span className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums">
                {formattedTime}
              </span>
            </div>
          </div>
          
          {/* Question Grid Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Question Grid
                </h3>
                <span className="text-[11px] text-blue-600 font-extrabold block truncate max-w-[190px]" title={currentCategory}>
                  {categories.length > 1 ? `Section ${currentCategoryIndex + 1}: ${currentCategory}` : currentCategory}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {currentCatAnsweredCount}/{currentCatQuestionsWithIndices.length} Answered
              </span>
            </div>

            {/* Questions of Selected Category ONLY */}
            <div className="grid grid-cols-5 gap-2.5">
              {currentCatQuestionsWithIndices.map(({ q, idx }) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = currentQuestionIndex === idx;

                let btnStyle = "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200";
                if (isAnswered) {
                  btnStyle = "bg-blue-600 text-white font-bold shadow-2xs border-blue-600";
                }
                if (isCurrent && !isAnswered) {
                  btnStyle = "bg-white text-blue-600 border-2 border-blue-600 font-black shadow-xs ring-2 ring-blue-400/30";
                }
                if (isCurrent && isAnswered) {
                  btnStyle = "bg-blue-700 text-white font-black shadow-xs ring-2 ring-blue-400 ring-offset-1";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(idx)}
                    className={`h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${btnStyle}`}
                    title={`Question ${idx + 1} (${currentCategory})`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* If all questions in this category are completed and there is a subsequent category */}
            {isCurrentCatCompleted && currentCategoryIndex < categories.length - 1 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-xs font-black">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Category Completed!</span>
                </div>
                <p className="text-[11px] text-emerald-700 font-medium">
                  All questions in this section are answered.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const nextCat = categories[currentCategoryIndex + 1];
                    const nextFirstIdx = questionsList.findIndex(q => ((q.category && q.category.trim()) || "General") === nextCat);
                    if (nextFirstIdx !== -1) goToQuestion(nextFirstIdx);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <span>Go to Section {currentCategoryIndex + 2}: {categories[currentCategoryIndex + 1]}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-2 text-[11px] font-bold text-slate-500 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300" />
                <span>Unanswered</span>
              </div>
            </div>
          </div>
          
          {/* Submit Assessment Button */}
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="w-full bg-white hover:bg-blue-50 border border-blue-600 text-blue-700 font-bold text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>Submit Assessment</span>
          </button>

        </div>
      </main>

      {/* ================= FULLSCREEN REQUIRED ENTRY PROMPT MODAL ================= */}
      {showFullscreenPrompt && (
        <div className="fixed inset-0 z-50 bg-[#0A0F1D]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto ring-8 ring-blue-500/10">
              <Maximize2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                🔒 PROCTORING MODE REQUIRED
              </span>
              <h3 className="text-2xl font-black text-[#0F172A]">
                Enter Full-Screen Examination
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
                To ensure assessment integrity, this quiz requires active full-screen mode. Please review the security rules below before starting.
              </p>
            </div>

            {/* Anti-Cheating Rules Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                <span><strong>Fullscreen Locked:</strong> Exiting full screen counts as a violation.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Copy className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>No Copy / Paste:</strong> Clipboard access and selection are strictly disabled.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MousePointer className="w-4 h-4 text-purple-600 shrink-0" />
                <span><strong>No Right Click:</strong> Context menu & developer shortcuts are blocked.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <EyeOff className="w-4 h-4 text-red-600 shrink-0" />
                <span><strong>No Tab Switch:</strong> Switching tabs or applications logs a violation.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={enterFullscreen}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm py-4 rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Maximize2 className="w-5 h-5" />
              <span>Enter Fullscreen & Begin Assessment</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= FULLSCREEN EXIT WARNING MODAL ================= */}
      {showFullscreenExitModal && !showFullscreenPrompt && (
        <div className="fixed inset-0 z-50 bg-[#1E0808]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl text-center animate-in zoom-in-95 duration-200 ring-8 ring-red-500/20">
            <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mx-auto ring-8 ring-red-500/10 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                ⚠️ PROCTORING VIOLATION RECORDED
              </span>
              <h3 className="text-2xl font-black text-[#0F172A]">
                Full-Screen Mode Exited!
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                You have exited full-screen mode. This incident has been logged to your exam record. Return immediately to prevent disqualification.
              </p>
            </div>

            <div className="bg-red-50 p-3.5 rounded-2xl border border-red-200 text-center">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">Total Violations</span>
              <span className="text-2xl font-black text-red-700">{violationsCount}</span>
            </div>

            <button
              type="button"
              onClick={enterFullscreen}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-sm py-4 rounded-2xl shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Maximize2 className="w-5 h-5" />
              <span>Return to Full-Screen Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= FINAL SUBMISSION CONFIRMATION MODAL ================= */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-[#0F172A]">Submit Examination?</h3>
              <p className="text-xs text-slate-500 font-medium">
                Please confirm your answers below before finalizing your submission.
              </p>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Answered</span>
                <span className="text-base font-black text-emerald-600">{answeredCount}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Unanswered</span>
                <span className={`text-base font-black ${unansweredCount > 0 ? "text-amber-600" : "text-slate-700"}`}>
                  {unansweredCount}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Violations</span>
                <span className={`text-base font-black ${violationsCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {violationsCount}
                </span>
              </div>
            </div>

            {violationsCount > 0 && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 font-medium">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>Notice: <strong>{violationsCount} proctoring violation(s)</strong> have been recorded in this session.</span>
              </div>
            )}

            {unansweredCount > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>You have <strong>{unansweredCount} unanswered questions</strong>. You can still return to complete them.</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
              >
                Back to Exam
              </button>

              <button
                type="button"
                onClick={() => handleFinalSubmit(false)}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Submit</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TIME EXPIRED AUTO-SUBMIT MODAL ================= */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-50 bg-[#0B132B]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto animate-bounce">
              <Clock className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black text-[#0F172A]">Time Has Expired!</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Your allotted examination time has ended. Your answers have been automatically collected and finalized.
            </p>
            <div className="pt-2 flex justify-center">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting to submission receipt...</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default QuizTakingPage;
