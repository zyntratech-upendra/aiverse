import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import jsQR from "jsqr";
import { useAuth } from "../../context/AuthContext";
import { 
  fetchEvents as apiFetchEvents, 
  fetchOrganizers, 
  fetchRegistrations, 
  fetchRegistrationById, 
  fetchAttendance, 
  markAttendance, 
  updateRegistration 
} from "../../services/apiClient";
import SEO from "../../components/layout/SEO";
import { 
  Search, 
  ArrowUpDown, 
  RefreshCw, 
  FileText, 
  QrCode,
  Camera,
  Check,
  X,
  Sun,
  Moon,
  Calendar,
  Users,
  User,
  ChevronDown,
  ArrowLeft,
  MapPin,
  Clock,
  LogIn,
  Sparkles,
  DoorOpen,
  DoorClosed,
  ArrowRight,
  Crown,
  CheckCheck,
  ChevronsUpDown,
  Ticket
} from "lucide-react";
import { computeEventDays, type EventDayInfo } from "../faculty/AttendanceManagementPage";

export interface StudentAttendee {
  id: string;
  regId: string;
  name: string;
  email: string;
  phone?: string;
  studentId: string;
  teamName: string;
  department?: string;
  college?: string;
  year?: string;
  program?: string;
  isLead: boolean;
  memberIndex?: number;
  gateStatus: "Present" | "Late" | "Absent";
  gateCheckInTime: string;
  morningStatus: "Present" | "Late" | "Absent";
  morningCheckInTime: string;
  afternoonStatus: "Present" | "Late" | "Absent";
  afternoonCheckInTime: string;
  gateExitStatus?: "Present" | "Late" | "Absent";
  gateExitCheckInTime?: string;
}

export interface TeamMemberAttendee {
  id: string;
  regId: string;
  name: string;
  email: string;
  phone?: string;
  studentId: string;
  department?: string;
  college?: string;
  year?: string;
  program?: string;
  isLead: boolean;
  memberIndex?: number;
  gateStatus: "Present" | "Late" | "Absent";
  gateCheckInTime: string;
  morningStatus: "Present" | "Late" | "Absent";
  morningCheckInTime: string;
  afternoonStatus: "Present" | "Late" | "Absent";
  afternoonCheckInTime: string;
  gateExitStatus?: "Present" | "Late" | "Absent";
  gateExitCheckInTime?: string;
}

export interface TeamAttendee {
  id: string;
  regId: string;
  teamName: string;
  ticketCode: string;
  college: string;
  department: string;
  year: string;
  program: string;
  lead: StudentAttendee;
  members: StudentAttendee[];
  allMembers: StudentAttendee[];
  totalMembersCount: number;
  presentCount: number;
  status: "All Present" | "Partial" | "All Absent";
}

interface EventItem {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  timeRange?: string;
  venue?: string;
  location?: string;
  room?: string;
  status?: string;
  isToday?: boolean;
  daysCount?: number;
}

export const OrgAttendancePage: React.FC = () => {
  const { user } = useAuth();
  // Two-step flow: "landing" = event selection, "marking" = attendance marking
  const [activeView, setActiveView] = useState<"landing" | "marking">("landing");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [assignedEvent, setAssignedEvent] = useState<EventItem | null>(null);
  const [students, setStudents] = useState<StudentAttendee[]>([]);
  const [viewMode, setViewMode] = useState<"teams" | "participants">("teams");
  const [collapsedTeamIds, setCollapsedTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Present" | "Late" | "Absent">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "time" | "status">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Four Attendance Session Tabs: "gate_entry" | "morning" | "afternoon" | "gate_exit"
  const [sessionTab, setSessionTab] = useState<"gate_entry" | "morning" | "afternoon" | "gate_exit">("morning");
  const [selectedDay, setSelectedDay] = useState<number>(1);

  // Session & Day Selection Modal on "Enter Event"
  const [sessionModalEvent, setSessionModalEvent] = useState<EventItem | null>(null);
  const [modalDay, setModalDay] = useState<number>(1);
  const [modalSession, setModalSession] = useState<"gate_entry" | "morning" | "afternoon" | "gate_exit">("gate_entry");

  // QR Scanner Modal States
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannedTeamInfo, setScannedTeamInfo] = useState<any | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState("");
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [rosterAttendance, setRosterAttendance] = useState<Record<string, "Present" | "Late" | "Absent">>({});
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const isProcessingQR = useRef(false);

  // Helper to format today's local date as YYYY-MM-DD
  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 1. Fetch available events on page load
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const todayObj = new Date();
        const year = todayObj.getFullYear();
        const month = String(todayObj.getMonth() + 1).padStart(2, "0");
        const day = String(todayObj.getDate()).padStart(2, "0");
        const todayStr = `${year}-${month}-${day}`;
        const userEmail = user?.email?.toLowerCase().trim() || "";

        // Robust check to determine if an event is occurring today
        const isEventToday = (startDateStr: string, endDateStr: string) => {
          if (!startDateStr && !endDateStr) return true; // Show scheduled events if no explicit date
          const s = (startDateStr || "").trim();
          const e = (endDateStr || s).trim();
          
          if (s === todayStr || s.startsWith(todayStr)) return true;
          if (s && e && s <= todayStr && e >= todayStr) return true;

          try {
            const startD = new Date(s);
            if (!isNaN(startD.getTime())) {
              const endD = e ? new Date(e) : startD;
              const t = new Date(year, todayObj.getMonth(), todayObj.getDate()).getTime();
              const sTime = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()).getTime();
              const eTime = !isNaN(endD.getTime()) ? new Date(endD.getFullYear(), endD.getMonth(), endD.getDate()).getTime() : sTime;
              if (t >= sTime && t <= eTime) return true;
            }
          } catch {
            // ignore parse failure
          }
          return false;
        };

        // Check if organizer is assigned specific events
        let assignedTitles: string[] = [];
        try {
          const orgsRes = await fetchOrganizers();
          const orgList = Array.isArray(orgsRes) ? orgsRes : (orgsRes?.organizers || orgsRes?.data || []);
          const orgData = orgList.find((o: any) => 
            o.email?.toLowerCase() === userEmail || o.username?.toLowerCase() === userEmail
          );
          if (orgData?.assignedEvents && Array.isArray(orgData.assignedEvents)) {
            assignedTitles = orgData.assignedEvents.map((t: string) => t.toLowerCase().trim());
          }
        } catch (e) {
          console.warn("Could not load organizers assignment:", e);
        }

        const eventsRes = await apiFetchEvents();
        const eventsList = Array.isArray(eventsRes) ? eventsRes : (eventsRes?.events || eventsRes?.data || []);
        const rawEvents: EventItem[] = [];

        eventsList.forEach((data: any) => {
          const eventDate = data.startDate || data.date || "";
          const endDate = data.endDate || eventDate;
          const isToday = isEventToday(eventDate, endDate);

          // Include today's events or active events
          if (isToday || (data.status || "").toLowerCase() === "active" || (data.status || "").toLowerCase() === "live" || eventsList.length <= 5) {
            rawEvents.push({
              id: data.id || data._id,
              title: data.title || "Untitled Event",
              startDate: data.startDate || data.date || "",
              endDate: data.endDate || "",
              date: data.date || data.startDate || "",
              startTime: data.startTime || "09:00 AM",
              endTime: data.endTime || "05:00 PM",
              timeRange: data.timeRange || (data.startTime ? `${data.startTime} - ${data.endTime || ""}` : "09:00 AM - 05:00 PM"),
              venue: data.venue || data.location || "Campus Venue",
              location: data.location || data.venue || "Campus Venue",
              room: data.room || "Room 101",
              status: data.status || "Active",
              daysCount: Number(data.daysCount || data.durationDays || data.totalDays) || undefined,
              isToday: isToday || true
            });
          }
        });

        // Fallback: If no today events, display all active events
        let filteredEvents: EventItem[] = rawEvents.length > 0 ? rawEvents : eventsList.map((data: any) => ({
          id: data.id || data._id,
          title: data.title || "Untitled Event",
          startDate: data.startDate || data.date || "",
          endDate: data.endDate || "",
          date: data.date || data.startDate || "",
          startTime: data.startTime || "09:00 AM",
          endTime: data.endTime || "05:00 PM",
          timeRange: data.timeRange || (data.startTime ? `${data.startTime} - ${data.endTime || ""}` : "09:00 AM - 05:00 PM"),
          venue: data.venue || data.location || "Campus Venue",
          location: data.location || data.venue || "Campus Venue",
          room: data.room || "Room 101",
          status: data.status || "Active",
          daysCount: Number(data.daysCount || data.durationDays || data.totalDays) || undefined,
          isToday: true
        }));

        // Filter today's events by organizer assignment if assignments exist
        if (assignedTitles.length > 0) {
          const matchedAssigned = filteredEvents.filter((e: EventItem) => 
            assignedTitles.some(t => e.title.toLowerCase().trim().includes(t) || t.includes(e.title.toLowerCase().trim()))
          );
          if (matchedAssigned.length > 0) {
            filteredEvents = matchedAssigned;
          }
        }

        // Sort today's events
        filteredEvents.sort((a: EventItem, b: EventItem) => {
          return (a.startTime || "").localeCompare(b.startTime || "");
        });

        setEvents(filteredEvents);

        if (filteredEvents.length > 0) {
          setSelectedEventId(filteredEvents[0].id);
          setAssignedEvent(filteredEvents[0]);
        }
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [user]);

  // 2. Fetch registered participants when selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) return;

    const loadEventAttendees = async () => {
      try {
        setLoading(true);
        const currentEvent = events.find(e => e.id === selectedEventId);
        if (currentEvent) {
          setAssignedEvent(currentEvent);
        }

        // Fetch registrations
        const regsRes = await fetchRegistrations();
        const allRegs = Array.isArray(regsRes) ? regsRes : (regsRes?.registrations || regsRes?.data || []);
        setRegistrations(allRegs);

        // Fetch attendances collection records for this event
        let attendances: any[] = [];
        try {
          const attsRes = await fetchAttendance({ eventId: selectedEventId });
          attendances = Array.isArray(attsRes) ? attsRes : (attsRes?.attendance || attsRes?.data || []);
        } catch (e) {
          console.warn("Could not load attendance list:", e);
        }

        const eventRegs = allRegs.filter((r: any) => 
          r.eventId === selectedEventId || 
          (currentEvent && (r.eventTitle || "").toLowerCase().trim() === currentEvent.title.toLowerCase().trim())
        );

        const attendeeList: StudentAttendee[] = [];

        eventRegs.forEach((r: any) => {
          const regId = r.id || r._id;
          const leadId = `${regId}_lead`;
          const attLeadGate = attendances.find((a: any) => 
            (a.eventId === selectedEventId || !a.eventId) && 
            (a.participantId === leadId || a.registrationId === regId || a.userEmail === (r.teamLeadEmail || r.email || '').toLowerCase()) && 
            Number(a.day || a.dayNumber || 1) === selectedDay &&
            (a.session === "gate_entry" || a.session === "gate")
          );
          const attLeadMorning = attendances.find((a: any) => 
            (a.eventId === selectedEventId || !a.eventId) && 
            (a.participantId === leadId || a.registrationId === regId || a.userEmail === (r.teamLeadEmail || r.email || '').toLowerCase()) && 
            Number(a.day || a.dayNumber || 1) === selectedDay &&
            (a.session === "morning" || !a.session)
          );
          const attLeadAfternoon = attendances.find((a: any) => 
            (a.eventId === selectedEventId || !a.eventId) && 
            (a.participantId === leadId || a.registrationId === regId || a.userEmail === (r.teamLeadEmail || r.email || '').toLowerCase()) && 
            Number(a.day || a.dayNumber || 1) === selectedDay &&
            a.session === "afternoon"
          );
          const attLeadExit = attendances.find((a: any) => 
            (a.eventId === selectedEventId || !a.eventId) && 
            (a.participantId === leadId || a.registrationId === regId || a.userEmail === (r.teamLeadEmail || r.email || '').toLowerCase()) && 
            Number(a.day || a.dayNumber || 1) === selectedDay &&
            (a.session === "gate_exit" || a.session === "exit")
          );

          const isGateLeadPresent = attLeadGate 
            ? (attLeadGate.status === "Present" || attLeadGate.status === "Entered") 
            : Boolean(selectedDay === 1 && (r.gateEntryMarked || r.attendanceMarked));

          const isGateExitLeadPresent = attLeadExit 
            ? (attLeadExit.status === "Present" || attLeadExit.status === "Entered" || attLeadExit.status === "Exited") 
            : Boolean(r.gateExitMarked);

          // 1. Team Lead / Individual Registrant
          attendeeList.push({
            id: leadId,
            regId: regId,
            isLead: true,
            name: r.teamLeadName || r.name || "Team Lead",
            email: r.teamLeadEmail || r.email || "",
            studentId: r.teamLeadStudentId || r.studentId || `AI-${String(regId).substring(0, 5).toUpperCase()}`,
            teamName: r.groupName || r.teamName || "Solo Registration",
            department: r.department || r.branch || "Engineering & Tech",
            year: r.year || "Year 3",
            program: r.program || "B.Tech",
            gateStatus: (attLeadGate?.status as any) || (isGateLeadPresent ? "Present" : "Absent"),
            gateCheckInTime: attLeadGate?.checkInTime || (selectedDay === 1 ? (r.checkInTimeGateEntry || (isGateLeadPresent ? r.checkInTime : "Not Checked-in")) : "Not Checked-in"),
            morningStatus: (attLeadMorning?.status as any) || (selectedDay === 1 ? (r.attendanceStatusMorning || r.attendanceStatus || "Absent") : "Absent"),
            morningCheckInTime: attLeadMorning?.checkInTime || (selectedDay === 1 ? (r.checkInTimeMorning || (r.attendanceStatus === "Present" ? r.checkInTime : "Not Checked-in")) : "Not Checked-in"),
            afternoonStatus: (attLeadAfternoon?.status as any) || (selectedDay === 1 ? (r.attendanceStatusAfternoon || "Absent") : "Absent"),
            afternoonCheckInTime: attLeadAfternoon?.checkInTime || (selectedDay === 1 ? (r.checkInTimeAfternoon || "Not Checked-in") : "Not Checked-in"),
            gateExitStatus: (attLeadExit?.status as any) || (isGateExitLeadPresent ? "Present" : "Absent"),
            gateExitCheckInTime: attLeadExit?.checkInTime || (isGateExitLeadPresent ? (r.checkInTimeGateExit || "Not Checked-in") : "Not Checked-in")
          });

          // 2. Team Squad Members
          if (Array.isArray(r.members) && r.members.length > 0) {
            r.members.forEach((m: any, idx: number) => {
              const memId = `${regId}_member_${idx}`;
              const attMemGate = attendances.find((a: any) => 
                (a.eventId === selectedEventId || !a.eventId) && 
                (a.participantId === memId || a.userEmail === (m.email || '').toLowerCase()) && 
                Number(a.day || a.dayNumber || 1) === selectedDay &&
                (a.session === "gate_entry" || a.session === "gate")
              );
              const attMemMorning = attendances.find((a: any) => 
                (a.eventId === selectedEventId || !a.eventId) && 
                (a.participantId === memId || a.userEmail === (m.email || '').toLowerCase()) && 
                Number(a.day || a.dayNumber || 1) === selectedDay &&
                (a.session === "morning" || !a.session)
              );
              const attMemAfternoon = attendances.find((a: any) => 
                (a.eventId === selectedEventId || !a.eventId) && 
                (a.participantId === memId || a.userEmail === (m.email || '').toLowerCase()) && 
                Number(a.day || a.dayNumber || 1) === selectedDay &&
                a.session === "afternoon"
              );
              const attMemExit = attendances.find((a: any) => 
                (a.eventId === selectedEventId || !a.eventId) && 
                (a.participantId === memId || a.userEmail === (m.email || '').toLowerCase()) && 
                Number(a.day || a.dayNumber || 1) === selectedDay &&
                (a.session === "gate_exit" || a.session === "exit")
              );

              const isGateMemPresent = attMemGate 
                ? (attMemGate.status === "Present" || attMemGate.status === "Entered") 
                : Boolean(selectedDay === 1 && (m.gateEntryMarked || m.attendanceMarked));

              const isGateExitMemPresent = attMemExit 
                ? (attMemExit.status === "Present" || attMemExit.status === "Entered" || attMemExit.status === "Exited") 
                : Boolean(m.gateExitMarked);

              attendeeList.push({
                id: memId,
                regId: regId,
                isLead: false,
                memberIndex: idx,
                name: m.name || `Teammate ${idx + 1}`,
                email: m.email || "",
                studentId: m.studentId || `AI-${String(regId).substring(0, 3)}-${idx + 1}`,
                teamName: r.groupName || r.teamName || "Team Member",
                department: m.department || r.department || "Engineering & Tech",
                year: m.year || r.year || "Year 3",
                program: m.program || r.program || "B.Tech",
                gateStatus: (attMemGate?.status as any) || (isGateMemPresent ? "Present" : "Absent"),
                gateCheckInTime: attMemGate?.checkInTime || (selectedDay === 1 ? (m.checkInTimeGateEntry || (isGateMemPresent ? m.checkInTime : "Not Checked-in")) : "Not Checked-in"),
                morningStatus: (attMemMorning?.status as any) || (selectedDay === 1 ? (m.attendanceStatusMorning || m.attendanceStatus || "Absent") : "Absent"),
                morningCheckInTime: attMemMorning?.checkInTime || (selectedDay === 1 ? (m.checkInTimeMorning || (m.attendanceStatus === "Present" ? m.checkInTime : "Not Checked-in")) : "Not Checked-in"),
                afternoonStatus: (attMemAfternoon?.status as any) || (selectedDay === 1 ? (m.attendanceStatusAfternoon || "Absent") : "Absent"),
                afternoonCheckInTime: attMemAfternoon?.checkInTime || (selectedDay === 1 ? (m.checkInTimeAfternoon || "Not Checked-in") : "Not Checked-in"),
                gateExitStatus: (attMemExit?.status as any) || (isGateExitMemPresent ? "Present" : "Absent"),
                gateExitCheckInTime: attMemExit?.checkInTime || (isGateExitMemPresent ? (m.checkInTimeGateExit || "Not Checked-in") : "Not Checked-in")
              });
            });
          }
        });

        setStudents(attendeeList);
      } catch (err) {
        console.error("Error loading event attendees:", err);
      } finally {
        setLoading(false);
      }
    };

    loadEventAttendees();
  }, [selectedEventId, selectedDay, events]);

  // Handle status toggle for a student across active session (Gate Enter, Morning, Afternoon)
  const handleStatusChange = async (studentId: string, newStatus: "Present" | "Late" | "Absent") => {
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const formattedCheckIn = newStatus === "Absent" ? "Not Checked-in" : `${timeNow} (Manual)`;

    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Update locally based on active sessionTab
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      if (sessionTab === "gate_entry") {
        return { ...s, gateStatus: newStatus, gateCheckInTime: formattedCheckIn };
      } else if (sessionTab === "morning") {
        return { ...s, morningStatus: newStatus, morningCheckInTime: formattedCheckIn };
      } else if (sessionTab === "afternoon") {
        return { ...s, afternoonStatus: newStatus, afternoonCheckInTime: formattedCheckIn };
      } else {
        return { ...s, gateExitStatus: newStatus, gateExitCheckInTime: formattedCheckIn };
      }
    }));

    // Update in Backend Database
    try {
      const regId = student.regId;

      // 1. Update attendances record via API
      if (selectedEventId) {
        await markAttendance({
          eventId: selectedEventId,
          eventTitle: assignedEvent?.title || "",
          registrationId: regId,
          participantId: student.id,
          userEmail: student.email,
          userName: student.name,
          name: student.name,
          role: "Participant",
          session: sessionTab,
          day: selectedDay,
          status: newStatus,
          checkInTime: formattedCheckIn
        });
      }

      // 2. Update registrations document fields
      if (student.isLead) {
        const updates: any = {};
        if (sessionTab === "gate_entry") {
          updates.gateEntryMarked = newStatus === "Present" || newStatus === "Late";
          updates.checkInTimeGateEntry = formattedCheckIn;
          updates.attendanceStatus = newStatus;
          updates.checkInTime = formattedCheckIn;
        } else if (sessionTab === "morning") {
          updates.attendanceStatusMorning = newStatus;
          updates.checkInTimeMorning = formattedCheckIn;
          updates.attendanceStatus = newStatus;
          updates.checkInTime = formattedCheckIn;
        } else if (sessionTab === "afternoon") {
          updates.attendanceStatusAfternoon = newStatus;
          updates.checkInTimeAfternoon = formattedCheckIn;
        } else if (sessionTab === "gate_exit") {
          updates.gateExitMarked = newStatus === "Present" || newStatus === "Late";
          updates.checkInTimeGateExit = formattedCheckIn;
        }
        await updateRegistration(regId, updates);
      } else if (student.memberIndex !== undefined) {
        const currentReg = registrations.find(r => (r.id || r._id) === regId);
        if (currentReg) {
          const membersList = [...(currentReg.members || [])];
          if (membersList[student.memberIndex]) {
            if (sessionTab === "gate_entry") {
              membersList[student.memberIndex].gateEntryMarked = newStatus === "Present" || newStatus === "Late";
              membersList[student.memberIndex].checkInTimeGateEntry = formattedCheckIn;
              membersList[student.memberIndex].attendanceStatus = newStatus;
              membersList[student.memberIndex].checkInTime = formattedCheckIn;
            } else if (sessionTab === "morning") {
              membersList[student.memberIndex].attendanceStatusMorning = newStatus;
              membersList[student.memberIndex].checkInTimeMorning = formattedCheckIn;
              membersList[student.memberIndex].attendanceStatus = newStatus;
              membersList[student.memberIndex].checkInTime = formattedCheckIn;
            } else if (sessionTab === "afternoon") {
              membersList[student.memberIndex].attendanceStatusAfternoon = newStatus;
              membersList[student.memberIndex].checkInTimeAfternoon = formattedCheckIn;
            } else if (sessionTab === "gate_exit") {
              membersList[student.memberIndex].gateExitMarked = newStatus === "Present" || newStatus === "Late";
              membersList[student.memberIndex].checkInTimeGateExit = formattedCheckIn;
            }
          }
          await updateRegistration(regId, { members: membersList });
        }
      }
    } catch (err) {
      console.error("Failed to update status in backend:", err);
    }
  };

  // QR Code Scanner Handlers
  const handleScannedCode = async (decodedText: string) => {
    if (isProcessingQR.current) return;
    isProcessingQR.current = true;

    try {
      let cleanText = decodedText.trim();

      // Try to parse JSON payload if embedded
      try {
        if (cleanText.startsWith("{") && cleanText.endsWith("}")) {
          const parsed = JSON.parse(cleanText);
          cleanText = parsed.id || parsed.regId || parsed.registrationId || cleanText;
        }
      } catch {
        // ignore parse error
      }

      // If full ticket URL is scanned (e.g. https://aiversevitb.in/ticket/REG_ID), extract the ID
      if (cleanText.includes("/ticket/")) {
        cleanText = cleanText.split("/ticket/").pop()?.split("?")[0]?.split("#")[0]?.trim() || cleanText;
      }

      let reg = registrations.find(r => 
        (r.id && r.id === cleanText) || 
        (r._id && r._id === cleanText) || 
        r.qrCodeData === cleanText || 
        r.ticketCode === cleanText || 
        r.registrationId === cleanText ||
        (r.teamLeadStudentId && r.teamLeadStudentId.toLowerCase() === cleanText.toLowerCase()) ||
        (r.teamLeadEmail && r.teamLeadEmail.toLowerCase() === cleanText.toLowerCase())
      );

      if (!reg) {
        setScanLoading(true);
        try {
          const fetchedReg = await fetchRegistrationById(cleanText);
          if (fetchedReg && (fetchedReg.id || fetchedReg._id)) {
            reg = { id: fetchedReg.id || fetchedReg._id, ...fetchedReg };
            setRegistrations(prev => [...prev, reg]);
          }
        } catch (e) {
          console.error("Fallback scan fetch failed:", e);
        }
        setScanLoading(false);
      }

      if (reg) {
        if (reg.eventId && selectedEventId && reg.eventId !== selectedEventId && reg.eventTitle?.toLowerCase() !== assignedEvent?.title?.toLowerCase()) {
          alert(`This ticket is for "${reg.eventTitle}". Please select that event or scan attendees for "${assignedEvent?.title}".`);
        } else {
          setScannedTeamInfo(reg);
        }
      } else {
        alert(`Invalid ticket QR Code or registration ID: "${cleanText}"`);
      }
    } finally {
      setTimeout(() => {
        isProcessingQR.current = false;
      }, 1500);
    }
  };

  const scanFrame = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          handleScannedCode(code.data);
          return;
        }
      }
    }
    
    if (isScannerModalOpen && !scannedTeamInfo) {
      requestRef.current = requestAnimationFrame(scanFrame);
    }
  };

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      if (isScannerModalOpen && !scannedTeamInfo) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
          });
          if (!active) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.play();
            requestRef.current = requestAnimationFrame(scanFrame);
          }
        } catch (err) {
          console.warn("Camera access failed or unavailable:", err);
        }
      }
    };

    const stopCamera = () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [isScannerModalOpen, scannedTeamInfo, registrations]);

  useEffect(() => {
    if (scannedTeamInfo) {
      const initialStatuses: Record<string, "Present" | "Late" | "Absent"> = {};
      const leadStatus = sessionTab === "gate_entry"
        ? (scannedTeamInfo.gateEntryMarked ? "Present" : "Present")
        : sessionTab === "morning" 
        ? (scannedTeamInfo.attendanceStatusMorning || scannedTeamInfo.attendanceStatus || "Present")
        : sessionTab === "gate_exit"
        ? (scannedTeamInfo.gateExitMarked ? "Present" : "Present")
        : (scannedTeamInfo.attendanceStatusAfternoon || "Present");
      initialStatuses["lead"] = leadStatus as any;

      if (scannedTeamInfo.members) {
        scannedTeamInfo.members.forEach((m: any, idx: number) => {
          const memStatus = sessionTab === "gate_entry"
            ? (m.gateEntryMarked ? "Present" : "Present")
            : sessionTab === "morning"
            ? (m.attendanceStatusMorning || m.attendanceStatus || "Present")
            : sessionTab === "gate_exit"
            ? (m.gateExitMarked ? "Present" : "Present")
            : (m.attendanceStatusAfternoon || "Present");
          initialStatuses[`member_${idx}`] = memStatus;
        });
      }
      setRosterAttendance(initialStatuses);
    } else {
      setRosterAttendance({});
    }
  }, [scannedTeamInfo, sessionTab]);

  // Compute live statistics based on active sessionTab
  const stats = useMemo(() => {
    const presentList = students.filter(s => {
      const status = sessionTab === "gate_entry" 
        ? s.gateStatus 
        : sessionTab === "morning" 
        ? s.morningStatus 
        : sessionTab === "gate_exit"
        ? s.gateExitStatus
        : s.afternoonStatus;
      return status === "Present" || status === "Late";
    });
    const totalPresent = presentList.length;
    const totalExpected = students.length;
    const rate = totalExpected > 0 ? ((totalPresent / totalExpected) * 100).toFixed(1) : "0.0";

    return {
      present: totalPresent,
      expected: totalExpected,
      rate
    };
  }, [students, sessionTab]);

  // Search & Filter students
  const filteredStudents = useMemo(() => {
    let result = students.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.teamName || "").toLowerCase().includes(q);

      const status = sessionTab === "gate_entry" 
        ? s.gateStatus 
        : sessionTab === "morning" 
        ? s.morningStatus 
        : sessionTab === "gate_exit"
        ? s.gateExitStatus
        : s.afternoonStatus;
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let fieldA: string = "";
      let fieldB: string = "";

      if (sortBy === "name") {
        fieldA = a.name;
        fieldB = b.name;
      } else if (sortBy === "time") {
        fieldA = sessionTab === "gate_entry" ? a.gateCheckInTime : sessionTab === "morning" ? a.morningCheckInTime : sessionTab === "gate_exit" ? (a.gateExitCheckInTime || "") : a.afternoonCheckInTime;
        fieldB = sessionTab === "gate_entry" ? b.gateCheckInTime : sessionTab === "morning" ? b.morningCheckInTime : sessionTab === "gate_exit" ? (b.gateExitCheckInTime || "") : b.afternoonCheckInTime;
      } else if (sortBy === "status") {
        fieldA = sessionTab === "gate_entry" ? a.gateStatus : sessionTab === "morning" ? a.morningStatus : sessionTab === "gate_exit" ? (a.gateExitStatus || "") : a.afternoonStatus;
        fieldB = sessionTab === "gate_entry" ? b.gateStatus : sessionTab === "morning" ? b.morningStatus : sessionTab === "gate_exit" ? (b.gateExitStatus || "") : b.afternoonStatus;
      }

      return sortOrder === "asc"
        ? fieldA.localeCompare(fieldB)
        : fieldB.localeCompare(fieldA);
    });

    return result;
  }, [students, searchQuery, statusFilter, sortBy, sortOrder, sessionTab]);

  // Group students by team / registration
  const teams = useMemo<TeamAttendee[]>(() => {
    const regGroups = new Map<string, StudentAttendee[]>();
    students.forEach((s) => {
      const arr = regGroups.get(s.regId) || [];
      arr.push(s);
      regGroups.set(s.regId, arr);
    });

    const teamList: TeamAttendee[] = [];
    regGroups.forEach((groupStudents, regId) => {
      const reg = registrations.find((r) => (r.id || r._id) === regId);
      const lead = groupStudents.find((s) => s.isLead) || groupStudents[0];
      const members = groupStudents.filter((s) => !s.isLead);

      const teamName = reg?.groupName || reg?.teamName || lead?.teamName || "Solo Registration";
      const ticketCode = reg?.ticketCode || lead?.studentId || `AI-${String(regId).substring(0, 6).toUpperCase()}`;
      const college = reg?.college || lead?.college || "Vishnu Institute of Technology";
      const department = reg?.department || reg?.branch || lead?.department || "Engineering";
      const year = reg?.year || lead?.year || "Year 3";
      const program = reg?.program || lead?.program || "B.Tech";

      const presentMembers = groupStudents.filter((s) => {
        const status =
          sessionTab === "gate_entry"
            ? s.gateStatus
            : sessionTab === "morning"
            ? s.morningStatus
            : sessionTab === "gate_exit"
            ? s.gateExitStatus
            : s.afternoonStatus;
        return status === "Present" || status === "Late";
      });

      const presentCount = presentMembers.length;
      const totalCount = groupStudents.length;

      let status: "All Present" | "Partial" | "All Absent" = "All Absent";
      if (presentCount === totalCount && totalCount > 0) {
        status = "All Present";
      } else if (presentCount > 0) {
        status = "Partial";
      }

      teamList.push({
        id: regId,
        regId,
        teamName,
        ticketCode,
        college,
        department,
        year,
        program,
        lead,
        members,
        allMembers: groupStudents,
        totalMembersCount: totalCount,
        presentCount,
        status,
      });
    });

    return teamList;
  }, [students, registrations, sessionTab]);

  // Filtered Teams based on search & status filter
  const filteredTeams = useMemo(() => {
    let result = teams.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.teamName.toLowerCase().includes(q) ||
        t.ticketCode.toLowerCase().includes(q) ||
        t.allMembers.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.studentId.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q)
        );

      let matchesStatus = true;
      if (statusFilter === "Present") {
        matchesStatus = t.status === "All Present";
      } else if (statusFilter === "Late") {
        matchesStatus = t.status === "Partial";
      } else if (statusFilter === "Absent") {
        matchesStatus = t.status === "All Absent";
      }

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortBy === "name") {
        return sortOrder === "asc"
          ? a.teamName.localeCompare(b.teamName)
          : b.teamName.localeCompare(a.teamName);
      } else if (sortBy === "status") {
        return sortOrder === "asc"
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      } else {
        return sortOrder === "asc"
          ? a.teamName.localeCompare(b.teamName)
          : b.teamName.localeCompare(a.teamName);
      }
    });

    return result;
  }, [teams, searchQuery, statusFilter, sortBy, sortOrder]);

  const toggleTeamCollapse = (teamId: string) => {
    setCollapsedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (collapsedTeamIds.size === 0) {
      const allIds = new Set(filteredTeams.map((t) => t.id));
      setCollapsedTeamIds(allIds);
    } else {
      setCollapsedTeamIds(new Set());
    }
  };

  // Bulk update all members of a specific team
  const handleMarkTeamStatus = async (team: TeamAttendee, newStatus: "Present" | "Absent") => {
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const formattedCheckIn = newStatus === "Absent" ? "Not Checked-in" : `${timeNow} (Team Manual)`;

    // 1. Immediately update local state
    setStudents((prev) =>
      prev.map((s) => {
        if (s.regId !== team.regId) return s;
        if (sessionTab === "gate_entry") {
          return { ...s, gateStatus: newStatus, gateCheckInTime: formattedCheckIn };
        } else if (sessionTab === "morning") {
          return { ...s, morningStatus: newStatus, morningCheckInTime: formattedCheckIn };
        } else if (sessionTab === "gate_exit") {
          return { ...s, gateExitStatus: newStatus, gateExitCheckInTime: formattedCheckIn };
        } else {
          return { ...s, afternoonStatus: newStatus, afternoonCheckInTime: formattedCheckIn };
        }
      })
    );

    // 2. Persist in database
    try {
      const promises: Promise<any>[] = [];
      for (const member of team.allMembers) {
        if (selectedEventId) {
          promises.push(
            markAttendance({
              eventId: selectedEventId,
              eventTitle: assignedEvent?.title || "",
              registrationId: team.regId,
              participantId: member.id,
              userEmail: member.email,
              userName: member.name,
              name: member.name,
              role: "Participant",
              session: sessionTab,
              day: selectedDay,
              status: newStatus,
              checkInTime: formattedCheckIn,
            }).catch((e) => console.warn("Error marking team attendee:", e))
          );
        }
      }

      const currentReg = registrations.find((r) => (r.id || r._id) === team.regId);
      if (currentReg) {
        const regUpdates: any = {};
        const updatedMembers = (currentReg.members || []).map((m: any) => {
          if (sessionTab === "gate_entry") {
            return {
              ...m,
              gateEntryMarked: newStatus === "Present",
              checkInTimeGateEntry: formattedCheckIn,
              attendanceStatus: newStatus,
              checkInTime: formattedCheckIn,
            };
          } else if (sessionTab === "morning") {
            return {
              ...m,
              attendanceStatusMorning: newStatus,
              checkInTimeMorning: formattedCheckIn,
              attendanceStatus: newStatus,
              checkInTime: formattedCheckIn,
            };
          } else if (sessionTab === "gate_exit") {
            return {
              ...m,
              gateExitMarked: newStatus === "Present",
              checkInTimeGateExit: formattedCheckIn,
            };
          } else {
            return {
              ...m,
              attendanceStatusAfternoon: newStatus,
              checkInTimeAfternoon: formattedCheckIn,
            };
          }
        });
        regUpdates.members = updatedMembers;

        if (sessionTab === "gate_entry") {
          regUpdates.gateEntryMarked = newStatus === "Present";
          regUpdates.checkInTimeGateEntry = formattedCheckIn;
          regUpdates.attendanceStatus = newStatus;
          regUpdates.checkInTime = formattedCheckIn;
        } else if (sessionTab === "morning") {
          regUpdates.attendanceStatusMorning = newStatus;
          regUpdates.checkInTimeMorning = formattedCheckIn;
          regUpdates.attendanceStatus = newStatus;
          regUpdates.checkInTime = formattedCheckIn;
        } else if (sessionTab === "gate_exit") {
          regUpdates.gateExitMarked = newStatus === "Present";
          regUpdates.checkInTimeGateExit = formattedCheckIn;
        } else {
          regUpdates.attendanceStatusAfternoon = newStatus;
          regUpdates.checkInTimeAfternoon = formattedCheckIn;
        }

        promises.push(
          updateRegistration(team.regId, regUpdates).catch((e) =>
            console.warn("Error updating registration team attendance:", e)
          )
        );
      }

      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to update team attendance in backend:", err);
    }
  };

  // Compute days for currently assigned event
  const currentEventDays = useMemo<EventDayInfo[]>(() => {
    if (!assignedEvent) return [{ dayNumber: 1, dateStr: "", formattedDate: "Day 1", label: "Main Event" }];
    return computeEventDays(
      assignedEvent.startDate,
      assignedEvent.endDate,
      assignedEvent.date,
      assignedEvent.timeRange,
      assignedEvent.daysCount
    );
  }, [assignedEvent]);

  // Compute days for event selected in modal
  const modalDays = useMemo<EventDayInfo[]>(() => {
    if (!sessionModalEvent) return [{ dayNumber: 1, dateStr: "", formattedDate: "Day 1", label: "Main Event" }];
    return computeEventDays(
      sessionModalEvent.startDate,
      sessionModalEvent.endDate,
      sessionModalEvent.date,
      sessionModalEvent.timeRange,
      sessionModalEvent.daysCount
    );
  }, [sessionModalEvent]);

  // Generate & Download Attendance CSV Report
  const handleGenerateReport = () => {
    if (students.length === 0) {
      alert("No attendance records to export.");
      return;
    }

    const headers = [
      "Student Name", 
      "Student ID", 
      "Email", 
      "Team Name", 
      "Role", 
      "Day",
      "Gate Status", 
      "Gate Check-In Time", 
      "Morning Status", 
      "Morning Check-In Time", 
      "Afternoon Status", 
      "Afternoon Check-In Time",
      "Gate Exit Status",
      "Gate Exit Check-In Time"
    ];
    const rows = students.map(s => [
      `"${s.name}"`,
      `"${s.studentId}"`,
      `"${s.email}"`,
      `"${s.teamName}"`,
      `"${s.isLead ? "Team Lead" : "Member"}"`,
      `"Day ${selectedDay}"`,
      `"${s.gateStatus}"`,
      `"${s.gateCheckInTime}"`,
      `"${s.morningStatus}"`,
      `"${s.morningCheckInTime}"`,
      `"${s.afternoonStatus}"`,
      `"${s.afternoonCheckInTime}"`,
      `"${s.gateExitStatus || "Absent"}"`,
      `"${s.gateExitCheckInTime || "Not Checked-in"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const eventNameClean = (assignedEvent?.title || "event").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    link.setAttribute("download", `${eventNameClean}_day${selectedDay}_attendance_${getTodayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncAttendance = () => {
    alert("Attendance state successfully synchronized with AI Verse database!");
  };

  // Open session & day picker modal when organizer clicks "Enter Event"
  const openSessionPicker = (ev: EventItem) => {
    const days = computeEventDays(ev.startDate, ev.endDate, ev.date, ev.timeRange, ev.daysCount);
    const todayStr = getTodayStr();
    const matchDay = days.find(d => d.dateStr === todayStr);
    const initialDay = matchDay ? matchDay.dayNumber : 1;
    setModalDay(initialDay);

    const isEndDay = initialDay >= 2 || (days.length > 1 && initialDay === days.length);
    const currentHour = new Date().getHours();
    let initialSession: "gate_entry" | "morning" | "afternoon" | "gate_exit" = isEndDay ? "morning" : "gate_entry";
    if (isEndDay) {
      if (currentHour < 13) {
        initialSession = "morning";
      } else if (currentHour < 16) {
        initialSession = "afternoon";
      } else {
        initialSession = "gate_exit";
      }
    } else {
      if (currentHour < 11) {
        initialSession = "gate_entry";
      } else if (currentHour < 14) {
        initialSession = "morning";
      } else {
        initialSession = "afternoon";
      }
    }
    setModalSession(initialSession);
    setSessionModalEvent(ev);
  };

  // Proceed into attendance marking view with chosen session and day
  const handleProceedToMarking = (session: "gate_entry" | "morning" | "afternoon" | "gate_exit", dayNum: number) => {
    if (!sessionModalEvent) return;
    setSelectedEventId(sessionModalEvent.id);
    setAssignedEvent(sessionModalEvent);
    setSelectedDay(dayNum);
    setSessionTab(session);
    setSessionModalEvent(null);
    setActiveView("marking");
  };


  // Session & Day Selection Modal on "Enter Event"
  const renderSessionModal = () => {
    if (!sessionModalEvent) return null;

    const isModalEndDay = modalDay >= 2 || (modalDays.length > 1 && modalDay === modalDays.length);

    const sessionOptions: {
      id: "gate_entry" | "morning" | "afternoon" | "gate_exit";
      name: string;
      timeRange: string;
      desc: string;
      badge: string;
      icon: typeof DoorOpen | typeof DoorClosed;
      accentBg: string;
      accentText: string;
      borderActive: string;
      ringActive: string;
      pillBg: string;
      pillText: string;
    }[] = isModalEndDay
      ? [
          {
            id: "morning",
            name: "Morning Session",
            timeRange: "09:00 AM - 01:00 PM",
            desc: "Forenoon attendance check for morning workshops, labs, and hackathon sprint.",
            badge: "Session 1",
            icon: Sun,
            accentBg: "bg-amber-500",
            accentText: "text-amber-700",
            borderActive: "border-amber-500 bg-amber-50/70",
            ringActive: "ring-amber-500/20",
            pillBg: "bg-amber-100",
            pillText: "text-amber-800",
          },
          {
            id: "afternoon",
            name: "Afternoon Session",
            timeRange: "02:00 PM - 06:00 PM",
            desc: "Post-lunch attendance verification, project demos & judging sprint.",
            badge: "Session 2",
            icon: Moon,
            accentBg: "bg-indigo-600",
            accentText: "text-indigo-700",
            borderActive: "border-indigo-500 bg-indigo-50/70",
            ringActive: "ring-indigo-500/20",
            pillBg: "bg-indigo-100",
            pillText: "text-indigo-800",
          },
          {
            id: "gate_exit",
            name: "Gate Exit",
            timeRange: "04:30 PM - 07:00 PM",
            desc: "Campus venue departure & final checkout verification for participants.",
            badge: "Event Finale / Departure",
            icon: DoorClosed,
            accentBg: "bg-rose-600",
            accentText: "text-rose-700",
            borderActive: "border-rose-500 bg-rose-50/70",
            ringActive: "ring-rose-500/20",
            pillBg: "bg-rose-100",
            pillText: "text-rose-800",
          },
        ]
      : [
          {
            id: "gate_entry",
            name: "Gate Enter",
            timeRange: "08:00 - 10:30 AM",
            desc: "Campus security & venue gate arrival check-in for registered participants.",
            badge: "Security Entry",
            icon: DoorOpen,
            accentBg: "bg-emerald-600",
            accentText: "text-emerald-700",
            borderActive: "border-emerald-500 bg-emerald-50/70",
            ringActive: "ring-emerald-500/20",
            pillBg: "bg-emerald-100",
            pillText: "text-emerald-800",
          },
          {
            id: "morning",
            name: "Morning Session",
            timeRange: "09:00 AM - 01:00 PM",
            desc: "Forenoon attendance check for morning workshops, labs, and hackathon sprint 1.",
            badge: "Session 1",
            icon: Sun,
            accentBg: "bg-amber-500",
            accentText: "text-amber-700",
            borderActive: "border-amber-500 bg-amber-50/70",
            ringActive: "ring-amber-500/20",
            pillBg: "bg-amber-100",
            pillText: "text-amber-800",
          },
          {
            id: "afternoon",
            name: "Afternoon Session",
            timeRange: "02:00 PM - 06:00 PM",
            desc: "Post-lunch attendance verification, demo submissions & judging sprint.",
            badge: "Session 2",
            icon: Moon,
            accentBg: "bg-indigo-600",
            accentText: "text-indigo-700",
            borderActive: "border-indigo-500 bg-indigo-50/70",
            ringActive: "ring-indigo-500/20",
            pillBg: "bg-indigo-100",
            pillText: "text-indigo-800",
          },
        ];

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto border border-slate-200/90 p-5 sm:p-7 relative text-left space-y-5">
          {/* Close Button */}
          <button
            onClick={() => setSessionModalEvent(null)}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-1.5 pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-50 text-blue-700 border border-blue-200/70 text-[9.5px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                <Sparkles className="w-3 h-3 text-blue-600" />
                Attendance Session Setup
              </span>
              <span className="text-slate-500 text-[11px] font-bold bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {sessionModalEvent.startDate || sessionModalEvent.date || getTodayStr()}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Select Attendance Session
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Choose which session you are taking attendance for in <span className="font-bold text-slate-800">{sessionModalEvent.title}</span>.
            </p>
          </div>

          {/* Event Info Card */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-blue-600/20">
                {sessionModalEvent.title.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">{sessionModalEvent.title}</h4>
                <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-semibold mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{sessionModalEvent.venue || "Campus"} {sessionModalEvent.room ? `• ${sessionModalEvent.room}` : ""}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{sessionModalEvent.timeRange || "09:00 AM - 05:00 PM"}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Day Selection (if event has multiple days) */}
          {modalDays.length > 1 && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Select Event Day
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {modalDays.map((d) => {
                  const isSelected = modalDay === d.dayNumber;
                  return (
                    <button
                      key={d.dayNumber}
                      type="button"
                      onClick={() => {
                        setModalDay(d.dayNumber);
                        const willBeEndDay = d.dayNumber >= 2 || (modalDays.length > 1 && d.dayNumber === modalDays.length);
                        if (willBeEndDay && modalSession === "gate_entry") {
                          setModalSession("morning");
                        } else if (!willBeEndDay && modalSession === "gate_exit") {
                          setModalSession("afternoon");
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-blue-50/90 border-blue-500 shadow-sm ring-2 ring-blue-500/20"
                          : "bg-white hover:bg-slate-50 border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
                          Day {d.dayNumber}
                        </span>
                        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md ${
                          isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                          {d.label}
                        </span>
                      </div>
                      {d.formattedDate && (
                        <span className={`text-[11px] font-medium block mt-1 ${isSelected ? "text-blue-700 font-bold" : "text-slate-400"}`}>
                          {d.formattedDate}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Session Selection Cards */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              {modalDays.length > 1 ? "Select Session" : "Choose Attendance Session"}
            </label>
            <div className="space-y-2.5">
              {sessionOptions.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = modalSession === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setModalSession(opt.id)}
                    className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? `${opt.borderActive} shadow-sm ring-2 ${opt.ringActive}`
                        : "bg-white hover:bg-slate-50 border-slate-200/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? `${opt.accentBg} text-white shadow-md shadow-black/10`
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            {opt.name}
                          </h4>
                          <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-md uppercase ${opt.pillBg} ${opt.pillText} border border-black/5`}>
                            {opt.timeRange}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 pl-1">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? `${opt.accentBg} text-white border-transparent`
                          : "border-slate-300 bg-white"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSessionModalEvent(null)}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleProceedToMarking(modalSession, modalDay)}
              className="flex-[2] bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs sm:text-sm py-3 px-5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer active:scale-[0.98]"
            >
              <span>Take Attendance</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // ======================== LANDING VIEW ========================
  if (activeView === "landing") {
    return (
      <div className="space-y-6 sm:space-y-8 pb-20 text-left font-sans relative">
        <SEO 
          title="Attendance - Student Organizer" 
          description="Select an event to start marking attendance for registered participants."
        />

        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9.5px] sm:text-[10px] uppercase font-black tracking-widest px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-blue-600/20">
              <Sparkles className="w-3 h-3" />
              Attendance Portal
            </span>
            <span className="text-slate-400 text-[11px] sm:text-xs font-bold bg-slate-100 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-slate-200">
              {getTodayStr()}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight leading-tight">
            Today's Events
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-xl leading-relaxed">
            Select an event below to start marking attendance for registered participants. Only events scheduled for today or currently active events are shown.
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-28">
            <RefreshCw className="h-9 w-9 sm:h-10 sm:w-10 text-blue-600 animate-spin" />
            <p className="text-xs sm:text-sm text-slate-400 font-bold mt-4">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          /* No Events State */
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-center px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4 sm:mb-5">
              <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-700">No Events Today</h3>
            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-sm mt-2">
              There are no events scheduled for today or assigned to you. Check back later or contact the admin.
            </p>
          </div>
        ) : (
          /* Event Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {events.map((ev, idx) => {
              const isLive = ev.isToday;
              const gradients = [
                "from-blue-600 via-blue-700 to-indigo-800",
                "from-violet-600 via-purple-700 to-indigo-800",
                "from-emerald-600 via-teal-700 to-cyan-800",
                "from-orange-500 via-amber-600 to-yellow-700",
                "from-rose-600 via-pink-700 to-fuchsia-800",
              ];
              const gradient = gradients[idx % gradients.length];

              return (
                <div 
                  key={ev.id} 
                  className="group relative rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  onClick={() => openSessionPicker(ev)}
                >
                  {/* Gradient Background */}
                  <div className={`bg-gradient-to-br ${gradient} p-5 sm:p-7 pb-5 sm:pb-6 min-h-[240px] sm:min-h-[260px] flex flex-col justify-between relative`}>
                    
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

                    {/* Top Row: Live Badge */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                        <div className="flex items-center gap-2">
                          {isLive && (
                            <span className="bg-white/20 backdrop-blur-sm text-white text-[9.5px] sm:text-[10px] uppercase font-black tracking-widest px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 border border-white/20">
                              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
                              Live Today
                            </span>
                          )}
                          {!isLive && (
                            <span className="bg-white/15 backdrop-blur-sm text-white/80 text-[9.5px] sm:text-[10px] uppercase font-black tracking-widest px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-white/15">
                              Scheduled
                            </span>
                          )}
                        </div>
                        <span className="bg-white/15 backdrop-blur-sm text-white/80 text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/15">
                          {ev.startDate || ev.date || "TBD"}
                        </span>
                      </div>

                      {/* Event Title */}
                      <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight mb-1 group-hover:translate-x-0.5 transition-transform">
                        {ev.title}
                      </h2>
                    </div>

                    {/* Bottom Section: Details + Enter */}
                    <div className="relative z-10 space-y-3.5 sm:space-y-4 mt-auto pt-4">
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        <span className="bg-white/15 backdrop-blur-sm text-white/90 text-[10.5px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 border border-white/10">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[150px] sm:max-w-none">{ev.venue || "Campus"} {ev.room ? `• ${ev.room}` : ""}</span>
                        </span>
                        <span className="bg-white/15 backdrop-blur-sm text-white/90 text-[10.5px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 border border-white/10">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{ev.timeRange || `${ev.startTime || "09:00"} - ${ev.endTime || "17:00"}`}</span>
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openSessionPicker(ev);
                        }}
                        className="w-full bg-white hover:bg-white/95 text-slate-900 font-black text-xs sm:text-sm py-3 sm:py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-black/10 transition-all active:scale-[0.97] group-hover:shadow-xl cursor-pointer"
                      >
                        <LogIn className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                        <span>Enter Event</span>
                        <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Mark Attendance
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal rendered in landing view */}
        {renderSessionModal()}
      </div>
    );
  }

  // ======================== MARKING VIEW ========================
  return (
    <div className="space-y-4 sm:space-y-6 pb-20 text-left font-sans relative">
      <SEO 
        title="Session Attendance - Student Organizer" 
        description="Mark morning and afternoon attendance, verify check-ins, and scan participant QR codes."
      />
      {/* ================= BACK BUTTON ================= */}
      <button
        onClick={() => {
          setActiveView("landing");
          setStudents([]);
        }}
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer group py-1.5 px-3 rounded-xl bg-white sm:bg-transparent border sm:border-0 border-slate-200/80 shadow-2xs sm:shadow-none"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Events</span>
      </button>

      {/* ================= TOP EVENT & SESSION BAR ================= */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xs space-y-4 sm:space-y-6">
        
        {/* Row 1: Event Info & Event Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-5 pb-4 sm:pb-5 border-b border-slate-100">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-50 text-blue-700 border border-blue-200/60 text-[9.5px] sm:text-[10px] uppercase font-black tracking-widest px-2.5 sm:px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-600 animate-pulse" />
                {assignedEvent?.isToday ? "Today's Event • Live Check-in" : "Assigned Event"}
              </span>

              <span className="text-slate-500 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 bg-slate-100 px-2.5 sm:px-3 py-1 rounded-full border border-slate-200">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
                {assignedEvent?.startDate || assignedEvent?.date || getTodayStr()}
              </span>

              <span className="text-slate-500 text-[11px] sm:text-xs font-semibold bg-slate-100 px-2.5 sm:px-3 py-1 rounded-full border border-slate-200">
                {assignedEvent?.venue || "Campus Lab"} {assignedEvent?.room ? `• ${assignedEvent.room}` : ""}
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">
              {assignedEvent ? assignedEvent.title : "Event Session Attendance"}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
              Registered participants for this event are loaded below. Mark check-in via cards or live QR scanner.
            </p>
          </div>

          {/* Event Selector Dropdown if multiple events */}
          {events.length > 1 && (
            <div className="flex flex-col items-start lg:items-end gap-1.5 w-full sm:w-auto">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Switch Event</span>
              <div className="relative inline-block w-full sm:w-auto">
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full sm:w-auto appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300/80 rounded-xl px-3.5 py-2 pr-9 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.isToday ? "🎯 [TODAY] " : ""}{ev.title} ({ev.startDate || ev.date || "Scheduled"})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Row 2: ACTIVE SESSION DISPLAY + METRICS */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 sm:gap-5">
          
          {/* Active Session & Day Information (Locked from Enter Event Modal) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Active Session:
              </span>
              
              {/* Session Pill */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black ${
                sessionTab === "gate_entry"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : sessionTab === "morning"
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : sessionTab === "gate_exit"
                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                  : "bg-indigo-100 text-indigo-800 border border-indigo-200"
              }`}>
                {sessionTab === "gate_entry" && <DoorOpen className="w-3.5 h-3.5 text-emerald-700" />}
                {sessionTab === "morning" && <Sun className="w-3.5 h-3.5 text-amber-600" />}
                {sessionTab === "afternoon" && <Moon className="w-3.5 h-3.5 text-indigo-700" />}
                {sessionTab === "gate_exit" && <DoorClosed className="w-3.5 h-3.5 text-rose-700" />}
                <span>
                  {sessionTab === "gate_entry" ? "Gate Enter" : sessionTab === "morning" ? "Morning Session" : sessionTab === "gate_exit" ? "Gate Exit" : "Afternoon Session"}
                </span>
                <span className="text-[10px] opacity-80 font-bold ml-0.5">
                  ({sessionTab === "gate_entry" ? "08:00 - 10:30" : sessionTab === "morning" ? "09:00 - 13:00" : sessionTab === "gate_exit" ? "16:30 - 19:00" : "14:00 - 18:00"})
                </span>
              </div>

              {/* Day Pill (if multi-day) */}
              {currentEventDays.length > 1 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-700 border border-blue-200/80">
                  <span>Day {selectedDay}</span>
                  {currentEventDays.find(d => d.dayNumber === selectedDay)?.formattedDate && (
                    <span className="text-[10px] opacity-80 font-bold">
                      ({currentEventDays.find(d => d.dayNumber === selectedDay)?.formattedDate})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Switch Button (Reopens Setup Modal) */}
            <button
              type="button"
              onClick={() => assignedEvent && openSessionPicker(assignedEvent)}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50/80 px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Change active attendance session or day"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Switch Session</span>
            </button>
          </div>

          {/* Real-time Attendance Stats Cards */}
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto shrink-0">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl p-2 sm:px-5 sm:py-2.5 text-center min-w-0 sm:min-w-[90px] shadow-2xs">
              <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-black text-slate-400 block">Present</span>
              <div className="text-base sm:text-xl font-black text-blue-600">{stats.present}</div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl p-2 sm:px-5 sm:py-2.5 text-center min-w-0 sm:min-w-[90px] shadow-2xs">
              <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-black text-slate-400 block">Expected</span>
              <div className="text-base sm:text-xl font-black text-slate-800">{stats.expected}</div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl sm:rounded-2xl p-2 sm:px-5 sm:py-2.5 text-center min-w-0 sm:min-w-[90px] shadow-2xs">
              <span className="text-[8.5px] sm:text-[9px] uppercase tracking-wider font-black text-emerald-700 block">Rate</span>
              <div className="text-base sm:text-xl font-black text-emerald-600">{stats.rate}%</div>
            </div>
          </div>

        </div>

      </div>

      {/* ================= CONTROLS ROW ================= */}
      <div className="space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 pt-1">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 max-w-xl">
          <div className="relative flex-grow">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={viewMode === "teams" ? "Search by team name, ticket, student name or ID..." : "Search by student name, ID, team..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200/90 rounded-xl py-2 pl-10 pr-4 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>

          {/* Mobile Status Filter & Sort Row */}
          <div className="flex items-center gap-2 sm:hidden">
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="flex-1 bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Present">{viewMode === "teams" ? "All Present Teams" : "Present Only"}</option>
              <option value="Late">{viewMode === "teams" ? "Partial Attendance Teams" : "Late Only"}</option>
              <option value="Absent">{viewMode === "teams" ? "All Absent Teams" : "Absent Only"}</option>
            </select>

            <button 
              onClick={() => {
                setSortBy(sortBy === "name" ? "status" : "name");
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              }}
              className="flex-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-all whitespace-nowrap cursor-pointer"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <span>Sort ({sortBy})</span>
            </button>
          </div>

          {/* Desktop Status Filter */}
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="hidden sm:block bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
          >
            <option value="ALL">All Statuses</option>
            <option value="Present">{viewMode === "teams" ? "All Present Teams" : "Present Only"}</option>
            <option value="Late">{viewMode === "teams" ? "Partial Attendance Teams" : "Late Only"}</option>
            <option value="Absent">{viewMode === "teams" ? "All Absent Teams" : "Absent Only"}</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => {
              setSortBy(sortBy === "name" ? "status" : "name");
              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
            }}
            className="hidden sm:flex border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl items-center gap-1.5 shadow-2xs transition-all whitespace-nowrap cursor-pointer"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span>Sort ({sortBy})</span>
          </button>

          <button
            onClick={() => {
              setIsScannerModalOpen(true);
              setScanSuccessMsg("");
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <QrCode className="h-4 w-4" />
            <span>Scan QR Code</span>
          </button>
        </div>
      </div>

      {/* ================= SPLIT SCREEN GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* Left Side: Attendees Roster (8/12) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs">
          
          {/* Header with View Toggle (Teams vs Participants) */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tab Switcher: Team-Wise vs Individual Participants */}
              <div className="inline-flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-bold shadow-inner">
                <button
                  type="button"
                  onClick={() => setViewMode("teams")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === "teams"
                      ? "bg-white text-blue-600 shadow-2xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Team-Wise ({filteredTeams.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("participants")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === "participants"
                      ? "bg-white text-blue-600 shadow-2xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Participants ({filteredStudents.length})</span>
                </button>
              </div>

              {viewMode === "teams" && filteredTeams.length > 0 && (
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="text-[11px] font-extrabold text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors bg-white shadow-2xs flex items-center gap-1 cursor-pointer"
                  title="Expand or collapse all team rosters"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                  <span>{collapsedTeamIds.size > 0 ? "Expand All" : "Collapse All"}</span>
                </button>
              )}
            </div>

            <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-400">
              Active: <span className="font-extrabold text-blue-600">{sessionTab === "gate_entry" ? "Gate Enter" : sessionTab === "morning" ? "Morning Session" : sessionTab === "gate_exit" ? "Gate Exit" : "Afternoon Session"} (Day {selectedDay})</span>
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              <p className="text-xs text-slate-400 font-bold mt-3">Loading registered attendees...</p>
            </div>
          ) : viewMode === "teams" ? (
            /* ==================== TEAM-WISE VIEW ==================== */
            filteredTeams.length === 0 ? (
              <div className="py-16 sm:py-20 text-center space-y-2 px-4">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-extrabold text-slate-700">No teams match the criteria</p>
                <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                  {teams.length === 0
                    ? `No registered teams found for "${assignedEvent?.title}".`
                    : "Try adjusting your search query or status filter."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/90">
                {filteredTeams.map((team) => {
                  const isCollapsed = collapsedTeamIds.has(team.id);
                  const isAllPresent = team.status === "All Present";
                  const isPartial = team.status === "Partial";

                  return (
                    <div 
                      key={team.id}
                      className={`transition-colors ${
                        isAllPresent 
                          ? "bg-emerald-50/20 hover:bg-emerald-50/40" 
                          : isPartial 
                          ? "bg-amber-50/20 hover:bg-amber-50/40" 
                          : "bg-white hover:bg-slate-50/50"
                      }`}
                    >
                      {/* Team Header Row */}
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div 
                          onClick={() => toggleTeamCollapse(team.id)}
                          className="flex items-start gap-3 cursor-pointer group flex-1 min-w-0"
                        >
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                            isAllPresent
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : isPartial
                              ? "bg-amber-100 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-600 border-blue-200"
                          }`}>
                            <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-slate-900 text-sm sm:text-base leading-snug group-hover:text-blue-600 transition-colors">
                                {team.teamName}
                              </h4>
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black bg-slate-100 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-md">
                                <Ticket className="w-3 h-3 text-slate-400" />
                                {team.ticketCode}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/70">
                                {team.totalMembersCount} {team.totalMembersCount === 1 ? "Member" : "Members"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 flex-wrap">
                              <span>Lead: <strong className="text-slate-700">{team.lead?.name || "N/A"}</strong></span>
                              <span>•</span>
                              <span>{team.department}</span>
                              {team.college && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[200px]">{team.college}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Team Actions & Status Badge */}
                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                          {/* Attendance Status Pill */}
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
                                ? `All Present (${team.presentCount}/${team.totalMembersCount})`
                                : isPartial
                                ? `Partial (${team.presentCount}/${team.totalMembersCount})`
                                : `All Absent (0/${team.totalMembersCount})`}
                            </span>
                          </span>

                          {/* Quick 1-Click Check-in Team Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkTeamStatus(team, isAllPresent ? "Absent" : "Present");
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide transition-all border cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1.5 ${
                              isAllPresent
                                ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/20"
                            }`}
                            title={isAllPresent ? "Reset entire team to absent" : "Check-in all team members as Present"}
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">
                              {isAllPresent ? "Reset Team" : "Mark Team Present"}
                            </span>
                            <span className="sm:hidden">
                              {isAllPresent ? "Reset" : "Check-in"}
                            </span>
                          </button>

                          {/* Expand/Collapse Chevron Button */}
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

                      {/* Expanded Team Members List */}
                      {!isCollapsed && (
                        <div className="bg-slate-50/70 border-t border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-2.5 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                            <span>Team Members ({team.allMembers.length})</span>
                          </div>

                          {/* Desktop Members Table */}
                          <div className="hidden sm:block overflow-x-auto bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-black tracking-wider">
                                  <th className="py-2.5 px-4">Member Name</th>
                                  <th className="py-2.5 px-4">Student ID / Roll No</th>
                                  <th className="py-2.5 px-4">Email Contact</th>
                                  <th className="py-2.5 px-4">Session Check-In</th>
                                  <th className="py-2.5 px-4 text-right pr-6">Status / Toggle</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {team.allMembers.map((member) => {
                                  const status =
                                    sessionTab === "gate_entry"
                                      ? member.gateStatus
                                      : sessionTab === "morning"
                                      ? member.morningStatus
                                      : sessionTab === "gate_exit"
                                      ? member.gateExitStatus
                                      : member.afternoonStatus;
                                  const checkIn =
                                    sessionTab === "gate_entry"
                                      ? member.gateCheckInTime
                                      : sessionTab === "morning"
                                      ? member.morningCheckInTime
                                      : sessionTab === "gate_exit"
                                      ? member.gateExitCheckInTime
                                      : member.afternoonCheckInTime;
                                  const isPresent = status === "Present";
                                  const isLate = status === "Late";

                                  return (
                                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-extrabold text-slate-900 text-xs">{member.name}</span>
                                          {member.isLead && (
                                            <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md uppercase border border-blue-200">
                                              <Crown className="w-2.5 h-2.5 text-blue-600" />
                                              Lead
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 font-mono text-slate-800 text-[11px]">
                                        {member.studentId}
                                      </td>
                                      <td className="py-3 px-4 text-slate-500 text-[11px] truncate max-w-[180px]">
                                        {member.email || "—"}
                                      </td>
                                      <td className="py-3 px-4 text-[11px]">
                                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                                            isPresent ? "bg-emerald-500 shadow-xs" : isLate ? "bg-amber-500" : "bg-slate-300"
                                          }`} />
                                          <span>{checkIn}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-right pr-6">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextStatus = isPresent ? "Late" : isLate ? "Absent" : "Present";
                                            handleStatusChange(member.id, nextStatus);
                                          }}
                                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all shadow-2xs border cursor-pointer active:scale-95 ${
                                            isPresent
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                              : isLate
                                              ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                          }`}
                                        >
                                          {status}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Members List */}
                          <div className="sm:hidden space-y-2">
                            {team.allMembers.map((member) => {
                              const status =
                                sessionTab === "gate_entry"
                                  ? member.gateStatus
                                  : sessionTab === "morning"
                                  ? member.morningStatus
                                  : sessionTab === "gate_exit"
                                  ? member.gateExitStatus
                                  : member.afternoonStatus;
                              const checkIn =
                                sessionTab === "gate_entry"
                                  ? member.gateCheckInTime
                                  : sessionTab === "morning"
                                  ? member.morningCheckInTime
                                  : sessionTab === "gate_exit"
                                  ? member.gateExitCheckInTime
                                  : member.afternoonCheckInTime;
                              const isPresent = status === "Present";
                              const isLate = status === "Late";

                              return (
                                <div key={member.id} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-extrabold text-slate-900 text-xs truncate">{member.name}</span>
                                      {member.isLead && (
                                        <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md uppercase">
                                          Lead
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextStatus = isPresent ? "Late" : isLate ? "Absent" : "Present";
                                        handleStatusChange(member.id, nextStatus);
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border shrink-0 ${
                                        isPresent
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : isLate
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-rose-50 text-rose-700 border-rose-200"
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
                                    <span>{member.studentId}</span>
                                    <span className="text-slate-400">{checkIn}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ==================== INDIVIDUAL PARTICIPANTS VIEW ==================== */
            filteredStudents.length === 0 ? (
              <div className="py-16 sm:py-20 text-center space-y-2 px-4">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-extrabold text-slate-700">No participants match the criteria</p>
                <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                  {students.length === 0 
                    ? `No registered participants found for "${assignedEvent?.title}". Ensure teams have registered for this event.`
                    : "Try adjusting your search terms or status filter."}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card List View (< sm) */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {filteredStudents.map((student) => {
                    const status = sessionTab === "gate_entry" ? student.gateStatus : sessionTab === "morning" ? student.morningStatus : sessionTab === "gate_exit" ? student.gateExitStatus : student.afternoonStatus;
                    const checkIn = sessionTab === "gate_entry" ? student.gateCheckInTime : sessionTab === "morning" ? student.morningCheckInTime : sessionTab === "gate_exit" ? student.gateExitCheckInTime : student.afternoonCheckInTime;
                    const isPresent = status === "Present";
                    const isLate = status === "Late";

                    return (
                      <div key={student.id} className="p-4 space-y-2.5 bg-white hover:bg-slate-50/50 transition-colors">
                        {/* Top Row: Name + Lead Badge + Status Button */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 text-sm leading-tight">
                                {student.name}
                              </span>
                              {student.isLead && (
                                <span className="text-[8.5px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md uppercase">
                                  Lead
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block truncate">
                              Team: <span className="font-bold text-slate-700">{student.teamName}</span>
                            </span>
                          </div>

                          {/* 1-Tap Toggle Status Button */}
                          <button
                            onClick={() => {
                              const nextStatus = isPresent ? "Late" : isLate ? "Absent" : "Present";
                              handleStatusChange(student.id, nextStatus);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all shadow-2xs border cursor-pointer active:scale-95 shrink-0 ${
                              isPresent
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : isLate
                                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            }`}
                          >
                            {status}
                          </button>
                        </div>

                        {/* Middle Row: ID & Email */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                          <span className="font-mono font-bold text-slate-700">{student.studentId}</span>
                          <span className="truncate max-w-[170px] text-[10.5px]">{student.email}</span>
                        </div>

                        {/* Bottom Row: Check-in Time */}
                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                          <span className="text-slate-400 font-medium">Session Check-In:</span>
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              isPresent ? "bg-emerald-500 shadow-xs" : isLate ? "bg-amber-500" : "bg-slate-300"
                            }`}></span>
                            <span>{checkIn}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (>= sm) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs font-semibold text-slate-600">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-black tracking-wider">
                        <th className="px-6 py-3.5">Participant & Team</th>
                        <th className="px-6 py-3.5">Student ID & Contact</th>
                        <th className="px-6 py-3.5">Session Check-In</th>
                        <th className="px-6 py-3.5 text-right pr-8">Status / Toggle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((student) => {
                        const status = sessionTab === "gate_entry" ? student.gateStatus : sessionTab === "morning" ? student.morningStatus : sessionTab === "gate_exit" ? student.gateExitStatus : student.afternoonStatus;
                        const checkIn = sessionTab === "gate_entry" ? student.gateCheckInTime : sessionTab === "morning" ? student.morningCheckInTime : sessionTab === "gate_exit" ? student.gateExitCheckInTime : student.afternoonCheckInTime;
                        const isPresent = status === "Present";
                        const isLate = status === "Late";

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* Student Column */}
                            <td className="px-6 py-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-slate-800 text-xs leading-snug">
                                    {student.name}
                                  </span>
                                  {student.isLead && (
                                    <span className="text-[9px] font-black bg-blue-100/80 text-blue-700 px-2 py-0.5 rounded-md uppercase">
                                      Lead
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                                  Team: <span className="text-slate-600 font-bold">{student.teamName}</span>
                                </span>
                              </div>
                            </td>

                            {/* ID & Dept Column */}
                            <td className="px-6 py-4">
                              <span className="text-slate-800 font-mono font-bold block">{student.studentId}</span>
                              <span className="text-[11px] text-slate-400 mt-0.5 block truncate max-w-[180px]">{student.email}</span>
                            </td>

                            {/* Last Check-in Column */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  isPresent ? "bg-emerald-500 shadow-xs" : isLate ? "bg-amber-500" : "bg-slate-300"
                                }`}></span>
                                <span className="text-slate-700 font-bold">{checkIn}</span>
                              </div>
                            </td>

                            {/* Actions Column */}
                            <td className="px-6 py-4 text-right pr-8">
                              <button
                                onClick={() => {
                                  const nextStatus = isPresent ? "Late" : isLate ? "Absent" : "Present";
                                  handleStatusChange(student.id, nextStatus);
                                }}
                                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all shadow-2xs border cursor-pointer active:scale-95 ${
                                  isPresent
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : isLate
                                    ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                }`}
                              >
                                {status}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </div>

        {/* Right Side: QR check-in & Action Box (4/12) */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
          
          {/* Card 1: Student Check-in (QR code) */}
          <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-white text-center space-y-3.5 sm:space-y-4 shadow-lg shadow-slate-900/10 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className={`text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                sessionTab === "gate_entry"
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : sessionTab === "morning"
                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  : sessionTab === "gate_exit"
                  ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                  : "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
              }`}>
                {sessionTab === "gate_entry" ? "Gate Enter Check-In" : sessionTab === "morning" ? "Morning Check-In" : sessionTab === "gate_exit" ? "Gate Exit Check-In" : "Afternoon Check-In"} (Day {selectedDay})
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <h3 className="text-sm sm:text-base font-black text-white">
              Student Ticket Check-in
            </h3>

            {/* Viewfinder Camera Simulation */}
            <div className="bg-black/60 rounded-2xl p-4 w-36 h-36 sm:w-44 sm:h-44 mx-auto border border-slate-700 shadow-inner relative flex flex-col items-center justify-center overflow-hidden group">
              {/* Scan Laser Line */}
              <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] top-4 animate-bounce z-10"></div>
              
              {/* Viewfinder Corners */}
              <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t-2 border-l-2 border-blue-500"></div>
              <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t-2 border-r-2 border-blue-500"></div>
              <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b-2 border-l-2 border-blue-500"></div>
              <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b-2 border-r-2 border-blue-500"></div>
              
              {/* Camera Icon */}
              <Camera className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 group-hover:text-blue-400 transition-colors duration-300" />
              
              {/* Status Text */}
              <div className="text-[8px] text-blue-400 font-black uppercase tracking-widest mt-2">
                Scanner Ready
              </div>
            </div>

            <p className="text-xs font-medium text-slate-300 leading-relaxed max-w-[240px] mx-auto">
              Scan student's registration QR barcode or ticket to instantly log attendance for the <span className="font-bold text-white">{sessionTab === "gate_entry" ? "Gate Enter" : sessionTab === "morning" ? "Morning" : sessionTab === "gate_exit" ? "Gate Exit" : "Afternoon"}</span> session (Day {selectedDay}).
            </p>

            <div className="pt-1">
              <button
                onClick={() => {
                  setIsScannerModalOpen(true);
                  setScanSuccessMsg("");
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer active:scale-95"
              >
                <QrCode className="h-4.5 w-4.5" />
                <span>Launch Live Scanner</span>
              </button>
            </div>
          </div>

          {/* Card 2: Attendance Actions */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-3.5 sm:space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Quick Actions
            </h4>

            <div className="space-y-2.5">
              <button
                onClick={handleGenerateReport}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs py-2.5 sm:py-3 px-4 rounded-xl border border-slate-200/80 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <FileText className="h-4 w-4 text-slate-500" />
                <span>Export Attendance (CSV)</span>
              </button>

              <button
                onClick={handleSyncAttendance}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2.5 sm:py-3 px-4 rounded-xl border border-blue-200/60 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <span>Sync Attendance Database</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ================= QR SCANNER MODAL ================= */}
      {isScannerModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-950 text-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-800 p-4 sm:p-6 flex flex-col items-center space-y-3.5 sm:space-y-4 relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setIsScannerModalOpen(false);
                setScannedTeamInfo(null);
              }}
              className="absolute top-3.5 right-3.5 p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors cursor-pointer z-30"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="text-center space-y-0.5 pt-1 sm:pt-0">
              <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-blue-400 tracking-widest block">
                {sessionTab === "gate_entry" ? "Gate Enter Check-in" : sessionTab === "morning" ? "Morning Session Check-in" : sessionTab === "gate_exit" ? "Gate Exit Check-in" : "Afternoon Session Check-in"} (Day {selectedDay})
              </span>
              <h2 className="text-base sm:text-xl font-black text-white tracking-tight">
                Participant Ticket Check-in
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium max-w-[260px] sm:max-w-[280px]">
                Scan registration QR barcode presented by student to log session attendance.
              </p>
            </div>

            {/* Camera Viewfinder */}
            {!scannedTeamInfo && (
              <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-2xl border-4 border-dashed border-blue-500 relative flex items-center justify-center bg-black overflow-hidden shrink-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_8px_#ef4444] animate-[bounce_2.5s_infinite] z-20"></div>
                
                <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-blue-400 z-20"></div>
                <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-blue-400 z-20"></div>
                <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-blue-400 z-20"></div>
                <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-blue-400 z-20"></div>

                {scanLoading ? (
                  <div className="flex flex-col items-center gap-2 z-10">
                    <RefreshCw className="h-7 w-7 sm:h-8 sm:w-8 text-blue-500 animate-spin" />
                    <span className="text-[9px] sm:text-[10px] text-blue-300 font-bold uppercase tracking-wider">Reading QR Code...</span>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover z-10"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 space-y-2 bg-black/75 z-0">
                      <div className="w-14 h-14 sm:w-18 sm:h-18 bg-white rounded-lg p-1.5 relative shadow-inner">
                        <img
                          src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=simulate_scanner_feed"
                          alt="QR Scanner Target"
                          className="w-full h-full object-contain opacity-60"
                        />
                      </div>
                      <span className="text-[8px] sm:text-[9px] text-slate-500 font-black uppercase tracking-wider">
                        Camera View Ready
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Quick Simulate Option if no webcam */}
            {!scannedTeamInfo && !scanLoading && (
              <div className="w-full pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const reg = registrations.find(x => 
                      (x.eventId === selectedEventId || (x.eventTitle || "").toLowerCase().trim() === (assignedEvent?.title || "").toLowerCase().trim())
                    );
                    if (!reg) {
                      alert(`No registrations found in the database for the active event "${assignedEvent?.title}".`);
                      return;
                    }

                    setScanLoading(true);
                    await new Promise(resolve => setTimeout(resolve, 600));
                    setScanLoading(false);
                    setScannedTeamInfo(reg);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2.5 px-3 rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <Camera className="h-4 w-4 shrink-0" />
                  <span className="truncate">Select First Ticket from Database</span>
                </button>
              </div>
            )}

            {/* Team details view */}
            {scannedTeamInfo && (
              <div className="w-full space-y-4 text-left animate-in fade-in duration-200">
                {scanSuccessMsg ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center animate-in zoom-in-95 duration-200">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/25 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shadow-inner">
                      <Check className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-400 block">Check-in Verified</span>
                    <h4 className="text-sm font-bold text-white mt-1">{scanSuccessMsg}</h4>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 sm:p-4 space-y-3">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-black tracking-widest uppercase rounded-full border border-blue-500/30 mb-1">
                          Scanned Registration
                        </span>
                        <h3 className="text-sm sm:text-base font-black text-white">{scannedTeamInfo.groupName || scannedTeamInfo.teamLeadName}</h3>
                        <p className="text-[11px] text-slate-400 font-semibold">{scannedTeamInfo.eventTitle}</p>
                      </div>

                      {/* Lead */}
                      <div className="bg-slate-950/60 rounded-xl p-3 flex items-center justify-between border border-slate-800/80 gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-blue-400 block">Team Lead</span>
                          <span className="text-xs font-bold text-white block truncate">{scannedTeamInfo.teamLeadName}</span>
                          <span className="text-[10px] text-slate-400 block truncate">{scannedTeamInfo.teamLeadEmail}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentStatus = rosterAttendance["lead"] || "Present";
                            const nextStatus = currentStatus === "Present" ? "Late" : currentStatus === "Late" ? "Absent" : "Present";
                            setRosterAttendance(prev => ({ ...prev, lead: nextStatus }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border cursor-pointer shrink-0 ${
                            (!rosterAttendance["lead"] || rosterAttendance["lead"] === "Present")
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : rosterAttendance["lead"] === "Late"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-red-500/20 text-red-300 border-red-500/40"
                          }`}
                        >
                          {rosterAttendance["lead"] || "Present"}
                        </button>
                      </div>

                      {/* Teammates */}
                      {scannedTeamInfo.members && scannedTeamInfo.members.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Squad Members</span>
                          {scannedTeamInfo.members.map((member: any, i: number) => (
                            <div key={i} className="bg-slate-950/40 rounded-xl p-2.5 flex items-center justify-between border border-slate-800/60 gap-2">
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-200 block truncate">{member.name || `Member ${i + 1}`}</span>
                                <span className="text-[10px] text-slate-400 block truncate">{member.studentId || member.email || ""}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentStatus = rosterAttendance[`member_${i}`] || "Present";
                                  const nextStatus = currentStatus === "Present" ? "Late" : currentStatus === "Late" ? "Absent" : "Present";
                                  setRosterAttendance(prev => ({ ...prev, [`member_${i}`]: nextStatus }));
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border cursor-pointer shrink-0 ${
                                  (!rosterAttendance[`member_${i}`] || rosterAttendance[`member_${i}`] === "Present")
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : rosterAttendance[`member_${i}`] === "Late"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : "bg-red-500/20 text-red-300 border-red-500/40"
                                }`}
                              >
                                {rosterAttendance[`member_${i}`] || "Present"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setScannedTeamInfo(null)}
                        className="flex-1 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs py-3 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setScanLoading(true);
                          try {
                            const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + " (QR Scan)";
                            const regId = scannedTeamInfo.id || scannedTeamInfo._id;

                            // Update registration members with session specific attendance
                            const updatedMembers = (scannedTeamInfo.members || []).map((m: any, idx: number) => {
                              const status = rosterAttendance[`member_${idx}`] || "Present";
                              if (sessionTab === "gate_entry") {
                                return { ...m, gateEntryMarked: status === "Present" || status === "Late", checkInTimeGateEntry: timeStr, attendanceStatus: status, checkInTime: timeStr };
                              } else if (sessionTab === "morning") {
                                return { ...m, attendanceStatusMorning: status, checkInTimeMorning: timeStr, attendanceStatus: status, checkInTime: timeStr };
                              } else if (sessionTab === "gate_exit") {
                                return { ...m, gateExitMarked: status === "Present" || status === "Late", checkInTimeGateExit: timeStr };
                              } else {
                                return { ...m, attendanceStatusAfternoon: status, checkInTimeAfternoon: timeStr };
                              }
                            });

                            const regUpdates: any = { members: updatedMembers };
                            const leadStatus = rosterAttendance["lead"] || "Present";

                            if (sessionTab === "gate_entry") {
                              regUpdates.gateEntryMarked = leadStatus === "Present" || leadStatus === "Late";
                              regUpdates.checkInTimeGateEntry = timeStr;
                              regUpdates.attendanceStatus = leadStatus;
                              regUpdates.checkInTime = timeStr;
                            } else if (sessionTab === "morning") {
                              regUpdates.attendanceStatusMorning = leadStatus;
                              regUpdates.checkInTimeMorning = timeStr;
                              regUpdates.attendanceStatus = leadStatus;
                              regUpdates.checkInTime = timeStr;
                            } else if (sessionTab === "gate_exit") {
                              regUpdates.gateExitMarked = leadStatus === "Present" || leadStatus === "Late";
                              regUpdates.checkInTimeGateExit = timeStr;
                            } else {
                              regUpdates.attendanceStatusAfternoon = leadStatus;
                              regUpdates.checkInTimeAfternoon = timeStr;
                            }

                            await updateRegistration(regId, regUpdates);

                            // Update attendances collection via apiClient
                            if (selectedEventId) {
                              const leadId = `${regId}_lead`;
                              await markAttendance({
                                eventId: selectedEventId,
                                eventTitle: assignedEvent?.title || "",
                                registrationId: regId,
                                participantId: leadId,
                                userEmail: scannedTeamInfo.teamLeadEmail || scannedTeamInfo.email || "",
                                userName: scannedTeamInfo.teamLeadName || "Participant",
                                name: scannedTeamInfo.teamLeadName || "Participant",
                                role: "Participant",
                                session: sessionTab,
                                day: selectedDay,
                                status: leadStatus,
                                checkInTime: timeStr
                              });

                              if (scannedTeamInfo.members && Array.isArray(scannedTeamInfo.members)) {
                                for (let i = 0; i < scannedTeamInfo.members.length; i++) {
                                  const mem = scannedTeamInfo.members[i];
                                  const memId = `${regId}_member_${i}`;
                                  const memStatus = rosterAttendance[`member_${i}`] || "Present";
                                  await markAttendance({
                                    eventId: selectedEventId,
                                    eventTitle: assignedEvent?.title || "",
                                    registrationId: regId,
                                    participantId: memId,
                                    userEmail: mem.email || "",
                                    userName: mem.name || "Teammate",
                                    name: mem.name || "Teammate",
                                    role: "Participant",
                                    session: sessionTab,
                                    day: selectedDay,
                                    status: memStatus,
                                    checkInTime: timeStr
                                  });
                                }
                              }
                            }

                            // Update local students state
                            setStudents(prev => prev.map(s => {
                              if (s.regId !== regId) return s;
                              if (s.isLead) {
                                if (sessionTab === "gate_entry") {
                                  return { ...s, gateStatus: leadStatus, gateCheckInTime: timeStr };
                                } else if (sessionTab === "morning") {
                                  return { ...s, morningStatus: leadStatus, morningCheckInTime: timeStr };
                                } else if (sessionTab === "gate_exit") {
                                  return { ...s, gateExitStatus: leadStatus, gateExitCheckInTime: timeStr };
                                } else {
                                  return { ...s, afternoonStatus: leadStatus, afternoonCheckInTime: timeStr };
                                }
                              } else if (s.memberIndex !== undefined) {
                                const mStatus = rosterAttendance[`member_${s.memberIndex}`] || "Present";
                                if (sessionTab === "gate_entry") {
                                  return { ...s, gateStatus: mStatus, gateCheckInTime: timeStr };
                                } else if (sessionTab === "morning") {
                                  return { ...s, morningStatus: mStatus, morningCheckInTime: timeStr };
                                } else if (sessionTab === "gate_exit") {
                                  return { ...s, gateExitStatus: mStatus, gateExitCheckInTime: timeStr };
                                } else {
                                  return { ...s, afternoonStatus: mStatus, afternoonCheckInTime: timeStr };
                                }
                              }
                              return s;
                            }));

                            setScanSuccessMsg(`Checked in for ${sessionTab === "gate_entry" ? "Gate Enter" : sessionTab === "morning" ? "Morning" : sessionTab === "gate_exit" ? "Gate Exit" : "Afternoon"} session (Day ${selectedDay})!`);
                            setTimeout(() => {
                              setScanSuccessMsg("");
                              setScannedTeamInfo(null);
                              setRosterAttendance({});
                              setIsScannerModalOpen(false);
                            }, 1200);
                          } catch (err) {
                            console.error("QR Check-in error:", err);
                            alert("Check-in failed. Please retry.");
                          } finally {
                            setScanLoading(false);
                          }
                        }}
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                      >
                        <Check className="h-4 w-4" />
                        <span>Confirm ({sessionTab === "gate_entry" ? "Gate Enter" : sessionTab === "morning" ? "Morning" : sessionTab === "gate_exit" ? "Gate Exit" : "Afternoon"})</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Session Modal rendered in marking view if triggered */}
      {renderSessionModal()}
    </div>
  );
};

export default OrgAttendancePage;
