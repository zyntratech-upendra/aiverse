import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getOrCreateQuizSession, getDeterministicSessionId } from "../../services/quizService";
import type { Quiz } from "../../types/quiz";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { quizLoadBalancer } from "../../utils/quizLoadBalancer";
import SEO from "../../components/layout/SEO";
import { 
  Clock, 
  HelpCircle, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Wifi, 
  FileText, 
  Loader2,
  ChevronLeft,
  Radio,
  Hourglass
} from "lucide-react";

export const QuizLobbyPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [starting, setStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Clock tick to keep countdown / schedule comparisons live
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling quiz status (replaces real-time onSnapshot to prevent 1,500 listener hotspot)
  // Polls every 5 seconds for quiz start status, and on tab focus
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!quizId) return;

    if (!hasLoadedRef.current) {
      setLoading(true);
      setError(null);
    }

    let isMounted = true;
    const quizRef = doc(db, "quizzes", quizId);

    const fetchQuizStatus = async () => {
      try {
        const snap = await getDoc(quizRef);
        if (!isMounted) return;
        
        if (!snap.exists()) {
          setError("The requested quiz could not be found or has not been published.");
          setLoading(false);
          return;
        }

        const data = snap.data();
        const loadedQuiz: Quiz = {
          id: snap.id,
          title: data.title || "AI Verse Quiz",
          description: data.description || "",
          eventId: data.eventId || "",
          eventTitle: data.eventTitle || "",
          track: data.track || "General",
          durationMinutes: Number(data.durationMinutes) || 30,
          totalMarks: Number(data.totalMarks) || 50,
          passingMarks: Number(data.passingMarks) || 20,
          instructions: Array.isArray(data.instructions) && data.instructions.length > 0 ? data.instructions : [
            "Each question has 4 options with single correct answer.",
            "Your answers are automatically saved periodically in the background.",
            "You can navigate freely between questions using the Question Palette.",
            "Once submitted or when the timer expires, no further modifications are allowed.",
            "Do not close or switch browser tabs to ensure an uninterrupted session."
          ],
          status: data.status || "active",
          scheduledStartTime: data.scheduledStartTime || 0,
          scheduledEndTime: data.scheduledEndTime || 0,
          questionsCount: Number(data.questionsCount) || (data.questions?.length || 0),
          questions: data.questions || [],
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now()
        };

        if (!isMounted) return;
        setQuiz(loadedQuiz);

        // Check if user already submitted in this current round
        if (user?.uid) {
          try {
            const sessionId = getDeterministicSessionId(quizId, user.uid);
            const subSnap = await getDoc(doc(db, "quizSubmissions", sessionId));
            if (subSnap.exists()) {
              const subData = subSnap.data();
              const wasSubmittedBeforeRestart = loadedQuiz.scheduledStartTime && subData.submittedAt && (subData.submittedAt < loadedQuiz.scheduledStartTime);
              if (!wasSubmittedBeforeRestart) {
                navigate(`/participant/quiz/${quizId}/completed`, { replace: true });
                return;
              }
            }
          } catch (err) {
            console.warn("Error checking submission record:", err);
          }
        }

        hasLoadedRef.current = true;
        setLoading(false);
      } catch (err) {
        console.error("Error fetching quiz status:", err);
        if (!hasLoadedRef.current && isMounted) {
          setError("Failed to load quiz details. Please check your internet connection.");
          setLoading(false);
        }
      }
    };

    // Initial fetch with user slot jitter to smooth lobby crowd
    const initialJitter = quizLoadBalancer.getUserJitter(user?.uid || "lobby_guest", 1500);
    const initTimer = setTimeout(fetchQuizStatus, initialJitter);

    // Poll every 30 seconds with ±3s randomized jitter
    const jitteredPollMs = 30_000 + (quizLoadBalancer.getUserJitter(user?.uid || "lobby_guest", 6000) - 3000);
    const pollId = setInterval(fetchQuizStatus, Math.max(15_000, jitteredPollMs));

    // Also re-check immediately when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchQuizStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [quizId, user, navigate]);

  // Derived status computations
  const isLive = Boolean(
    quiz &&
    quiz.status === "active" &&
    quiz.scheduledStartTime &&
    quiz.scheduledStartTime <= currentTime &&
    (!quiz.scheduledEndTime || quiz.scheduledEndTime > currentTime)
  );

  const isCompleted = Boolean(
    quiz && (
      quiz.status === "completed" ||
      (quiz.scheduledEndTime && quiz.scheduledEndTime <= currentTime && quiz.scheduledStartTime)
    )
  );

  const isUpcoming = Boolean(
    quiz && quiz.scheduledStartTime && quiz.scheduledStartTime > currentTime
  );

  // Format countdown string for upcoming quiz
  const formatScheduledCountdown = (targetTime: number) => {
    const diffMs = Math.max(0, targetTime - currentTime);
    const totalSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m ${secs}s`;
    }
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  };

  const handleStartQuiz = async () => {
    if (!quiz || !user || starting || !acknowledged || !isLive) return;

    try {
      setStarting(true);
      setError(null);

      // Stagger entry across 1,000 users with micro-jitter (0-800ms)
      const entryJitter = quizLoadBalancer.getUserJitter(user.uid, 800);
      if (entryJitter > 50) {
        await new Promise(r => setTimeout(r, entryJitter));
      }

      // Initialize or restore session via load balancer gate
      await quizLoadBalancer.executeGatedRequest(() => 
        getOrCreateQuizSession(quiz, {
          uid: user.uid,
          email: user.email,
          displayName: user.name || user.email
        }, {
          name: user.teamName
        }),
        "high"
      );

      // Navigate to examination environment
      navigate(`/participant/quiz/${quiz.id}/take`);
    } catch (err: any) {
      console.error("Failed to start quiz session:", err);
      setError(err.message || "Failed to start quiz session. Please try again.");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FC] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Connecting to examination hub...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-[#F4F7FC] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#0F172A]">Quiz Unavailable</h2>
            <p className="text-xs text-slate-500 font-medium mt-2">{error || "Quiz not found"}</p>
          </div>
          <Link
            to="/participant/dashboard"
            className="inline-flex items-center gap-2 bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC] flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-500/20 selection:text-blue-600">
      <SEO title={`${quiz.title} - AI Verse Quiz`} description={quiz.description} />

      {/* Top Bar */}
      <header className="h-16 px-6 sm:px-10 border-b border-slate-200/80 bg-white flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <Link to="/participant/dashboard" className="flex items-center gap-3 group">
          <img src="/ai_verse.png" alt="AI Verse Logo" className="w-8 h-8 rounded-xl object-contain shadow-sm" />
          <div className="leading-tight">
            <span className="text-sm font-extrabold text-[#0F172A] block tracking-tight">AI Verse</span>
            <span className="text-[10px] text-slate-400 font-semibold block">Quiz Assessment Portal</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {isLive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Assessment Active</span>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
              <span>Assessment Concluded</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Waiting for Admin</span>
            </div>
          )}

          <span className="hidden sm:inline-block text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/70 px-3 py-1 rounded-full">
            {quiz.track || "General Track"}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto p-6 sm:p-10 space-y-8 flex-1">
        
        {/* ================= WAITING STATE BANNER ================= */}
        {!isLive && !isCompleted && (
          <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A1128] border border-blue-900/50 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(37,99,235,0.2)_0%,transparent_70%)] pointer-events-none transform-gpu -z-0" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                    {isUpcoming ? "QUIZ SCHEDULED" : "WAITING FOR ADMIN TO START"}
                  </span>
                  <span className="text-xs text-blue-200/70 font-medium">Real-time sync enabled</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {isUpcoming ? "Assessment Opens Soon" : "Please Wait for Admin to Start"}
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl leading-relaxed">
                  {isUpcoming 
                    ? `This assessment is scheduled to open soon. Please wait on this page—it will automatically unlock when time is up.`
                    : `The exam engine is ready. Please wait until the administrator starts the quiz session from the faculty control room. This page will automatically unlock immediately.`
                  }
                </p>
              </div>

              {/* Countdown or Live Pulse Indicator */}
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:p-5 text-center shrink-0 min-w-[170px] shadow-inner">
                {isUpcoming && quiz.scheduledStartTime ? (
                  <div>
                    <Hourglass className="w-5 h-5 text-amber-400 mx-auto mb-1 animate-spin" />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Opens In</span>
                    <span className="text-2xl font-black text-amber-300 font-mono">
                      {formatScheduledCountdown(quiz.scheduledStartTime)}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-1">
                    <div className="relative w-8 h-8 mx-auto flex items-center justify-center">
                      <span className="absolute w-full h-full rounded-full bg-blue-500/40 animate-ping" />
                      <span className="relative w-3.5 h-3.5 rounded-full bg-blue-400" />
                    </div>
                    <span className="text-xs font-bold text-blue-200 block">Lobby Connected</span>
                    <span className="text-[10px] text-slate-400 font-semibold block">Auto-unlocking...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= COMPLETED BANNER ================= */}
        {isCompleted && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">
                ASSESSMENT CLOSED
              </span>
              <h2 className="text-xl font-black text-white">This Assessment Has Concluded</h2>
              <p className="text-xs text-slate-400">The allotted window for this quiz has closed or the administrator has finalized the exam.</p>
            </div>
            <Link
              to="/participant/dashboard"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Return to Dashboard
            </Link>
          </div>
        )}

        {/* Hero Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs">
                OFFICIAL ASSESSMENT
              </span>
              {quiz.eventTitle && (
                <span className="text-xs font-semibold text-slate-500">
                  Part of: <strong className="text-[#0F172A]">{quiz.eventTitle}</strong>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">{quiz.title}</h1>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">{quiz.description || "Official examination for AI Verse participants."}</p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center">
              <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1.5" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
              <span className="text-lg font-black text-[#0F172A]">{quiz.durationMinutes} Mins</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center">
              <HelpCircle className="w-5 h-5 text-indigo-600 mx-auto mb-1.5" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Questions</span>
              <span className="text-lg font-black text-[#0F172A]">{quiz.questions?.length || quiz.questionsCount || 0} MCQs</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center">
              <Award className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Marks</span>
              <span className="text-lg font-black text-[#0F172A]">{quiz.totalMarks} Pts</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center">
              <Wifi className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Autosave</span>
              <span className="text-lg font-black text-[#0F172A]">Real-Time</span>
            </div>
          </div>
        </div>

        {/* Instructions & Guidelines */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-[#0F172A]">Instructions & Code of Conduct</h2>
          </div>

          <ul className="space-y-3">
            {quiz.instructions.map((inst, i) => (
              <li key={i} className="flex items-start gap-3 text-xs sm:text-sm text-slate-600 font-medium">
                <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0 mt-0.5" />
                <span>{inst}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Readiness Verification & Start Button */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">Participant Verification</h3>
              <p className="text-xs text-slate-500 font-medium">
                Logged in as <strong className="text-[#0F172A]">{user?.name || user?.email}</strong>
                {user?.teamName && <> (Team: <strong className="text-blue-600">{user.teamName}</strong>)</>}
              </p>
            </div>
          </div>

          <label htmlFor="quiz-acknowledgment" className={`flex items-start gap-3 p-4 rounded-2xl transition-colors ${
            isLive ? "bg-blue-50/50 border border-blue-100 cursor-pointer hover:bg-blue-50" : "bg-slate-50 border border-slate-200 opacity-60 cursor-not-allowed"
          }`}>
            <input
              id="quiz-acknowledgment"
              name="quizAcknowledgment"
              type="checkbox"
              disabled={!isLive}
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-xs font-semibold text-slate-700 leading-relaxed">
              I confirm that I am ready to begin the exam. I understand that once started, the timer will count down continuously and my answers will automatically submit when time expires.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <Link
              to="/participant/dashboard"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 text-center sm:text-left"
            >
              Cancel and return to dashboard
            </Link>

            {isLive ? (
              <button
                onClick={handleStartQuiz}
                disabled={!acknowledged || starting}
                className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  !acknowledged || starting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initializing Exam Session...</span>
                  </>
                ) : (
                  <>
                    <span>Start Examination</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : isCompleted ? (
              <button
                disabled
                className="bg-slate-200 text-slate-500 font-bold text-xs px-8 py-3.5 rounded-xl cursor-not-allowed"
              >
                Assessment Closed
              </button>
            ) : (
              <button
                disabled
                className="bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs px-6 py-3.5 rounded-xl flex items-center gap-2 cursor-not-allowed opacity-90 shadow-2xs"
              >
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span>{isUpcoming ? "Waiting for Scheduled Start Time..." : "Waiting for Admin to Start Quiz..."}</span>
              </button>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default QuizLobbyPage;
