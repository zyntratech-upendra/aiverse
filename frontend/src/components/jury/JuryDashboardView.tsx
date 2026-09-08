import React, { useState, useEffect } from "react";
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Flame,
  Layers
} from "lucide-react";
import { fetchSettings, fetchJuryEvaluations, fetchRegistrations, fetchEvents } from "../../services/apiClient";

interface JuryDashboardViewProps {
  onNavigateTab: (tab: "Dashboard" | "Assignments") => void;
}

interface JuryEvaluationDoc {
  id: string;
  teamName: string;
  projectTitle: string;
  track: string;
  status: "Pending" | "Evaluated";
  isSaved?: boolean;
  totalScore?: number;
}

interface FirestoreEventDoc {
  id: string;
  title: string;
  date: string;
  time?: string;
  startTime?: string;
  location?: string;
  category?: string;
  currentReg?: number;
  maxReg?: number;
}

const JuryDashboardView: React.FC<JuryDashboardViewProps> = ({
  onNavigateTab
}) => {
  const [evaluations, setEvaluations] = useState<JuryEvaluationDoc[]>([]);
  const [dbEvents, setDbEvents] = useState<FirestoreEventDoc[]>([]);
  const [registrationsCount, setRegistrationsCount] = useState<number>(0);
  const [activeEventConfig, setActiveEventConfig] = useState<{ id: string; title: string }>({
    id: localStorage.getItem("activeJuryEventId") || "ALL_EVENTS",
    title: localStorage.getItem("activeJuryEventTitle") || "All Events"
  });

  // 1. Subscribe to Active Event configuration from settings/portal_config
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
        const d = await fetchSettings("portal_config");
        if (d && (d.activeJuryEventId || d.activeJuryEventTitle)) {
          const id = d.activeJuryEventId || "ALL_EVENTS";
          const title = d.activeJuryEventTitle || "All Events";
          setActiveEventConfig({ id, title });
          localStorage.setItem("activeJuryEventId", id);
          localStorage.setItem("activeJuryEventTitle", title);
        }
      } catch (e) {}
    };

    loadSettings();
    settingsPoll = setInterval(loadSettings, 15000);

    return () => {
      window.removeEventListener("storage", syncConfig);
      window.removeEventListener("juryPortalStatusChanged", syncConfig);
      if (settingsPoll) clearInterval(settingsPoll);
    };
  }, []);

  // 2. Load jury evaluations from backend
  useEffect(() => {
    let evalsPoll: any = null;
    const loadEvals = async () => {
      try {
        const list = await fetchJuryEvaluations();
        if (Array.isArray(list) && list.length > 0) {
          const fetched: JuryEvaluationDoc[] = list.map((data: any) => ({
            id: data._id || data.id || "",
            teamName: data.teamName || "",
            projectTitle: data.projectTitle || "",
            track: data.track || "",
            status: (data.status as "Pending" | "Evaluated") || "Pending",
            isSaved: Boolean(data.isSaved),
            totalScore: Number(data.totalScore) || 0
          }));
          setEvaluations(fetched);
        } else {
          setEvaluations([]);
        }
      } catch (err) {
        console.error("Error loading jury evaluations:", err);
      }
    };

    loadEvals();
    evalsPoll = setInterval(loadEvals, 15000);
    return () => { if (evalsPoll) clearInterval(evalsPoll); };
  }, []);

  // 3. Load registrations count for fallback metrics
  useEffect(() => {
    let regsPoll: any = null;
    const loadRegsCount = async () => {
      try {
        const list = await fetchRegistrations();
        if (Array.isArray(list)) {
          setRegistrationsCount(list.length);
        }
      } catch (err) {
        console.error("Error loading registrations count:", err);
      }
    };
    loadRegsCount();
    regsPoll = setInterval(loadRegsCount, 15000);
    return () => { if (regsPoll) clearInterval(regsPoll); };
  }, []);

  // 4. Load events for Active Tracks and Calendar (Excludes completed/archived events)
  useEffect(() => {
    let eventsPoll: any = null;
    const loadEventsList = async () => {
      try {
        const events = await fetchEvents();
        if (Array.isArray(events) && events.length > 0) {
          const list: FirestoreEventDoc[] = events
            .map((d: any) => ({
              id: d._id || d.id || "",
              title: d.title || "Unnamed Event",
              date: d.date || "Upcoming",
              time: d.time || d.startTime || "10:00 AM",
              location: d.location || "Main Auditorium",
              category: d.category || "Hackathon",
              currentReg: Number(d.currentReg) || 0,
              maxReg: Number(d.maxReg) || 50,
              status: d.status || "Active"
            }))
            .filter((ev: any) => {
              const s = (ev.status || "").toLowerCase();
              return !s.includes("completed") && !s.includes("finished") && !s.includes("archive");
            });
          setDbEvents(list);
        } else {
          setDbEvents([]);
        }
      } catch (err) {
        console.error("Error loading events for dashboard:", err);
      }
    };
    loadEvents();
    eventsPoll = setInterval(loadEvents, 10000);
    return () => { if (eventsPoll) clearInterval(eventsPoll); };
  }, []);

  // Filter evaluations based on active event configuration
  const activeEvaluations = evaluations.filter((item) => {
    if (activeEventConfig.id === "ALL_EVENTS") return true;
    return (
      item.track.toLowerCase().includes(activeEventConfig.title.toLowerCase()) ||
      activeEventConfig.title.toLowerCase().includes(item.track.toLowerCase())
    );
  });

  // Derived real metrics
  const totalAssignments = activeEvaluations.length > 0 ? activeEvaluations.length : registrationsCount;
  const completedCount = activeEvaluations.filter((e) => e.status === "Evaluated" || e.isSaved).length;
  const pendingCount = Math.max(0, totalAssignments - completedCount);
  const completionPercentage = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0;

  // Derive tracks breakdown dynamically from Firestore (Filtering out 100% completed tracks)
  const tracksMap = new Map<string, { total: number; evaluated: number }>();
  
  if (activeEvaluations.length > 0) {
    activeEvaluations.forEach((item) => {
      const trackName = item.track || activeEventConfig.title || "General Track";
      const existing = tracksMap.get(trackName) || { total: 0, evaluated: 0 };
      tracksMap.set(trackName, {
        total: existing.total + 1,
        evaluated: existing.evaluated + (item.status === "Evaluated" || item.isSaved ? 1 : 0)
      });
    });
  } else if (dbEvents.length > 0) {
    dbEvents.forEach((ev) => {
      tracksMap.set(ev.title, {
        total: ev.currentReg || 4,
        evaluated: 0
      });
    });
  }

  const tracksList = Array.from(tracksMap.entries())
    .map(([trackName, stat]) => ({
      trackName,
      total: stat.total,
      evaluated: stat.evaluated,
      percentage: stat.total > 0 ? Math.round((stat.evaluated / stat.total) * 100) : 0
    }))
    .filter((track) => track.percentage < 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ================= WELCOME HEADER ================= */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-0.5 rounded-full border border-blue-100/60">
              REAL-TIME JURY METRICS
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              LIVE DATA SYNC
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Welcome back, Juror
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            You have <span className="font-extrabold text-blue-600">{pendingCount} projects</span> pending evaluation for{" "}
            <span className="font-extrabold text-slate-800">{activeEventConfig.title}</span>.
          </p>
        </div>

        <button
          onClick={() => onNavigateTab("Assignments")}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-blue-600/15 transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <Flame className="h-4 w-4" />
          Evaluate Projects Now
        </button>
      </div>

      {/* ================= METRIC STAT CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Assignments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardList className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100/50">
              FIRESTORE LIVE
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              TOTAL ASSIGNMENTS
            </span>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1 block">
              {String(totalAssignments).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Card 2: Pending Evaluations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${pendingCount > 0 ? "text-amber-700 bg-amber-50 border-amber-100" : "text-emerald-700 bg-emerald-50 border-emerald-100"}`}>
              {pendingCount > 0 ? "ACTION NEEDED" : "ALL DONE"}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              PENDING EVALUATIONS
            </span>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1 block">
              {String(pendingCount).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              {completionPercentage}%
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              COMPLETED
            </span>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1 block">
              {String(completedCount).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Card 4: Active Event Track */}
        <div className="bg-white p-5 rounded-2xl border border-[#2563EB]/30 shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              ACTIVE TRACK
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              ACTIVE JURY FILTER
            </span>
            <span className="text-sm font-black text-slate-900 tracking-tight mt-1 block truncate">
              {activeEventConfig.title}
            </span>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="space-y-6">
        {/* Active Jury Tracks Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Active Jury Tracks
              </h2>
              <p className="text-xs text-slate-400 font-medium">Real-time team evaluation progress by event track</p>
            </div>
            <button 
              onClick={() => onNavigateTab("Assignments")}
              className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100"
            >
              View All Tracks <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Tracks List */}
          <div className="space-y-4">
            {tracksList.length > 0 ? (
              tracksList.map((track, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3 cursor-pointer" 
                  onClick={() => onNavigateTab("Assignments")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{track.trackName}</span>
                    <span className="text-[10px] font-extrabold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-100 shadow-xs">
                      {track.evaluated} / {track.total} Evaluated
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#2563EB] rounded-full transition-all duration-500" 
                      style={{ width: `${track.percentage}%` }} 
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium text-xs">
                No evaluation tracks currently registered. Create events or submit registrations to start scoring.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JuryDashboardView;
