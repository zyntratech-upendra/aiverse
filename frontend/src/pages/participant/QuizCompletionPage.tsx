import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { Quiz, QuizSubmission } from "../../types/quiz";
import { getDeterministicSessionId, evaluateQuizAnswers, getQuizById } from "../../services/quizService";
import SEO from "../../components/layout/SEO";
import { 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  ChevronRight,
  ShieldAlert,
  Award,
  BarChart3,
  Check,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export const QuizCompletionPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuth();
  const location = useLocation();

  const [submission, setSubmission] = useState<QuizSubmission | null>(
    (location.state as any)?.submission || null
  );
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [showReview, setShowReview] = useState<boolean>(false);

  // Fetch Quiz & Submission details with automatic score backfill
  useEffect(() => {
    if (!quizId) return;

    const loadData = async () => {
      try {
        // 1. Fetch Quiz definition
        const loadedQuiz = await getQuizById(quizId);
        if (loadedQuiz) {
          setQuiz(loadedQuiz);
        }

        // 2. Fetch Submission if not already provided in state
        let currentSub = submission;
        if (!currentSub && user) {
          const sessionId = getDeterministicSessionId(quizId, user.uid);
          const docSnap = await getDoc(doc(db, "quizSubmissions", sessionId));
          if (docSnap.exists()) {
            currentSub = { id: docSnap.id, ...docSnap.data() } as QuizSubmission;
          }
        }

        // 3. Auto-evaluate score if missing
        if (currentSub && (currentSub.score === undefined || currentSub.score === null) && loadedQuiz) {
          const evalData = evaluateQuizAnswers(loadedQuiz, currentSub.answers || {});
          const updatedSub: QuizSubmission = {
            ...currentSub,
            ...evalData,
            evaluatedAt: Date.now()
          };
          setSubmission(updatedSub);

          // Persist backfill to Firestore
          updateDoc(doc(db, "quizSubmissions", currentSub.id), {
            score: evalData.score,
            maxScore: evalData.maxScore,
            percentage: evalData.percentage,
            correctCount: evalData.correctCount,
            incorrectCount: evalData.incorrectCount,
            passed: evalData.passed,
            evaluatedAt: Date.now()
          }).catch(() => {});
        } else if (currentSub) {
          setSubmission(currentSub);
        }
      } catch (err) {
        console.error("Error fetching quiz submission receipt:", err);
      }
    };

    loadData();
  }, [quizId, user]);

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const violationsCount = submission?.violationsCount || 0;
  const violationLogs = submission?.violationLogs || [];

  const maxScore = submission?.maxScore || quiz?.totalMarks || (quiz?.questions?.length ? quiz.questions.length * 2 : 50);
  const score = submission?.score ?? 0;
  const percentage = submission?.percentage !== undefined ? submission.percentage : (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);
  const isPassed = submission?.passed ?? (score >= (quiz?.passingMarks || Math.round(maxScore * 0.4)));
  const questions = quiz?.questions || [];
  const answers = submission?.answers || {};

  return (
    <div className="min-h-screen bg-[#F4F7FC] flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-500/20 selection:text-blue-600">
      <SEO 
        title="Assessment Completed - AI Verse" 
        description="Official submission receipt and score breakdown for AI Verse quiz assessment."
      />

      {/* Top Navbar */}
      <header className="h-16 px-6 sm:px-10 border-b border-slate-200/80 bg-white flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <Link to="/participant/dashboard" className="flex items-center gap-3">
          <img src="/ai_verse.png" alt="AI Verse Logo" className="w-8 h-8 rounded-xl object-contain" />
          <span className="text-sm font-extrabold text-[#0F172A] tracking-tight">AI Verse Assessment</span>
        </Link>

        <Link
          to="/participant/dashboard"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <span>Dashboard</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </header>

      {/* Main Receipt Content */}
      <main className="max-w-2xl w-full mx-auto p-6 sm:p-10 my-8 space-y-6">
        
        {/* Success & Score Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-sm text-center space-y-6">
          
          {/* Animated Success Badge */}
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10 animate-in zoom-in-75 duration-300">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
              SUBMISSION RECEIVED & EVALUATED
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
              Assessment Completed!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
              Your examination answers have been securely recorded, evaluated, and sealed in the AI Verse assessment registry.
            </p>
          </div>

          {/* Grand Score Display Hero */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <span className="text-blue-300 text-[11px] font-extrabold uppercase tracking-widest block">
                  Your Total Score
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {submission?.score !== undefined ? submission.score : "..."}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-slate-400">
                    / {maxScore}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white bg-white/10 backdrop-blur-md px-3 py-1 rounded-xl border border-white/20">
                    {percentage}% Accuracy
                  </span>
                </div>

                <div>
                  {isPassed ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Qualifying Benchmark Passed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Assessment Finalized</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1.5">
                <span>Passing Threshold: {quiz?.passingMarks || Math.round(maxScore * 0.4)} pts</span>
                <span>{score} / {maxScore} pts</span>
              </div>
              <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-700 rounded-full ${
                    isPassed ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-blue-500 to-indigo-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Submission Details Grid */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 text-left space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Quiz Title</span>
              <span className="font-extrabold text-[#0F172A]">{submission?.quizTitle || quiz?.title || "AI Verse Quiz"}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Participant</span>
              <span className="font-bold text-[#0F172A]">{submission?.userName || user?.name || user?.email}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Submission ID</span>
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                {submission?.id ? `SUB-${submission.id.substring(0, 8).toUpperCase()}` : "AI-SUB-RECORD"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Correct</span>
                <span className="text-base font-black text-emerald-600">
                  {submission?.correctCount !== undefined ? submission.correctCount : "-"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Incorrect</span>
                <span className="text-base font-black text-red-500">
                  {submission?.incorrectCount !== undefined ? submission.incorrectCount : "-"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Time Taken</span>
                <span className="text-base font-black text-blue-600">
                  {submission?.timeSpentSeconds ? formatSeconds(submission.timeSpentSeconds) : "-"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Violations</span>
                <span className={`text-base font-black ${violationsCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {violationsCount} {violationsCount === 0 ? "✓" : ""}
                </span>
              </div>
            </div>

            {/* Proctoring Integrity Details */}
            {violationsCount > 0 ? (
              <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Proctoring Audit: {violationsCount} Violation(s) Logged</span>
                </div>
                <p className="text-[11px] text-red-600 font-medium leading-relaxed">
                  During this assessment, {violationsCount} security anomaly / anti-cheating incidents (fullscreen exit, tab switch, right-click, or copy-paste attempt) were registered.
                </p>
                {violationLogs.length > 0 && (
                  <div className="pt-2 border-t border-red-200/60 space-y-1.5 max-h-32 overflow-y-auto">
                    {violationLogs.slice(0, 5).map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px] bg-white/80 px-2 py-1 rounded border border-red-100">
                        <span className="font-semibold text-slate-700 truncate">{log.message}</span>
                        <span className="text-slate-400 font-mono shrink-0 ml-2">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    {violationLogs.length > 5 && (
                      <div className="text-[10px] text-slate-400 text-center font-medium">
                        + {violationLogs.length - 5} more logged incidents
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Proctored Session Verified — Zero violations recorded.</span>
              </div>
            )}

            {submission?.submittedAt && (
              <div className="flex items-center justify-between pt-2 text-slate-400 text-[11px]">
                <span>Submitted on {new Date(submission.submittedAt).toLocaleDateString()}</span>
                <span>{new Date(submission.submittedAt).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Toggle Answer Sheet Review */}
          {questions.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden text-left">
              <button
                onClick={() => setShowReview(!showReview)}
                className="w-full bg-slate-50 hover:bg-slate-100 p-4 flex items-center justify-between text-xs font-extrabold text-[#0F172A] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span>Review Answer Sheet & Solutions ({questions.length} Questions)</span>
                </div>
                {showReview ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showReview && (
                <div className="p-4 space-y-4 bg-white border-t border-slate-200">
                  {questions.map((q, idx) => {
                    const userSelectedOptId = answers[q.id];
                    const isCorrect = userSelectedOptId && q.correctOptionId && userSelectedOptId.trim().toLowerCase() === q.correctOptionId.trim().toLowerCase();
                    const isUnanswered = !userSelectedOptId;

                    return (
                      <div
                        key={q.id || idx}
                        className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                          isCorrect 
                            ? "bg-emerald-50/40 border-emerald-200" 
                            : isUnanswered 
                              ? "bg-slate-50 border-slate-200" 
                              : "bg-red-50/40 border-red-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                              Q{q.questionNumber || idx + 1}
                            </span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                              {q.points || quiz?.pointsPerQuestion || 2} pts
                            </span>
                          </div>
                          <div>
                            {isCorrect ? (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Correct
                              </span>
                            ) : isUnanswered ? (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                                Unanswered
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <X className="w-3 h-3" /> Incorrect
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="font-extrabold text-[#0F172A] leading-relaxed">
                          {q.text}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt) => {
                            const isUserChoice = userSelectedOptId === opt.id;
                            const isOfficialCorrect = q.correctOptionId === opt.id;

                            let optStyle = "bg-white border-slate-200 text-slate-700";
                            if (isUserChoice && isOfficialCorrect) {
                              optStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-1 ring-emerald-500/20";
                            } else if (isUserChoice && !isOfficialCorrect) {
                              optStyle = "bg-red-50 border-red-500 text-red-900 font-bold ring-1 ring-red-500/20";
                            } else if (isOfficialCorrect) {
                              optStyle = "bg-emerald-50/60 border-emerald-400 border-dashed text-emerald-900 font-bold";
                            }

                            return (
                              <div key={opt.id} className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${optStyle}`}>
                                <span>{opt.id.replace("opt_", "").toUpperCase()}) {opt.text}</span>
                                {isUserChoice && isOfficialCorrect && (
                                  <span className="text-[9px] font-black uppercase text-emerald-700">✓ Your Answer</span>
                                )}
                                {isUserChoice && !isOfficialCorrect && (
                                  <span className="text-[9px] font-black uppercase text-red-700">✗ Your Answer</span>
                                )}
                                {!isUserChoice && isOfficialCorrect && (
                                  <span className="text-[9px] font-black uppercase text-emerald-700">✓ Correct Answer</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {q.explanation && (
                          <div className="p-2 bg-blue-50/60 border border-blue-100 rounded-lg text-[10px] text-blue-900">
                            <strong>Explanation:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Security & Verification Notice */}
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Cryptographically sealed & timestamped in AI Verse Cloud</span>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <Link
              to="/participant/dashboard"
              className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Return to Participant Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>

      </main>
    </div>
  );
};

export default QuizCompletionPage;
