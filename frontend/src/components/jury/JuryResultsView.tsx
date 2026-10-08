import React, { useState, useEffect } from "react";
import { 
  Trophy, 
  BarChart3, 
  Calendar, 
  ArrowLeft, 
  ChevronRight, 
  Users,
  Calculator,
  CheckCircle2,
  Sparkles,
  Layers,
  Award,
  RefreshCw,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { fetchEvents, fetchJuryEvaluations, fetchRegistrations, updateRegistration } from "../../services/apiClient";

interface LeaderboardItem {
  id: string;
  rank: number;
  teamName: string;
  projectTitle: string;
  track: string;
  totalScore: number;
  round1Score: number;
  round2Score: number;
  averageScore: number;
  round1Evaluated: boolean;
  round2Evaluated: boolean;
  evaluator: string;
  badge?: string;
  status: string;
  eventId?: string;
}

export interface EventResultCard {
  id: string;
  title: string;
  category: string;
  date: string;
  teamsCount: number;
  status: string;
  description: string;
}

const JuryResultsView: React.FC = () => {
  const [eventCards, setEventCards] = useState<EventResultCard[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventResultCard | null>(null);
  const [allEvaluations, setAllEvaluations] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"round1" | "round2" | "average">("average");
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcNotification, setCalcNotification] = useState<{ message: string; type: "success" | "info" } | null>(null);

  // MongoDB REST API fetcher for database events and jury evaluations
  useEffect(() => {
    setLoading(true);

    // 1. Fetch events from backend API
    const loadEvents = async () => {
      try {
        const eventsData = await fetchEvents();
        const list = Array.isArray(eventsData) ? eventsData : [];
        const dbCards: EventResultCard[] = list.map((data: any) => ({
          id: data.id || data._id || "",
          title: data.title || "Unnamed Event",
          category: data.category || (data.type ? data.type.toUpperCase() : "GENERAL"),
          date: data.date || (data.startDate ? `${data.startDate}` : "2026"),
          teamsCount: Math.max(0, Number(data.currentReg) || 0),
          status: data.status === "Opened" || data.status === "Published" || data.status === "Active" ? "Active" : "Evaluated",
          description: data.description || "Official Event Results & Standings"
        }));
        setEventCards(dbCards);
        setLoading(false);
      } catch (err) {
        console.error("Error loading events:", err);
        setLoading(false);
      }
    };
    loadEvents();

    // 2. Fetch real jury evaluations and registrations from backend API
    const loadEvals = async () => {
      try {
        const [evalsData, regsData] = await Promise.all([
          fetchJuryEvaluations().catch(() => []),
          fetchRegistrations().catch(() => [])
        ]);
        const evalsList = Array.isArray(evalsData) ? evalsData : [];
        const regsList = Array.isArray(regsData) ? regsData : [];

        const consolidatedMap = new Map<string, any>();

        // 1. Process registrations
        regsList.forEach((reg: any) => {
          const id = reg.id || reg._id;
          if (!id) return;

          const r1Score = Number(reg.round1Score) || 0;
          const r2Score = Number(reg.round2Score) || 0;
          let avgScore = Number(reg.averageScore) || 0;

          if (avgScore === 0 && (r1Score > 0 || r2Score > 0)) {
            avgScore = (r1Score > 0 && r2Score > 0) 
              ? Math.round(((r1Score + r2Score) / 2) * 10) / 10 
              : (r1Score > 0 ? r1Score : r2Score);
          }

          let critSum = 0;
          if (reg.criteriaScores && typeof reg.criteriaScores === "object") {
            Object.values(reg.criteriaScores).forEach((v: any) => {
              critSum += Number(v) || 0;
            });
          }
          if (critSum === 0) {
            const comm = Number(reg.communication) || 0;
            const innov = Number(reg.innovationUniqueness) || 0;
            const feas = Number(reg.feasibilityViability) || 0;
            const stats = Number(reg.statistics) || 0;
            const rev = Number(reg.revenue) || 0;
            critSum = comm + innov + feas + stats + rev;
          }
          const defaultScore = critSum > 0 ? critSum : (Number(reg.totalScore || reg.juryScore || reg.score) || 0);
          const finalScore = avgScore > 0 ? avgScore : (r1Score > 0 ? r1Score : defaultScore);
          const isSaved = Boolean(reg.isSaved || reg.juryEvaluated || reg.evaluationStatus === "Evaluated" || finalScore > 0);

          consolidatedMap.set(id, {
            id,
            eventId: reg.eventId || "",
            teamName: reg.groupName || reg.teamName || reg.teamLeadName || `Team ${id.substring(0, 5)}`,
            projectTitle: reg.projectTitle || `${reg.groupName || reg.teamName || "Project"} Submission`,
            track: reg.eventTitle || reg.eventName || reg.track || "General Track",
            status: isSaved || finalScore > 0 ? "Evaluated" : "Pending",
            round1Score: r1Score,
            round2Score: r2Score,
            averageScore: avgScore > 0 ? avgScore : finalScore,
            totalScore: finalScore,
            round1Evaluated: r1Score > 0 || (reg.round === 1 && isSaved),
            round2Evaluated: r2Score > 0 || (reg.round === 2 && isSaved),
            evaluator: isSaved || finalScore > 0 ? "Jury Evaluated" : "Pending Evaluation"
          });
        });

        // 2. Overlay with jury evaluations (highest fidelity per round)
        evalsList.forEach((ev: any) => {
          const id = ev.registrationId || ev.id || ev._id;
          if (!id) return;

          let critSum = 0;
          if (ev.criteriaScores && typeof ev.criteriaScores === "object") {
            Object.values(ev.criteriaScores).forEach((v: any) => {
              critSum += Number(v) || 0;
            });
          }
          if (critSum === 0) {
            const comm = Number(ev.communication) || 0;
            const innov = Number(ev.innovationUniqueness) || 0;
            const feas = Number(ev.feasibilityViability) || 0;
            const stats = Number(ev.statistics) || 0;
            const rev = Number(ev.revenue) || 0;
            critSum = comm + innov + feas + stats + rev;
          }
          const evScore = critSum > 0 ? critSum : (Number(ev.totalScore || ev.score) || 0);
          const evRound = Number(ev.round) || 1;

          const existing = consolidatedMap.get(id) || consolidatedMap.get((ev.teamName || "").trim().toLowerCase());
          const teamName = ev.teamName || existing?.teamName || `Team ${id.substring(0, 5)}`;
          const track = ev.track || ev.eventTitle || existing?.track || "General Track";
          const projectTitle = ev.projectTitle || existing?.projectTitle || "Hackathon Submission";

          let r1 = existing?.round1Score || 0;
          let r2 = existing?.round2Score || 0;
          let r1Eval = existing?.round1Evaluated || false;
          let r2Eval = existing?.round2Evaluated || false;

          if (evRound === 1) {
            r1 = evScore;
            r1Eval = Boolean(ev.isSaved || ev.status === "Evaluated" || evScore > 0);
          } else if (evRound === 2) {
            r2 = evScore;
            r2Eval = Boolean(ev.isSaved || ev.status === "Evaluated" || evScore > 0);
          } else {
            if (r1 === 0) r1 = evScore;
          }

          const calculatedAvg = (r1 > 0 && r2 > 0) ? Math.round(((r1 + r2) / 2) * 10) / 10 : (r1 > 0 ? r1 : r2);
          const isSaved = Boolean(ev.isSaved || ev.status === "Evaluated" || evScore > 0 || existing?.status === "Evaluated");

          consolidatedMap.set(id, {
            id,
            eventId: ev.eventId || existing?.eventId || "",
            teamName,
            projectTitle,
            track,
            status: isSaved ? "Evaluated" : (existing?.status || ev.status || "Pending"),
            round1Score: r1,
            round2Score: r2,
            averageScore: calculatedAvg > 0 ? calculatedAvg : (existing?.averageScore || 0),
            totalScore: calculatedAvg > 0 ? calculatedAvg : (r1 > 0 ? r1 : evScore),
            round1Evaluated: r1Eval,
            round2Evaluated: r2Eval,
            evaluator: ev.juryName ? `Juror: ${ev.juryName}` : (existing?.evaluator || "Jury Evaluated")
          });
        });

        const list = Array.from(consolidatedMap.values());
        setAllEvaluations(list);
      } catch (err) {
        console.error("Error loading jury evaluations:", err);
      }
    };
    loadEvals();

    const polls = [
      setInterval(loadEvents, 15000),
      setInterval(loadEvals, 15000)
    ];

    return () => polls.forEach(p => clearInterval(p));
  }, []);

  // Filter evaluations for the selected hackathon event & sort according to active viewMode
  const currentResults = selectedEvent
    ? allEvaluations
        .filter(item => {
          const selTitle = (selectedEvent.title || "").trim().toLowerCase();
          const itemTrack = (item.track || "").trim().toLowerCase();
          const itemEventId = item.eventId || "";
          const selEventId = selectedEvent.id || "";

          const matchesId = Boolean(itemEventId && selEventId && itemEventId === selEventId);
          const matchesTitle = itemTrack === selTitle || 
                               (itemTrack.length > 2 && selTitle.includes(itemTrack)) || 
                               (selTitle.length > 2 && itemTrack.includes(selTitle));

          return matchesId || matchesTitle;
        })
        .sort((a, b) => {
          let scoreA = a.averageScore || 0;
          let scoreB = b.averageScore || 0;
          if (viewMode === "round1") {
            scoreA = a.round1Score || 0;
            scoreB = b.round1Score || 0;
          } else if (viewMode === "round2") {
            scoreA = a.round2Score || 0;
            scoreB = b.round2Score || 0;
          }
          return scoreB - scoreA;
        })
        .map((item, idx) => {
          const activeScore = viewMode === "round1" 
            ? (item.round1Score || 0) 
            : viewMode === "round2" 
            ? (item.round2Score || 0) 
            : (item.averageScore || 0);

          let badge = undefined;
          if (idx === 0 && activeScore > 0) badge = "1ST PLACE";
          else if (idx === 1 && activeScore > 0) badge = "2ND PLACE";
          else if (idx === 2 && activeScore > 0) badge = "3RD PLACE";

          return {
            ...item,
            rank: idx + 1,
            badge
          };
        })
    : [];

  const getActiveScore = (item: LeaderboardItem | null) => {
    if (!item) return 0;
    if (viewMode === "round1") return item.round1Score || 0;
    if (viewMode === "round2") return item.round2Score || 0;
    return item.averageScore || 0;
  };

  const evaluatedResults = currentResults.filter(r => getActiveScore(r) > 0 || r.status === "Evaluated");
  const firstPlace = evaluatedResults[0] || (getActiveScore(currentResults[0]) > 0 ? currentResults[0] : null);
  const secondPlace = evaluatedResults[1] || (getActiveScore(currentResults[1]) > 0 ? currentResults[1] : null);
  const thirdPlace = evaluatedResults[2] || (getActiveScore(currentResults[2]) > 0 ? currentResults[2] : null);

  // Statistics across Round 1, Round 2, and Average
  const totalTeams = currentResults.length;
  
  const r1EvaluatedTeams = currentResults.filter(r => r.round1Score > 0 || r.round1Evaluated);
  const r1Scores = r1EvaluatedTeams.map(r => r.round1Score).filter(s => s > 0);
  const r1Average = r1Scores.length > 0 ? Math.round((r1Scores.reduce((a, b) => a + b, 0) / r1Scores.length) * 10) / 10 : 0;
  const r1TopScore = r1Scores.length > 0 ? Math.max(...r1Scores) : 0;

  const r2EvaluatedTeams = currentResults.filter(r => r.round2Score > 0 || r.round2Evaluated);
  const r2Scores = r2EvaluatedTeams.map(r => r.round2Score).filter(s => s > 0);
  const r2Average = r2Scores.length > 0 ? Math.round((r2Scores.reduce((a, b) => a + b, 0) / r2Scores.length) * 10) / 10 : 0;
  const r2TopScore = r2Scores.length > 0 ? Math.max(...r2Scores) : 0;

  const avgScores = currentResults.map(r => r.averageScore).filter(s => s > 0);
  const grandAverage = avgScores.length > 0 ? Math.round((avgScores.reduce((a, b) => a + b, 0) / avgScores.length) * 10) / 10 : 0;
  const topAverageScore = avgScores.length > 0 ? Math.max(...avgScores) : 0;
  const bothEvaluatedCount = currentResults.filter(r => r.round1Score > 0 && r.round2Score > 0).length;

  // Calculation Handler: Calculates (Round 1 + Round 2) / 2 for all teams and saves to MongoDB
  const handleCalculateAverages = async () => {
    if (!selectedEvent) return;
    setIsCalculating(true);
    try {
      let count = 0;
      const targetItems = currentResults;
      const updatedMap = new Map<string, { r1: number; r2: number; avg: number }>();

      targetItems.forEach((item) => {
        const r1 = Number(item.round1Score) || 0;
        const r2 = Number(item.round2Score) || 0;
        let avg = 0;
        if (r1 > 0 && r2 > 0) {
          avg = Math.round(((r1 + r2) / 2) * 10) / 10;
        } else if (r1 > 0) {
          avg = r1;
        } else if (r2 > 0) {
          avg = r2;
        }
        updatedMap.set(item.id, { r1, r2, avg });
        count++;
      });

      // Update local state immediately
      setAllEvaluations((prev) =>
        prev.map((item) => {
          const calc = updatedMap.get(item.id);
          if (calc) {
            return {
              ...item,
              round1Score: calc.r1,
              round2Score: calc.r2,
              averageScore: calc.avg,
              totalScore: calc.avg > 0 ? calc.avg : item.totalScore,
              status: calc.avg > 0 ? "Evaluated" : item.status,
            };
          }
          return item;
        })
      );

      // Persist to backend MongoDB via updateRegistration
      const updatePromises = targetItems.map(async (item) => {
        const calc = updatedMap.get(item.id);
        if (!calc) return;
        try {
          await updateRegistration(item.id, {
            round1Score: calc.r1,
            round2Score: calc.r2,
            averageScore: calc.avg,
            totalScore: calc.avg > 0 ? calc.avg : undefined,
            juryScore: calc.avg > 0 ? calc.avg : undefined,
            evaluationStatus: calc.avg > 0 ? "Evaluated" : undefined,
            juryEvaluated: calc.avg > 0,
          });
        } catch (e) {
          console.warn(`Failed saving average for registration ${item.id}:`, e);
        }
      });

      await Promise.allSettled(updatePromises);

      setViewMode("average");
      setCalcNotification({
        message: `Calculated & saved averages for ${count} teams in ${selectedEvent.title}!`,
        type: "success",
      });
      setTimeout(() => setCalcNotification(null), 5000);
    } catch (err) {
      console.error("Calculate error:", err);
      setCalcNotification({
        message: "Failed to calculate averages.",
        type: "info",
      });
      setTimeout(() => setCalcNotification(null), 4000);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCalculateSingle = async (item: LeaderboardItem) => {
    const r1 = Number(item.round1Score) || 0;
    const r2 = Number(item.round2Score) || 0;
    const avg = (r1 > 0 && r2 > 0) ? Math.round(((r1 + r2) / 2) * 10) / 10 : (r1 > 0 ? r1 : r2);

    setAllEvaluations((prev) =>
      prev.map((p) =>
        p.id === item.id
          ? {
              ...p,
              round1Score: r1,
              round2Score: r2,
              averageScore: avg,
              totalScore: avg > 0 ? avg : p.totalScore,
              status: avg > 0 ? "Evaluated" : p.status,
            }
          : p
      )
    );

    try {
      await updateRegistration(item.id, {
        round1Score: r1,
        round2Score: r2,
        averageScore: avg,
        totalScore: avg > 0 ? avg : undefined,
        juryScore: avg > 0 ? avg : undefined,
        evaluationStatus: avg > 0 ? "Evaluated" : undefined,
        juryEvaluated: avg > 0,
      });
      setCalcNotification({
        message: `Calculated average for ${item.teamName}: ${avg}/100`,
        type: "success",
      });
      setTimeout(() => setCalcNotification(null), 3500);
    } catch (e) {
      console.warn("Single calc save error:", e);
    }
  };

  const exportLeaderboardCSV = () => {
    const headers = [
      "Rank", 
      "Team Name", 
      "Project Title", 
      "Track", 
      "Round 1 Score", 
      "Round 2 Score", 
      "Calculated Average Score", 
      "Evaluator", 
      "Status"
    ];
    const rows = (currentResults.length > 0 ? currentResults : allEvaluations).map(item => [
      item.rank,
      `"${item.teamName.replace(/"/g, '""')}"`,
      `"${item.projectTitle.replace(/"/g, '""')}"`,
      `"${item.track.replace(/"/g, '""')}"`,
      item.round1Score,
      item.round2Score,
      item.averageScore,
      `"${item.evaluator.replace(/"/g, '""')}"`,
      item.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${(selectedEvent?.title || "hackathon").toLowerCase().replace(/\s+/g, "_")}_${viewMode}_standings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // STEP 1: If no event is selected, render ONLY the Hackathon Event Cards present in database
  if (!selectedEvent) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 text-left font-sans">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Trophy className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Select a Hackathon Event
            </h1>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Choose a database hackathon track below to view jury evaluation scorecards and podium standings.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : eventCards.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-slate-100 text-center font-semibold text-slate-400 text-xs shadow-sm">
            No hackathon evaluation records currently exist in the database.
          </div>
        ) : (
          /* Database Hackathon Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventCards.map((card) => (
              <div
                key={card.id}
                onClick={() => setSelectedEvent(card)}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-500/40 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Header Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full">
                      {card.category}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      {card.status}
                    </span>
                  </div>

                  {/* Event Details */}
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-2">
                      {card.description}
                    </p>
                  </div>

                  {/* Event Metadata */}
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{card.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{card.teamsCount} Teams</span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-5 mt-4 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(card);
                    }}
                    className="w-full py-2.5 rounded-2xl bg-slate-50 group-hover:bg-[#2563EB] text-slate-700 group-hover:text-white font-bold text-xs transition-all text-center flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>View Jury Results & Standings</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // STEP 2: When a hackathon is selected, render its 3 Round Cards, Navigation, Podium & Leaderboard
  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left font-sans">
      {/* 3 Interactive Cards: Round 1, Round 2, and Average with Calculate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: ROUND 1 */}
        <div
          onClick={() => setViewMode("round1")}
          className={`cursor-pointer rounded-3xl p-6 transition-all relative overflow-hidden flex flex-col justify-between border ${
            viewMode === "round1"
              ? "bg-gradient-to-b from-blue-50/70 via-white to-white border-blue-500 shadow-md ring-2 ring-blue-500/20"
              : "bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-md"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs ${
                  viewMode === "round1" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
                }`}>
                  1
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                    Round 1
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Phase 1 Evaluation
                  </span>
                </div>
              </div>
              {viewMode === "round1" ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-600 text-white tracking-wide shadow-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active View
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 tracking-wide">
                  View Standings
                </span>
              )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100/80 my-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Evaluated</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {r1EvaluatedTeams.length}/{totalTeams}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Avg Score</span>
                <span className="text-sm font-extrabold text-blue-600">
                  {r1Average > 0 ? `${r1Average}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Top Score</span>
                <span className="text-sm font-extrabold text-emerald-600">
                  {r1TopScore > 0 ? `${r1TopScore}` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("round1");
              }}
              className={`w-full py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                viewMode === "round1"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600"
              }`}
            >
              <span>{viewMode === "round1" ? "Viewing Round 1 Rankings" : "Switch to Round 1 View"}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* CARD 2: ROUND 2 */}
        <div
          onClick={() => setViewMode("round2")}
          className={`cursor-pointer rounded-3xl p-6 transition-all relative overflow-hidden flex flex-col justify-between border ${
            viewMode === "round2"
              ? "bg-gradient-to-b from-indigo-50/70 via-white to-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
              : "bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-md"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs ${
                  viewMode === "round2" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                }`}>
                  2
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                    Round 2
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Phase 2 Evaluation
                  </span>
                </div>
              </div>
              {viewMode === "round2" ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white tracking-wide shadow-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active View
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 tracking-wide">
                  View Standings
                </span>
              )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100/80 my-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Evaluated</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {r2EvaluatedTeams.length}/{totalTeams}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Avg Score</span>
                <span className="text-sm font-extrabold text-indigo-600">
                  {r2Average > 0 ? `${r2Average}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Top Score</span>
                <span className="text-sm font-extrabold text-emerald-600">
                  {r2TopScore > 0 ? `${r2TopScore}` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("round2");
              }}
              className={`w-full py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                viewMode === "round2"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600"
              }`}
            >
              <span>{viewMode === "round2" ? "Viewing Round 2 Rankings" : "Switch to Round 2 View"}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* CARD 3: AVERAGE & CALCULATE */}
        <div
          onClick={() => setViewMode("average")}
          className={`cursor-pointer rounded-3xl p-6 transition-all relative overflow-hidden flex flex-col justify-between border ${
            viewMode === "average"
              ? "bg-gradient-to-b from-emerald-50/70 via-white to-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-md"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shadow-xs ${
                  viewMode === "average" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600"
                }`}>
                  AVG
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                    Average Score
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    (Round 1 + Round 2) ÷ 2
                  </span>
                </div>
              </div>
              {viewMode === "average" ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white tracking-wide shadow-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active View
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 tracking-wide">
                  Overall Standings
                </span>
              )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100/80 my-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Both Done</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {bothEvaluatedCount}/{totalTeams}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Class Avg</span>
                <span className="text-sm font-extrabold text-emerald-600">
                  {grandAverage > 0 ? `${grandAverage}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Top Avg</span>
                <span className="text-sm font-extrabold text-emerald-700">
                  {topAverageScore > 0 ? `${topAverageScore}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* CALCULATE ACTION BUTTON */}
          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCalculateAverages();
              }}
              disabled={isCalculating}
              className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Calculator className={`h-4 w-4 ${isCalculating ? "animate-spin" : ""}`} />
              <span>{isCalculating ? "Calculating & Saving..." : "Calculate Averages"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification Alert */}
      {calcNotification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-sm transition-all animate-in fade-in duration-200 ${
          calcNotification.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
            : "bg-blue-50 text-blue-800 border border-blue-200"
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{calcNotification.message}</span>
          </div>
          <button 
            onClick={() => setCalcNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-extrabold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Back Button & Event Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedEvent(null)}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0"
            title="Back to Hackathons List"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>All Hackathons</span>
          </button>
          <div>
            <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">
              Jury Evaluation — {selectedEvent.category}
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {selectedEvent.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCalculateAverages}
            disabled={isCalculating}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0 disabled:opacity-60"
            title="Calculate and sync averages across Round 1 and Round 2"
          >
            <Calculator className={`h-4 w-4 ${isCalculating ? "animate-spin" : ""}`} />
            <span>Calculate Averages</span>
          </button>

          <button
            onClick={exportLeaderboardCSV}
            className="px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0"
          >
            <BarChart3 className="h-4 w-4" />
            Export Standings CSV
          </button>
        </div>
      </div>

      {/* Top Podium Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2nd Place */}
        {secondPlace ? (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-between h-52 relative overflow-hidden order-2 md:order-1">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 font-black flex items-center justify-center text-sm shadow-inner">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{secondPlace.teamName}</h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{secondPlace.projectTitle}</p>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-black">
              {viewMode === "round1" ? "Round 1: " : viewMode === "round2" ? "Round 2: " : "Average: "}
              {getActiveScore(secondPlace)}/100
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center h-52 order-2 md:order-1 text-slate-300 font-bold text-xs">
            2nd Place Pending
          </div>
        )}

        {/* 1st Place */}
        {firstPlace ? (
          <div className="bg-gradient-to-b from-amber-500/10 via-amber-400/5 to-white p-6 rounded-3xl border-2 border-amber-400/40 shadow-md text-center flex flex-col items-center justify-between h-56 relative overflow-hidden order-1 md:order-2">
            <div className="w-12 h-12 rounded-full bg-amber-400 text-white font-black flex items-center justify-center text-base shadow-md shadow-amber-500/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {viewMode === "round1" ? "ROUND 1 LEADER" : viewMode === "round2" ? "ROUND 2 LEADER" : "OVERALL WINNER"}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-1">{firstPlace.teamName}</h3>
              <p className="text-xs font-bold text-slate-500">{firstPlace.projectTitle}</p>
            </div>
            <div className="px-5 py-2 rounded-full bg-amber-500 text-white text-xs font-black shadow-md shadow-amber-500/20">
              {viewMode === "round1" ? "Round 1: " : viewMode === "round2" ? "Round 2: " : "Average: "}
              {getActiveScore(firstPlace)}/100
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center h-56 order-1 md:order-2 text-slate-300 font-bold text-xs">
            1st Place Pending
          </div>
        )}

        {/* 3rd Place */}
        {thirdPlace ? (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-between h-52 relative overflow-hidden order-3">
            <div className="w-10 h-10 rounded-full bg-amber-100/60 text-amber-700 font-black flex items-center justify-center text-sm shadow-inner">
              3
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{thirdPlace.teamName}</h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{thirdPlace.projectTitle}</p>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-black">
              {viewMode === "round1" ? "Round 1: " : viewMode === "round2" ? "Round 2: " : "Average: "}
              {getActiveScore(thirdPlace)}/100
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center h-52 order-3 text-slate-300 font-bold text-xs">
            3rd Place Pending
          </div>
        )}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4.5 w-4.5 text-blue-600" />
              Complete Score Rankings — {selectedEvent.title}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Ranked by <span className="font-extrabold text-slate-800 uppercase">{viewMode === "round1" ? "Round 1 Score" : viewMode === "round2" ? "Round 2 Score" : "Calculated Average Score"}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle Pills */}
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setViewMode("round1")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === "round1"
                    ? "bg-white text-blue-600 shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Round 1
              </button>
              <button
                type="button"
                onClick={() => setViewMode("round2")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === "round2"
                    ? "bg-white text-indigo-600 shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Round 2
              </button>
              <button
                type="button"
                onClick={() => setViewMode("average")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === "average"
                    ? "bg-white text-emerald-600 shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Average
              </button>
            </div>

            <button
              onClick={exportLeaderboardCSV}
              className="px-3.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-blue-200/60"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100">
              <tr>
                <th scope="col" className="px-5 py-3.5">Rank</th>
                <th scope="col" className="px-5 py-3.5">Team & Project</th>
                <th scope="col" className="px-5 py-3.5">Track</th>
                <th 
                  scope="col" 
                  onClick={() => setViewMode("round1")}
                  className={`px-5 py-3.5 text-center cursor-pointer transition-colors ${
                    viewMode === "round1" ? "bg-blue-50 text-blue-700 font-extrabold" : "hover:text-slate-700"
                  }`}
                  title="Click to sort by Round 1"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Round 1</span>
                    {viewMode === "round1" && <span className="text-[11px]">▼</span>}
                  </div>
                </th>
                <th 
                  scope="col" 
                  onClick={() => setViewMode("round2")}
                  className={`px-5 py-3.5 text-center cursor-pointer transition-colors ${
                    viewMode === "round2" ? "bg-indigo-50 text-indigo-700 font-extrabold" : "hover:text-slate-700"
                  }`}
                  title="Click to sort by Round 2"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Round 2</span>
                    {viewMode === "round2" && <span className="text-[11px]">▼</span>}
                  </div>
                </th>
                <th 
                  scope="col" 
                  onClick={() => setViewMode("average")}
                  className={`px-5 py-3.5 text-center cursor-pointer transition-colors ${
                    viewMode === "average" ? "bg-emerald-50 text-emerald-700 font-extrabold" : "hover:text-slate-700"
                  }`}
                  title="Click to sort by Average"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Average</span>
                    {viewMode === "average" && <span className="text-[11px]">▼</span>}
                  </div>
                </th>
                <th scope="col" className="px-5 py-3.5">Evaluator</th>
                <th scope="col" className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No team evaluation scores recorded for this hackathon yet.
                  </td>
                </tr>
              ) : (
                currentResults.map((item) => (
                  <tr key={item.id || item.teamName} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-black text-slate-800">
                      #{item.rank}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{item.teamName}</div>
                      <div className="text-slate-400 text-[11px] font-medium">{item.projectTitle}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-500">
                      {item.track}
                    </td>
                    <td className={`px-5 py-4 text-center ${viewMode === "round1" ? "bg-blue-50/40" : ""}`}>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                        item.round1Score > 0 
                          ? "bg-blue-50 text-blue-700 border border-blue-100" 
                          : "bg-slate-50 text-slate-400"
                      }`}>
                        {item.round1Score > 0 ? `${item.round1Score}/100` : "Pending"}
                      </span>
                    </td>
                    <td className={`px-5 py-4 text-center ${viewMode === "round2" ? "bg-indigo-50/40" : ""}`}>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                        item.round2Score > 0 
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                          : "bg-slate-50 text-slate-400"
                      }`}>
                        {item.round2Score > 0 ? `${item.round2Score}/100` : "Pending"}
                      </span>
                    </td>
                    <td className={`px-5 py-4 text-center ${viewMode === "average" ? "bg-emerald-50/40" : ""}`}>
                      <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-extrabold ${
                        item.averageScore > 0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                          : "bg-slate-50 text-slate-400"
                      }`}>
                        {item.averageScore > 0 ? `${item.averageScore}/100` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-500">
                      {item.evaluator}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleCalculateSingle(item)}
                        className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors inline-flex items-center gap-1 text-[11px] font-bold"
                        title="Recalculate Average for this team"
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Calc</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JuryResultsView;
