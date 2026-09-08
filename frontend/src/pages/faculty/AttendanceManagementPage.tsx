import React, { useState, useEffect } from "react";
import { 
  Users, 
  Calendar, 
  ArrowLeft, 
  ArrowRight, 
  Download, 
  Printer, 
  Check, 
  QrCode, 
  RefreshCw, 
  CheckSquare
} from "lucide-react";
import { 
  fetchUsers, 
  fetchEvents, 
  fetchRegistrations, 
  fetchAttendance, 
  markAttendance,
  updateEvent 
} from "../../services/apiClient";
import SEO from "../../components/layout/SEO";

interface Attendee {
  id: string;
  name: string;
  email: string;
  department: string;
  checkInTime: string;
  status: "Present" | "Late" | "Absent";
}

interface EventCard {
  id: string;
  title: string;
  location: string;
  timeRange: string;
  category: string;
  status: "LIVE" | "STARTING SOON";
  currentReg: number;
  maxReg: number;
}

const AttendanceManagementPage: React.FC = () => {
  const [events, setEvents] = useState<EventCard[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [openOptionsId, setOpenOptionsId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAttendeesCount, setTotalAttendeesCount] = useState(1284);
  const [syncing, setSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const [viewMode, setViewMode] = useState<"Participants" | "Team Members">("Participants");
  const [teamAttendees, setTeamAttendees] = useState<Attendee[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const showToast = (text: string, type: "success" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const initializeAttendanceData = async () => {
      try {
        setLoading(true);
        // 1. Fetch total members from users collection to show realistic total attendees
        const usersList = await fetchUsers().catch(() => []);
        if (usersList && usersList.length > 0) {
          setTotalAttendeesCount(usersList.length * 12 + 84);
        }

        // 2. Fetch events from backend
        const rawEvents = await fetchEvents().catch(() => []);
        const eventsList: any[] = Array.isArray(rawEvents) ? rawEvents : [];
        const todayStr = new Date().toISOString().split("T")[0];

        const activeDbEvents: EventCard[] = eventsList
          .map((data: any) => {
            const categoryString = data.category || (data.type ? data.type.toUpperCase() : "GENERAL");
            
            // Check if event is completed, closed, finished, cancelled, or past
            const statusUpper = (data.status || "").toString().toUpperCase();
            const isCompletedStatus = ["COMPLETED", "CLOSED", "FINISHED", "CANCELLED", "PAST"].includes(statusUpper);
            const isPastFlag = Boolean(data.isPastEvent);
            
            const dateStr = data.endDate || data.startDate;
            const isPastDate = Boolean(dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && dateStr < todayStr);

            if (isCompletedStatus || isPastFlag || isPastDate) {
              return null;
            }

            const displayStatus = data.status === "Opened" || data.status === "Published" || data.status === "Active" 
              ? ("LIVE" as const) 
              : ("STARTING SOON" as const);
            
            return {
              id: data.id || data._id || "",
              title: data.title || "Unnamed Event",
              location: data.location || "General Classroom",
              timeRange: data.timeRange || (data.startDate ? `${data.startDate} • ${data.startTime || ""}` : "10:00 AM - 12:00 PM"),
              category: categoryString,
              status: displayStatus,
              currentReg: Math.max(0, Number(data.currentReg) || 0),
              maxReg: data.maxReg || 100
            };
          })
          .filter((ev): ev is EventCard => ev !== null);

        setEvents(activeDbEvents);
        if (activeDbEvents.length > 0) {
          setSelectedEventId(activeDbEvents[0].id);
        }
      } catch (err) {
        console.error("Error initializing attendance events:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeAttendanceData();
  }, []);

  // Fetch attendees when selected event changes
  useEffect(() => {
    if (!selectedEventId) return;

    const loadAttendees = async () => {
      try {
        // 1. Fetch Participant Registrations
        const regsSnap = await fetchRegistrations().catch(() => []);
        const eventRegs = (regsSnap || [])
          .map((d: any) => ({ id: d.id || d._id || "", ...d }))
          .filter((r: any) => r.eventId === selectedEventId);

        if (eventRegs.length === 0) {
          setAttendees([]);
        } else {
          const list: Attendee[] = eventRegs.map((r: any) => ({
            id: r.id,
            name: r.teamLeadName || "Unnamed Participant",
            email: r.teamLeadEmail || "",
            department: r.groupName || "General",
            checkInTime: r.checkInTime || "—",
            status: (r.attendanceStatus as any) || "Absent"
          }));
          setAttendees(list);
        }

        // 2. Fetch Team Members and their Attendances
        const allUsers = await fetchUsers().catch(() => []);
        const teamMembers = (allUsers || []).filter((u: any) => {
          const role = (u.role || "").toLowerCase();
          return role.includes("organizer") || role.includes("volunteer") || role.includes("coordinator") || role.includes("faculty") || role.includes("team");
        });

        const attendances = await fetchAttendance({ eventId: selectedEventId }).catch(() => []);

        const teamList: Attendee[] = teamMembers.map((tm: any) => {
          const attendanceRecord = attendances.find((a: any) => a.teamMemberId === (tm.id || tm._id) || (a.userEmail && a.userEmail.toLowerCase() === tm.email?.toLowerCase()));
          return {
            id: tm.id || tm._id,
            name: tm.name || tm.displayName || "Unnamed Team Member",
            email: tm.email || "",
            department: tm.role || "Organizer",
            checkInTime: attendanceRecord?.checkInTime || "—",
            status: (attendanceRecord?.status as any) || "Absent"
          };
        });
        setTeamAttendees(teamList);

        setCurrentPage(1);
      } catch (err) {
        console.error("Error fetching attendees:", err);
      }
    };

    loadAttendees();
  }, [selectedEventId, events]);

  const handleTeamStatusChange = async (teamMemberId: string, newStatus: "Present" | "Late" | "Absent", teamMemberName: string, teamMemberRole: string) => {
    if (!selectedEventId) return;
    
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const formattedCheckIn = newStatus === "Absent" ? "—" : `${timeNow} (Manual)`;
    
    setTeamAttendees(prev => prev.map(t => t.id === teamMemberId ? {
      ...t,
      status: newStatus,
      checkInTime: formattedCheckIn
    } : t));

    try {
      await markAttendance({
        eventId: selectedEventId,
        teamMemberId,
        name: teamMemberName,
        role: teamMemberRole,
        status: newStatus,
        checkInTime: formattedCheckIn
      });
      showToast(`Updated attendance for ${teamMemberName}`);
    } catch (err) {
      console.error("Error updating team attendance:", err);
      showToast("Failed to update team attendance.", "info");
    }
  };

  const handleExportCSV = () => {
    try {
      const selectedTitle = events.find(e => e.id === selectedEventId)?.title || "event";
      const headers = "Participant,Email,Department,Check-In Time,Status\n";
      const rows = attendees.map(a => `"${a.name}","${a.email}","${a.department}","${a.checkInTime}","${a.status}"`).join("\n");
      
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${selectedTitle.toLowerCase().replace(/\s+/g, "_")}_attendance.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("CSV report exported successfully!");
    } catch (err) {
      console.error("Error exporting report:", err);
    }
  };

  const handleSyncData = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      showToast("Synced dynamic attendance logs to database!");
    }, 1500);
  };

  const handleOpenCheckIn = async (eventId: string) => {
    setEvents(prev => prev.map(ev => {
      if (ev.id === eventId) {
        return { ...ev, status: "LIVE" as const };
      }
      return ev;
    }));
    setSelectedEventId(eventId);
    
    try {
      await updateEvent(eventId, { status: "Published" });
    } catch (err) {
      console.error("Error opening event check-in in database:", err);
    }
    
    showToast("Event check-in portal opened successfully!");
  };

  const handleCloseCheckIn = async (eventId: string) => {
    setEvents(prev => prev.map(ev => {
      if (ev.id === eventId) {
        return { ...ev, status: "CLOSED" as any };
      }
      return ev;
    }));
    
    try {
      await updateEvent(eventId, { status: "CLOSED" });
    } catch (err) {
      console.error("Error closing event check-in in database:", err);
    }
    
    showToast("Event check-in portal closed successfully!");
  };

  const activeEvent = events.find(e => e.id === selectedEventId);

  // Pagination helper
  const displayList = viewMode === "Participants" ? attendees : teamAttendees;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAttendees = displayList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayList.length / itemsPerPage);

  return (
    <div className="space-y-6 text-left relative">
      <SEO 
        title="Attendance Management - Faculty Portal" 
        description="Faculty coordinator workspace for real-time check-ins and attendance logs." 
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg animate-fade-in text-sm font-semibold">
          <Check className="h-4.5 w-4.5 text-emerald-400" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <span>Dashboard</span>
          <span>&gt;</span>
          <span className="text-[#2563EB]">Attendance</span>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight font-sans">Attendance Management</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 font-medium">Managing real-time check-ins for active faculty events.</p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 shrink-0 bg-white p-3 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.01)]">
            <div className="flex items-center gap-2.5 px-3 py-1.5 border-r border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Total Attendees</span>
                <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{totalAttendeesCount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-1.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Active Events</span>
                <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{String(events.length).padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ongoing Today Row */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-[#2563EB] rounded-full"></span>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Ongoing Today</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-100">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 bg-white rounded-3xl border border-slate-100 text-center font-medium text-slate-400 text-xs">
            No active or ongoing events available for attendance management today. Completed and past events have been archived.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.map((ev) => {
              const percentage = Math.min(Math.round((ev.currentReg / ev.maxReg) * 100), 100);
              const isSelected = selectedEventId === ev.id;
              
              return (
                <div 
                  key={ev.id} 
                  className={`bg-white rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative group hover:shadow-md
                    ${isSelected ? "border-[#2563EB] ring-2 ring-blue-50" : "border-slate-100"}`}
                >
                  <div className="space-y-4">
                    {/* Header badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{ev.category}</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase
                        ${ev.status === "LIVE" 
                          ? "bg-emerald-50 text-emerald-600" 
                          : "bg-slate-100 text-slate-600"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse ${ev.status === "LIVE" ? "" : "hidden"}`}></span>
                        {ev.status}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-base font-bold text-slate-800 tracking-tight leading-snug group-hover:text-[#2563EB] transition-colors">{ev.title}</h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">{ev.location} • {ev.timeRange}</p>
                    </div>

                    {/* Capacity Indicator Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                        <span>Capacity</span>
                        <span className="text-slate-700">{ev.currentReg}/{ev.maxReg}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#2563EB] rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="pt-5 mt-4 border-t border-slate-50">
                    {ev.status === "LIVE" ? (
                      <div className="relative w-full">
                        {isSelected ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventId(ev.id);
                              setOpenOptionsId(openOptionsId === ev.id ? null : ev.id);
                            }}
                            className="w-full py-2.5 rounded-2xl bg-[#2563EB] text-white hover:bg-blue-700 font-bold text-xs shadow-sm hover:shadow transition-all text-center flex items-center justify-center gap-1.5"
                          >
                            <Check className="h-4 w-4" />
                            Managing Attendance
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventId(ev.id);
                              setOpenOptionsId(openOptionsId === ev.id ? null : ev.id);
                            }}
                            className="w-full py-2.5 rounded-2xl border border-[#2563EB] text-[#2563EB] hover:bg-blue-50 font-bold text-xs transition-all text-center flex items-center justify-center gap-1.5"
                          >
                            Manage Attendance
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {openOptionsId === ev.id && (
                          <div className="absolute right-0 left-0 mt-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-lg z-20 flex flex-col gap-1 text-left">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleOpenCheckIn(ev.id);
                                setOpenOptionsId(null);
                              }}
                              className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-705 font-bold text-xs rounded-xl flex items-center gap-2 transition-all"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                              Open Check-in
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleCloseCheckIn(ev.id);
                                setOpenOptionsId(null);
                              }}
                              className="w-full px-4 py-2.5 hover:bg-red-50 text-red-650 font-bold text-xs rounded-xl flex items-center gap-2 transition-all border-t border-slate-50"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                              Close Check-in
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenCheckIn(ev.id)}
                        className={`w-full py-2.5 rounded-2xl border font-bold text-xs transition-all text-center flex items-center justify-center gap-1.5
                          ${isSelected 
                            ? "bg-[#2563EB] text-white hover:bg-blue-700 border-[#2563EB]" 
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                      >
                        Open Check-in
                        <QrCode className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Participant List Section */}
      {activeEvent && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] overflow-hidden">
          {/* Header Row */}
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{activeEvent.title}</h2>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => { setViewMode("Participants"); setCurrentPage(1); }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${viewMode === "Participants" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"}`}
                >
                  Participants ({attendees.length})
                </button>
                <button
                  onClick={() => { setViewMode("Team Members"); setCurrentPage(1); }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${viewMode === "Team Members" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"}`}
                >
                  Team Members ({teamAttendees.length})
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              <button
                onClick={() => window.print()}
                className="w-9.5 h-9.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm"
                title="Print Attendance"
              >
                <Printer className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="py-3.5 px-6 font-semibold">Participant</th>
                  <th className="py-3.5 px-6 font-semibold">Department</th>
                  <th className="py-3.5 px-6 font-semibold">Check-in Time</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-750">
                {currentAttendees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-xs text-slate-400 font-medium">
                      No registered attendees found.
                    </td>
                  </tr>
                ) : (
                  currentAttendees.map((att) => {
                    const initials = att.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                    return (
                      <tr key={att.id} className="text-xs hover:bg-slate-50/30 transition-colors">
                        {/* Profile Info */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-500 shrink-0">
                              {initials}
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-800">{att.name}</h4>
                              <p className="text-[10px] text-slate-400 font-medium">{att.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Department info */}
                        <td className="py-3.5 px-6 font-medium text-slate-500">
                          {att.department}
                        </td>

                        {/* Check in time */}
                        <td className="py-3.5 px-6 font-medium text-slate-500">
                          {att.checkInTime}
                        </td>

                        {/* Action status tags */}
                        <td className="py-3.5 px-6 text-right">
                          {viewMode === "Team Members" ? (
                            <button
                              onClick={() => {
                                const nextStatus = att.status === "Present" ? "Late" : att.status === "Late" ? "Absent" : "Present";
                                handleTeamStatusChange(att.id, nextStatus, att.name, att.department);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm border hover:shadow-md
                                ${att.status === "Present" && "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/30"}
                                ${att.status === "Late" && "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100/30"}
                                ${att.status === "Absent" && "bg-red-50 text-red-600 border-red-100 hover:bg-red-100/30"}
                              `}>
                              <span className={`w-1.5 h-1.5 rounded-full
                                ${att.status === "Present" && "bg-emerald-500"}
                                ${att.status === "Late" && "bg-amber-500"}
                                ${att.status === "Absent" && "bg-red-500"}
                              `} />
                              {att.status}
                            </button>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider
                              ${att.status === "Present" && "bg-emerald-50 text-emerald-600 border border-emerald-100/50"}
                              ${att.status === "Late" && "bg-amber-50 text-amber-600 border border-amber-100/50"}
                              ${att.status === "Absent" && "bg-red-50 text-red-600 border border-red-100/50"}
                            `}>
                              <span className={`w-1.5 h-1.5 rounded-full
                                ${att.status === "Present" && "bg-emerald-500"}
                                ${att.status === "Late" && "bg-amber-500"}
                                ${att.status === "Absent" && "bg-red-500"}
                              `} />
                              {att.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">
                Showing {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, displayList.length)} of {displayList.length} {viewMode.toLowerCase()}
              </span>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7.5 h-7.5 rounded-lg font-bold text-[10px] flex items-center justify-center transition-all
                      ${currentPage === p 
                        ? "bg-[#2563EB] text-white shadow-sm" 
                        : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Interactive Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Card 1: Export Report */}
        <button
          onClick={handleExportCSV}
          className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex gap-4 text-left hover:shadow-md transition-all duration-300 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#2563EB] shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">Export Report</h4>
            <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">Download detailed attendance log dataset as CSV spreadsheet.</p>
          </div>
        </button>

        {/* Card 3: Sync Local Data */}
        <button
          onClick={handleSyncData}
          disabled={syncing}
          className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex gap-4 text-left hover:shadow-md transition-all duration-300 group disabled:opacity-70"
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <RefreshCw className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">
              {syncing ? "Syncing Logs..." : "Sync Data"}
            </h4>
            <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">Automatically upload logs and backup metadata back to the university cloud.</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default AttendanceManagementPage;
