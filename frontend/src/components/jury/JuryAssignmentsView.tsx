import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  Send,
  X,
  FileSpreadsheet,
  Download,
  Eye,
  EyeOff,
  Flame,
  Maximize2,
  Minimize2
} from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs, getDoc, doc, setDoc } from "firebase/firestore";

export interface HackathonProject {
  id: string;
  teamName: string;
  projectTitle: string;
  track: string;
  status: "Pending" | "Evaluated";
  communication: number;
  innovationUniqueness: number;
  feasibilityViability: number;
  statistics: number;
  revenue: number;
  totalScore?: number;
  membersCount: number;
  githubUrl?: string;
  demoUrl?: string;
  abstract: string;
  isSaved?: boolean;
}

const mockProjects: HackathonProject[] = [
  {
    id: "proj-1",
    teamName: "Aether Dynamics",
    projectTitle: "NeuralRAG: Enterprise Vector Search Optimizer",
    track: "Neural Hackathon 2024",
    status: "Pending",
    communication: 0,
    innovationUniqueness: 0,
    feasibilityViability: 0,
    statistics: 0,
    revenue: 0,
    membersCount: 4,
    githubUrl: "https://github.com/ai-verse/neural-rag",
    demoUrl: "https://neural-rag-demo.aiverse.in",
    abstract: "A high-performance hybrid indexing pipeline reducing LLM retrieval latency by 45% using customized embedding quantization.",
    isSaved: false
  },
  {
    id: "proj-2",
    teamName: "DeepShield Labs",
    projectTitle: "DeepGuard: Real-Time Deepfake Detection Web Extension",
    track: "AI Vision Challenge",
    status: "Pending",
    communication: 0,
    innovationUniqueness: 0,
    feasibilityViability: 0,
    statistics: 0,
    revenue: 0,
    membersCount: 3,
    githubUrl: "https://github.com/ai-verse/deepguard",
    demoUrl: "https://deepguard.aiverse.in",
    abstract: "Convolutional neural network for frame-by-frame artifact recognition in video streams.",
    isSaved: false
  },
  {
    id: "proj-3",
    teamName: "Cognitive AI Team",
    projectTitle: "Synthetic Code Auditor & Security Guard",
    track: "Neural Hackathon 2024",
    status: "Evaluated",
    communication: 19,
    innovationUniqueness: 20,
    feasibilityViability: 18,
    statistics: 19,
    revenue: 18,
    totalScore: 94,
    membersCount: 5,
    githubUrl: "https://github.com/ai-verse/code-auditor",
    demoUrl: "https://code-auditor.aiverse.in",
    abstract: "Automated static code security auditor with automated patch suggestions.",
    isSaved: true
  },
  {
    id: "proj-4",
    teamName: "Quantum Byte",
    projectTitle: "BioSynthetix: Protein Structure Prediction Engine",
    track: "AI Vision Challenge",
    status: "Pending",
    communication: 0,
    innovationUniqueness: 0,
    feasibilityViability: 0,
    statistics: 0,
    revenue: 0,
    membersCount: 4,
    githubUrl: "https://github.com/ai-verse/biosynthetix",
    demoUrl: "https://biosynthetix.aiverse.in",
    abstract: "3D molecular geometry rendering driven by transformer embeddings.",
    isSaved: false
  }
];

const JuryAssignmentsView: React.FC = () => {
  const [projects, setProjects] = useState<HackathonProject[]>(mockProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Pending" | "Evaluated">("All");
  const [filterTrack, setFilterTrack] = useState<string>("All");
  // Reveal saved scores toggle state
  const [revealScores, setRevealScores] = useState(false);
  const [focusedCell, setFocusedCell] = useState<{ id: string; field: string } | null>(null);

  // Full Screen distraction-free scoring mode state
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const toggleFullScreen = () => {
    if (!isFullScreenMode) {
      setIsFullScreenMode(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullScreenMode(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreenMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, []);

  // Active event configuration configured in Admin Settings -> Jury Control
  const [activeEventConfig, setActiveEventConfig] = useState<{ id: string; title: string }>({
    id: localStorage.getItem("activeJuryEventId") || "ALL_EVENTS",
    title: localStorage.getItem("activeJuryEventTitle") || "All Events"
  });

  useEffect(() => {
    const syncConfig = () => {
      const id = localStorage.getItem("activeJuryEventId") || "ALL_EVENTS";
      const title = localStorage.getItem("activeJuryEventTitle") || "All Events";
      setActiveEventConfig({ id, title });
    };

    window.addEventListener("storage", syncConfig);
    window.addEventListener("juryPortalStatusChanged", syncConfig);

    let settingsPoll: any = null;
    const loadSettings = async () => {
      try {
        const sDoc = await getDoc(doc(db, "settings", "portal_config"));
        if (sDoc.exists()) {
          const d = sDoc.data();
          if (d.activeJuryEventId || d.activeJuryEventTitle) {
            const id = d.activeJuryEventId || "ALL_EVENTS";
            const title = d.activeJuryEventTitle || "All Events";
            setActiveEventConfig({ id, title });
            localStorage.setItem("activeJuryEventId", id);
            localStorage.setItem("activeJuryEventTitle", title);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    loadSettings();
    settingsPoll = setInterval(loadSettings, 10000);

    return () => {
      window.removeEventListener("storage", syncConfig);
      window.removeEventListener("juryPortalStatusChanged", syncConfig);
      if (settingsPoll) clearInterval(settingsPoll);
    };
  }, []);

  // Real-time Firestore listener combining registrations and jury_evaluations
  useEffect(() => {
    let registrationsList: any[] = [];
    let evaluationsMap = new Map<string, any>();

    const mergeAndSetProjects = () => {
      if (registrationsList.length === 0 && evaluationsMap.size === 0) {
        return;
      }

      const merged: HackathonProject[] = [];
      const processedIds = new Set<string>();

      // 1. Process registrations from database
      registrationsList.forEach((reg) => {
        const id = reg.id;
        processedIds.add(id);

        const evalData = evaluationsMap.get(id) || {};
        const teamName = reg.groupName || reg.teamLeadName || `Team ${id.substring(0, 5)}`;
        const track = reg.eventTitle || reg.eventName || "General Event";
        const projectTitle = reg.projectTitle || `${teamName} Submission`;
        const membersCount = reg.teamSize || (reg.members && Array.isArray(reg.members) ? reg.members.length + 1 : 1);

        merged.push({
          id,
          teamName,
          projectTitle,
          track,
          status: (evalData.status as "Pending" | "Evaluated") || (evalData.isSaved ? "Evaluated" : "Pending"),
          communication: Number(evalData.communication) || 0,
          innovationUniqueness: Number(evalData.innovationUniqueness) || 0,
          feasibilityViability: Number(evalData.feasibilityViability) || 0,
          statistics: Number(evalData.statistics) || 0,
          revenue: Number(evalData.revenue) || 0,
          totalScore: Number(evalData.totalScore) || 0,
          membersCount,
          githubUrl: evalData.githubUrl || reg.githubUrl || "https://github.com/ai-verse",
          demoUrl: evalData.demoUrl || reg.demoUrl || "https://demo.aiverse.in",
          abstract: evalData.abstract || reg.abstract || `Registered team lead: ${reg.teamLeadName || teamName} (${reg.teamLeadEmail || ""}).`,
          isSaved: Boolean(evalData.isSaved)
        });
      });

      // 2. Process standalone jury_evaluations that may not have a matching registration doc
      evaluationsMap.forEach((evalData, id) => {
        if (!processedIds.has(id)) {
          merged.push({
            id,
            teamName: evalData.teamName || `Team ${id.substring(0, 5)}`,
            projectTitle: evalData.projectTitle || "Hackathon Submission",
            track: evalData.track || "General Event",
            status: (evalData.status as "Pending" | "Evaluated") || (evalData.isSaved ? "Evaluated" : "Pending"),
            communication: Number(evalData.communication) || 0,
            innovationUniqueness: Number(evalData.innovationUniqueness) || 0,
            feasibilityViability: Number(evalData.feasibilityViability) || 0,
            statistics: Number(evalData.statistics) || 0,
            revenue: Number(evalData.revenue) || 0,
            totalScore: Number(evalData.totalScore) || 0,
            membersCount: Number(evalData.membersCount) || 1,
            githubUrl: evalData.githubUrl || "https://github.com/ai-verse",
            demoUrl: evalData.demoUrl || "https://demo.aiverse.in",
            abstract: evalData.abstract || "Submission for jury evaluation.",
            isSaved: Boolean(evalData.isSaved)
          });
        }
      });

      if (merged.length > 0) {
        setProjects(merged);
      }
    };

    // Sub 1: registrations collection
    let regsPoll: any = null;
    let evalsPoll: any = null;

    const loadRegs = async () => {
      try {
        const snap = await getDocs(collection(db, "registrations"));
        registrationsList = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        mergeAndSetProjects();
      } catch (e) {
        console.error("Registrations polling error:", e);
      }
    };

    const loadEvals = async () => {
      try {
        const snap = await getDocs(collection(db, "jury_evaluations"));
        evaluationsMap.clear();
        snap.docs.forEach(docSnap => evaluationsMap.set(docSnap.id, docSnap.data()));
        mergeAndSetProjects();
      } catch (e) {
        console.error("Jury evaluations polling error:", e);
      }
    };

    // Initial load and periodic polling
    loadRegs();
    loadEvals();
    regsPoll = setInterval(loadRegs, 10000);
    evalsPoll = setInterval(loadEvals, 10000);

    return () => {
      if (regsPoll) clearInterval(regsPoll);
      if (evalsPoll) clearInterval(evalsPoll);
    };
  }, []);

  const tracks = Array.from(new Set(projects.map(p => p.track)));

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.abstract.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "All" || p.status === filterStatus;
    const matchesTrack = filterTrack === "All" || p.track === filterTrack;

    // Check if Jury Control selected a specific event
    const activeTitleClean = activeEventConfig.title.trim().toLowerCase();
    const projectTrackClean = p.track.trim().toLowerCase();

    const matchesActiveJuryEvent = activeEventConfig.id === "ALL_EVENTS" || 
                                   activeTitleClean === "all events" ||
                                   projectTrackClean === activeTitleClean ||
                                   projectTrackClean.includes(activeTitleClean) ||
                                   activeTitleClean.includes(projectTrackClean);

    return matchesSearch && matchesStatus && matchesTrack && matchesActiveJuryEvent;
  });

  // Inline cell score change handler (Always allowed and editable)
  const handleCellChange = (
    projectId: string,
    field: "communication" | "innovationUniqueness" | "feasibilityViability" | "statistics" | "revenue",
    rawVal: string
  ) => {
    const numVal = Math.min(20, Math.max(0, parseInt(rawVal, 10) || 0));
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updated = {
        ...p,
        [field]: rawVal === "" ? 0 : numVal,
      };
      const total = updated.communication + updated.innovationUniqueness + updated.feasibilityViability + updated.statistics + updated.revenue;
      
      return {
        ...updated,
        totalScore: total,
        status: total > 0 ? ("Evaluated" as const) : ("Pending" as const)
      };
    }));
  };

  // Save or update scores in Firebase Firestore for a team row
  const handleSaveRowScores = async (project: HackathonProject) => {
    const total = project.communication + project.innovationUniqueness + project.feasibilityViability + project.statistics + project.revenue;
    if (total === 0) {
      showToast(`Please enter marks for "${project.teamName}" before saving.`);
      return;
    }

    const payload = {
      teamName: project.teamName,
      projectTitle: project.projectTitle,
      track: project.track,
      communication: project.communication,
      innovationUniqueness: project.innovationUniqueness,
      feasibilityViability: project.feasibilityViability,
      statistics: project.statistics,
      revenue: project.revenue,
      totalScore: total,
      status: "Evaluated",
      isSaved: true,
      membersCount: project.membersCount,
      abstract: project.abstract
    };

    try {
      await setDoc(doc(db, "jury_evaluations", project.id), payload, { merge: true });
      showToast(`Scores for "${project.teamName}" saved successfully (${total}/100)!`);
    } catch (err) {
      console.error("Firebase Firestore Save Error:", err);
      showToast("Failed to save score to Firebase. Please try again.");
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Row", 
      "Team Name", 
      "Project Title", 
      "Track", 
      "Communication (20)", 
      "Innovation and Uniqueness (20)", 
      "Feasibility and Viability (20)", 
      "Statistics (20)", 
      "Revenue (20)", 
      "Total Score (100)", 
      "Status"
    ];
    const rows = filteredProjects.map((p, idx) => [
      idx + 1,
      `"${p.teamName}"`,
      `"${p.projectTitle}"`,
      `"${p.track}"`,
      p.status === "Evaluated" ? p.communication : "N/A",
      p.status === "Evaluated" ? p.innovationUniqueness : "N/A",
      p.status === "Evaluated" ? p.feasibilityViability : "N/A",
      p.status === "Evaluated" ? p.statistics : "N/A",
      p.status === "Evaluated" ? p.revenue : "N/A",
      p.totalScore ?? "N/A",
      p.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `jury_evaluation_matrix_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const evaluatedCount = projects.filter(p => p.status === "Evaluated").length;
  const avgScore = evaluatedCount > 0 
    ? (projects.filter(p => p.totalScore).reduce((acc, p) => acc + (p.totalScore || 0), 0) / evaluatedCount).toFixed(1)
    : "N/A";

  return (
    <div className={isFullScreenMode ? "fixed inset-0 z-[9999] bg-[#F8FAFC] p-4 sm:p-6 overflow-y-auto space-y-5 animate-in fade-in duration-200 text-left font-sans" : "space-y-5 animate-in fade-in duration-200 text-left font-sans"}>
      {/* Toast Notification Banner (Does not exit Full Screen mode!) */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[10000] bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-2.5 animate-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white p-0.5 rounded-lg">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Fullscreen Sticky Control Header */}
      {isFullScreenMode && (
        <div className="bg-slate-950 text-white px-6 py-3.5 rounded-2xl flex items-center justify-between shadow-xl shrink-0 border border-slate-800 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-sm">
              <Maximize2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-white">Full Screen Scoring Mode</h2>
              <p className="text-[10px] text-slate-300 font-medium">Distraction-free jury evaluation grid • Press Esc or click Exit to return</p>
            </div>
          </div>
          <button
            onClick={toggleFullScreen}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 border border-white/20 active:scale-95 cursor-pointer"
          >
            <Minimize2 className="h-4 w-4 text-blue-400" />
            Exit Full Screen
          </button>
        </div>
      )}

      {/* Header with Excel Export & Fullscreen Buttons */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60 shrink-0">
              <FileSpreadsheet className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Assigned Projects & Submissions (Grid Scoring)
            </h1>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Scores are visible while writing. Once saved, scores automatically convert to password dots and lock against editing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap w-full sm:w-auto">
          <button
            onClick={toggleFullScreen}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0 active:scale-95 cursor-pointer"
            title="Enter distraction-free full screen scoring mode"
          >
            {isFullScreenMode ? (
              <>
                <Minimize2 className="h-4 w-4" />
                Exit Full Screen
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                Enter Full Screen
              </>
            )}
          </button>

          <button
            onClick={exportToCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0 active:scale-95 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export to Excel (CSV)
          </button>
        </div>
      </div>

      {!isFullScreenMode ? (
        /* STANDBY / LAUNCHER CARD WHEN NOT IN FULLSCREEN MODE */
        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 border border-slate-200/80 shadow-md text-center space-y-6 max-w-2xl mx-auto my-4 w-full animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#2563EB] mx-auto flex items-center justify-center border border-blue-100 shadow-inner">
            <Maximize2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3.5 py-1 rounded-full border border-blue-100/80">
              FULL SCREEN SCORING REQUIRED
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight pt-2">
              Jury Evaluation Grid & Score Board
            </h2>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-md mx-auto">
              To evaluate assigned projects, enter marks, and lock evaluation matrices, please enter full-screen scoring mode. The score board loads distraction-free without sidebars.
            </p>
          </div>

          {/* Quick Metrics Summary */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
            <div>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Active Event</span>
              <span className="text-xs font-black text-slate-800 truncate block mt-0.5">{activeEventConfig.title}</span>
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Assigned Projects</span>
              <span className="text-xs font-black text-blue-600 block mt-0.5">{projects.length} Submissions</span>
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Evaluated</span>
              <span className="text-xs font-black text-emerald-600 block mt-0.5">{evaluatedCount} / {projects.length}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={toggleFullScreen}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer"
            >
              <Maximize2 className="h-4.5 w-4.5" />
              Enter Full Screen Score Board
            </button>

            <button
              onClick={exportToCSV}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Download className="h-4 w-4 text-slate-500" />
              Export CSV
            </button>
          </div>
        </div>
      ) : (
        /* FULL SCREEN ACTIVE: RENDER ACTIVE EVENT BANNER & SCORING SPREADSHEET MATRIX */
        <>
          {/* Active Evaluation Event Banner */}
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-[#2563EB] text-white shadow-xs">
                <Flame className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest bg-white px-2.5 py-0.5 rounded-full border border-blue-100">
                    ACTIVE EVALUATION EVENT
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    LIVE SCORING OPEN
                  </span>
                </div>
                <h2 className="text-base font-extrabold text-slate-900 mt-1">
                  {activeEventConfig.title}
                </h2>
              </div>
            </div>

            <div className="text-xs text-slate-600 font-bold bg-white px-4 py-2 rounded-xl border border-blue-100 shrink-0 flex items-center gap-2">
              <span>Active Track Filter:</span>
              <span className="text-[#2563EB] font-black">{activeEventConfig.title}</span>
            </div>
          </div>

      {/* Filter & Reveal Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by team, project, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="appearance-none px-4 py-2 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="All">Status: All</option>
              <option value="Pending">Pending</option>
              <option value="Evaluated">Evaluated</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Track Filter */}
          <div className="relative">
            <select
              value={filterTrack}
              onChange={(e) => setFilterTrack(e.target.value)}
              className="appearance-none px-4 py-2 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="All">Track: All</option>
              {tracks.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Reveal Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRevealScores(!revealScores)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-xs cursor-pointer ${
              revealScores
                ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
            title="Toggle reveal/mask saved scores"
          >
            {revealScores ? <EyeOff className="h-4 w-4 text-amber-600" /> : <Eye className="h-4 w-4 text-slate-500" />}
            <span>{revealScores ? "Hide Saved Scores" : "Reveal Saved Scores"}</span>
          </button>
        </div>
      </div>

      {/* EXCEL SPREADSHEET TABLE CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Excel Header Bar */}
        <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="font-mono uppercase tracking-wider text-slate-700">Sheet1: Jury_Evaluation_Matrix.xlsx</span>
          </div>
          <span className="text-slate-400 font-mono text-[10px]">SAVE & LOCK SCORING SYSTEM</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3 border-r border-slate-200 w-12 text-center font-mono">#</th>
                <th className="py-3 px-4 border-r border-slate-200 min-w-[160px]">Team Name</th>
                <th className="py-3 px-3 border-r border-slate-200 w-36 text-center">Communication</th>
                <th className="py-3 px-3 border-r border-slate-200 w-48 text-center">Innovation & Uniqueness</th>
                <th className="py-3 px-3 border-r border-slate-200 w-48 text-center">Feasibility & Viability</th>
                <th className="py-3 px-3 border-r border-slate-200 w-36 text-center">Statistics</th>
                <th className="py-3 px-3 border-r border-slate-200 w-36 text-center">Revenue</th>
                <th className="py-3 px-3 border-r border-slate-200 w-28 text-center font-mono">Total Score</th>
                <th className="py-3 px-3 border-r border-slate-200 w-28 text-center">Status</th>
                <th className="py-3 px-4 text-center min-w-[140px] sticky right-0 bg-slate-100 border-l border-slate-200 shadow-xs z-10">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    No submissions matched your search criteria.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p, idx) => {
                  const isRowSaved = p.isSaved || p.status === "Evaluated";
                  const isMasked = isRowSaved && !revealScores;

                  return (
                    <tr 
                      key={p.id}
                      className="hover:bg-blue-50/40 transition-colors group odd:bg-slate-50/20"
                    >
                      {/* Row Index */}
                      <td className="py-3.5 px-3 border-r border-slate-200/70 text-center font-mono text-slate-400 font-bold bg-slate-50/60 group-hover:bg-blue-100/30">
                        {idx + 1}
                      </td>

                      {/* Team Name */}
                      <td className="py-3.5 px-4 border-r border-slate-200/70 font-extrabold text-slate-900">
                        <div>{p.teamName}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{p.membersCount} members</div>
                      </td>

                      {/* 1. Communication */}
                      <td className="py-2.5 px-2 border-r border-slate-200/70 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type={isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "communication") ? "password" : "number"}
                            min="0"
                            max="20"
                            placeholder="—"
                            value={p.communication > 0 ? p.communication : ""}
                            onFocus={() => setFocusedCell({ id: p.id, field: "communication" })}
                            onBlur={() => setFocusedCell(null)}
                            onChange={(e) => handleCellChange(p.id, "communication", e.target.value)}
                            className={`w-14 py-1.5 px-2 text-center font-mono font-bold text-xs rounded-lg transition-all ${
                              isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "communication")
                                ? "bg-amber-50/80 text-amber-900 border border-amber-200 shadow-inner"
                                : "bg-slate-50 border border-slate-300/80 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                            }`}
                          />
                          <span className="text-[10px] text-slate-400 font-bold font-mono">/20</span>
                        </div>
                      </td>

                      {/* 2. Innovation and Uniqueness */}
                      <td className="py-2.5 px-2 border-r border-slate-200/70 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type={isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "innovationUniqueness") ? "password" : "number"}
                            min="0"
                            max="20"
                            placeholder="—"
                            value={p.innovationUniqueness > 0 ? p.innovationUniqueness : ""}
                            onFocus={() => setFocusedCell({ id: p.id, field: "innovationUniqueness" })}
                            onBlur={() => setFocusedCell(null)}
                            onChange={(e) => handleCellChange(p.id, "innovationUniqueness", e.target.value)}
                            className={`w-14 py-1.5 px-2 text-center font-mono font-bold text-xs rounded-lg transition-all ${
                              isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "innovationUniqueness")
                                ? "bg-amber-50/80 text-amber-900 border border-amber-200 shadow-inner"
                                : "bg-slate-50 border border-slate-300/80 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                            }`}
                          />
                          <span className="text-[10px] text-slate-400 font-bold font-mono">/20</span>
                        </div>
                      </td>

                      {/* 3. Feasibility and Viability */}
                      <td className="py-2.5 px-2 border-r border-slate-200/70 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type={isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "feasibilityViability") ? "password" : "number"}
                            min="0"
                            max="20"
                            placeholder="—"
                            value={p.feasibilityViability > 0 ? p.feasibilityViability : ""}
                            onFocus={() => setFocusedCell({ id: p.id, field: "feasibilityViability" })}
                            onBlur={() => setFocusedCell(null)}
                            onChange={(e) => handleCellChange(p.id, "feasibilityViability", e.target.value)}
                            className={`w-14 py-1.5 px-2 text-center font-mono font-bold text-xs rounded-lg transition-all ${
                              isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "feasibilityViability")
                                ? "bg-amber-50/80 text-amber-900 border border-amber-200 shadow-inner"
                                : "bg-slate-50 border border-slate-300/80 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                            }`}
                          />
                          <span className="text-[10px] text-slate-400 font-bold font-mono">/20</span>
                        </div>
                      </td>

                      {/* 4. Statistics */}
                      <td className="py-2.5 px-2 border-r border-slate-200/70 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type={isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "statistics") ? "password" : "number"}
                            min="0"
                            max="20"
                            placeholder="—"
                            value={p.statistics > 0 ? p.statistics : ""}
                            onFocus={() => setFocusedCell({ id: p.id, field: "statistics" })}
                            onBlur={() => setFocusedCell(null)}
                            onChange={(e) => handleCellChange(p.id, "statistics", e.target.value)}
                            className={`w-14 py-1.5 px-2 text-center font-mono font-bold text-xs rounded-lg transition-all ${
                              isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "statistics")
                                ? "bg-amber-50/80 text-amber-900 border border-amber-200 shadow-inner"
                                : "bg-slate-50 border border-slate-300/80 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                            }`}
                          />
                          <span className="text-[10px] text-slate-400 font-bold font-mono">/20</span>
                        </div>
                      </td>

                      {/* 5. Revenue */}
                      <td className="py-2.5 px-2 border-r border-slate-200/70 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type={isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "revenue") ? "password" : "number"}
                            min="0"
                            max="20"
                            placeholder="—"
                            value={p.revenue > 0 ? p.revenue : ""}
                            onFocus={() => setFocusedCell({ id: p.id, field: "revenue" })}
                            onBlur={() => setFocusedCell(null)}
                            onChange={(e) => handleCellChange(p.id, "revenue", e.target.value)}
                            className={`w-14 py-1.5 px-2 text-center font-mono font-bold text-xs rounded-lg transition-all ${
                              isMasked && !(focusedCell?.id === p.id && focusedCell?.field === "revenue")
                                ? "bg-amber-50/80 text-amber-900 border border-amber-200 shadow-inner"
                                : "bg-slate-50 border border-slate-300/80 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                            }`}
                          />
                          <span className="text-[10px] text-slate-400 font-bold font-mono">/20</span>
                        </div>
                      </td>

                      {/* Total Score */}
                      <td className="py-3.5 px-3 border-r border-slate-200/70 text-center font-mono font-extrabold">
                        {p.totalScore !== undefined && (p.status === "Evaluated" || p.totalScore > 0) ? (
                          isMasked ? (
                            <span className="text-amber-600 font-extrabold text-sm tracking-widest select-none">••••</span>
                          ) : (
                            <span className="text-blue-600 text-sm font-black">{p.totalScore}/100</span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3 border-r border-slate-200/70 text-center">
                        {p.status === "Evaluated" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Evaluated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100/80 text-amber-800 border border-amber-200">
                            <Clock className="h-3 w-3 text-amber-600" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Sticky Actions Column */}
                      <td className="py-3.5 px-3 text-center sticky right-0 bg-white group-hover:bg-blue-50/80 border-l border-slate-200/80 shadow-xs z-10">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleSaveRowScores(p)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                              p.isSaved ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-[#2563EB] hover:bg-blue-700 shadow-blue-600/20"
                            }`}
                            title="Save / Update scores in database"
                          >
                            {p.isSaved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                            {p.isSaved ? "Saved" : "Save"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Excel Status Bar Footer */}
        <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-semibold text-slate-500 gap-4">
          <div className="flex items-center gap-6 font-mono text-[11px]">
            <span>COUNT: <strong className="text-slate-800">{filteredProjects.length}</strong></span>
            <span>EVALUATED: <strong className="text-emerald-600">{evaluatedCount}</strong></span>
            <span>PENDING: <strong className="text-amber-600">{projects.length - evaluatedCount}</strong></span>
            <span>AVG SCORE: <strong className="text-blue-600">{avgScore}</strong></span>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            AI Verse Evaluation Grid • Save & Lock Active
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default JuryAssignmentsView;


