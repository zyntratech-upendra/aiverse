import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { 
  getQuizById, 
  getOrCreateQuizSession, 
  submitQuizFinal 
} from "../../services/quizService";
import type { Quiz, QuizSession, QuizQuestion, QuizViolationLog } from "../../types/quiz";
import { useQuizTimer } from "../../hooks/useQuizTimer";
import { useQuizSession } from "../../hooks/useQuizSession";
import { quizLoadBalancer } from "../../utils/quizLoadBalancer";
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
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);

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
          quizData.status === "active" &&
          quizData.scheduledStartTime &&
          quizData.scheduledStartTime <= now &&
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

        if (isMounted) {
          setQuiz(quizData);
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
        const snap = await getDoc(doc(db, "quizzes", quizId));
        if (!snap.exists() || !isMounted) return;
        const data = snap.data();
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

  // Compute unique categories
  const categories = useMemo(() => {
    if (!quiz?.questions) return [];
    const cats = quiz.questions.map(q => q.category).filter(Boolean) as string[];
    return Array.from(new Set(cats));
  }, [quiz]);

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
        <div className="lg:col-span-8 space-y-6">
          
          {/* Top Info Pill */}
          <div className="flex items-center gap-4 relative">
            <span className="bg-blue-100 text-blue-800 font-bold text-xs px-3 py-1.5 rounded-full">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
            
            {/* Category Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="text-slate-500 hover:text-blue-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-full transition-all"
              >
                <Network className="w-3.5 h-3.5" />
                {currentQuestion.category || quiz.title}
                {categories.length > 0 && <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
              </button>

              {isCategoryDropdownOpen && categories.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsCategoryDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-2 overflow-hidden">
                    <div className="px-3 pb-2 mb-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Jump to Section
                    </div>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          const firstQIdx = questionsList.findIndex(q => q.category === cat);
                          if (firstQIdx !== -1) {
                            goToQuestion(firstQIdx);
                          }
                          setIsCategoryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer ${
                          currentQuestion.category === cat ? "text-blue-600 bg-blue-50/50" : "text-slate-600"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-4 pt-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight tracking-tight">
              {currentQuestion.text}
            </h2>

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
                  onClick={() => selectOption(currentQuestion.id, option.id)}
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

            <button
              onClick={() => {
                if (currentQuestionIndex === totalQuestions - 1) {
                  setShowSubmitModal(true);
                } else {
                  goToQuestion(currentQuestionIndex + 1);
                }
              }}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>{currentQuestionIndex === totalQuestions - 1 ? "Review & Submit" : "Next Question"}</span>
              {currentQuestionIndex !== totalQuestions - 1 && <ArrowRight className="w-4 h-4" />}
            </button>
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
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-[#0F172A]">
                Question Grid
              </h3>
              <span className="text-xs font-bold text-slate-500">
                {answeredCount}/{totalQuestions} Answered
              </span>
            </div>

            {/* Question Buttons Matrix */}
            <div className="grid grid-cols-5 gap-2.5">
              {questionsList.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = currentQuestionIndex === idx;

                let btnStyle = "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent";
                if (isAnswered) {
                  btnStyle = "bg-blue-600 text-white font-bold shadow-sm";
                }
                if (isCurrent && !isAnswered) {
                  btnStyle = "bg-white text-blue-600 border-2 border-blue-600 font-bold";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(idx)}
                    className={`h-11 rounded-lg text-sm transition-all flex items-center justify-center cursor-pointer ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-2 text-[11px] font-bold text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
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
