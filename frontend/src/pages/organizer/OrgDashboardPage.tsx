import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../../config/firebase";
import { collection, getDocs } from "firebase/firestore";
import SEO from "../../components/layout/SEO";
import { useAuth } from "../../context/AuthContext";
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  MapPin, 
  ArrowRight, 
  Loader2,
  TrendingUp
} from "lucide-react";

// Asset fallbacks matching our images folder
import satoshiImg from "../../assets/images/satoshi.png";
import elenaImg from "../../assets/images/elena.png";
import sarahImg from "../../assets/images/sarah.png";

interface EventItem {
  id: string;
  title: string;
  description?: string;
  currentReg: number;
  maxReg: number;
  status: "Draft" | "Active" | "Opened";
  date: string;
  location: string;
  time?: string;
  category?: string;
}

interface RegistrationItem {
  id: string;
  status: string;
  teamSize?: number;
}

import { dataCache } from "../../utils/dataCache";

const OrgDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cachedEvents = dataCache.get<EventItem[]>("org_dashboard_events");
  const cachedRegs = dataCache.get<RegistrationItem[]>("org_dashboard_regs");
  const [events, setEvents] = useState<EventItem[]>(cachedEvents || []);
  const [registrations, setRegistrations] = useState<RegistrationItem[]>(cachedRegs || []);
  const [loading, setLoading] = useState(!cachedEvents);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Parallelize events and registrations queries
        const [eventSnapshotRes, regSnapshotRes] = await Promise.allSettled([
          getDocs(collection(db, "events")),
          getDocs(collection(db, "registrations"))
        ]);

        if (eventSnapshotRes.status === "fulfilled") {
          const eventList: EventItem[] = [];
          eventSnapshotRes.value.forEach((docSnap) => {
            const data = docSnap.data();
            eventList.push({
              id: docSnap.id,
              title: data.title || "Untitled Event",
              description: data.description || "No description provided.",
              currentReg: Math.max(0, Number(data.currentReg) || 0),
              maxReg: Number(data.maxReg) || 100,
              status: data.status || "Draft",
              date: data.date || "TBD",
              location: data.location || "TBD",
              time: data.time || "TBD",
              category: data.category || "General"
            });
          });
          setEvents(eventList);
          dataCache.set("org_dashboard_events", eventList, 60_000);
        }

        if (regSnapshotRes.status === "fulfilled") {
          const regList: RegistrationItem[] = [];
          regSnapshotRes.value.forEach((docSnap) => {
            const data = docSnap.data();
            regList.push({
              id: docSnap.id,
              status: data.status || "Confirmed",
              teamSize: data.teamSize || 1
            });
          });
          setRegistrations(regList);
          dataCache.set("org_dashboard_regs", regList, 60_000);
        }
      } catch (err) {
        console.error("Error loading coordinator dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    // Total Registrations across all events
    const totalRegistrations = events.reduce((sum, e) => sum + e.currentReg, 0);

    // Pending approvals count from registrations collection
    const pendingApprovals = registrations.filter(r => r.status === "Pending").length;

    // Active events under management (Opened + Active status)
    const activeEventsCount = events.filter(e => e.status === "Opened" || e.status === "Active").length;

    return {
      totalRegistrations,
      pendingApprovals,
      activeEventsCount
    };
  }, [events, registrations]);

  // Happening Now (Prioritize today's active/live event, or closest active event)
  const happeningNowEvent = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const activeEvents = events.filter(e => e.status === "Opened" || e.status === "Active");
    const todayEvent = activeEvents.find(e => e.date === todayStr || (e.date && e.date.startsWith(todayStr)));
    if (todayEvent) return todayEvent;

    if (activeEvents.length > 0) {
      return activeEvents[0];
    }
    return null;
  }, [events]);

  const eventStatus = useMemo(() => {
    if (!happeningNowEvent || !happeningNowEvent.date || happeningNowEvent.date === "TBD") {
       return { isLive: true, text: "Happening Now" };
    }
    const eventDate = new Date(happeningNowEvent.date);
    if (isNaN(eventDate.getTime())) return { isLive: true, text: "Happening Now" };

    const today = new Date();
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return { isLive: true, text: "Happening Now" };
    if (diffDays > 0) return { isLive: false, text: `${diffDays} Days To Go` };
    return { isLive: false, text: "Past Event" };
  }, [happeningNowEvent]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-8 sm:pb-12 font-sans text-left">
      <SEO 
        title="Coordinator Dashboard - AI Verse" 
        description="Collaborate and organize student activities, log attendance, and review metrics."
      />

      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3.5xl font-black text-slate-800 tracking-tight leading-tight sm:leading-none">Coordinator Dashboard</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 sm:mt-2 font-medium">
            Welcome back, <span className="text-blue-600 font-bold">{user?.name?.split(" ")[0] || "Alex"}</span>. 
            You have <span className="font-bold text-slate-700">{stats.activeEventsCount} active events</span> under your management this week.
          </p>
        </div>
      </div>

      {/* ================= METRIC CARDS ================= */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* TOTAL REGISTRATIONS */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> +12%
              </span>
            </div>
            <div className="mt-4 sm:mt-6">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Registrations</span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mt-1">
                {stats.totalRegistrations.toLocaleString()}
              </h3>
            </div>
          </div>

          {/* PENDING APPROVALS */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 uppercase tracking-wide">
                High Priority
              </span>
            </div>
            <div className="mt-4 sm:mt-6">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Approvals</span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mt-1">
                {stats.pendingApprovals}
              </h3>
            </div>
          </div>

          {/* TASK COMPLETION */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                On Track
              </span>
            </div>
            <div className="mt-4 sm:mt-6 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Task Completion</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-700">88.5%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: "88.5%" }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN COLUMN SPLIT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* Left Column: My Events (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">My Events</h2>
              <Link 
                to="/organizer/events" 
                className="text-[11px] sm:text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
              >
                View All <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-semibold text-sm">
                No events currently configured in the database.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                {events.slice(0, 2).map((event, idx) => {
                  const isOpened = event.status === "Opened";
                  const isDraft = event.status === "Draft";
                  
                  return (
                    <div 
                      key={event.id}
                      className="border border-slate-100 rounded-2xl p-4 sm:p-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 bg-white shadow-sm"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                            isOpened 
                              ? "bg-green-50 text-green-600 border-green-100" 
                              : isDraft 
                              ? "bg-amber-50 text-amber-600 border-amber-100" 
                              : "bg-blue-50 text-blue-600 border-blue-100"
                          }`}>
                            {isOpened ? "LIVE" : isDraft ? "PLANNING" : "ACTIVE"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Users className="h-3 w-3 shrink-0" /> {event.currentReg} registered
                          </span>
                        </div>

                        <div className="text-left space-y-1">
                          <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-snug tracking-tight hover:text-blue-600 transition-colors">
                            {event.title}
                          </h3>
                          <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {event.description}
                          </p>
                        </div>
                      </div>

                      {/* Organizer avatars & action button */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        {/* Mock Coordinator Overlapping Avatars */}
                        <div className="flex -space-x-2.5 overflow-hidden">
                          <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" src={satoshiImg} alt="Satoshi" />
                          <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" src={sarahImg} alt="Sarah" />
                          <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" src={elenaImg} alt="Elena" />
                          {idx === 0 && (
                            <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 ring-2 ring-white flex items-center justify-center text-[9px] font-bold">
                              +5
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={() => navigate(isDraft ? `/organizer/events` : `/organizer/events`)}
                          className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                            isDraft
                              ? "border border-slate-200 text-slate-500 hover:bg-slate-50"
                              : "bg-[#2563EB] text-white hover:bg-blue-700 shadow-sm"
                          }`}
                        >
                          {isDraft ? "Edit Plan" : "Manage"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Attendance & Recent Activity (4/12) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 1. Live Attendance Widget */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
            <div className="flex items-center gap-2">
              {eventStatus.isLive && (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white shrink-0 animate-ping"></span>
              )}
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                {eventStatus.isLive ? "Live Attendance" : "Upcoming Attendance"}
              </h2>
            </div>

            {/* Gradient Banner representing active block */}
            <div className={`p-4 sm:p-5 rounded-2xl text-white text-left space-y-4 shadow-sm relative overflow-hidden ${eventStatus.isLive ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-slate-600 to-slate-700'}`}>
              {/* background subtle styling decoration */}
              <div className="absolute right-0 bottom-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-x-4 translate-y-4"></div>

              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-widest text-blue-100 uppercase block">
                  {eventStatus.text}
                </span>
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight leading-snug">
                  {happeningNowEvent ? happeningNowEvent.title : "Ethics in AI Symposium"}
                </h3>
              </div>

              <div className="space-y-2 text-xs font-semibold text-blue-50/90 pt-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-200 shrink-0" />
                  <span>{happeningNowEvent ? happeningNowEvent.location : "Main Hall"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-200 shrink-0" />
                  <span>{happeningNowEvent ? (happeningNowEvent.time || "TBD") : "Until 4:00 PM"}</span>
                </div>
              </div>

              <button 
                onClick={() => navigate("/organizer/attendance")}
                className={`w-full bg-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm ${eventStatus.isLive ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {eventStatus.isLive ? "Mark Attendance" : "View Details"}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default OrgDashboardPage;
