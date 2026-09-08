import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Upload,
  LogOut,
  Clock,
  ArrowRight,
  CircleCheckBig,
  HelpCircle,
  Trophy,
  Sparkles,
  XCircle,
  Code,
  Video,
  Check,
  Layers,
  ChevronRight
} from "lucide-react";
import SEO from "../../components/layout/SEO";
import TeamReviewPage from "./TeamReviewPage";
import ProjectSubmissionPage from "./ProjectSubmissionPage";
import { db } from "../../config/firebase";
import { collection, getDocs, doc, getDoc, query, where, limit } from "firebase/firestore";
import { fetchRegistrations, fetchEvents } from "../../services/apiClient";
import { getAllQuizzes } from "../../services/quizService";
import { dataCache } from "../../utils/dataCache";
import type { Quiz, QuizSubmission } from "../../types/quiz";

export const ParticipantDashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"dashboard" | "review-team" | "submission" | "quizzes">("review-team");

  // Real Database State
  const [isQuizParticipant, setIsQuizParticipant] = useState<boolean>(false);
  const [isAccessGranted, setIsAccessGranted] = useState<boolean>(true);
  const [accessChecked, setAccessChecked] = useState<boolean>(false);
  const [targetRegId, setTargetRegId] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const [eventTitle, setEventTitle] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [leaderName, setLeaderName] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<Record<string, QuizSubmission>>({});

  // Submission Form State
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [demoVideoUrl, setDemoVideoUrl] = useState<string>("");
  const [submissionStatus, setSubmissionStatus] = useState<string>("Registered");
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  // Participant Round & Promotion Progression State
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number>(2);
  const [activeRoundName, setActiveRoundName] = useState<string>("Stage Evaluation");
  const [roundStatus, setRoundStatus] = useState<string>("Active");
  const [promotionScore, setPromotionScore] = useState<number | null>(null);
  const [promotionMethod, setPromotionMethod] = useState<string | null>(null);
  const [eliminatedInRound, setEliminatedInRound] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizPercentage, setQuizPercentage] = useState<number | null>(null);
  const [quizMaxScore, setQuizMaxScore] = useState<number | null>(null);

  // Team review confirmed state
  const [teamReviewConfirmed, setTeamReviewConfirmed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Helper to apply registration data to state
  const applyRegistrationData = (targetReg: any) => {
    if (!targetReg) return;
    const isQuiz = Boolean(
      targetReg.isQuiz === true ||
      targetReg.category === "Quiz" ||
      targetReg.category === "QUIZ" ||
      targetReg.eventCategory === "Quiz" ||
      targetReg.eventCategory === "QUIZ" ||
      targetReg.eventTitle?.toLowerCase().includes("quiz") ||
      targetReg.groupName === "Individual Registration" ||
      user?.teamName === "Individual Registration" ||
      user?.eventTitle?.toLowerCase().includes("quiz")
    );

    if (isQuiz) {
      setIsQuizParticipant(true);
      setActiveTab("quizzes");
    }

    const currentEventTitle = targetReg.eventTitle || "Hackathon";
    setTargetRegId(targetReg.id || "");
    setTeamName(targetReg.groupName || user?.teamName || (isQuiz ? "Individual Registration" : "My Team"));
    setEventTitle(currentEventTitle);
    setTeamId(targetReg.id ? `AI-${targetReg.id.substring(0, 4).toUpperCase()}-${targetReg.id.substring(4, 7).toUpperCase()}` : "AI-REG-001");
    setLeaderName(targetReg.teamLeadName || targetReg.fullName || targetReg.name || user?.name || "Participant");

    // Members
    const regMembers = Array.isArray(targetReg.members) ? targetReg.members : [];
    setMembers(regMembers);

    // Submission data
    setProjectTitle(targetReg.projectTitle || targetReg.title || "");
    setGithubUrl(targetReg.githubUrl || targetReg.githubLink || "");
    setDemoVideoUrl(targetReg.demoVideoUrl || targetReg.videoLink || "");
    setSubmissionStatus(targetReg.submissionStatus || targetReg.status || "Registered");
    if (targetReg.submittedAt) setSubmittedAt(targetReg.submittedAt);

    // Round & Promotion Data
    const cRound = targetReg.currentRound || targetReg.promotedToRound || 1;
    setCurrentRound(cRound);
    setRoundStatus(targetReg.roundStatus || (cRound > 1 ? "Qualified" : "Active"));
    if (targetReg.promotionScore !== undefined) setPromotionScore(targetReg.promotionScore);
    if (targetReg.promotionMethod) setPromotionMethod(targetReg.promotionMethod);
    if (targetReg.eliminatedInRound !== undefined) setEliminatedInRound(targetReg.eliminatedInRound);

    // Quiz Performance Data from Registration
    if (targetReg.quizScore !== undefined && targetReg.quizScore !== null) {
      setQuizScore(targetReg.quizScore);
    }
    if (targetReg.quizPercentage !== undefined && targetReg.quizPercentage !== null) {
      setQuizPercentage(targetReg.quizPercentage);
    }
    if (targetReg.quizMaxScore) {
      setQuizMaxScore(targetReg.quizMaxScore);
    }
  };

  // Fetch real team, submission data, and quizzes with instant cache
  useEffect(() => {
    const fetchRealData = async () => {
      const cleanEmail = user?.email?.toLowerCase().trim() || "";
      const cacheKey = `participant_reg_${cleanEmail || user?.uid || "guest"}`;

      // 1. Instant Cache Hydration (0ms paint)
      const cached = dataCache.get<any>(cacheKey);
      if (cached) {
        applyRegistrationData(cached);
        setIsAccessGranted(Boolean(cached.accessGranted !== false && cached.loginAccessGranted !== false));
        setAccessChecked(true);
      }

      try {
        let targetReg: any = null;

        // 2. High-speed Targeted Queries in Parallel
        const fetchTargetedReg = async (): Promise<any> => {
          try {
            const regs = await fetchRegistrations();

            if (!Array.isArray(regs) || regs.length === 0) return null;

            // A. If registrationId exists on profile, fetch directly
            if (user?.registrationId) {
              const found = regs.find((r: any) => (r.id || r._id || r._doc) === user.registrationId || r.id === user.registrationId);
              if (found) return { id: found.id || found._id || "", ...found };
            }

            // B. Targeted email queries
            if (cleanEmail) {
              const leadMatch = regs.find((r: any) => (r.teamLeadEmail || "")?.toLowerCase().trim() === cleanEmail);
              if (leadMatch) return { id: leadMatch.id || leadMatch._id || "", ...leadMatch };
              const teamEmailMatch = regs.find((r: any) => (r.teamEmail || "")?.toLowerCase().trim() === cleanEmail);
              if (teamEmailMatch) return { id: teamEmailMatch.id || teamEmailMatch._id || "", ...teamEmailMatch };
            }

            // C. Fallback: search members or teamName
            if (cleanEmail) {
              const foundByMember = regs.find((r: any) => {
                const leadEmail = (r.teamLeadEmail || "").toLowerCase().trim();
                const tEmail = (r.teamEmail || "").toLowerCase().trim();
                if (leadEmail === cleanEmail || tEmail === cleanEmail) return true;
                if (Array.isArray(r.members) && r.members.some((m: any) => (m.email || "").toLowerCase().trim() === cleanEmail)) return true;
                return false;
              });
              if (foundByMember) return { id: foundByMember.id || foundByMember._id || "", ...foundByMember };
            }

            if (user?.teamName) {
              const tn = user.teamName.toLowerCase().trim();
              if (tn !== "team alpha-9" && tn !== "my team") {
                const foundByName = regs.find((r: any) => ((r.groupName || "") as string).toLowerCase().trim() === tn);
                if (foundByName) return { id: foundByName.id || foundByName._id || "", ...foundByName };
              }
            }

            return null;
          } catch (err) {
            console.warn("Targeted reg fetch via API failed, falling back:", err);
            return null;
          }
        };

        // Run data fetches in parallel
        const [foundReg, quizzesList] = await Promise.all([
          fetchTargetedReg(),
          getAllQuizzes().catch(() => [])
        ]);

        targetReg = foundReg;

        // Fetch participant's existing quiz submissions in parallel
        if (user?.uid) {
          getDocs(query(collection(db, "quizSubmissions"), where("userId", "==", user.uid)))
            .then((subSnap) => {
              const subMap: Record<string, QuizSubmission> = {};
              subSnap.forEach((d) => {
                const s = { id: d.id, ...d.data() } as QuizSubmission;
                if (s.quizId) subMap[s.quizId] = s;
              });
              setUserSubmissions(subMap);
            })
            .catch((e) => console.warn("Error fetching user quiz submissions:", e));
        }

        // Active quizzes filter
        if (Array.isArray(quizzesList)) {
          const activeQz = quizzesList.filter(q => {
            if (q.status !== "active") return false;
            if (targetReg?.eventId && q.eventId) {
              return q.eventId === targetReg.eventId;
            }
            if (targetReg?.eventTitle && q.eventTitle) {
              return q.eventTitle.toLowerCase().trim() === targetReg.eventTitle.toLowerCase().trim();
            }
            return !q.eventId;
          });
          setAvailableQuizzes(activeQz);
        }

        if (targetReg) {
          // If access was revoked, immediately logout and redirect to /login
          if (targetReg.accessGranted === false || targetReg.loginAccessGranted === false) {
            console.warn("[ParticipantDashboard] Access was revoked. Redirecting to login...");
            dataCache.invalidate(`participant_reg_${cleanEmail || user?.uid}`);
            await logout();
            window.location.href = "/login";
            return;
          }

          const hasAccess = Boolean(
            targetReg.accessGranted === true ||
            targetReg.loginAccessGranted === true
          );
          setIsAccessGranted(hasAccess);
          setAccessChecked(true);

          applyRegistrationData(targetReg);
          dataCache.set(cacheKey, targetReg);

          // Fetch stage definitions if needed
          if (targetReg.eventId) {
            try {
              const events = await fetchEvents();
              const ev = (events || []).find((e: any) => (e.id || e._id || "") === targetReg.eventId || e._id === targetReg.eventId || e.id === targetReg.eventId);
              if (ev) {
                if (
                  ev.category === "Quiz" ||
                  ev.category === "QUIZ" ||
                  (ev.title && String(ev.title).toLowerCase().includes("quiz"))
                ) {
                  setIsQuizParticipant(true);
                  setActiveTab("quizzes");
                }
                const cRound = targetReg.currentRound || targetReg.promotedToRound || 1;
                if (Array.isArray(ev.rounds) && ev.rounds.length > 0) {
                  setTotalRounds(ev.rounds.length);
                  const currentRDef = ev.rounds.find((r: any) => r.roundNumber === cRound);
                  if (currentRDef?.name) setActiveRoundName(currentRDef.name);
                } else if (ev.totalRounds) {
                  setTotalRounds(ev.totalRounds);
                }
              }
            } catch (err) {
              console.warn("Error fetching event doc by eventId via API:", err);
            }
          }
        } else {
          let hasAccess = true;
          if (user?.registrationId) {
            try {
              const regDoc = await getDoc(doc(db, "registrations", user.registrationId));
              if (regDoc.exists()) {
                const rData = regDoc.data();
                hasAccess = Boolean(rData.accessGranted === true || rData.loginAccessGranted === true);
              }
            } catch (e) {}
          }
          setIsAccessGranted(hasAccess);
          setAccessChecked(true);

          const isQuizFallback = Boolean(
            user?.teamName === "Individual Registration" ||
            user?.eventTitle?.toLowerCase().includes("quiz")
          );
          if (isQuizFallback) {
            setIsQuizParticipant(true);
            setActiveTab("quizzes");
          }
          setTeamName(user?.teamName || (user?.name ? `${user.name}'s Team` : "My Team"));
          setEventTitle("General Track");
          setTeamId(user?.uid ? `AI-${user.uid.substring(0, 4).toUpperCase()}-${user.uid.substring(4, 7).toUpperCase()}` : "AI-REG");
          setLeaderName(user?.name || "Participant");
        }
      } catch (err) {
        console.error("Error fetching participant dashboard data:", err);
        setAccessChecked(true);
      }
    };

    fetchRealData();
  }, [user]);

  // Real-time access revocation watcher on target registration
  useEffect(() => {
    const regIdToWatch = targetRegId || user?.registrationId;
    if (!regIdToWatch) return;

    let poll: any = null;
    const check = async () => {
      try {
        const snap = await getDoc(doc(db, "registrations", regIdToWatch));
        if (snap.exists()) {
          const data = snap.data();
          if (data.accessGranted === false || data.loginAccessGranted === false) {
            console.warn("[ParticipantDashboard] Real-time revoke detected on registration:", regIdToWatch);
            logout().finally(() => { window.location.href = "/login"; });
          }
        }
      } catch (err) {
        console.warn("Registration check error:", err);
      }
    };
    check();
    poll = setInterval(check, 5000);
    return () => { if (poll) clearInterval(poll); };
  }, [targetRegId, user?.registrationId, logout]);

  const getInitials = (name: string) => {
    if (!name) return "PU";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Calculate submission progress
  const getSubmissionProgress = () => {
    let progress = 20; // base registered
    if (teamReviewConfirmed) progress += 20;
    if (projectTitle) progress += 20;
    if (githubUrl) progress += 20;
    if (demoVideoUrl) progress += 10;
    if (submissionStatus === "Submitted") progress = 100;
    return Math.min(progress, 100);
  };

  const submissionProgress = getSubmissionProgress();

  const handleConfirmAndContinue = () => {
    setTeamReviewConfirmed(true);
    setActiveTab("dashboard");
  };

  // Sidebar items
  const sidebarItems = isQuizParticipant
    ? [
        { id: "quizzes" as const, label: "Online Quiz", icon: HelpCircle },
      ]
    : [
        { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
        { id: "quizzes" as const, label: "Online Quiz", icon: HelpCircle },
        { id: "review-team" as const, label: "Team", icon: Users },
        { id: "submission" as const, label: "Submission", icon: Upload },
      ];

  return (
    <div className="h-screen bg-[#F4F7FC] flex font-sans text-slate-800 antialiased overflow-hidden selection:bg-blue-500/20 selection:text-blue-600">
      <SEO
        title="Participant Portal - AI Verse"
        description="Manage team details, submit projects, and view evaluation status."
      />

      {/* Fixed Left Sidebar - Modern Clean Light Theme */}
      <aside className="w-[260px] h-screen border-r border-slate-200/90 bg-white flex flex-col justify-between shrink-0 z-20 sticky top-0 overflow-y-auto shadow-xs">
        <div className="p-5 space-y-6">
          {/* Logo Header */}
          <Link to="/" className="flex items-center gap-3 px-2 group">
            <div className="relative">
              <img src="/ai_verse.png" alt="AI Verse Logo" className="w-9 h-9 rounded-xl object-contain shadow-sm shadow-blue-500/20 ring-1 ring-slate-200" />
            </div>
            <div>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight block leading-none">AI Verse</span>
              <span className="text-[10px] text-blue-600 font-bold tracking-wider block mt-1 uppercase">
                {isQuizParticipant ? "Quiz Portal" : "Participant Portal"}
              </span>
              {accessChecked && !isAccessGranted && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 tracking-wider">
                  Access Pending
                </span>
              )}
            </div>
          </Link>

          {/* Navigation */}
          <nav className="space-y-1.5">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (accessChecked && !isAccessGranted) return;
                  setActiveTab(item.id);
                }}
                disabled={accessChecked && !isAccessGranted}
                className={`w-full px-4 py-3 rounded-2xl flex items-center gap-3.5 text-sm font-semibold transition-all text-left cursor-pointer ${activeTab === item.id
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-blue-500/30"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                  } ${accessChecked && !isAccessGranted ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <item.icon className={`w-5 h-5 ${activeTab === item.id ? "text-white" : "text-slate-500"}`} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom Section: User Profile + Logout */}
        <div className="p-5 space-y-3 border-t border-slate-100">
          {/* User Profile Card */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl shadow-2xs">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm shadow-blue-500/20 ring-1 ring-white">
              {getInitials(leaderName || user?.name || "P")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{leaderName || user?.name || "Participant"}</p>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                {isQuizParticipant ? "Quiz Participant" : "Team Participant"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:text-red-600 font-semibold text-sm transition-colors text-left cursor-pointer rounded-xl hover:bg-red-50"
          >
            <LogOut className="w-4.5 h-4.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content (Scrollable Right Panel) */}
      <div className="flex-1 min-w-0 h-screen flex flex-col bg-gradient-to-br from-[#F8FAFC] via-[#EEF2FF]/60 to-[#F1F5F9] overflow-y-auto">

        {/* If Access is Pending (Organizers have not activated login access yet) */}
        {accessChecked && !isAccessGranted ? (
          <main className="p-8 max-w-xl w-full mx-auto flex-1 flex items-center justify-center">
            <div className="bg-white border border-amber-200/90 rounded-3xl p-8 sm:p-10 shadow-lg text-center space-y-6 animate-in fade-in zoom-in-95 duration-200 w-full">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-inner">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3.5 py-1 rounded-full text-amber-800 text-[11px] font-extrabold uppercase tracking-wider shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Access Pending
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Login Access Not Activated Yet
                </h2>
                <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-md mx-auto">
                  Your registration for <span className="font-bold text-slate-900">{eventTitle || "this event"}</span> is recorded, but the event coordinators have not activated portal access yet.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 text-left space-y-2">
                <p className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Registration Status</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-bold">STATUS: PENDING ACTIVATION</span>
                </p>
                <p>• Name: <strong className="text-slate-800">{leaderName || user?.name || "Participant"}</strong></p>
                {teamId && <p>• Participant ID: <span className="font-mono text-slate-700 font-bold">{teamId}</span></p>}
                <p>• Event: <strong className="text-slate-800">{eventTitle}</strong></p>
                <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                  Once the event coordinators activate access from the admin portal, click refresh to enter your examination.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-[#2563EB] hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  Check Status / Refresh
                </button>
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>
          </main>
        ) : (
          /* Tab Body */
          <main className="p-8 space-y-8 max-w-6xl w-full mx-auto flex-1">

            {/* Review Team Tab (Only for Hackathons) */}
            {activeTab === "review-team" && !isQuizParticipant && (
              <TeamReviewPage
                embedded={true}
                onConfirm={handleConfirmAndContinue}
              />
            )}

            {/* ==================== CLEAN, MODERN & ATTRACTIVE DASHBOARD (Only for Hackathons) ==================== */}
            {activeTab === "dashboard" && !isQuizParticipant && (
            <div className="space-y-6 animate-in fade-in duration-300">

              {/* 1. HERO GREETING & CONTEXT BAR */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200/60 flex items-center gap-1.5 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      {eventTitle}
                    </span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                      Team ID: <span className="font-mono text-slate-800 font-extrabold">{teamId}</span>
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      {roundStatus === "Qualified" || currentRound > 1 ? `Qualified for Round ${currentRound}` : "Round 1 Active"}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
                    Welcome back, {teamName || user?.teamName || leaderName || user?.name || "Participant"}! 👋
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
                    Here is your live competition status, assigned assessments, and project deliverables for <span className="font-bold text-slate-700">{eventTitle}</span>.
                  </p>
                </div>

                <div className="flex items-center gap-3 relative z-10 flex-wrap">
                  <button
                    onClick={() => setActiveTab("quizzes")}
                    className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200/80 transition-all flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <HelpCircle className="w-4 h-4 text-purple-600" />
                    <span>Online Quizzes</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("submission")}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Upload className="w-4 h-4 text-white" />
                    <span>Project Submission</span>
                  </button>
                </div>
              </div>

              {/* 2. 🏆 PROMOTION ANNOUNCEMENT BANNER */}
              {(currentRound > 1 || roundStatus === "Qualified") && (
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 p-0.5 rounded-3xl shadow-lg shadow-emerald-600/10 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-[#0A1128] rounded-[22px] p-5 sm:p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30 shrink-0">
                        <Trophy className="w-6 h-6 text-slate-900" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            PROMOTION QUALIFIED
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-300" /> STAGE {currentRound} ACTIVE
                          </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                          🎉 Congratulations! Team "{teamName}" has advanced to Round {currentRound}
                        </h3>
                        <p className="text-xs text-slate-300 font-medium">
                          Shortlisted via {promotionMethod || "Performance Assessment"} {promotionScore !== null ? `• Qualifying Score: ${promotionScore} Marks` : ""} • Your team is eligible to submit Round {currentRound} requirements.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab("submission")}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 shrink-0 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Stage {currentRound} Deliverables</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ⚠️ ELIMINATION STATUS NOTICE */}
              {roundStatus === "Eliminated" && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 sm:p-5 rounded-3xl flex items-center justify-between gap-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-red-300">Competition Status: Eliminated in Round {eliminatedInRound || currentRound}</h4>
                      <p className="text-xs text-slate-400 font-medium">Thank you for your innovation and participation in {eventTitle}. Feedback and participation certificates will be published shortly.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. FOUR ESSENTIAL LIVE METRIC TILES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Tile 1: Stage & Round */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3 hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Stage</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#0F172A]">Round {currentRound} of {totalRounds}</h3>
                    <p className="text-xs font-bold text-blue-600 mt-0.5 truncate">{activeRoundName}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Status</span>
                    <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      {roundStatus === "Qualified" || currentRound > 1 ? "✓ Qualified" : "Active"}
                    </span>
                  </div>
                </div>

                {/* Tile 2: Online Quiz Score */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3 hover:border-purple-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Online Quiz</span>
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200/60">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#0F172A]">
                      {quizScore !== null 
                        ? `${quizScore} / ${quizMaxScore || 100}` 
                        : Object.keys(userSubmissions).length > 0 
                          ? "Submitted ✓" 
                          : "Assessment Pending"}
                    </h3>
                    <p className="text-xs font-bold text-purple-600 mt-0.5">
                      {quizPercentage !== null ? `${quizPercentage}% Score Achieved` : "Preliminary Round"}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Cutoff Result</span>
                    <button 
                      onClick={() => setActiveTab("quizzes")}
                      className="font-extrabold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{quizScore !== null ? "View Details" : "Take Exam"}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Tile 3: Team Squad */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3 hover:border-emerald-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Team Squad</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#0F172A]">{members.length + 1} Member(s)</h3>
                    <p className="text-xs font-bold text-emerald-700 mt-0.5 truncate">Team: {teamName}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span className="truncate max-w-[120px]" title={leaderName}>Lead: {leaderName}</span>
                    <button 
                      onClick={() => setActiveTab("review-team")}
                      className="font-extrabold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Tile 4: Project Submission */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3 hover:border-amber-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Submission</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
                      <Upload className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#0F172A]">
                      {submissionStatus === "Submitted" ? "Submitted ✓" : `${submissionProgress}% Complete`}
                    </h3>
                    <p className="text-xs font-bold text-amber-700 mt-0.5 truncate">
                      {projectTitle ? projectTitle : "Draft in Progress"}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>{submissionStatus === "Submitted" ? "In Queue" : "Editable"}</span>
                    <button 
                      onClick={() => setActiveTab("submission")}
                      className="font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{submissionStatus === "Submitted" ? "Review" : "Upload"}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>

              {/* 4. MAIN 2-COLUMN SECTION: DELIVERABLES HUB & SIDEBAR WIDGETS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT 2-COLS: PROJECT DELIVERABLES COMMAND CENTER */}
                <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                          DELIVERABLES HUB
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-[#0F172A] mt-1 tracking-tight">
                        Project & Submission Checklist
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Complete all deliverables for your track to ensure eligibility for jury scoring.
                      </p>
                    </div>

                    <span className={`self-start sm:self-auto font-bold text-xs px-3.5 py-1.5 rounded-full ${
                      submissionStatus === "Submitted"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {submissionStatus === "Submitted" ? "✓ Final Submitted" : "Draft Status"}
                    </span>
                  </div>

                  {/* Project Summary Banner */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Title</span>
                      {submittedAt && (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Submitted on {new Date(submittedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-extrabold text-[#0F172A]">
                      {projectTitle || "No Project Title Set Yet"}
                    </h4>
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60 text-xs flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-slate-600">
                        <Code className="w-4 h-4 text-blue-600" />
                        <span>GitHub:</span>
                        {githubUrl ? (
                          <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-xs font-semibold">
                            Connected ✓
                          </a>
                        ) : (
                          <span className="text-slate-400 font-medium">Not provided</span>
                        )}
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1.5 font-bold text-slate-600">
                        <Video className="w-4 h-4 text-indigo-600" />
                        <span>Demo Video:</span>
                        {demoVideoUrl ? (
                          <a href={demoVideoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate max-w-xs font-semibold">
                            Attached ✓
                          </a>
                        ) : (
                          <span className="text-slate-400 font-medium">Not provided</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Live Deliverables Checklist */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Stage Milestone Checklist
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Step 1 */}
                      <div className="p-4 rounded-2xl border bg-emerald-50/50 border-emerald-200/80 flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#0F172A]">1. Team Roster Verified</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">{members.length + 1} Member(s) Registered</p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                        quizScore !== null || Object.keys(userSubmissions).length > 0
                          ? "bg-emerald-50/50 border-emerald-200/80"
                          : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                          quizScore !== null || Object.keys(userSubmissions).length > 0
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 text-slate-500"
                        }`}>
                          {quizScore !== null || Object.keys(userSubmissions).length > 0 ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <span className="text-[10px] font-bold">2</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#0F172A]">2. Online Assessment</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {quizScore !== null ? `Score: ${quizScore}/${quizMaxScore || 100} (${quizPercentage}%)` : "Complete Track Quiz"}
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                        githubUrl ? "bg-emerald-50/50 border-emerald-200/80" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                          githubUrl ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                        }`}>
                          {githubUrl ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">3</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#0F172A]">3. Code Repository</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {githubUrl ? "GitHub Repo Linked" : "Add Public Repo URL"}
                          </p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                        submissionStatus === "Submitted" ? "bg-emerald-50/50 border-emerald-200/80" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                          submissionStatus === "Submitted" ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                        }`}>
                          {submissionStatus === "Submitted" ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">4</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#0F172A]">4. Final Submission</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {submissionStatus === "Submitted" ? "Locked for Judging" : "Review & Confirm"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button Row */}
                  <div className="pt-3 flex items-center justify-between flex-wrap gap-3 border-t border-slate-100">
                    <button
                      onClick={() => setActiveTab("review-team")}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Review Team Squad
                    </button>

                    <button
                      onClick={() => setActiveTab("submission")}
                      className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>{submissionStatus === "Submitted" ? "Edit Project Submission" : "Proceed with Submission"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* RIGHT 1-COL: TEAM SQUAD ROSTER */}
                <div className="space-y-6">

                  {/* Team Squad Summary Widget */}
                  <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-black text-[#0F172A]">Team Squad</h3>
                        <p className="text-[11px] text-slate-400 font-medium">{members.length + 1} Registered</p>
                      </div>
                      <button
                        onClick={() => setActiveTab("review-team")}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* Leader Card */}
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50/60 border border-blue-100/80">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                          {getInitials(leaderName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#0F172A] truncate">{leaderName}</p>
                          <p className="text-[10px] text-blue-600 font-extrabold">Team Lead</p>
                        </div>
                      </div>

                      {/* Members List */}
                      {members.map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                            {getInitials(m.name || "M")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-[#0F172A] truncate">{m.name || "Member"}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{m.role || "Developer"}</p>
                          </div>
                        </div>
                      ))}

                      {members.length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-400 font-medium">
                          No additional members added yet
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* Project Submission Tab (Only for Hackathons) */}
          {activeTab === "submission" && !isQuizParticipant && (
            <ProjectSubmissionPage
              targetRegId={targetRegId}
              initialData={{
                githubUrl,
                demoVideoUrl,
                submissionStatus,
                submittedAt
              }}
              onSuccess={() => {
                setSubmissionStatus("Submitted");
                setSubmittedAt(Date.now());
              }}
              embedded={true}
            />
          )}

          {/* TAB 5: ONLINE QUIZ & ASSESSMENTS */}
          {(activeTab === "quizzes" || isQuizParticipant) && (
            <div className="max-w-4xl w-full mx-auto space-y-6">
              {/* Quiz Participant Greeting Card */}
              {isQuizParticipant && (
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden text-left animate-in fade-in duration-200">
                  <div className="space-y-1.5 relative z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200/70 flex items-center gap-1.5 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                        {eventTitle || "Quiz Competition"}
                      </span>
                      {teamId && (
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                          Participant ID: <span className="font-mono text-slate-800 font-extrabold">{teamId}</span>
                        </span>
                      )}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                      Welcome, {leaderName || user?.name || "Participant"}! 👋
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">
                      All quizzes and assessments assigned to you are listed below. Click Start / Take Exam when the test goes live.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-left">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">
                      EXAMINATION HUB
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] mt-2 tracking-tight">
                    Online Quizzes & Assessments
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    Complete your assigned track quizzes within the allotted time. Your answers are continually autosaved.
                  </p>
                </div>

                {availableQuizzes.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                    <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                    <h3 className="text-sm font-extrabold text-[#0F172A]">No Active Quizzes Scheduled</h3>
                    <p className="text-xs text-slate-400 font-medium">Check back when the event organizers publish the assessment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableQuizzes.map((quiz) => {
                      const now = Date.now();
                      const userSub = userSubmissions[quiz.id];
                      const isSubmitted = !!userSub;
                      const hasScore = userSub && userSub.score !== undefined && userSub.score !== null;
                      const maxQScore = userSub?.maxScore || quiz.totalMarks || (quiz.questions?.length ? quiz.questions.length * 2 : 50);

                      const isLive = Boolean(
                        !isSubmitted &&
                        quiz.status === "active" &&
                        quiz.scheduledStartTime &&
                        quiz.scheduledStartTime <= now &&
                        (!quiz.scheduledEndTime || quiz.scheduledEndTime > now)
                      );
                      const isCompleted = Boolean(
                        quiz.status === "completed" ||
                        (quiz.scheduledEndTime && quiz.scheduledEndTime <= now && quiz.scheduledStartTime)
                      );
                      const isUpcoming = Boolean(!isSubmitted && quiz.scheduledStartTime && quiz.scheduledStartTime > now);

                      return (
                        <div
                          key={quiz.id}
                          className={`border rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all ${
                            isSubmitted 
                              ? "bg-white border-blue-200/80 shadow-xs" 
                              : "bg-slate-50 border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                                {quiz.track || "General"}
                              </span>
                              
                              {isSubmitted ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                    <CircleCheckBig className="w-3 h-3 text-emerald-600" />
                                    <span>Submitted</span>
                                  </span>
                                  {hasScore && (
                                    <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                      Score: {userSub.score} / {maxQScore} ({userSub.percentage}%)
                                    </span>
                                  )}
                                </div>
                              ) : isLive ? (
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Now
                                </span>
                              ) : isCompleted ? (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                  Concluded
                                </span>
                              ) : isUpcoming ? (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-indigo-500" /> Scheduled
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Waiting for Admin
                                </span>
                              )}
                            </div>

                            <h3 className="text-base font-extrabold text-[#0F172A] leading-tight">{quiz.title}</h3>
                            <p className="text-xs text-slate-500 font-medium line-clamp-2">{quiz.description}</p>
                          </div>

                          <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
                            <span className="text-xs font-bold text-slate-500">
                              {quiz.questions?.length || quiz.questionsCount || 0} Questions • {quiz.durationMinutes}m
                            </span>

                            {isSubmitted ? (
                              <Link
                                to={`/participant/quiz/${quiz.id}/completed`}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trophy className="w-3.5 h-3.5 text-blue-600" />
                                <span>View Scorecard</span>
                              </Link>
                            ) : (
                              <Link
                                to={`/participant/quiz/${quiz.id}/lobby`}
                                className={`text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isLive 
                                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" 
                                    : "bg-[#0F172A] hover:bg-slate-800"
                                }`}
                              >
                                <span>{isLive ? "Enter Exam" : "Enter Lobby"}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </div>
          )}

        </main>
        )}
      </div>
    </div>
  );
};

export default ParticipantDashboardPage;
