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
  ChevronRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react";
import SEO from "../../components/layout/SEO";
import TeamReviewPage from "./TeamReviewPage";
import ProjectSubmissionPage from "./ProjectSubmissionPage";
import { db, collection, getDocs, doc, getDoc, query, where } from "../../config/firebase";
import { fetchRegistrations, fetchEvents, fetchSubmission } from "../../services/apiClient";
import { getAllQuizzes, getQuizById } from "../../services/quizService";
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

  // Quiz inline review state
  const [expandedQuizReviewId, setExpandedQuizReviewId] = useState<string | null>(null);
  const [quizDetailsCache, setQuizDetailsCache] = useState<Record<string, Quiz>>({});
  const [loadingReviewId, setLoadingReviewId] = useState<string | null>(null);

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
  const [activeRoundType, setActiveRoundType] = useState<string>("Screening");
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

    // Round & Promotion Data
    const cRound = targetReg.currentRound || targetReg.promotedToRound || 1;
    setCurrentRound(cRound);
    setRoundStatus(targetReg.roundStatus || (cRound > 1 ? "Qualified" : "Active"));
    if (targetReg.promotionScore !== undefined) setPromotionScore(targetReg.promotionScore);
    if (targetReg.promotionMethod) setPromotionMethod(targetReg.promotionMethod);
    if (targetReg.eliminatedInRound !== undefined) setEliminatedInRound(targetReg.eliminatedInRound);

    // Round-aware Submission data
    const rP = `r${cRound}_`;
    const isSubForCurrentRound = (targetReg as any)[`${rP}submissionStatus`] === "Submitted" || 
      !!(targetReg as any)[`${rP}submittedAt`] || 
      (Number(targetReg.submissionRound) === cRound && (targetReg.submissionStatus === "Submitted" || !!targetReg.submittedAt));
    
    const isDraftForCurrentRound = !isSubForCurrentRound && !!((targetReg as any)[`${rP}problemStatement`] || (Number(targetReg.submissionRound) === cRound && targetReg.problemStatement));

    if (isSubForCurrentRound) {
      setSubmissionStatus("Submitted");
      setSubmittedAt((targetReg as any)[`${rP}submittedAt`] || targetReg.submittedAt || Date.now());
      setProjectTitle((targetReg as any)[`${rP}problemStatement`] || (targetReg as any)[`${rP}selectedProblemStatement`]?.title || (Number(targetReg.submissionRound) === cRound ? (targetReg.projectTitle || targetReg.title || targetReg.problemStatement) : "") || `Round ${cRound} Project Submission`);
      setGithubUrl((targetReg as any)[`${rP}githubUrl`] || (targetReg as any)[`${rP}githubLink`] || (Number(targetReg.submissionRound) === cRound ? (targetReg.githubUrl || targetReg.githubLink) : "") || "");
      setDemoVideoUrl((targetReg as any)[`${rP}demoVideoUrl`] || (targetReg as any)[`${rP}videoLink`] || (Number(targetReg.submissionRound) === cRound ? (targetReg.demoVideoUrl || targetReg.videoLink) : "") || "");
    } else if (isDraftForCurrentRound) {
      setSubmissionStatus("Draft");
      setSubmittedAt(null);
      setProjectTitle((targetReg as any)[`${rP}problemStatement`] || (targetReg as any)[`${rP}selectedProblemStatement`]?.title || (Number(targetReg.submissionRound) === cRound ? (targetReg.projectTitle || targetReg.title || targetReg.problemStatement) : "") || "");
      setGithubUrl((targetReg as any)[`${rP}githubUrl`] || (targetReg as any)[`${rP}githubLink`] || (Number(targetReg.submissionRound) === cRound ? (targetReg.githubUrl || targetReg.githubLink) : "") || "");
      setDemoVideoUrl((targetReg as any)[`${rP}demoVideoUrl`] || (targetReg as any)[`${rP}videoLink`] || (Number(targetReg.submissionRound) === cRound ? (targetReg.demoVideoUrl || targetReg.videoLink) : "") || "");
    } else if (cRound === 1) {
      setSubmissionStatus(targetReg.submissionStatus || targetReg.status || "Registered");
      if (targetReg.submittedAt) setSubmittedAt(targetReg.submittedAt);
      setProjectTitle(targetReg.projectTitle || targetReg.title || targetReg.problemStatement || "");
      setGithubUrl(targetReg.githubUrl || targetReg.githubLink || "");
      setDemoVideoUrl(targetReg.demoVideoUrl || targetReg.videoLink || "");
    } else {
      setSubmissionStatus("Registered");
      setSubmittedAt(null);
      setProjectTitle("");
      setGithubUrl("");
      setDemoVideoUrl("");
    }

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
        const rawCachedStatus = String(cached.status || "").toLowerCase().trim();
        const cachedConfirmed = rawCachedStatus === "confirmed";
        setIsAccessGranted(Boolean(cachedConfirmed && cached.accessGranted !== false && cached.loginAccessGranted !== false));
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

        // Fetch participant's existing quiz submissions across all identifiers in parallel
        const subMap: Record<string, QuizSubmission> = {};
        const fetchSubmissionsFromAllSources = async () => {
          try {
            const queries = [];
            if (user?.uid) {
              queries.push(getDocs(query(collection(db, "quizSubmissions"), where("userId", "==", user.uid))));
            }
            if (cleanEmail) {
              queries.push(getDocs(query(collection(db, "quizSubmissions"), where("userEmail", "==", cleanEmail))));
            }
            if (targetReg?.id) {
              queries.push(getDocs(query(collection(db, "quizSubmissions"), where("teamId", "==", targetReg.id))));
            }

            const results = await Promise.allSettled(queries);
            results.forEach((res) => {
              if (res.status === "fulfilled" && res.value) {
                res.value.forEach((d: any) => {
                  const s = { id: d.id, ...d.data() } as QuizSubmission;
                  if (s.quizId) subMap[s.quizId] = s;
                });
              }
            });

            // If API has quizzes, also try to fetch submission for each quiz via API
            if (Array.isArray(quizzesList)) {
              await Promise.allSettled(
                quizzesList.map(async (q) => {
                  if (user?.uid && !subMap[q.id]) {
                    const sessionId = `${q.id.trim()}_${user.uid.trim()}`;
                    const subData = await fetchSubmission(sessionId).catch(() => null);
                    if (subData && (subData.id || subData._id)) {
                      subMap[q.id] = { id: subData.id || subData._id, ...subData } as QuizSubmission;
                    }
                  }
                })
              );
            }

            // Sync fallback scores from registration
            if (targetReg?.quizScore !== undefined && targetReg?.quizScore !== null) {
              setQuizScore(targetReg.quizScore);
              if (targetReg.quizPercentage !== undefined) setQuizPercentage(targetReg.quizPercentage);
              if (targetReg.quizMaxScore) setQuizMaxScore(targetReg.quizMaxScore);
            }

            setUserSubmissions((prev) => ({ ...prev, ...subMap }));
          } catch (e) {
            console.warn("Error fetching user quiz submissions:", e);
          }
        };

        fetchSubmissionsFromAllSources();

        // Include all quizzes for this event (active, scheduled, or completed)
        if (Array.isArray(quizzesList)) {
          const matchedQuizzes = quizzesList.filter(q => {
            if (targetReg?.eventId && q.eventId) {
              return q.eventId === targetReg.eventId;
            }
            if (targetReg?.eventTitle && q.eventTitle) {
              return q.eventTitle.toLowerCase().trim() === targetReg.eventTitle.toLowerCase().trim();
            }
            if (subMap[q.id] || userSubmissions[q.id]) {
              return true;
            }
            return !q.eventId;
          });
          setAvailableQuizzes(matchedQuizzes.length > 0 ? matchedQuizzes : quizzesList);
        }

        if (targetReg) {
          const rawStatus = String(targetReg.status || "").toLowerCase().trim();
          const isConfirmed = rawStatus === "confirmed";
          const isAccessAllowed = isConfirmed && targetReg.accessGranted !== false && targetReg.loginAccessGranted !== false;

          setIsAccessGranted(isAccessAllowed);
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
                // Update cRound to track the global event's currentRound to pair with Submission Monitoring
                const globalRound = ev.currentRound || targetReg.currentRound || targetReg.promotedToRound || 1;
                setCurrentRound(globalRound);
                const cRoundForType = globalRound;
                if (Array.isArray(ev.rounds) && ev.rounds.length > 0) {
                  setTotalRounds(ev.rounds.length);
                  const currentRDef = ev.rounds.find((r: any) => r.roundNumber === cRoundForType);
                  if (currentRDef?.name) setActiveRoundName(currentRDef.name);
                  if (currentRDef?.type) setActiveRoundType(currentRDef.type);
                } else if (ev.totalRounds) {
                  setTotalRounds(ev.totalRounds);
                }
              }
            } catch (err) {
              console.warn("Error fetching event doc by eventId via API:", err);
            }
          }
        } else {
          let hasAccess = false;
          if (user?.registrationId) {
            try {
              const regDoc = await getDoc(doc(db, "registrations", user.registrationId));
              if (regDoc.exists()) {
                const rData = regDoc.data();
                const isConfirmed = String(rData.status || "").toLowerCase().trim() === "confirmed";
                hasAccess = Boolean(isConfirmed && rData.accessGranted !== false && rData.loginAccessGranted !== false);
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

  // Toggle Quiz Question-by-Question Review with instant questions fetch
  const toggleQuizReview = async (quizId: string) => {
    if (expandedQuizReviewId === quizId) {
      setExpandedQuizReviewId(null);
      return;
    }
    setExpandedQuizReviewId(quizId);

    // Fetch full quiz definition if not cached or questions empty
    const existing = quizDetailsCache[quizId] || availableQuizzes.find((q) => q.id === quizId);
    if (!existing || !existing.questions || existing.questions.length === 0) {
      setLoadingReviewId(quizId);
      try {
        const fullQuiz = await getQuizById(quizId, true);
        if (fullQuiz) {
          setQuizDetailsCache((prev) => ({ ...prev, [quizId]: fullQuiz }));
        }
      } catch (err) {
        console.warn("Error fetching full quiz details for review:", err);
      } finally {
        setLoadingReviewId(null);
      }
    }

    // Also fetch submission answers if not present in memory
    if (!userSubmissions[quizId]?.answers && user?.uid) {
      try {
        const sessionId = `${quizId.trim()}_${user.uid.trim()}`;
        const subData = await fetchSubmission(sessionId).catch(() => null);
        if (subData && (subData.id || subData._id)) {
          setUserSubmissions((prev) => ({
            ...prev,
            [quizId]: { id: subData.id || subData._id, ...subData } as QuizSubmission
          }));
        }
      } catch (e) {}
    }
  };

  // Sidebar items: Always include Online Quiz so Round 2 & Round 1 participants can view answers & scores at any time
  const sidebarItems: Array<{ id: "dashboard" | "quizzes" | "review-team" | "submission"; label: string; icon: any }> = isQuizParticipant
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
                    <span>Online Quizzes {quizScore !== null ? `(${quizScore}/${quizMaxScore || 50})` : ""}</span>
                  </button>
                  
                  {!isQuizParticipant && (
                    <button
                      onClick={() => setActiveTab("submission")}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Upload className="w-4 h-4 text-white" />
                      <span>Project Submission</span>
                    </button>
                  )}
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
                          {quizScore !== null && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-400/30">
                              Quiz Score: {quizScore} / {quizMaxScore || 50} ({quizPercentage}%)
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                          🎉 Congratulations! Team "{teamName}" has advanced to Round {currentRound}
                        </h3>
                        <p className="text-xs text-slate-300 font-medium">
                          Shortlisted via {promotionMethod === "quiz" ? "Online Quiz Assessment" : promotionMethod || "Performance Assessment"} {quizScore !== null ? `• Qualifying Quiz Score: ${quizScore}/${quizMaxScore || 50} (${quizPercentage}%)` : promotionScore !== null ? `• Qualifying Score: ${promotionScore} Marks` : ""} • You can review your quiz answers and submit Round {currentRound} deliverables below.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                      <button
                        onClick={() => setActiveTab("quizzes")}
                        className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all border border-white/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <HelpCircle className="w-4 h-4 text-amber-400" />
                        <span>View Quiz Score & Answers</span>
                      </button>
                      <button
                        onClick={() => setActiveTab(activeRoundType === "Quiz" ? "quizzes" : "submission")}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{activeRoundType === "Quiz" ? `Stage ${currentRound} Quiz` : `Stage ${currentRound} Deliverables`}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
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

                {/* Tile 2: Online Quiz Score - ALWAYS VISIBLE */}
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
                        ? `${quizScore} / ${quizMaxScore || 50}` 
                        : Object.keys(userSubmissions).length > 0 && Object.values(userSubmissions)[0]?.score !== undefined
                          ? `${Object.values(userSubmissions)[0].score} / ${Object.values(userSubmissions)[0].maxScore || 50}`
                          : Object.keys(userSubmissions).length > 0 
                            ? "Submitted ✓" 
                            : "Assessment Pending"}
                    </h3>
                    <p className="text-xs font-bold text-purple-600 mt-0.5">
                      {quizPercentage !== null 
                        ? `${quizPercentage}% Score Achieved` 
                        : Object.keys(userSubmissions).length > 0 && Object.values(userSubmissions)[0]?.percentage !== undefined
                          ? `${Object.values(userSubmissions)[0].percentage}% Score Achieved`
                          : currentRound > 1
                            ? "Round 1 Quiz Completed"
                            : "Preliminary Assessment"}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Performance</span>
                    <button 
                      onClick={() => setActiveTab("quizzes")}
                      className="font-extrabold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{quizScore !== null || Object.keys(userSubmissions).length > 0 ? "View Answers & Score" : "Take Exam"}</span>
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
                {(!isQuizParticipant && activeRoundType !== "Quiz") && (
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
                )}

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
                      <div className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                        quizScore !== null || Object.keys(userSubmissions).length > 0
                          ? "bg-emerald-50/50 border-emerald-200/80"
                          : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-start gap-3 min-w-0">
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
                              {quizScore !== null ? `Score: ${quizScore}/${quizMaxScore || 50} (${quizPercentage}%)` : Object.keys(userSubmissions).length > 0 ? "Quiz Assessment Submitted" : "Complete Track Quiz"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveTab("quizzes")}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 shrink-0 self-center hover:underline cursor-pointer"
                        >
                          View Answers →
                        </button>
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

          {/* Project Submission Tab */}
          {activeTab === "submission" && !isQuizParticipant && (
            <ProjectSubmissionPage
              targetRegId={targetRegId}
              activeRoundType={activeRoundType}
              initialData={{
                githubUrl,
                demoVideoUrl,
                submissionStatus,
                submittedAt,
                currentRound
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
                  <div className="space-y-6">
                    {availableQuizzes.map((quiz) => {
                      const now = Date.now();
                      const userSub = userSubmissions[quiz.id];
                      const isSubmitted = Boolean(userSub || (quizScore !== null && availableQuizzes.length === 1));
                      const effectiveScore = userSub?.score ?? (quizScore !== null ? quizScore : 0);
                      const maxQScore = userSub?.maxScore || quiz.totalMarks || (quiz.questions?.length ? quiz.questions.length * 2 : (quizMaxScore || 50));
                      const effectivePercentage = userSub?.percentage !== undefined ? userSub.percentage : (maxQScore > 0 ? Math.round((effectiveScore / maxQScore) * 100) : (quizPercentage || 0));
                      const isPassed = userSub?.passed ?? (effectivePercentage >= 40 || currentRound > 1);

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

                      const isExpanded = expandedQuizReviewId === quiz.id;
                      const activeQuizObj = quizDetailsCache[quiz.id] || quiz;
                      const reviewQuestions = activeQuizObj.questions || [];
                      const subAnswers = userSub?.answers || {};
                      const isLoadingReview = loadingReviewId === quiz.id;

                      const correctCount = userSub?.correctCount ?? Math.round((effectiveScore / Math.max(1, (activeQuizObj.pointsPerQuestion || 2))));
                      const incorrectCount = userSub?.incorrectCount ?? Math.max(0, (reviewQuestions.length || Math.round(maxQScore / 2)) - correctCount);

                      return (
                        <div
                          key={quiz.id}
                          className={`border rounded-3xl p-6 transition-all space-y-5 ${
                            isSubmitted 
                              ? "bg-white border-blue-200/90 shadow-xs" 
                              : "bg-slate-50 border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          {/* Header & Status Bar */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60 uppercase tracking-wider">
                                  {quiz.track || "General Track"}
                                </span>
                                {isSubmitted && (
                                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                    <CircleCheckBig className="w-3 h-3 text-emerald-600" />
                                    <span>Submitted & Evaluated</span>
                                  </span>
                                )}
                                {currentRound > 1 && isSubmitted && (
                                  <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                                    <Trophy className="w-3 h-3 text-purple-600" />
                                    <span>Qualified for Round {currentRound}</span>
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg font-black text-[#0F172A] tracking-tight">{quiz.title}</h3>
                              <p className="text-xs text-slate-500 font-medium line-clamp-2">{quiz.description}</p>
                            </div>

                            <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                              {isSubmitted ? (
                                <div className="text-right">
                                  <div className="text-xs font-bold text-slate-400">Final Score</div>
                                  <div className="text-xl font-black text-blue-600">
                                    {effectiveScore} <span className="text-sm font-semibold text-slate-400">/ {maxQScore}</span>
                                  </div>
                                </div>
                              ) : isLive ? (
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Now
                                </span>
                              ) : isCompleted ? (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                  Concluded
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-indigo-500" /> Scheduled
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Submitted Quiz Scorecard Hero Summary */}
                          {isSubmitted && (
                            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                <div className="space-y-1">
                                  <span className="text-blue-300 text-[10px] font-black uppercase tracking-widest block">
                                    Quiz Performance & Scorecard
                                  </span>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                      {effectiveScore}
                                    </span>
                                    <span className="text-lg font-bold text-slate-400">
                                      / {maxQScore} Marks
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-center">
                                    <span className="text-[10px] font-bold text-slate-300 block uppercase">Accuracy</span>
                                    <span className="text-sm font-black text-emerald-400">{effectivePercentage}%</span>
                                  </div>

                                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-center">
                                    <span className="text-[10px] font-bold text-slate-300 block uppercase">Correct</span>
                                    <span className="text-sm font-black text-emerald-400">{correctCount}</span>
                                  </div>

                                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-center">
                                    <span className="text-[10px] font-bold text-slate-300 block uppercase">Incorrect</span>
                                    <span className="text-sm font-black text-rose-400">{incorrectCount}</span>
                                  </div>

                                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-center">
                                    <span className="text-[10px] font-bold text-slate-300 block uppercase">Status</span>
                                    <span className="text-xs font-black text-amber-300">
                                      {isPassed ? "✓ Qualified" : "Completed"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action Button Row */}
                          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                            <span className="text-xs font-bold text-slate-500">
                              {quiz.questions?.length || quiz.questionsCount || 0} Questions • {quiz.durationMinutes}m Allotted
                            </span>

                            {isSubmitted ? (
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <button
                                  onClick={() => toggleQuizReview(quiz.id)}
                                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                                >
                                  <BarChart3 className="w-4 h-4 text-blue-600" />
                                  <span>{isExpanded ? "Hide Answer Sheet" : "Review Questions & Answers"}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>

                                <Link
                                  to={`/participant/quiz/${quiz.id}/completed`}
                                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Full Scorecard & Receipt</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            ) : (
                              <Link
                                to={`/participant/quiz/${quiz.id}/lobby`}
                                className={`text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
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

                          {/* ================= INLINE QUESTION & ANSWER SHEET REVIEW ================= */}
                          {isExpanded && (
                            <div className="pt-5 border-t border-slate-200/80 space-y-4 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div>
                                  <h4 className="text-sm font-black text-[#0F172A] flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-blue-600" />
                                    <span>Verified Solutions & Answer Key</span>
                                  </h4>
                                  <p className="text-xs text-slate-500 font-medium">
                                    Compare your submitted responses against the verified answer key.
                                  </p>
                                </div>
                                <span className="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                                  {reviewQuestions.length} Questions
                                </span>
                              </div>

                              {isLoadingReview ? (
                                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                  <p className="text-xs font-bold text-slate-500">Loading verified solutions & answer keys...</p>
                                </div>
                              ) : reviewQuestions.length === 0 ? (
                                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200">
                                  <p className="text-xs text-slate-500 font-medium">Question list loading. Please click Full Scorecard button above to view.</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {reviewQuestions.map((q: any, qIdx: number) => {
                                    const userSelectedOptId = subAnswers[q.id];
                                    const isCorrect = userSelectedOptId && q.correctOptionId && userSelectedOptId.trim().toLowerCase() === q.correctOptionId.trim().toLowerCase();
                                    const isUnanswered = !userSelectedOptId;

                                    return (
                                      <div
                                        key={q.id || qIdx}
                                        className={`p-4 sm:p-5 rounded-2xl border text-xs space-y-3 transition-all ${
                                          isCorrect
                                            ? "bg-emerald-50/40 border-emerald-200 shadow-2xs"
                                            : isUnanswered
                                              ? "bg-slate-50 border-slate-200"
                                              : "bg-red-50/40 border-red-200 shadow-2xs"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-black text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                              Q{q.questionNumber || qIdx + 1}
                                            </span>
                                            <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/70">
                                              {q.points || activeQuizObj?.pointsPerQuestion || 2} pts
                                            </span>
                                          </div>

                                          <div>
                                            {isCorrect ? (
                                              <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1 border border-emerald-300">
                                                <Check className="w-3 h-3 text-emerald-700" />
                                                <span>Correct (+{q.points || 2} pts)</span>
                                              </span>
                                            ) : isUnanswered ? (
                                              <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                                                Unanswered (0 pts)
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-black text-red-800 bg-red-100 px-3 py-1 rounded-full flex items-center gap-1 border border-red-300">
                                                <X className="w-3 h-3 text-red-700" />
                                                <span>Incorrect (0 pts)</span>
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <p className="font-extrabold text-sm text-[#0F172A] leading-relaxed">
                                          {q.text}
                                        </p>

                                        {q.codeSnippet && (
                                          <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800">
                                            <code>{q.codeSnippet}</code>
                                          </pre>
                                        )}

                                        {/* Options List */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                          {(q.options || []).map((opt: any) => {
                                            const isUserChoice = userSelectedOptId === opt.id;
                                            const isOfficialCorrect = q.correctOptionId === opt.id;

                                            let optStyle = "bg-white border-slate-200 text-slate-700";
                                            if (isUserChoice && isOfficialCorrect) {
                                              optStyle = "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/20";
                                            } else if (isUserChoice && !isOfficialCorrect) {
                                              optStyle = "bg-red-50 border-red-500 text-red-950 font-bold ring-2 ring-red-500/20";
                                            } else if (isOfficialCorrect) {
                                              optStyle = "bg-emerald-50/70 border-emerald-400 border-dashed text-emerald-950 font-bold";
                                            }

                                            return (
                                              <div key={opt.id} className={`p-3 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${optStyle}`}>
                                                <span className="flex-1">
                                                  <strong className="mr-1.5 uppercase font-mono">{opt.id.replace("opt_", "")})</strong>
                                                  {opt.text}
                                                </span>
                                                {isUserChoice && isOfficialCorrect && (
                                                  <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                                                    ✓ Your Choice
                                                  </span>
                                                )}
                                                {isUserChoice && !isOfficialCorrect && (
                                                  <span className="text-[9px] font-black uppercase text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-300 shrink-0">
                                                    ✗ Your Choice
                                                  </span>
                                                )}
                                                {!isUserChoice && isOfficialCorrect && (
                                                  <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                                                    ✓ Correct Answer
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>

                                        {q.explanation && (
                                          <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-[11px] text-blue-950 flex items-start gap-2">
                                            <span className="font-extrabold text-blue-700 shrink-0">💡 Explanation:</span>
                                            <span className="font-medium leading-relaxed">{q.explanation}</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

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
