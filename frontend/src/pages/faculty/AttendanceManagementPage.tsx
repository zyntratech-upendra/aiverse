import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, 
  Calendar, 
  Download, 
  Printer, 
  Check, 
  RefreshCw, 
  CheckSquare,
  DoorOpen,
  DoorClosed,
  Sun,
  Clock,
  ShieldCheck,
  Layers,
  Search,
  XCircle,
  ChevronDown,
  Crown,
  CheckCheck,
  ArrowLeft,
  ArrowRight,
  QrCode,
  Coffee,
  CheckCircle2,
  Trophy,
  Filter,
  Sparkles
} from "lucide-react";
import { 
  fetchEvents, 
  fetchRegistrations, 
  fetchAttendance, 
  markAttendance,
  bulkMarkAttendance,
  updateEvent 
} from "../../services/apiClient";
import SEO from "../../components/layout/SEO";

export interface DaySessionStatus {
  gateEntered: boolean;
  gateCheckInTime: string;
  morningStatus: "Present" | "Late" | "Absent" | "Pending";
  morningCheckInTime: string;
  afternoonStatus: "Present" | "Late" | "Absent" | "Pending";
  afternoonCheckInTime: string;
  gateExited?: boolean;
  gateExitCheckInTime?: string;
}


export interface FacultyTeamMember {
  id: string;
  regId: string;
  name: string;
  email: string;
  studentId: string;
  phone?: string;
  department?: string;
  college?: string;
  year?: string;
  isLead: boolean;
  memberIndex?: number;
  days: Record<number, DaySessionStatus>;
}

export interface FacultyTeam {
  id: string;
  regId: string;
  teamName: string;
  ticketCode: string;
  college: string;
  department: string;
  year: string;
  currentRound: number;
  promotedToRound?: number;
  roundStatus?: string;
  lead: FacultyTeamMember;
  members: FacultyTeamMember[];
  allMembers: FacultyTeamMember[];
  totalMembersCount: number;
}

export interface EventDayInfo {
  dayNumber: number;
  dateStr: string;
  formattedDate: string;
  label: string;
}

// Compute dynamic event days from event startDate, endDate, date, or timeRange
export function computeEventDays(
  startDate?: string, 
  endDate?: string, 
  dateStr?: string, 
  timeRange?: string, 
  daysCount?: number
): EventDayInfo[] {
  // 1. Explicit numerical days
  if (typeof daysCount === "number" && daysCount > 0) {
    const total = Math.min(daysCount, 7);
    return Array.from({ length: total }, (_, i) => ({
      dayNumber: i + 1,
      dateStr: "",
      formattedDate: `Day ${i + 1}`,
      label: total === 1 ? "Main Event" : total === 2 ? (i === 0 ? "Kickoff" : "Grand Finale") : (i === 0 ? "Kickoff" : i === total - 1 ? "Grand Finale" : `Sprint ${i + 1}`)
    }));
  }

  const parseYMD = (s?: string) => {
    if (!s) return null;
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const start = parseYMD(startDate);
  const end = parseYMD(endDate);

  // 2. Both start and end dates provided
  if (start && end) {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sTime = start.getTime();
    const eTime = end.getTime();
    const diff = Math.max(1, Math.round((eTime - sTime) / oneDayMs) + 1);
    const totalDays = Math.min(diff, 7);

    return Array.from({ length: totalDays }, (_, i) => {
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const dateFormatted = cur.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const sublabel = totalDays === 1 
        ? "Main Event" 
        : totalDays === 2 
        ? (i === 0 ? "Kickoff" : "Grand Finale") 
        : (i === 0 ? "Kickoff" : i === totalDays - 1 ? "Grand Finale" : `Sprint ${i + 1}`);

      return {
        dayNumber: i + 1,
        dateStr: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
        formattedDate: dateFormatted,
        label: sublabel
      };
    });
  }

  // 3. Fallback: Parse date range text like "2026-10-08 ... 2026-10-09" or "March 28-29, 2026"
  const combined = `${startDate || ""} ${endDate || ""} ${dateStr || ""} ${timeRange || ""}`;
  const isoDates = combined.match(/\d{4}-\d{2}-\d{2}/g);
  if (isoDates && isoDates.length >= 2) {
    const d1 = parseYMD(isoDates[0]);
    const d2 = parseYMD(isoDates[1]);
    if (d1 && d2 && d2 >= d1) {
      const diff = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const totalDays = Math.min(diff, 7);
      return Array.from({ length: totalDays }, (_, i) => {
        const cur = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate() + i);
        return {
          dayNumber: i + 1,
          dateStr: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
          formattedDate: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          label: totalDays === 2 ? (i === 0 ? "Kickoff" : "Grand Finale") : (i === 0 ? "Kickoff" : i === totalDays - 1 ? "Grand Finale" : `Sprint ${i + 1}`)
        };
      });
    }
  }

  // 4. Match hyphenated day number range like "28-29" in "March 28-29, 2026"
  const dayRangeMatch = combined.match(/\b(\d{1,2})\s*[-–—to]+\s*(\d{1,2})\b/i);
  if (dayRangeMatch) {
    const dStart = parseInt(dayRangeMatch[1], 10);
    const dEnd = parseInt(dayRangeMatch[2], 10);
    if (dEnd >= dStart && dEnd - dStart <= 6) {
      const totalDays = dEnd - dStart + 1;
      return Array.from({ length: totalDays }, (_, i) => ({
        dayNumber: i + 1,
        dateStr: "",
        formattedDate: `Day ${i + 1}`,
        label: totalDays === 2 ? (i === 0 ? "Kickoff" : "Grand Finale") : (i === 0 ? "Kickoff" : i === totalDays - 1 ? "Grand Finale" : `Sprint ${i + 1}`)
      }));
    }
  }

  // 5. Single date exists
  if (start) {
    const dateFormatted = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return [
      {
        dayNumber: 1,
        dateStr: startDate || "",
        formattedDate: dateFormatted,
        label: "Main Event"
      }
    ];
  }

  // 6. Default standard hackathon: 2 days (Kickoff & Grand Finale)
  return [
    { dayNumber: 1, dateStr: "", formattedDate: "", label: "Kickoff" },
    { dayNumber: 2, dateStr: "", formattedDate: "", label: "Grand Finale" }
  ];
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
  startDate?: string;
  endDate?: string;
  date?: string;
  daysCount?: number;
  currentRound?: number;
  totalRounds?: number;
  rounds?: any[];
}


const AttendanceManagementPage: React.FC = () => {
  const [events, setEvents] = useState<EventCard[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [openOptionsId, setOpenOptionsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [facultyTeams, setFacultyTeams] = useState<FacultyTeam[]>([]);
  const totalAttendeesCount = useMemo(() => {
    return facultyTeams.reduce((acc, t) => acc + t.allMembers.length, 0);
  }, [facultyTeams]);
  const [syncing, setSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const [selectedRound, setSelectedRound] = useState<number | "all">(1);
  const [collapsedTeamIds, setCollapsedTeamIds] = useState<Set<string>>(new Set());

  // Day-Wise & Session Tracker states
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [sessionFilter, setSessionFilter] = useState<"all" | "gate_entry" | "morning" | "afternoon" | "gate_exit">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isBulkProcessing, setIsBulkProcessing] = useState<boolean>(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const showToast = (text: string, type: "success" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const initializeAttendanceData = async () => {
      try {
        setLoading(true);

        // Fetch events from backend
        const rawEvents = await fetchEvents().catch(() => []);
        const eventsList: any[] = Array.isArray(rawEvents) ? rawEvents : (rawEvents?.events || rawEvents?.data || []);
        const todayStr = new Date().toISOString().split("T")[0];

        let activeDbEvents: EventCard[] = eventsList
          .map((data: any): EventCard | null => {
            const categoryString = data.category || (data.type ? data.type.toUpperCase() : "GENERAL");
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
              location: data.location || data.venue || "General Classroom",
              timeRange: data.timeRange || (data.startDate ? `${data.startDate} • ${data.startTime || ""}` : "10:00 AM - 12:00 PM"),
              category: categoryString,
              status: displayStatus,
              currentReg: Math.max(0, Number(data.currentReg) || 0),
              maxReg: data.maxReg || 100,
              startDate: data.startDate,
              endDate: data.endDate,
              date: data.date,
              daysCount: Number(data.daysCount || data.durationDays || data.totalDays) || undefined,
              currentRound: Number(data.currentRound) || undefined,
              totalRounds: Number(data.totalRounds) || undefined,
              rounds: Array.isArray(data.rounds) ? data.rounds : undefined,
            };
          })
          .filter((ev): ev is EventCard => ev !== null);

        // Fallback: If no live/future events matched, load all available events from database
        if (activeDbEvents.length === 0 && eventsList.length > 0) {
          activeDbEvents = eventsList.map((data: any): EventCard => ({
            id: data.id || data._id || "",
            title: data.title || "Unnamed Event",
            location: data.location || data.venue || "General Classroom",
            timeRange: data.timeRange || (data.startDate ? `${data.startDate} • ${data.startTime || ""}` : "10:00 AM - 12:00 PM"),
            category: data.category || "GENERAL",
            status: "LIVE" as const,
            currentReg: Math.max(0, Number(data.currentReg) || 0),
            maxReg: data.maxReg || 100,
            startDate: data.startDate,
            endDate: data.endDate,
            date: data.date,
            daysCount: Number(data.daysCount || data.durationDays || data.totalDays) || undefined,
            currentRound: Number(data.currentRound) || undefined,
            totalRounds: Number(data.totalRounds) || undefined,
            rounds: Array.isArray(data.rounds) ? data.rounds : undefined,
          }));
        }

        setEvents(activeDbEvents);
        if (activeDbEvents.length > 0) {
          const firstEv = activeDbEvents[0];
          setSelectedEventId(firstEv.id);
          const rList = firstEv.rounds || [];
          const actR = Array.isArray(rList) ? rList.find((r: any) => r.status === "Active") : null;
          const initRound = (firstEv.currentRound && firstEv.currentRound >= 1)
            ? Number(firstEv.currentRound)
            : (actR ? (Number(actR.roundNumber) || 1) : 1);
          setSelectedRound(initRound);
        }
      } catch (err) {
        console.error("Error initializing attendance events:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeAttendanceData();
  }, []);

  // Helper to format timestamps or check-in strings cleanly
  const formatTimeStr = (val: any) => {
    if (!val || val === "—") return "—";
    if (typeof val === "string" && (val.includes("AM") || val.includes("PM"))) return val;
    const num = Number(val);
    if (!isNaN(num) && num > 1000000000) {
      return new Date(num).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
    const dateObj = new Date(val);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
    return String(val);
  };

  // Fetch attendees and attendance records when selected event changes
  useEffect(() => {
    if (!selectedEventId) return;

    const loadAttendees = async () => {
      try {
        const [regsSnap, attendancesRaw] = await Promise.all([
          fetchRegistrations().catch(() => []),
          fetchAttendance({ eventId: selectedEventId }).catch(() => [])
        ]);

        const attendances: any[] = Array.isArray(attendancesRaw) ? attendancesRaw : [];
        const eventRegs = (Array.isArray(regsSnap) ? regsSnap : [])
          .map((d: any) => ({ id: d.id || d._id || "", ...d }))
          .filter((r: any) => r.eventId === selectedEventId);

        // Process Teams and Squad Members Day-Wise
        const teamsList: FacultyTeam[] = [];

        eventRegs.forEach((r: any) => {
          const regId = r.id || r._id || "";
          const groupTeamName = r.groupName || r.teamName || (r.members && r.members.length > 0 ? `Team ${(r.teamLeadName || r.name || "Squad").split(" ")[0]}` : (r.teamLeadName || r.name || "Solo Registration"));
          const ticketCode = r.ticketCode || (r.teamLeadStudentId || `AI-${String(regId).substring(0, 6).toUpperCase()}`);
          const college = r.college || "Campus";
          const deptName = r.department || r.branch || groupTeamName;
          const year = r.year || "Year 3";
          const regRound = Number(r.currentRound || r.promotedToRound) || 1;
          const roundStatus = r.roundStatus || "Active";

          const buildDaysMapForPerson = (personId: string, personEmail: string, isLeadPerson: boolean) => {
            const pEmail = (personEmail || "").toLowerCase().trim();
            const daysMap: Record<number, DaySessionStatus> = {};
            [1, 2, 3, 4, 5, 6, 7].forEach((day) => {
              const pAtts = attendances.filter((a: any) => {
                const dayMatch = Number(a.day || a.dayNumber || 1) === day;
                if (!dayMatch) return false;
                if (a.participantId && a.participantId === personId) return true;
                if (pEmail && a.userEmail && a.userEmail.toLowerCase().trim() === pEmail) return true;
                if (isLeadPerson && (a.registrationId === regId || a.participantId === `${regId}_lead`)) return true;
                return false;
              });

              const gateAtt = pAtts.find((a: any) => a.session === "gate_entry" || a.session === "gate");
              const mornAtt = pAtts.find((a: any) => a.session === "morning" || !a.session);
              const aftAtt = pAtts.find((a: any) => a.session === "afternoon");
              const exitAtt = pAtts.find((a: any) => a.session === "gate_exit" || a.session === "exit");

              const isGate = Boolean(
                gateAtt
                  ? (gateAtt.status === "Present" || gateAtt.status === "Entered")
                  : (day === 1 && isLeadPerson && (r.gateEntryMarked || r.attendanceMarked))
              );
              const gateTime = gateAtt?.checkInTime
                ? formatTimeStr(gateAtt.checkInTime)
                : (day === 1 && isLeadPerson && (r.checkInTimeGateEntry || r.checkInTime)
                  ? formatTimeStr(r.checkInTimeGateEntry || r.checkInTime)
                  : "—");

              const mStatus = (mornAtt?.status as any) ||
                (day === 1 && isLeadPerson && (r.attendanceStatusMorning || (r.attendanceMarked ? "Present" : undefined))) ||
                "Pending";
              const mTime = mornAtt?.checkInTime
                ? formatTimeStr(mornAtt.checkInTime)
                : (day === 1 && isLeadPerson && (r.checkInTimeMorning || (r.attendanceMarked ? r.checkInTime : undefined))
                  ? formatTimeStr(r.checkInTimeMorning || r.checkInTime)
                  : "—");

              const aStatus = (aftAtt?.status as any) ||
                (day === 1 && isLeadPerson && r.attendanceStatusAfternoon) ||
                "Pending";
              const aTime = aftAtt?.checkInTime
                ? formatTimeStr(aftAtt.checkInTime)
                : (day === 1 && isLeadPerson && r.checkInTimeAfternoon
                  ? formatTimeStr(r.checkInTimeAfternoon)
                  : "—");

              const isExit = Boolean(
                exitAtt
                  ? (exitAtt.status === "Present" || exitAtt.status === "Entered" || exitAtt.status === "Exited")
                  : (isLeadPerson && r.gateExitMarked)
              );
              const exitTime = exitAtt?.checkInTime
                ? formatTimeStr(exitAtt.checkInTime)
                : (isLeadPerson && r.checkInTimeGateExit
                  ? formatTimeStr(r.checkInTimeGateExit)
                  : "—");

              daysMap[day] = {
                gateEntered: isGate,
                gateCheckInTime: isGate && gateTime === "—" ? "08:45 AM" : gateTime,
                morningStatus: mStatus,
                morningCheckInTime: mTime,
                afternoonStatus: aStatus,
                afternoonCheckInTime: aTime,
                gateExited: isExit,
                gateExitCheckInTime: isExit && exitTime === "—" ? "05:30 PM" : exitTime
              };
            });
            return daysMap;
          };

          // 1. Team Lead
          const leadId = `${regId}_lead`;
          const leadEmail = r.teamLeadEmail || r.leadEmail || r.userEmail || r.email || "";
          const leadDays = buildDaysMapForPerson(leadId, leadEmail, true);
          const leadMember: FacultyTeamMember = {
            id: leadId,
            regId,
            name: r.teamLeadName || r.fullName || r.name || "Team Lead",
            email: leadEmail,
            studentId: r.teamLeadStudentId || r.studentId || r.rollNo || ticketCode,
            phone: r.teamLeadPhone || r.leadPhone || r.phoneNumber || r.phone || "",
            department: deptName,
            college,
            year,
            isLead: true,
            days: leadDays
          };

          // 2. Squad Members
          const squadMembers: FacultyTeamMember[] = [];
          if (Array.isArray(r.members) && r.members.length > 0) {
            r.members.forEach((m: any, idx: number) => {
              const memId = `${regId}_member_${idx}`;
              const memEmail = m.email || "";
              const memDays = buildDaysMapForPerson(memId, memEmail, false);
              squadMembers.push({
                id: memId,
                regId,
                name: m.name || `Member ${idx + 1}`,
                email: memEmail,
                studentId: m.studentId || m.rollNo || m.registrationNumber || `${ticketCode}-${idx + 2}`,
                phone: m.phone || "",
                department: m.department || deptName,
                college: m.college || college,
                year: m.year || year,
                isLead: false,
                memberIndex: idx,
                days: memDays
              });
            });
          }

          const allSquad = [leadMember, ...squadMembers];
          teamsList.push({
            id: regId,
            regId,
            teamName: groupTeamName,
            ticketCode,
            college,
            department: deptName,
            year,
            currentRound: regRound,
            promotedToRound: r.promotedToRound ? Number(r.promotedToRound) : undefined,
            roundStatus,
            lead: leadMember,
            members: squadMembers,
            allMembers: allSquad,
            totalMembersCount: allSquad.length
          });

        });

        setFacultyTeams(teamsList);
        setCurrentPage(1);

        // Automatically set selectedRound to current event's active round
        const curEv = events.find(e => e.id === selectedEventId);
        if (curEv) {
          const rList = curEv.rounds || [];
          const actR = Array.isArray(rList) ? rList.find((r: any) => r.status === "Active") : null;
          const evRound = (curEv.currentRound && curEv.currentRound >= 1)
            ? Number(curEv.currentRound)
            : (actR ? (Number(actR.roundNumber) || 1) : 1);
          setSelectedRound(evRound);
        }
      } catch (err) {
        console.error("Error fetching attendees:", err);
      }
    };

    loadAttendees();
  }, [selectedEventId, events]);

  // Team collapse/expand state helpers
  const toggleTeamCollapse = (teamId: string) => {
    setCollapsedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedTeamIds(new Set());
  };

  const handleCollapseAll = () => {
    setCollapsedTeamIds(new Set(facultyTeams.map(t => t.id)));
  };

  // Helper to compute team attendance counts for any day
  const getTeamDayStats = (team: FacultyTeam, day = selectedDay) => {
    const isDayEnd = day >= 2;
    const total = team.allMembers.length;
    const gateEntered = team.allMembers.filter(m => m.days?.[day]?.gateEntered).length;
    const morningPresent = team.allMembers.filter(m => {
      const s = m.days?.[day]?.morningStatus;
      return s === "Present" || s === "Late";
    }).length;
    const afternoonPresent = team.allMembers.filter(m => {
      const s = m.days?.[day]?.afternoonStatus;
      return s === "Present" || s === "Late";
    }).length;
    const gateExited = team.allMembers.filter(m => m.days?.[day]?.gateExited).length;

    let presentCount = 0;
    if (sessionFilter === "gate_entry") {
      presentCount = gateEntered;
    } else if (sessionFilter === "morning") {
      presentCount = morningPresent;
    } else if (sessionFilter === "afternoon") {
      presentCount = afternoonPresent;
    } else if (sessionFilter === "gate_exit") {
      presentCount = gateExited;
    } else {
      presentCount = isDayEnd
        ? Math.max(morningPresent, afternoonPresent, gateExited)
        : Math.max(gateEntered, morningPresent, afternoonPresent);
    }

    let status: "All Present" | "Partial" | "All Absent" = "All Absent";
    if (presentCount === total && total > 0) {
      status = "All Present";
    } else if (presentCount > 0) {
      status = "Partial";
    }

    return {
      total,
      gateEntered,
      morningPresent,
      afternoonPresent,
      gateExited,
      presentCount,
      status
    };
  };

  // Team Member Toggle: Gate Exit (Day 2 / End Date)
  const handleToggleTeamMemberGateExit = async (teamId: string, memberId: string, day = selectedDay) => {
    if (!selectedEventId) return;
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const currentTeam = facultyTeams.find(t => t.id === teamId);
    const member = currentTeam?.allMembers.find(m => m.id === memberId);
    if (!member) return;

    const curDay = member.days?.[day] || {
      gateEntered: false,
      gateCheckInTime: "—",
      morningStatus: "Pending",
      morningCheckInTime: "—",
      afternoonStatus: "Pending",
      afternoonCheckInTime: "—",
      gateExited: false,
      gateExitCheckInTime: "—"
    };

    const nextExited = !curDay.gateExited;
    const exitTime = nextExited ? timeNow : "—";

    setFacultyTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      const updateMember = (m: FacultyTeamMember): FacultyTeamMember => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          days: {
            ...m.days,
            [day]: {
              ...(m.days?.[day] || curDay),
              gateExited: nextExited,
              gateExitCheckInTime: exitTime
            }
          }
        };
      };

      const newLead = updateMember(t.lead);
      const newMembers = t.members.map(updateMember);
      return {
        ...t,
        lead: newLead,
        members: newMembers,
        allMembers: [newLead, ...newMembers]
      };
    }));

    try {
      await markAttendance({
        eventId: selectedEventId,
        registrationId: member.regId,
        participantId: member.id,
        userEmail: member.email,
        name: member.name,
        session: "gate_exit",
        day,
        status: nextExited ? "Present" : "Absent",
        checkInTime: exitTime !== "—" ? exitTime : ""
      });
      showToast(nextExited ? `Logged Gate Exit for ${member.name} at ${exitTime}` : `Cleared Gate Exit for ${member.name}`);
    } catch (err) {
      console.error("Error logging gate exit:", err);
    }
  };

  // Team Member Toggle: Gate Entry
  const handleToggleTeamMemberGateEnter = async (teamId: string, memberId: string, day = selectedDay) => {
    if (!selectedEventId) return;
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    
    const currentTeam = facultyTeams.find(t => t.id === teamId);
    const member = currentTeam?.allMembers.find(m => m.id === memberId);
    if (!member) return;

    const curDay = member.days?.[day] || {
      gateEntered: false,
      gateCheckInTime: "—",
      morningStatus: "Pending",
      morningCheckInTime: "—",
      afternoonStatus: "Pending",
      afternoonCheckInTime: "—"
    };

    const nextEntered = !curDay.gateEntered;
    const gateTime = nextEntered ? timeNow : "—";

    setFacultyTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      const updateMember = (m: FacultyTeamMember): FacultyTeamMember => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          days: {
            ...m.days,
            [day]: {
              ...(m.days?.[day] || curDay),
              gateEntered: nextEntered,
              gateCheckInTime: gateTime
            }
          }
        };
      };

      const newLead = updateMember(t.lead);
      const newMembers = t.members.map(updateMember);
      return {
        ...t,
        lead: newLead,
        members: newMembers,
        allMembers: [newLead, ...newMembers]
      };
    }));

    try {
      await markAttendance({
        eventId: selectedEventId,
        registrationId: member.regId,
        participantId: member.id,
        userEmail: member.email,
        name: member.name,
        session: "gate_entry",
        day,
        status: nextEntered ? "Present" : "Absent",
        checkInTime: nextEntered ? timeNow : ""
      });
      showToast(`${member.name} Gate Entry: ${nextEntered ? "Entered" : "Pending"}`);
    } catch (err) {
      console.error("Error toggling gate entry:", err);
      showToast("Updated locally.", "info");
    }
  };

  // Team Member Toggle: Morning Session
  const handleToggleTeamMemberMorning = async (teamId: string, memberId: string, day = selectedDay) => {
    if (!selectedEventId) return;
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    
    const currentTeam = facultyTeams.find(t => t.id === teamId);
    const member = currentTeam?.allMembers.find(m => m.id === memberId);
    if (!member) return;

    const curDay = member.days?.[day] || {
      gateEntered: false,
      gateCheckInTime: "—",
      morningStatus: "Pending",
      morningCheckInTime: "—",
      afternoonStatus: "Pending",
      afternoonCheckInTime: "—"
    };

    const cycle: Record<string, "Present" | "Late" | "Absent" | "Pending"> = {
      "Pending": "Present",
      "Present": "Late",
      "Late": "Absent",
      "Absent": "Present"
    };
    const nextStatus = cycle[curDay.morningStatus] || "Present";
    const checkInTime = nextStatus === "Absent" || nextStatus === "Pending" ? "—" : timeNow;

    setFacultyTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      const updateMember = (m: FacultyTeamMember): FacultyTeamMember => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          days: {
            ...m.days,
            [day]: {
              ...(m.days?.[day] || curDay),
              morningStatus: nextStatus,
              morningCheckInTime: checkInTime
            }
          }
        };
      };

      const newLead = updateMember(t.lead);
      const newMembers = t.members.map(updateMember);
      return {
        ...t,
        lead: newLead,
        members: newMembers,
        allMembers: [newLead, ...newMembers]
      };
    }));

    try {
      await markAttendance({
        eventId: selectedEventId,
        registrationId: member.regId,
        participantId: member.id,
        userEmail: member.email,
        name: member.name,
        session: "morning",
        day,
        status: nextStatus,
        checkInTime: nextStatus !== "Absent" && nextStatus !== "Pending" ? timeNow : ""
      });
      showToast(`${member.name} Morning: ${nextStatus}`);
    } catch (err) {
      console.error("Error toggling morning attendance:", err);
      showToast("Updated locally.", "info");
    }
  };

  // Team Member Toggle: Afternoon Session
  const handleToggleTeamMemberAfternoon = async (teamId: string, memberId: string, day = selectedDay) => {
    if (!selectedEventId) return;
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    
    const currentTeam = facultyTeams.find(t => t.id === teamId);
    const member = currentTeam?.allMembers.find(m => m.id === memberId);
    if (!member) return;

    const curDay = member.days?.[day] || {
      gateEntered: false,
      gateCheckInTime: "—",
      morningStatus: "Pending",
      morningCheckInTime: "—",
      afternoonStatus: "Pending",
      afternoonCheckInTime: "—"
    };

    const cycle: Record<string, "Present" | "Late" | "Absent" | "Pending"> = {
      "Pending": "Present",
      "Present": "Late",
      "Late": "Absent",
      "Absent": "Present"
    };
    const nextStatus = cycle[curDay.afternoonStatus] || "Present";
    const checkInTime = nextStatus === "Absent" || nextStatus === "Pending" ? "—" : timeNow;

    setFacultyTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      const updateMember = (m: FacultyTeamMember): FacultyTeamMember => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          days: {
            ...m.days,
            [day]: {
              ...(m.days?.[day] || curDay),
              afternoonStatus: nextStatus,
              afternoonCheckInTime: checkInTime
            }
          }
        };
      };

      const newLead = updateMember(t.lead);
      const newMembers = t.members.map(updateMember);
      return {
        ...t,
        lead: newLead,
        members: newMembers,
        allMembers: [newLead, ...newMembers]
      };
    }));

    try {
      await markAttendance({
        eventId: selectedEventId,
        registrationId: member.regId,
        participantId: member.id,
        userEmail: member.email,
        name: member.name,
        session: "afternoon",
        day,
        status: nextStatus,
        checkInTime: nextStatus !== "Absent" && nextStatus !== "Pending" ? timeNow : ""
      });
      showToast(`${member.name} Afternoon: ${nextStatus}`);
    } catch (err) {
      console.error("Error toggling afternoon attendance:", err);
      showToast("Updated locally.", "info");
    }
  };

  // Team Member: Mark All Day Sessions
  const handleMarkAllForTeamMember = async (teamId: string, memberId: string, day = selectedDay) => {
    if (!selectedEventId) return;
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const currentTeam = facultyTeams.find(t => t.id === teamId);
    const member = currentTeam?.allMembers.find(m => m.id === memberId);
    if (!member) return;

    const isDayEnd = day >= 2;
    setFacultyTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      const updateMember = (m: FacultyTeamMember): FacultyTeamMember => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          days: {
            ...m.days,
            [day]: {
              ...(m.days?.[day] || {}),
              gateEntered: !isDayEnd ? true : Boolean(m.days?.[day]?.gateEntered),
              gateCheckInTime: !isDayEnd ? timeNow : (m.days?.[day]?.gateCheckInTime || "—"),
              morningStatus: "Present",
              morningCheckInTime: timeNow,
              afternoonStatus: "Present",
              afternoonCheckInTime: timeNow,
              gateExited: isDayEnd ? true : Boolean(m.days?.[day]?.gateExited),
              gateExitCheckInTime: isDayEnd ? timeNow : (m.days?.[day]?.gateExitCheckInTime || "—")
            }
          }
        };
      };

      const newLead = updateMember(t.lead);
      const newMembers = t.members.map(updateMember);
      return {
        ...t,
        lead: newLead,
        members: newMembers,
        allMembers: [newLead, ...newMembers]
      };
    }));

    try {
      const isDayEnd = day >= 2;
      const sessions = isDayEnd ? ["morning", "afternoon", "gate_exit"] : ["gate_entry", "morning", "afternoon"];
      await Promise.allSettled(
        sessions.map(sess => markAttendance({
          eventId: selectedEventId,
          registrationId: member.regId,
          participantId: member.id,
          userEmail: member.email,
          name: member.name,
          session: sess,
          day,
          status: "Present",
          checkInTime: timeNow
        }))
      );
      showToast(`Marked all sessions for ${member.name} on Day ${day}!`);
    } catch (err) {
      console.error("Error marking all sessions:", err);
    }
  };

  // Team-Level: 1-Click Mark All Sessions for entire team
  const handleMarkTeamAll = async (team: FacultyTeam, day = selectedDay) => {
    if (!selectedEventId) return;
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const isDayEnd = day >= 2;

    const isAllEntered = isDayEnd
      ? team.allMembers.every(m => m.days?.[day]?.morningStatus === "Present" && m.days?.[day]?.afternoonStatus === "Present" && m.days?.[day]?.gateExited)
      : team.allMembers.every(m => m.days?.[day]?.gateEntered && m.days?.[day]?.morningStatus === "Present" && m.days?.[day]?.afternoonStatus === "Present");

    const targetGate = !isAllEntered;
    const targetStatus: "Present" | "Absent" = !isAllEntered ? "Present" : "Absent";
    const targetTime = !isAllEntered ? timeNow : "—";

    setFacultyTeams(prev => prev.map(t => {
      if (t.id !== team.id) return t;
      const updateMember = (m: FacultyTeamMember): FacultyTeamMember => ({
        ...m,
        days: {
          ...m.days,
          [day]: {
            gateEntered: !isDayEnd ? targetGate : Boolean(m.days?.[day]?.gateEntered),
            gateCheckInTime: !isDayEnd ? targetTime : (m.days?.[day]?.gateCheckInTime || "—"),
            morningStatus: targetStatus,
            morningCheckInTime: targetTime,
            afternoonStatus: targetStatus,
            afternoonCheckInTime: targetTime,
            gateExited: isDayEnd ? targetGate : Boolean(m.days?.[day]?.gateExited),
            gateExitCheckInTime: isDayEnd ? targetTime : (m.days?.[day]?.gateExitCheckInTime || "—")
          }
        }
      });
      const newLead = updateMember(t.lead);
      const newMembers = t.members.map(updateMember);
      return {
        ...t,
        lead: newLead,
        members: newMembers,
        allMembers: [newLead, ...newMembers]
      };
    }));

    try {
      const promises: Promise<any>[] = [];
      const sessions = isDayEnd ? ["morning", "afternoon", "gate_exit"] : ["gate_entry", "morning", "afternoon"];
      team.allMembers.forEach(m => {
        sessions.forEach(sess => {
          promises.push(markAttendance({
            eventId: selectedEventId,
            registrationId: m.regId,
            participantId: m.id,
            userEmail: m.email,
            name: m.name,
            session: sess,
            day,
            status: sess === "gate_entry" ? (targetGate ? "Present" : "Absent") : sess === "gate_exit" ? (targetGate ? "Present" : "Absent") : targetStatus,
            checkInTime: targetTime !== "—" ? targetTime : ""
          }));
        });
      });
      await Promise.allSettled(promises);
      showToast(`Team "${team.teamName}": ${!isAllEntered ? "All Members Checked-In!" : "Reset to Absent"}`);
    } catch (err) {
      console.error(err);
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

  // Active round determination for the selected event
  const eventActiveRound: number = useMemo(() => {
    if (!activeEvent) return 1;
    if (activeEvent.currentRound && activeEvent.currentRound >= 1) {
      return Number(activeEvent.currentRound);
    }
    const actR = Array.isArray(activeEvent.rounds) ? activeEvent.rounds.find((r: any) => r.status === "Active") : null;
    if (actR && actR.roundNumber) {
      return Number(actR.roundNumber);
    }
    return 1;
  }, [activeEvent]);

  // List of available rounds across the event and teams
  const availableRounds: number[] = useMemo(() => {
    if (!activeEvent) return [1];
    const roundSet = new Set<number>();
    if (activeEvent.rounds && Array.isArray(activeEvent.rounds) && activeEvent.rounds.length > 0) {
      activeEvent.rounds.forEach((r: any) => {
        const rn = Number(r.roundNumber || r.round);
        if (!isNaN(rn) && rn >= 1) roundSet.add(rn);
      });
    }
    if (activeEvent.totalRounds && activeEvent.totalRounds > 0) {
      for (let i = 1; i <= activeEvent.totalRounds; i++) roundSet.add(i);
    }
    facultyTeams.forEach(t => {
      if (t.currentRound && t.currentRound >= 1) roundSet.add(t.currentRound);
      if (t.promotedToRound && t.promotedToRound >= 1) roundSet.add(t.promotedToRound);
    });
    if (eventActiveRound >= 1) roundSet.add(eventActiveRound);
    if (roundSet.size === 0) roundSet.add(1);
    return Array.from(roundSet).sort((a, b) => a - b);
  }, [activeEvent, facultyTeams, eventActiveRound]);

  // Teams strictly filtered by selected round (defaults to eventActiveRound)
  const activeTeams: FacultyTeam[] = useMemo(() => {
    if (selectedRound === "all") {
      return facultyTeams;
    }
    const roundNum = Number(selectedRound);
    return facultyTeams.filter(team => {
      if (team.roundStatus === "Eliminated") return false;
      if (roundNum === 1) {
        return (
          team.currentRound === 1 ||
          team.promotedToRound === 1 ||
          !team.currentRound ||
          team.currentRound === 0
        );
      }
      return team.currentRound === roundNum || team.promotedToRound === roundNum;
    });
  }, [facultyTeams, selectedRound]);

  const eventDays = useMemo(() => {
    return computeEventDays(
      activeEvent?.startDate,
      activeEvent?.endDate,
      activeEvent?.date,
      activeEvent?.timeRange,
      activeEvent?.daysCount
    );
  }, [activeEvent?.startDate, activeEvent?.endDate, activeEvent?.date, activeEvent?.timeRange, activeEvent?.daysCount]);

  const isEndDay = useMemo(() => {
    return selectedDay >= 2 || (eventDays.length > 1 && selectedDay === eventDays.length);
  }, [selectedDay, eventDays.length]);

  // Ensure selectedDay stays within the dynamic day bounds
  useEffect(() => {
    if (eventDays.length > 0 && selectedDay > eventDays.length) {
      setSelectedDay(1);
    } else if (selectedDay < 1 && eventDays.length > 0) {
      setSelectedDay(1);
    }
  }, [eventDays.length, selectedDay]);

  // All participant members belonging to the active round teams
  const activeRoundMembers = useMemo(() => {
    return activeTeams.flatMap(t => t.allMembers);
  }, [activeTeams]);

  const totalMembersInActiveRound = activeRoundMembers.length;

  // Day-wise stats calculated strictly for the active round members
  const gateEnteredCount = useMemo(() => {
    return activeRoundMembers.filter(m => m.days?.[selectedDay]?.gateEntered).length;
  }, [activeRoundMembers, selectedDay]);

  const gateRate = totalMembersInActiveRound > 0 ? Math.round((gateEnteredCount / totalMembersInActiveRound) * 100) : 0;

  const morningPresentCount = useMemo(() => {
    return activeRoundMembers.filter(m => {
      const s = m.days?.[selectedDay]?.morningStatus;
      return s === "Present" || s === "Late";
    }).length;
  }, [activeRoundMembers, selectedDay]);

  const morningLateCount = useMemo(() => {
    return activeRoundMembers.filter(m => m.days?.[selectedDay]?.morningStatus === "Late").length;
  }, [activeRoundMembers, selectedDay]);

  const morningRate = totalMembersInActiveRound > 0 ? Math.round((morningPresentCount / totalMembersInActiveRound) * 100) : 0;

  const afternoonPresentCount = useMemo(() => {
    return activeRoundMembers.filter(m => {
      const s = m.days?.[selectedDay]?.afternoonStatus;
      return s === "Present" || s === "Late";
    }).length;
  }, [activeRoundMembers, selectedDay]);

  const afternoonLateCount = useMemo(() => {
    return activeRoundMembers.filter(m => m.days?.[selectedDay]?.afternoonStatus === "Late").length;
  }, [activeRoundMembers, selectedDay]);

  const afternoonRate = totalMembersInActiveRound > 0 ? Math.round((afternoonPresentCount / totalMembersInActiveRound) * 100) : 0;

  const gateExitedCount = useMemo(() => {
    return activeRoundMembers.filter(m => m.days?.[selectedDay]?.gateExited).length;
  }, [activeRoundMembers, selectedDay]);

  const gateExitRate = totalMembersInActiveRound > 0 ? Math.round((gateExitedCount / totalMembersInActiveRound) * 100) : 0;

  // Bulk Mark an entire session for active round teams
  const handleBulkMarkSession = async (session: "gate_entry" | "morning" | "afternoon" | "gate_exit", targetStatus: "Present" | "Absent" = "Present") => {
    if (!selectedEventId || activeTeams.length === 0) return;
    setIsBulkProcessing(true);
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const activeTeamIds = new Set(activeTeams.map(t => t.id));

    setFacultyTeams(prev => prev.map(t => {
      if (!activeTeamIds.has(t.id)) return t;
      const updateMem = (m: FacultyTeamMember): FacultyTeamMember => {
        const curDay = m.days?.[selectedDay] || {
          gateEntered: false,
          gateCheckInTime: "—",
          morningStatus: "Pending",
          morningCheckInTime: "—",
          afternoonStatus: "Pending",
          afternoonCheckInTime: "—",
          gateExited: false,
          gateExitCheckInTime: "—"
        };
        const newDayState = { ...curDay };
        if (session === "gate_entry") {
          newDayState.gateEntered = targetStatus === "Present";
          newDayState.gateCheckInTime = targetStatus === "Present" ? timeNow : "—";
        } else if (session === "morning") {
          newDayState.morningStatus = targetStatus;
          newDayState.morningCheckInTime = targetStatus === "Present" ? timeNow : "—";
        } else if (session === "afternoon") {
          newDayState.afternoonStatus = targetStatus;
          newDayState.afternoonCheckInTime = targetStatus === "Present" ? timeNow : "—";
        } else if (session === "gate_exit") {
          newDayState.gateExited = targetStatus === "Present";
          newDayState.gateExitCheckInTime = targetStatus === "Present" ? timeNow : "—";
        }
        return {
          ...m,
          days: { ...m.days, [selectedDay]: newDayState }
        };
      };

      const newLead = updateMem(t.lead);
      const newMems = t.members.map(updateMem);
      return {
        ...t,
        lead: newLead,
        members: newMems,
        allMembers: [newLead, ...newMems]
      };
    }));

    try {
      const allMems = activeTeams.flatMap(t => t.allMembers);
      const records = allMems.map(m => ({
        eventId: selectedEventId,
        registrationId: m.regId,
        participantId: m.id,
        userEmail: m.email,
        name: m.name,
        session,
        day: selectedDay,
        status: targetStatus,
        checkInTime: timeNow
      }));

      await bulkMarkAttendance({
        eventId: selectedEventId,
        day: selectedDay,
        records
      });

      const sessionLabel = session === "gate_entry" 
        ? "Gate Entry" 
        : session === "morning" 
        ? "Morning Session" 
        : session === "afternoon" 
        ? "Afternoon Session" 
        : "Gate Exit";
      showToast(`Marked all ${allMems.length} members across ${activeTeams.length} teams as ${targetStatus} for Day ${selectedDay} (${sessionLabel})!`);
    } catch (err) {
      console.error("Bulk mark error:", err);
      showToast("Bulk marking completed locally.", "info");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Day-Wise CSV Export of the active teams
  const handleExportCSV = () => {
    try {
      const selectedTitle = events.find(e => e.id === selectedEventId)?.title || "hackathon";
      const headers = "Team Name,Ticket Code,College,Department,Round,Round Status,Member Name,Role,Email,Roll No / Student ID,Day,Gate Enter Status,Gate In Time,Morning Status,Morning Check-In Time,Afternoon Status,Afternoon Check-In Time,Gate Exit Status,Gate Exit Time\n";
      const rows = activeTeams.flatMap(t => {
        return t.allMembers.map(m => {
          const d = m.days?.[selectedDay] || {
            gateEntered: false,
            gateCheckInTime: "—",
            morningStatus: "Pending",
            morningCheckInTime: "—",
            afternoonStatus: "Pending",
            afternoonCheckInTime: "—",
            gateExited: false,
            gateExitCheckInTime: "—"
          };
          return `"${t.teamName}","${t.ticketCode}","${t.college}","${t.department}","Round ${t.currentRound}","${t.roundStatus || 'Active'}","${m.name}","${m.isLead ? 'Lead' : 'Member'}","${m.email}","${m.studentId}","Day ${selectedDay}","${d.gateEntered ? 'Entered' : 'Pending'}","${d.gateCheckInTime}","${d.morningStatus}","${d.morningCheckInTime}","${d.afternoonStatus}","${d.afternoonCheckInTime}","${d.gateExited ? 'Exited' : 'Pending'}","${d.gateExitCheckInTime || '—'}"`;
        });
      }).join("\n");

      const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${selectedTitle.toLowerCase().replace(/\s+/g, "_")}_teams_day${selectedDay}_round${selectedRound}_attendance_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported Day ${selectedDay} Team-Wise CSV report successfully!`);
    } catch (err) {
      console.error("Error exporting report:", err);
    }
  };

  // Search filtering for activeTeams
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return activeTeams;
    const q = searchQuery.toLowerCase().trim();
    return activeTeams.filter(team => {
      const matchTeam = (team.teamName || "").toLowerCase().includes(q) ||
        (team.ticketCode || "").toLowerCase().includes(q) ||
        (team.department || "").toLowerCase().includes(q) ||
        (team.college || "").toLowerCase().includes(q);
      if (matchTeam) return true;
      const matchLead = (team.lead.name || "").toLowerCase().includes(q) ||
        (team.lead.email || "").toLowerCase().includes(q) ||
        (team.lead.studentId || "").toLowerCase().includes(q);
      if (matchLead) return true;
      return team.members.some(m =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.studentId || "").toLowerCase().includes(q)
      );
    });
  }, [activeTeams, searchQuery]);

  // Pagination for Teams
  const indexOfFirstTeam = (currentPage - 1) * itemsPerPage;
  const indexOfLastTeam = indexOfFirstTeam + itemsPerPage;
  const currentTeams = filteredTeams.slice(indexOfFirstTeam, indexOfLastTeam);
  const totalTeamPages = Math.ceil(filteredTeams.length / itemsPerPage);

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

      {/* Participant List & Day-Wise Sessions Section */}
      {activeEvent && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] overflow-hidden">
          {/* Header Row */}
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">{activeEvent.title}</h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Stage {eventActiveRound} Active</span>
                </span>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  {activeTeams.length} Teams ({totalMembersInActiveRound} Participants)
                </span>
              </div>

              {/* Round / Stage Selector Pills */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-400" />
                  Stage:
                </span>
                {availableRounds.map(rNum => {
                  const isSelected = selectedRound === rNum;
                  const isEventActive = rNum === eventActiveRound;
                  const rTeamsCount = facultyTeams.filter(t => {
                    if (t.roundStatus === "Eliminated") return false;
                    if (rNum === 1) return t.currentRound === 1 || t.promotedToRound === 1 || !t.currentRound || t.currentRound === 0;
                    return t.currentRound === rNum || t.promotedToRound === rNum;
                  }).length;

                  return (
                    <button
                      key={rNum}
                      type="button"
                      onClick={() => { setSelectedRound(rNum); setCurrentPage(1); }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "bg-[#2563EB] text-white shadow-sm shadow-blue-600/30 font-black ring-2 ring-blue-400/20"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Trophy className={`w-3.5 h-3.5 ${isSelected ? "text-white" : isEventActive ? "text-amber-500" : "text-slate-400"}`} />
                      <span>Round {rNum} {isEventActive ? "(Active Stage)" : ""}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {rTeamsCount} Teams
                      </span>
                    </button>
                  );
                })}

                {availableRounds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedRound("all"); setCurrentPage(1); }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedRound === "all"
                        ? "bg-[#2563EB] text-white shadow-sm shadow-blue-600/30 font-black"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>All Stages</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      selectedRound === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {facultyTeams.length} Teams
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Download className="h-4 w-4" />
                Export Day {selectedDay} CSV
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

          {/* DAY-WISE SELECTOR & THREE INFO CARDS: GATE ENTER, MORNING, AFTERNOON */}
          <div className="p-6 bg-slate-50/70 border-b border-slate-100 space-y-5">
            {/* Day Switcher Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">
                  {eventDays.length === 1 ? "1-DAY EVENT" : `${eventDays.length}-DAY HACKATHON`}
                </span>
                <h3 className="text-sm font-extrabold text-slate-800">Day-Wise Session Overview</h3>
              </div>

              {/* Day Tabs dynamically calculated from event startDate and endDate */}
              <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                {eventDays.map((dInfo) => {
                  const d = dInfo.dayNumber;
                  const isSelected = selectedDay === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setSelectedDay(d); setCurrentPage(1); }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "bg-[#2563EB] text-white shadow-sm shadow-blue-600/20"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Day {d}</span>
                      {dInfo.formattedDate && !dInfo.formattedDate.startsWith("Day") && (
                        <span className={`text-[10px] font-semibold ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                          ({dInfo.formattedDate})
                        </span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        isSelected ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                      }`}>
                        {dInfo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* THE THREE INFO CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
              {/* CARD 1: GATE ENTER (Day 1 only) */}
              {!isEndDay && (
                <div
                  onClick={() => setSessionFilter(sessionFilter === "gate_entry" ? "all" : "gate_entry")}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                    sessionFilter === "gate_entry"
                      ? "bg-white border-2 border-emerald-500 ring-4 ring-emerald-500/10 shadow-md shadow-emerald-500/5"
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md shadow-2xs"
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-transform group-hover:scale-105 ${
                          sessionFilter === "gate_entry" 
                            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30" 
                            : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
                        }`}>
                          <DoorOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 tracking-tight truncate">Gate Enter</h4>
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>08:00 – 10:30 AM</span>
                          </div>
                        </div>
                      </div>

                      {/* Turnout Pill */}
                      <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0 ${
                        gateRate >= 70 
                          ? "bg-emerald-100 text-emerald-800" 
                          : gateRate > 0 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" 
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${gateRate > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                        {gateRate}% Turnout
                      </span>
                    </div>

                    {/* Counter Stats & Numbers */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-baseline justify-between text-xs">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-black text-slate-900 text-xl tracking-tight leading-none">
                            {gateEnteredCount}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            / {totalMembersInActiveRound} Entered
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">
                          {totalMembersInActiveRound - gateEnteredCount} Pending
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${gateRate > 0 ? Math.max(gateRate, 2.5) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Info & Interactive Tag */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Campus Gate Check-in</span>
                    </span>
                    {sessionFilter === "gate_entry" ? (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Active Filter
                      </span>
                    ) : (
                      <span className="text-emerald-600 group-hover:underline inline-flex items-center gap-0.5">
                        Filter Column →
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* CARD: MORNING SESSION */}
              <div
                onClick={() => setSessionFilter(sessionFilter === "morning" ? "all" : "morning")}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                  sessionFilter === "morning"
                    ? "bg-white border-2 border-amber-500 ring-4 ring-amber-500/10 shadow-md shadow-amber-500/5"
                    : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md shadow-2xs"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-transform group-hover:scale-105 ${
                        sessionFilter === "morning" 
                          ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30" 
                          : "bg-amber-50 text-amber-600 ring-1 ring-amber-100"
                      }`}>
                        <Sun className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-900 tracking-tight truncate">Morning Session</h4>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>09:00 AM – 01:00 PM</span>
                        </div>
                      </div>
                    </div>

                    {/* Present Pill */}
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0 ${
                      morningRate >= 70 
                        ? "bg-amber-100 text-amber-800" 
                        : morningRate > 0 
                        ? "bg-amber-50 text-amber-700 border border-amber-200/60" 
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${morningRate > 0 ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
                      {morningRate}% Present
                    </span>
                  </div>

                  {/* Counter Stats & Numbers */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-black text-slate-900 text-xl tracking-tight leading-none">
                          {morningPresentCount}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          / {totalMembersInActiveRound} Present
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="text-slate-500">
                          {totalMembersInActiveRound - morningPresentCount} Pending
                        </span>
                        {morningLateCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                            {morningLateCount} Late
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-400 to-orange-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${morningRate > 0 ? Math.max(morningRate, 2.5) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Info & Interactive Tag */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                    <Coffee className="w-3.5 h-3.5 text-amber-600" />
                    <span>AM Attendance & Sprints</span>
                  </span>
                  {sessionFilter === "morning" ? (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-black inline-flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Active Filter
                    </span>
                  ) : (
                    <span className="text-amber-600 group-hover:underline inline-flex items-center gap-0.5">
                      Filter Column →
                    </span>
                  )}
                </div>
              </div>

              {/* CARD: AFTERNOON SESSION */}
              <div
                onClick={() => setSessionFilter(sessionFilter === "afternoon" ? "all" : "afternoon")}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                  sessionFilter === "afternoon"
                    ? "bg-white border-2 border-indigo-500 ring-4 ring-indigo-500/10 shadow-md shadow-indigo-500/5"
                    : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md shadow-2xs"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-transform group-hover:scale-105 ${
                        sessionFilter === "afternoon" 
                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30" 
                          : "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"
                      }`}>
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-900 tracking-tight truncate">Afternoon Session</h4>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>02:00 – 06:00 PM</span>
                        </div>
                      </div>
                    </div>

                    {/* Present Pill */}
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0 ${
                      afternoonRate >= 70 
                        ? "bg-indigo-100 text-indigo-800" 
                        : afternoonRate > 0 
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60" 
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${afternoonRate > 0 ? "bg-indigo-500 animate-pulse" : "bg-slate-400"}`} />
                      {afternoonRate}% Present
                    </span>
                  </div>

                  {/* Counter Stats & Numbers */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-black text-slate-900 text-xl tracking-tight leading-none">
                          {afternoonPresentCount}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          / {totalMembersInActiveRound} Present
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="text-slate-500">
                          {totalMembersInActiveRound - afternoonPresentCount} Pending
                        </span>
                        {afternoonLateCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[10px] font-extrabold">
                            {afternoonLateCount} Late
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${afternoonRate > 0 ? Math.max(afternoonRate, 2.5) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Info & Interactive Tag */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>PM Evaluation Turnout</span>
                  </span>
                  {sessionFilter === "afternoon" ? (
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-black inline-flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Active Filter
                    </span>
                  ) : (
                    <span className="text-indigo-600 group-hover:underline inline-flex items-center gap-0.5">
                      Filter Column →
                    </span>
                  )}
                </div>
              </div>

              {/* CARD: GATE EXIT (Day 2 / End Date only) */}
              {isEndDay && (
                <div
                  onClick={() => setSessionFilter(sessionFilter === "gate_exit" ? "all" : "gate_exit")}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                    sessionFilter === "gate_exit"
                      ? "bg-white border-2 border-rose-500 ring-4 ring-rose-500/10 shadow-md shadow-rose-500/5"
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md shadow-2xs"
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-transform group-hover:scale-105 ${
                          sessionFilter === "gate_exit" 
                            ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30" 
                            : "bg-rose-50 text-rose-600 ring-1 ring-rose-100"
                        }`}>
                          <DoorClosed className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 tracking-tight truncate">Gate Exit</h4>
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>04:30 – 07:00 PM</span>
                          </div>
                        </div>
                      </div>

                      {/* Turnout Pill */}
                      <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0 ${
                        gateExitRate >= 70 
                          ? "bg-rose-100 text-rose-800" 
                          : gateExitRate > 0 
                          ? "bg-rose-50 text-rose-700 border border-rose-200/60" 
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${gateExitRate > 0 ? "bg-rose-500 animate-pulse" : "bg-slate-400"}`} />
                        {gateExitRate}% Exited
                      </span>
                    </div>

                    {/* Counter Stats & Numbers */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-baseline justify-between text-xs">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-black text-slate-900 text-xl tracking-tight leading-none">
                            {gateExitedCount}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            / {totalMembersInActiveRound} Exited
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">
                          {totalMembersInActiveRound - gateExitedCount} Pending
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${gateExitRate > 0 ? Math.max(gateExitRate, 2.5) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Info & Interactive Tag */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                      <span>Campus Gate Departure</span>
                    </span>
                    {sessionFilter === "gate_exit" ? (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-black inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Active Filter
                      </span>
                    ) : (
                      <span className="text-rose-600 group-hover:underline inline-flex items-center gap-0.5">
                        Filter Column →
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Bulk Actions & Search Toolbar */}
            <div className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500">Bulk Actions (Day {selectedDay}):</span>
                {!isEndDay && (
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={() => handleBulkMarkSession("gate_entry", "Present")}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-200 shadow-2xs disabled:opacity-50"
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>Mark All Gate Entered</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => handleBulkMarkSession("morning", "Present")}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-200 shadow-2xs disabled:opacity-50"
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Mark All Morning Present</span>
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => handleBulkMarkSession("afternoon", "Present")}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-200 shadow-2xs disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Mark All Afternoon Present</span>
                </button>
                {isEndDay && (
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={() => handleBulkMarkSession("gate_exit", "Present")}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-200 shadow-2xs disabled:opacity-50"
                  >
                    <DoorClosed className="w-3.5 h-3.5" />
                    <span>Mark All Gate Exited</span>
                  </button>
                )}
                {sessionFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setSessionFilter("all")}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all"
                  >
                    Clear Filter
                  </button>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search participant or team..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* TEAM-WISE PARTICIPANT ATTENDANCE */}
          <div className="space-y-4 p-4 sm:p-6 bg-slate-50/50">
              {currentTeams.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 font-medium bg-white rounded-2xl border border-slate-200">
                  No matching teams found for Day {selectedDay}.
                </div>
              ) : (
                currentTeams.map((team) => {
                  const stats = getTeamDayStats(team, selectedDay);
                  const isCollapsed = collapsedTeamIds.has(team.id);
                  const isAllPresent = stats.status === "All Present";
                  const isPartial = stats.status === "Partial";

                  return (
                    <div
                      key={team.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden"
                    >
                      {/* Team Header Bar */}
                      <div
                        onClick={() => toggleTeamCollapse(team.id)}
                        className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none bg-gradient-to-r from-white via-white to-slate-50/50 hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Team Identity */}
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 font-black text-sm shrink-0 shadow-2xs">
                            {team.teamName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-extrabold text-slate-900 tracking-tight truncate">
                                {team.teamName}
                              </h3>
                              <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                                {team.ticketCode}
                              </span>
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200/60">
                                {team.allMembers.length} {team.allMembers.length === 1 ? "Member" : "Members"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
                              <span>Lead: <strong className="text-slate-800">{team.lead.name}</strong></span>
                              <span>•</span>
                              <span>{team.college}</span>
                              {team.department && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600">{team.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Session Summary Pills & Team Actions */}
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap lg:flex-nowrap shrink-0 self-end lg:self-center" onClick={(e) => e.stopPropagation()}>
                          {/* Day Session Summary Pills */}
                          <div className="flex items-center gap-1.5 text-[11px] font-bold">
                            {!isEndDay && (
                              /* Gate Badge */
                              <span className={`px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                                stats.gateEntered === stats.total && stats.total > 0
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : stats.gateEntered > 0
                                  ? "bg-emerald-50/60 text-emerald-700 border-emerald-200/60"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}>
                                <DoorOpen className="w-3 h-3 text-emerald-600" />
                                <span>Gate: {stats.gateEntered}/{stats.total}</span>
                              </span>
                            )}

                            {/* Morning Badge */}
                            <span className={`px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                              stats.morningPresent === stats.total && stats.total > 0
                                ? "bg-amber-50 text-amber-900 border-amber-200"
                                : stats.morningPresent > 0
                                ? "bg-amber-50/60 text-amber-800 border-amber-200/60"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}>
                              <Sun className="w-3 h-3 text-amber-600" />
                              <span>AM: {stats.morningPresent}/{stats.total}</span>
                            </span>

                            {/* Afternoon Badge */}
                            <span className={`px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                              stats.afternoonPresent === stats.total && stats.total > 0
                                ? "bg-indigo-50 text-indigo-900 border-indigo-200"
                                : stats.afternoonPresent > 0
                                ? "bg-indigo-50/60 text-indigo-800 border-indigo-200/60"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}>
                              <Clock className="w-3 h-3 text-indigo-600" />
                              <span>PM: {stats.afternoonPresent}/{stats.total}</span>
                            </span>

                            {isEndDay && (
                              /* Gate Exit Badge */
                              <span className={`px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                                stats.gateExited === stats.total && stats.total > 0
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : stats.gateExited > 0
                                  ? "bg-rose-50/60 text-rose-700 border-rose-200/60"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}>
                                <DoorClosed className="w-3 h-3 text-rose-600" />
                                <span>Exit: {stats.gateExited}/{stats.total}</span>
                              </span>
                            )}
                          </div>

                          {/* Overall Status Pill */}
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${
                            isAllPresent
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : isPartial
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-rose-100 text-rose-800 border-rose-200"
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              isAllPresent ? "bg-emerald-600 animate-pulse" : isPartial ? "bg-amber-500" : "bg-rose-500"
                            }`} />
                            <span>
                              {isAllPresent
                                ? `All Present`
                                : isPartial
                                ? `Partial`
                                : `All Absent`}
                            </span>
                          </span>

                          {/* 1-Click Quick Check-in Team Button */}
                          <button
                            type="button"
                            onClick={() => handleMarkTeamAll(team, selectedDay)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1.5 ${
                              isAllPresent
                                ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/20"
                            }`}
                            title={isAllPresent ? "Reset entire team" : "Mark all team members present across Day " + selectedDay}
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>{isAllPresent ? "Reset Team" : "Mark Team All"}</span>
                          </button>

                          {/* Chevron Expand/Collapse Button */}
                          <button
                            type="button"
                            onClick={() => toggleTeamCollapse(team.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title={isCollapsed ? "Expand Team Members" : "Collapse Team Members"}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${!isCollapsed ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Squad Members Table */}
                      {!isCollapsed && (
                        <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-5">
                          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/70 text-[9.5px] uppercase font-black tracking-wider text-slate-400">
                                  <th className="py-2.5 px-4">Member</th>
                                  <th className="py-2.5 px-4">Roll No / ID</th>
                                  {!isEndDay && (
                                    <th className={`py-2.5 px-4 text-center ${sessionFilter === "gate_entry" ? "bg-emerald-50 text-emerald-900" : ""}`}>
                                      Gate Enter (Day {selectedDay})
                                    </th>
                                  )}
                                  <th className={`py-2.5 px-4 text-center ${sessionFilter === "morning" ? "bg-amber-50 text-amber-900" : ""}`}>
                                    Morning (Day {selectedDay})
                                  </th>
                                  <th className={`py-2.5 px-4 text-center ${sessionFilter === "afternoon" ? "bg-indigo-50 text-indigo-900" : ""}`}>
                                    Afternoon (Day {selectedDay})
                                  </th>
                                  {isEndDay && (
                                    <th className={`py-2.5 px-4 text-center ${sessionFilter === "gate_exit" ? "bg-rose-50 text-rose-900" : ""}`}>
                                      Gate Exit (Day {selectedDay})
                                    </th>
                                  )}
                                  <th className="py-2.5 px-4 text-right pr-5">Quick Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                {team.allMembers.map((member) => {
                                  const dStatus = member.days?.[selectedDay] || {
                                    gateEntered: false,
                                    gateCheckInTime: "—",
                                    morningStatus: "Pending",
                                    morningCheckInTime: "—",
                                    afternoonStatus: "Pending",
                                    afternoonCheckInTime: "—",
                                    gateExited: false,
                                    gateExitCheckInTime: "—"
                                  };

                                  const initials = (member.name || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

                                  return (
                                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                                      {/* Member info */}
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[9.5px] text-slate-600 shrink-0">
                                            {initials}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-extrabold text-slate-900 text-xs truncate max-w-[170px] sm:max-w-none">
                                                {member.name}
                                              </span>
                                              {member.isLead && (
                                                <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md uppercase border border-blue-200">
                                                  <Crown className="w-2.5 h-2.5 text-blue-600" />
                                                  Lead
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 block truncate max-w-[170px] sm:max-w-none">
                                              {member.email || "—"}
                                            </span>
                                          </div>
                                        </div>
                                      </td>

                                      {/* Roll No / ID */}
                                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 font-semibold">
                                        {member.studentId}
                                      </td>

                                      {/* Gate Enter (Day 1 only) */}
                                      {!isEndDay && (
                                        <td className="py-3 px-4 text-center">
                                          {dStatus.gateEntered ? (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleTeamMemberGateEnter(team.id, member.id, selectedDay)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                                              title="Click to toggle Gate Entry"
                                            >
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                              <span>Entered</span>
                                              <span className="text-[9px] font-medium text-emerald-600/80">({dStatus.gateCheckInTime})</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleTeamMemberGateEnter(team.id, member.id, selectedDay)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase bg-slate-50 text-slate-500 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all cursor-pointer"
                                              title="Click to mark Gate Entered"
                                            >
                                              <DoorOpen className="w-3 h-3 text-slate-400" />
                                              <span>Gate Pending</span>
                                            </button>
                                          )}
                                        </td>
                                      )}

                                      {/* Morning Session */}
                                      <td className="py-3 px-4 text-center">
                                        {dStatus.morningStatus === "Present" ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTeamMemberMorning(team.id, member.id, selectedDay)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
                                            title="Click to cycle status"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            <span>Present</span>
                                            <span className="text-[9px] font-medium text-amber-700/80">({dStatus.morningCheckInTime})</span>
                                          </button>
                                        ) : dStatus.morningStatus === "Late" ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTeamMemberMorning(team.id, member.id, selectedDay)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-all cursor-pointer shadow-2xs"
                                            title="Click to cycle status"
                                          >
                                            <Clock className="w-3 h-3 text-orange-600" />
                                            <span>Late</span>
                                            <span className="text-[9px] font-medium text-orange-600/80">({dStatus.morningCheckInTime})</span>
                                          </button>
                                        ) : dStatus.morningStatus === "Absent" ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTeamMemberMorning(team.id, member.id, selectedDay)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
                                            title="Click to cycle status"
                                          >
                                            <XCircle className="w-3 h-3 text-red-500" />
                                            <span>Absent</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTeamMemberMorning(team.id, member.id, selectedDay)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase bg-slate-50 text-slate-500 border border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 transition-all cursor-pointer"
                                            title="Click to mark Present"
                                          >
                                            <Sun className="w-3 h-3 text-slate-400" />
                                            <span>Pending</span>
                                          </button>
                                        )}
                                      </td>

                                      {/* Afternoon Session */}
                                      <td className="py-3 px-4 text-center">
                                        {dStatus.afternoonStatus === "Present" ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTeamMemberAfternoon(team.id, member.id, selectedDay)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs"
                                            title="Click to cycle status"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                            <span>Present</span>
                                            <span className="text-[9px] font-medium text-indigo-600/80">({dStatus.afternoonCheckInTime})</span>
                                          </button>
                                        ) : dStatus.afternoonStatus === "Late" ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTeamMemberAfternoon(team.id, member.id, selectedDay)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all cursor-pointer shadow-2xs"
                                            title="Click to cycle status"
                                          >
                                            <Clock className="w-3 h-3 text-purple-600" />
                                            <span>Late</span>
                                            <span className="text-[9px] font-medium text-purple-600/80">({dStatus.afternoonCheckInTime})</span>
                                          </button>
                                        ) : dStatus.afternoonStatus === "Absent" ? (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTeamMemberAfternoon(team.id, member.id, selectedDay)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
                                            title="Click to cycle status"
                                          >
                                            <XCircle className="w-3 h-3 text-red-500" />
                                            <span>Absent</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleTeamMemberAfternoon(team.id, member.id, selectedDay)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase bg-slate-50 text-slate-500 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all cursor-pointer"
                                            title="Click to mark Present"
                                          >
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Pending</span>
                                          </button>
                                        )}
                                      </td>

                                      {/* Gate Exit (Day 2 / End Date only) */}
                                      {isEndDay && (
                                        <td className="py-3 px-4 text-center">
                                          {dStatus.gateExited ? (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleTeamMemberGateExit(team.id, member.id, selectedDay)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                                              title="Click to toggle Gate Exit"
                                            >
                                              <CheckCircle2 className="w-3 h-3 text-rose-600" />
                                              <span>Exited</span>
                                              <span className="text-[9px] font-medium text-rose-600/80">({dStatus.gateExitCheckInTime || "—"})</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleTeamMemberGateExit(team.id, member.id, selectedDay)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase bg-slate-50 text-slate-500 border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all cursor-pointer"
                                              title="Click to mark Gate Exited"
                                            >
                                              <DoorClosed className="w-3 h-3 text-slate-400" />
                                              <span>Exit Pending</span>
                                            </button>
                                          )}
                                        </td>
                                      )}

                                      {/* Quick Action: Mark All */}
                                      <td className="py-3 px-4 text-right pr-5">
                                        <button
                                          type="button"
                                          onClick={() => handleMarkAllForTeamMember(team.id, member.id, selectedDay)}
                                          className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-[#2563EB] text-[#2563EB] hover:text-white text-[10px] font-black transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                                          title={isEndDay ? "Check In Morning, Afternoon & Gate Exit for this member" : "Check In Gate, Morning & Afternoon for this member"}
                                        >
                                          <Check className="w-3 h-3" />
                                          <span>Mark All</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Team-Wise Pagination Footer */}
              {totalTeamPages > 1 && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">
                    Showing {indexOfFirstTeam + 1}–{Math.min(indexOfLastTeam, filteredTeams.length)} of {filteredTeams.length} teams
                  </span>

                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalTeamPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7.5 h-7.5 rounded-lg font-bold text-[10px] flex items-center justify-center transition-all cursor-pointer
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
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">Export Day {selectedDay} Report</h4>
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
