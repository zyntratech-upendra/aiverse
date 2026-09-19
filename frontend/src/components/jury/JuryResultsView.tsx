import React, { useState, useEffect } from "react";
import { 
  Trophy, 
  BarChart3, 
  Calendar, 
  ArrowLeft, 
  ChevronRight, 
  Users
} from "lucide-react";
import { fetchEvents, fetchJuryEvaluations, fetchRegistrations } from "../../services/apiClient";

interface LeaderboardItem {
  id: string;
  rank: number;
  teamName: string;
  projectTitle: string;
  track: string;
  totalScore: number;
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
          const comm = Number(reg.communication) || 0;
          const innov = Number(reg.innovationUniqueness) || 0;
          const feas = Number(reg.feasibilityViability) || 0;
          const stats = Number(reg.statistics) || 0;
          const rev = Number(reg.revenue) || 0;
          const critSum = comm + innov + feas + stats + rev;
          const totalScore = critSum > 0 ? critSum : (Number(reg.totalScore || reg.juryScore || reg.score) || 0);
          const isSaved = Boolean(reg.isSaved || reg.juryEvaluated || reg.evaluationStatus === "Evaluated" || totalScore > 0);

          consolidatedMap.set(id, {
            id,
            eventId: reg.eventId || "",
            teamName: reg.groupName || reg.teamName || reg.teamLeadName || `Team ${id.substring(0, 5)}`,
            projectTitle: reg.projectTitle || `${reg.groupName || reg.teamName || "Project"} Submission`,
            track: reg.eventTitle || reg.eventName || reg.track || "General Track",
            status: isSaved || totalScore > 0 ? "Evaluated" : "Pending",
            totalScore,
            evaluator: isSaved || totalScore > 0 ? "Jury Evaluated" : "Pending Evaluation"
          });
        });

        // 2. Overlay with jury evaluations (highest fidelity)
        evalsList.forEach((ev: any) => {
          const id = ev.registrationId || ev.id || ev._id;
          if (!id) return;

          const comm = Number(ev.communication) || 0;
          const innov = Number(ev.innovationUniqueness) || 0;
          const feas = Number(ev.feasibilityViability) || 0;
          const stats = Number(ev.statistics) || 0;
          const rev = Number(ev.revenue) || 0;
          const critSum = comm + innov + feas + stats + rev;
          const totalScore = critSum > 0 ? critSum : (Number(ev.totalScore || ev.score) || 0);

          const existing = consolidatedMap.get(id) || consolidatedMap.get((ev.teamName || "").trim().toLowerCase());
          const teamName = ev.teamName || existing?.teamName || `Team ${id.substring(0, 5)}`;
          const track = ev.track || ev.eventTitle || existing?.track || "General Track";
          const projectTitle = ev.projectTitle || existing?.projectTitle || "Hackathon Submission";
          const isSaved = Boolean(ev.isSaved || ev.status === "Evaluated" || totalScore > 0);

          consolidatedMap.set(id, {
            id,
            eventId: ev.eventId || existing?.eventId || "",
            teamName,
            projectTitle,
            track,
            status: isSaved || totalScore > 0 ? "Evaluated" : (ev.status || "Pending"),
            totalScore,
            evaluator: ev.juryName ? `Juror: ${ev.juryName}` : (totalScore > 0 ? "Jury Evaluated" : "Pending Evaluation")
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

  // Filter evaluations for the selected hackathon event
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
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
        .map((item, idx) => {
          let badge = undefined;
          if (idx === 0 && item.totalScore > 0) badge = "1ST PLACE";
          else if (idx === 1 && item.totalScore > 0) badge = "2ND PLACE";
          else if (idx === 2 && item.totalScore > 0) badge = "3RD PLACE";

          return {
            ...item,
            rank: idx + 1,
            badge
          };
        })
    : [];

  const evaluatedResults = currentResults.filter(r => r.totalScore > 0 || r.status === "Evaluated");
  const firstPlace = evaluatedResults[0] || (currentResults[0]?.totalScore > 0 ? currentResults[0] : null);
  const secondPlace = evaluatedResults[1] || (currentResults[1]?.totalScore > 0 ? currentResults[1] : null);
  const thirdPlace = evaluatedResults[2] || (currentResults[2]?.totalScore > 0 ? currentResults[2] : null);

  const exportLeaderboardCSV = () => {
    const headers = ["Rank", "Team Name", "Project Title", "Track", "Evaluator", "Score", "Status"];
    const rows = (currentResults.length > 0 ? currentResults : allEvaluations).map(item => [
      item.rank,
      `"${item.teamName}"`,
      `"${item.projectTitle}"`,
      `"${item.track}"`,
      `"${item.evaluator}"`,
      item.totalScore,
      item.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${(selectedEvent?.title || "hackathon").toLowerCase().replace(/\s+/g, "_")}_standings.csv`);
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

  // STEP 2: When a hackathon is selected, render its Jury Results, Podium & Leaderboard
  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left font-sans">
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

        <button
          onClick={exportLeaderboardCSV}
          className="px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0"
        >
          <BarChart3 className="h-4 w-4" />
          Export Standings CSV
        </button>
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
              Score: {secondPlace.totalScore}/100
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
                WINNER
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-1">{firstPlace.teamName}</h3>
              <p className="text-xs font-bold text-slate-500">{firstPlace.projectTitle}</p>
            </div>
            <div className="px-5 py-2 rounded-full bg-amber-500 text-white text-xs font-black shadow-md shadow-amber-500/20">
              Score: {firstPlace.totalScore}/100
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
              Score: {thirdPlace.totalScore}/100
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
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-blue-600" />
            Complete Score Rankings — {selectedEvent.title}
          </h3>
          <button onClick={exportLeaderboardCSV} className="text-xs font-bold text-blue-600 hover:text-blue-700">
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100">
              <tr>
                <th scope="col" className="px-6 py-3.5">Rank</th>
                <th scope="col" className="px-6 py-3.5">Team & Project</th>
                <th scope="col" className="px-6 py-3.5">Track</th>
                <th scope="col" className="px-6 py-3.5">Evaluator</th>
                <th scope="col" className="px-6 py-3.5 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentResults.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    No team evaluation scores recorded for this hackathon yet.
                  </td>
                </tr>
              ) : (
                currentResults.map((item) => (
                  <tr key={item.id || item.teamName} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-800">
                      #{item.rank}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{item.teamName}</div>
                      <div className="text-slate-400 text-[11px] font-medium">{item.projectTitle}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-500">
                      {item.track}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">
                      {item.evaluator}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-600 border border-blue-100">
                        {item.totalScore}/100
                      </span>
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
