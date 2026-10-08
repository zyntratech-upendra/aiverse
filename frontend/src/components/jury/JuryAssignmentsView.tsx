import React, { useState, useEffect, useRef } from "react";
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
  Minimize2,
  Award
} from "lucide-react";
import { fetchSettings, fetchRegistrations, fetchJuryEvaluations, updateJuryEvaluation, updateRegistration } from "../../services/apiClient";

export interface JuryMarksColumn {
  id: string;
  name: string;
  maxMarks: number;
}

export const DEFAULT_JURY_MARKS_COLUMNS: JuryMarksColumn[] = [
  { id: "communication", name: "Communication", maxMarks: 20 },
  { id: "innovationUniqueness", name: "Innovation & Uniqueness", maxMarks: 20 },
  { id: "feasibilityViability", name: "Feasibility & Viability", maxMarks: 20 },
  { id: "statistics", name: "Statistics", maxMarks: 20 },
  { id: "revenue", name: "Revenue", maxMarks: 20 }
];

export interface HackathonProject {
  id: string;
  eventId?: string;
  teamName: string;
  projectTitle: string;
  track: string;
  status: "Pending" | "Evaluated";
  criteriaScores?: Record<string, number>;
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

const mockProjects: HackathonProject[] = [];

export interface JuryAssignmentsViewProps {
  isFullScreenMode?: boolean;
  toggleFullScreen?: () => void;
  onOpenSubmitModal?: () => void;
  activeRound?: number;
}

const JuryAssignmentsView: React.FC<JuryAssignmentsViewProps> = ({
  isFullScreenMode: propFullScreenMode,
  toggleFullScreen: propToggleFullScreen,
  onOpenSubmitModal,
  activeRound: propActiveRound
}) => {
  const [projects, setProjects] = useState<HackathonProject[]>([]);
  const userModifiedIdsRef = useRef<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Pending" | "Evaluated">("All");
  const [filterTrack, setFilterTrack] = useState<string>("All");
  const [activeRound, setActiveRound] = useState<number>(() => {
    if (propActiveRound) return propActiveRound;
    const local = localStorage.getItem("activeJuryRound");
    return local ? Number(local) : 1;
  });

  useEffect(() => {
    if (propActiveRound) setActiveRound(propActiveRound);
  }, [propActiveRound]);
  // Reveal saved scores toggle state (defaults to false so saved evaluations are masked)
  const [revealScores, setRevealScores] = useState(false);
  const [focusedCell, setFocusedCell] = useState<{ id: string; field: string } | null>(null);

  // Dynamic Jury Marks Columns loaded from Faculty Settings
  const [marksColumns, setMarksColumns] = useState<JuryMarksColumn[]>(() => {
    try {
      const raw = localStorage.getItem("juryMarksColumns");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_JURY_MARKS_COLUMNS;
  });

  const totalMaxMarks = marksColumns.reduce((sum, col) => sum + (Number(col.maxMarks) || 0), 0);

  const getColumnScore = (project: HackathonProject, columnId: string): number => {
    if (project.criteriaScores && project.criteriaScores[columnId] !== undefined) {
      return Number(project.criteriaScores[columnId]) || 0;
    }
    const directVal = (project as any)[columnId];
    if (directVal !== undefined && directVal !== null) {
      return Number(directVal) || 0;
    }
    return 0;
  };

    // Full Screen distraction-free scoring mode state
  const [internalFullScreenMode, setInternalFullScreenMode] = useState(false);
  const isFullScreenMode = propFullScreenMode !== undefined ? propFullScreenMode : internalFullScreenMode;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const toggleFullScreen = () => {
    if (propToggleFullScreen) {
      propToggleFullScreen();
      return;
    }
    if (!isFullScreenMode) {
      setInternalFullScreenMode(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setInternalFullScreenMode(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    if (propFullScreenMode !== undefined) return;
    const handleFullScreenChange = () => {
      if (!document.fullscreenElement) {
        setInternalFullScreenMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, [propFullScreenMode]);

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

      const r = localStorage.getItem("activeJuryRound");
      if (r) {
        setActiveRound(Number(r));
      }

      try {
        const rawCols = localStorage.getItem("juryMarksColumns");
        if (rawCols) {
          const parsed = JSON.parse(rawCols);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMarksColumns(parsed);
          }
        }
      } catch {}
    };

    window.addEventListener("storage", syncConfig);
    window.addEventListener("juryPortalStatusChanged", syncConfig);

    let settingsPoll: any = null;
    const loadSettings = async () => {
      try {
        const d = await fetchSettings("portal_config");
        if (d) {
          if (d.activeJuryEventId || d.activeJuryEventTitle) {
            const id = d.activeJuryEventId || "ALL_EVENTS";
            const title = d.activeJuryEventTitle || "All Events";
            setActiveEventConfig({ id, title });
            localStorage.setItem("activeJuryEventId", id);
            localStorage.setItem("activeJuryEventTitle", title);
          }
          if (d.currentRound) {
            setActiveRound(Number(d.currentRound));
            localStorage.setItem("activeJuryRound", String(d.currentRound));
          }
          if (Array.isArray(d.juryMarksColumns) && d.juryMarksColumns.length > 0) {
            setMarksColumns(d.juryMarksColumns);
            localStorage.setItem("juryMarksColumns", JSON.stringify(d.juryMarksColumns));
          }
        }
      } catch (e) {
        // ignore
      }
    };

    loadSettings();
    settingsPoll = setInterval(loadSettings, 15000);

    return () => {
      window.removeEventListener("storage", syncConfig);
      window.removeEventListener("juryPortalStatusChanged", syncConfig);
      if (settingsPoll) clearInterval(settingsPoll);
    };
  }, []);

  // Load registrations and jury evaluations from REST backend
  useEffect(() => {
    let regsPoll: any = null;

    const loadData = async () => {
      try {
        const [regsRes, evalsRes] = await Promise.all([
          fetchRegistrations().catch(() => []),
          fetchJuryEvaluations().catch(() => [])
        ]);

        const registrationsList = Array.isArray(regsRes) ? regsRes : [];
        const evaluationsList = Array.isArray(evalsRes) ? evalsRes : [];

        const evaluationsMap = new Map<string, any>();
        evaluationsList.forEach((ev: any) => {
          const key = ev.registrationId || ev.id || ev._id;
          if (key) evaluationsMap.set(key, ev);
          if (ev.teamName) evaluationsMap.set(ev.teamName.trim().toLowerCase(), ev);
        });

        if (registrationsList.length === 0 && evaluationsList.length === 0) {
          return;
        }

        setProjects(prevProjects => {
          const prevMap = new Map(prevProjects.map(p => [p.id, p]));
          const merged: HackathonProject[] = [];
          const processedIds = new Set<string>();

          // 1. Process registrations from database
          registrationsList.forEach((reg: any) => {
            const id = reg.id || reg._id;
            processedIds.add(id);

            // Preserve user's in-progress changes if actively modified in memory
            const existing = prevMap.get(id);
            if (existing && userModifiedIdsRef.current.has(id)) {
              merged.push(existing);
              return;
            }

            const evalData = evaluationsMap.get(id) || 
                             evaluationsMap.get((reg.groupName || "").trim().toLowerCase()) || 
                             evaluationsMap.get((reg.teamLeadName || "").trim().toLowerCase()) || 
                             evaluationsMap.get((reg.teamName || "").trim().toLowerCase()) || {};
            const teamName = reg.groupName || reg.teamName || reg.teamLeadName || `Team ${id.substring(0, 5)}`;
            const track = reg.eventTitle || reg.eventName || evalData.track || evalData.eventTitle || "General Event";
            const projectTitle = reg.projectTitle || evalData.projectTitle || `${teamName} Submission`;
            const membersCount = reg.teamSize || (reg.members && Array.isArray(reg.members) ? reg.members.length + 1 : 1);

            const criteriaScores: Record<string, number> = {};
            let criteriaSum = 0;

            if (evalData.criteriaScores && typeof evalData.criteriaScores === "object") {
              Object.entries(evalData.criteriaScores).forEach(([k, v]) => {
                criteriaScores[k] = Number(v) || 0;
              });
            }
            if (reg.criteriaScores && typeof reg.criteriaScores === "object") {
              Object.entries(reg.criteriaScores).forEach(([k, v]) => {
                if (criteriaScores[k] === undefined) {
                  criteriaScores[k] = Number(v) || 0;
                }
              });
            }

            marksColumns.forEach(col => {
              if (criteriaScores[col.id] === undefined) {
                const legacyVal = Number(
                  evalData[col.id] ?? 
                  reg[col.id] ?? 
                  0
                );
                criteriaScores[col.id] = legacyVal;
              }
              criteriaSum += Number(criteriaScores[col.id]) || 0;
            });

            const comm = Number(criteriaScores["communication"] ?? evalData.communication ?? reg.communication ?? 0);
            const innov = Number(criteriaScores["innovationUniqueness"] ?? evalData.innovationUniqueness ?? reg.innovationUniqueness ?? 0);
            const feas = Number(criteriaScores["feasibilityViability"] ?? evalData.feasibilityViability ?? reg.feasibilityViability ?? 0);
            const stats = Number(criteriaScores["statistics"] ?? evalData.statistics ?? reg.statistics ?? 0);
            const rev = Number(criteriaScores["revenue"] ?? evalData.revenue ?? reg.revenue ?? 0);
            const totalScore = criteriaSum > 0 ? criteriaSum : (Number(evalData.totalScore || evalData.score || reg.totalScore || reg.juryScore || reg.score) || 0);

            const isSaved = Boolean(evalData.isSaved || reg.isSaved || evalData.status === "Evaluated" || reg.evaluationStatus === "Evaluated" || totalScore > 0);

            merged.push({
              id,
              eventId: reg.eventId || evalData.eventId || "",
              teamName,
              projectTitle,
              track,
              status: (evalData.status as "Pending" | "Evaluated") || (isSaved ? "Evaluated" : "Pending"),
              criteriaScores,
              communication: comm,
              innovationUniqueness: innov,
              feasibilityViability: feas,
              statistics: stats,
              revenue: rev,
              totalScore,
              membersCount,
              githubUrl: evalData.githubUrl || reg.githubUrl || "https://github.com/ai-verse",
              demoUrl: evalData.demoUrl || reg.demoUrl || "https://demo.aiverse.in",
              abstract: evalData.abstract || reg.abstract || `Registered team lead: ${reg.teamLeadName || teamName} (${reg.teamLeadEmail || ""}).`,
              isSaved
            });
          });

          // 2. Process standalone jury evaluations without matching registration doc
          evaluationsList.forEach((evalData: any) => {
            const id = evalData.id || evalData._id || evalData.registrationId;
            if (id && !processedIds.has(id)) {
              const existing = prevMap.get(id);
              if (existing && userModifiedIdsRef.current.has(id)) {
                merged.push(existing);
                return;
              }

              const criteriaScores: Record<string, number> = {};
              let criteriaSum = 0;

              if (evalData.criteriaScores && typeof evalData.criteriaScores === "object") {
                Object.entries(evalData.criteriaScores).forEach(([k, v]) => {
                  criteriaScores[k] = Number(v) || 0;
                });
              }

              marksColumns.forEach(col => {
                if (criteriaScores[col.id] === undefined) {
                  const legacyVal = Number(evalData[col.id] ?? 0);
                  criteriaScores[col.id] = legacyVal;
                }
                criteriaSum += Number(criteriaScores[col.id]) || 0;
              });

              const comm = Number(criteriaScores["communication"] ?? evalData.communication ?? 0);
              const innov = Number(criteriaScores["innovationUniqueness"] ?? evalData.innovationUniqueness ?? 0);
              const feas = Number(criteriaScores["feasibilityViability"] ?? evalData.feasibilityViability ?? 0);
              const stats = Number(criteriaScores["statistics"] ?? evalData.statistics ?? 0);
              const rev = Number(criteriaScores["revenue"] ?? evalData.revenue ?? 0);
              const totalScore = criteriaSum > 0 ? criteriaSum : (Number(evalData.totalScore || evalData.score) || 0);
              const isSaved = Boolean(evalData.isSaved || evalData.status === "Evaluated" || totalScore > 0);

              merged.push({
                id,
                eventId: evalData.eventId || "",
                teamName: evalData.teamName || `Team ${id.substring(0, 5)}`,
                projectTitle: evalData.projectTitle || "Hackathon Submission",
                track: evalData.track || evalData.eventTitle || "General Event",
                status: (evalData.status as "Pending" | "Evaluated") || (isSaved ? "Evaluated" : "Pending"),
                criteriaScores,
                communication: comm,
                innovationUniqueness: innov,
                feasibilityViability: feas,
                statistics: stats,
                revenue: rev,
                totalScore,
                membersCount: Number(evalData.membersCount) || 1,
                githubUrl: evalData.githubUrl || "https://github.com/ai-verse",
                demoUrl: evalData.demoUrl || "https://demo.aiverse.in",
                abstract: evalData.abstract || "Submission for jury evaluation.",
                isSaved
              });
            }
          });

          return merged.length > 0 ? merged : prevProjects;
        });
      } catch (e) {
        console.error("Jury data loading error:", e);
      }
    };

    loadData();
    regsPoll = setInterval(loadData, 20000);

    return () => {
      if (regsPoll) clearInterval(regsPoll);
    };
  }, []);

  const tracks = Array.from(new Set(projects.map(p => p.track).filter(Boolean)));

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

  // Inline cell score change handler (Tracks modified rows to prevent any data loss)
  const handleCellChange = (
    projectId: string,
    columnId: string,
    rawVal: string,
    maxMarks: number = 20
  ) => {
    userModifiedIdsRef.current.add(projectId);
    let numVal = rawVal === "" ? 0 : parseInt(rawVal, 10);
    if (isNaN(numVal)) numVal = 0;
    if (numVal > maxMarks) numVal = maxMarks;
    if (numVal < 0) numVal = 0;

    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updatedCriteria = { ...(p.criteriaScores || {}) };
      updatedCriteria[columnId] = numVal;

      const total = marksColumns.reduce((sum, col) => {
        return sum + (Number(updatedCriteria[col.id]) || 0);
      }, 0);

      const updated: HackathonProject = {
        ...p,
        criteriaScores: updatedCriteria,
        [columnId]: numVal,
        isSaved: false, // Marked as unsaved while editing
        totalScore: total,
        status: total > 0 ? ("Evaluated" as const) : ("Pending" as const)
      };

      return updated;
    }));
  };

  // Save or update scores in database for a team row
  const handleSaveRowScores = async (project: HackathonProject) => {
    const currentCriteria: Record<string, number> = {};
    let total = 0;

    marksColumns.forEach(col => {
      const val = getColumnScore(project, col.id);
      currentCriteria[col.id] = val;
      total += val;
    });

    if (total === 0) {
      showToast(`Please enter marks for "${project.teamName}" before saving.`);
      return;
    }

    const payload: any = {
      round: activeRound,
      eventId: project.eventId || activeEventConfig.id,
      eventTitle: project.track || activeEventConfig.title,
      teamName: project.teamName,
      projectTitle: project.projectTitle,
      track: project.track || activeEventConfig.title,
      criteriaScores: currentCriteria,
      score: total,
      totalScore: total,
      maxScore: totalMaxMarks,
      status: "Evaluated",
      isSaved: true,
      membersCount: project.membersCount,
      abstract: project.abstract,
      registrationId: project.id
    };

    // Populate direct legacy fields for backward compatibility
    marksColumns.forEach(col => {
      payload[col.id] = currentCriteria[col.id];
    });

    try {
      await Promise.all([
        updateJuryEvaluation(project.id, payload),
        updateRegistration(project.id, {
          totalScore: total,
          score: total,
          juryScore: total,
          juryEvaluated: true,
          evaluationStatus: "Evaluated",
          criteriaScores: currentCriteria,
          ...currentCriteria,
          isSaved: true,
        }).catch(() => {})
      ]);
      userModifiedIdsRef.current.delete(project.id);
      setProjects(prev => prev.map(p => p.id === project.id ? { 
        ...p, 
        ...payload, 
        criteriaScores: currentCriteria, 
        totalScore: total, 
        isSaved: true, 
        status: "Evaluated" 
      } : p));
      showToast(`Scores for "${project.teamName}" saved successfully (${total}/${totalMaxMarks})!`);
    } catch (err) {
      console.error("Save Error:", err);
      showToast("Failed to save score. Please try again.");
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Row",
      "Round",
      "Team Name", 
      "Project Title", 
      "Track", 
      ...marksColumns.map(c => `"${c.name} (${c.maxMarks})"`),
      `"Total Score (${totalMaxMarks})"`, 
      "Status"
    ];
    const rows = filteredProjects.map((p, idx) => [
      idx + 1,
      `Round ${activeRound}`,
      `"${p.teamName}"`,
      `"${p.projectTitle}"`,
      `"${p.track}"`,
      ...marksColumns.map(c => p.status === "Evaluated" ? getColumnScore(p, c.id) : "N/A"),
      p.totalScore !== undefined ? p.totalScore : "N/A",
      p.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `jury_evaluation_matrix_round_${activeRound}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const evaluatedCount = filteredProjects.filter(p => p.status === "Evaluated" || (p.totalScore !== undefined && p.totalScore > 0)).length;
  const pendingCount = Math.max(0, filteredProjects.length - evaluatedCount);
  const evaluatedProjects = filteredProjects.filter(p => p.totalScore !== undefined && p.totalScore > 0);
  const avgScore = evaluatedProjects.length > 0 
    ? (evaluatedProjects.reduce((acc, p) => acc + (p.totalScore || 0), 0) / evaluatedProjects.length).toFixed(1)
    : "N/A";

  return (
    <div className={`space-y-5 animate-in fade-in duration-200 text-left font-sans w-full ${isFullScreenMode ? "min-h-full" : ""}`}>
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold tracking-tight text-white">Full Screen Scoring Mode</h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/25 text-blue-300 border border-blue-400/30">
                  Round {activeRound} Active
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-medium">Distraction-free jury evaluation grid • Press Esc or click Exit to return</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {onOpenSubmitModal && (
              <button
                type="button"
                onClick={onOpenSubmitModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-blue-500 shadow-sm active:scale-95 cursor-pointer"
                title="Submit final evaluations"
              >
                <Award className="h-4 w-4" />
                <span>Submit Final Scores</span>
              </button>
            )}
            <button
              onClick={toggleFullScreen}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 border border-white/20 active:scale-95 cursor-pointer"
            >
              <Minimize2 className="h-4 w-4 text-blue-400" />
              Exit Full Screen
            </button>
          </div>
        </div>
      )}

      {/* Header with Excel Export & Fullscreen Buttons */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60 shrink-0">
              <FileSpreadsheet className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Assigned Projects & Submissions (Grid Scoring)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-700 shadow-xs">
              Round {activeRound} Active
            </span>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
            <div>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Active Event</span>
              <span className="text-xs font-black text-slate-800 truncate block mt-0.5">{activeEventConfig.title}</span>
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Active Round</span>
              <span className="text-xs font-black text-[#2563EB] flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                Round {activeRound}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Assigned Projects</span>
              <span className="text-xs font-black text-slate-800 block mt-0.5">{projects.length} Submissions</span>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest bg-white px-2.5 py-0.5 rounded-full border border-blue-100">
                    ACTIVE EVALUATION EVENT
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase bg-blue-100 text-blue-800 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                    ROUND {activeRound} ACTIVE
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="font-mono uppercase tracking-wider text-slate-700">Sheet1: Round {activeRound} - Jury_Evaluation_Matrix.xlsx</span>
            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
              Round {activeRound} Active
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[10px]">SAVE & LOCK SCORING SYSTEM</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3 border-r border-slate-200 w-12 text-center font-mono">#</th>
                <th className="py-3 px-4 border-r border-slate-200 min-w-[160px]">Team Name</th>
                {marksColumns.map((col) => (
                  <th key={col.id} className="py-3 px-3 border-r border-slate-200 min-w-[130px] text-center">
                    <div>{col.name}</div>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold">({col.maxMarks})</span>
                  </th>
                ))}
                <th className="py-3 px-3 border-r border-slate-200 w-28 text-center font-mono">
                  <div>Total Score</div>
                  <span className="text-[10px] text-slate-400 font-mono font-semibold">({totalMaxMarks})</span>
                </th>
                <th className="py-3 px-3 border-r border-slate-200 w-28 text-center">Status</th>
                <th className="py-3 px-4 text-center min-w-[140px] sticky right-0 bg-slate-100 border-l border-slate-200 shadow-xs z-10">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={marksColumns.length + 5} className="py-12 text-center text-slate-400 font-medium">
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

                      {/* Dynamic Marks Columns */}
                      {marksColumns.map((col) => {
                        const colScore = getColumnScore(p, col.id);
                        const isFieldFocused = focusedCell?.id === p.id && focusedCell?.field === col.id;

                        return (
                          <td key={col.id} className="py-2.5 px-2 border-r border-slate-200/70 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isMasked ? (
                                <span className="w-14 py-1.5 px-2 text-center font-mono font-extrabold text-xs rounded-lg bg-amber-50/80 border border-amber-200/70 text-amber-700 tracking-widest select-none">
                                  {colScore > 0 ? "••" : "—"}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max={col.maxMarks}
                                  placeholder="—"
                                  value={colScore > 0 ? colScore : (colScore === 0 && isFieldFocused ? "0" : "")}
                                  onFocus={() => setFocusedCell({ id: p.id, field: col.id })}
                                  onBlur={() => setFocusedCell(null)}
                                  onChange={(e) => handleCellChange(p.id, col.id, e.target.value, col.maxMarks)}
                                  className="w-14 py-1.5 px-2 text-center font-mono font-bold text-xs rounded-lg transition-all bg-slate-50 border border-slate-300/80 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                                />
                              )}
                              <span className="text-[10px] text-slate-400 font-bold font-mono">/{col.maxMarks}</span>
                            </div>
                          </td>
                        );
                      })}

                      {/* Total Score */}
                      <td className="py-3.5 px-3 border-r border-slate-200/70 text-center font-mono font-extrabold">
                        {p.totalScore !== undefined && (p.status === "Evaluated" || p.totalScore > 0) ? (
                          isMasked ? (
                            <span className="text-amber-600 font-extrabold text-sm tracking-widest select-none">••••</span>
                          ) : (
                            <span className="text-blue-600 text-sm font-black">{p.totalScore}/{totalMaxMarks}</span>
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
            <span>PENDING: <strong className="text-amber-600">{pendingCount}</strong></span>
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


