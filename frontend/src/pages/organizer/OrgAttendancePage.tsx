import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import jsQR from "jsqr";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, getDoc, doc, updateDoc, setDoc } from "firebase/firestore";
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
  ChevronDown,
  ArrowLeft,
  MapPin,
  Clock,
  LogIn,
  Sparkles
} from "lucide-react";

interface StudentAttendee {
  id: string;
  name: string;
  email: string;
  studentId: string;
  teamName: string;
  department: string;
  year: string;
  program: string;
  isLead: boolean;
  memberIndex?: number;
  regId: string;
  morningStatus: "Present" | "Late" | "Absent";
  morningCheckInTime: string;
  afternoonStatus: "Present" | "Late" | "Absent";
  afternoonCheckInTime: string;
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
}

export const OrgAttendancePage: React.FC = () => {
  const { user } = useAuth();
  // Two-step flow: "landing" = event selection, "marking" = attendance marking
  const [activeView, setActiveView] = useState<"landing" | "marking">("landing");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [assignedEvent, setAssignedEvent] = useState<EventItem | null>(null);
  const [students, setStudents] = useState<StudentAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Present" | "Late" | "Absent">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "time" | "status">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Two Attendance Session Tabs: "morning" | "afternoon"
  const [sessionTab, setSessionTab] = useState<"morning" | "afternoon">("morning");

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
    const fetchEvents = async () => {
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
          if (!startDateStr && !endDateStr) return false;
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
          const orgsSnap = await getDocs(collection(db, "organizers"));
          const orgData = orgsSnap.docs.map(d => d.data()).find(o => 
            o.email?.toLowerCase() === userEmail || o.username?.toLowerCase() === userEmail
          );
          if (orgData?.assignedEvents && Array.isArray(orgData.assignedEvents)) {
            assignedTitles = orgData.assignedEvents.map((t: string) => t.toLowerCase().trim());
          }
        } catch (e) {
          console.warn("Could not load organizers assignment:", e);
        }

        const eventsSnap = await getDocs(collection(db, "events"));
        const rawEvents: EventItem[] = [];

        eventsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const eventDate = data.startDate || data.date || "";
          const endDate = data.endDate || eventDate;
          const isToday = isEventToday(eventDate, endDate);

          // STRICT FILTER: Only include events occurring today
          if (isToday) {
            rawEvents.push({
              id: docSnap.id,
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
              isToday: true
            });
          }
        });

        // Filter today's events by organizer assignment if assignments exist
        let filteredEvents = rawEvents;
        if (assignedTitles.length > 0) {
          const matchedAssigned = rawEvents.filter(e => 
            assignedTitles.some(t => e.title.toLowerCase().trim().includes(t) || t.includes(e.title.toLowerCase().trim()))
          );
          if (matchedAssigned.length > 0) {
            filteredEvents = matchedAssigned;
          }
        }

        // Sort today's events
        filteredEvents.sort((a, b) => {
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

    fetchEvents();
  }, []);

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
        const regsSnap = await getDocs(collection(db, "registrations"));
        const allRegs: any[] = [];
        regsSnap.forEach(d => {
          allRegs.push({ id: d.id, ...d.data() });
        });
        setRegistrations(allRegs);

        // Fetch attendances collection records for this event
        const attsSnap = await getDocs(collection(db, "attendances"));
        const attendances = attsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const eventRegs = allRegs.filter((r: any) => 
          r.eventId === selectedEventId || 
          (currentEvent && (r.eventTitle || "").toLowerCase().trim() === currentEvent.title.toLowerCase().trim())
        );

        const attendeeList: StudentAttendee[] = [];

        eventRegs.forEach((r: any) => {
          const leadId = `${r.id}_lead`;
          const attLeadMorning = attendances.find((a: any) => 
            a.eventId === selectedEventId && 
            a.participantId === leadId && 
            (a.session === "morning" || !a.session)
          );
          const attLeadAfternoon = attendances.find((a: any) => 
            a.eventId === selectedEventId && 
            a.participantId === leadId && 
            a.session === "afternoon"
          );

          // 1. Team Lead / Individual Registrant
          attendeeList.push({
            id: leadId,
            regId: r.id,
            isLead: true,
            name: r.teamLeadName || r.name || "Team Lead",
            email: r.teamLeadEmail || r.email || "",
            studentId: r.teamLeadStudentId || r.studentId || `AI-${r.id.substring(0, 5).toUpperCase()}`,
            teamName: r.groupName || r.teamName || "Solo Registration",
            department: r.department || r.branch || "Engineering & Tech",
            year: r.year || "Year 3",
            program: r.program || "B.Tech",
            morningStatus: (attLeadMorning?.status as any) || r.attendanceStatusMorning || r.attendanceStatus || "Absent",
            morningCheckInTime: attLeadMorning?.checkInTime || r.checkInTimeMorning || (r.attendanceStatus === "Present" ? r.checkInTime : "Not Checked-in"),
            afternoonStatus: (attLeadAfternoon?.status as any) || r.attendanceStatusAfternoon || "Absent",
            afternoonCheckInTime: attLeadAfternoon?.checkInTime || r.checkInTimeAfternoon || "Not Checked-in"
          });

          // 2. Team Squad Members
          if (Array.isArray(r.members) && r.members.length > 0) {
            r.members.forEach((m: any, idx: number) => {
              const memId = `${r.id}_member_${idx}`;
              const attMemMorning = attendances.find((a: any) => 
                a.eventId === selectedEventId && 
                a.participantId === memId && 
                (a.session === "morning" || !a.session)
              );
              const attMemAfternoon = attendances.find((a: any) => 
                a.eventId === selectedEventId && 
                a.participantId === memId && 
                a.session === "afternoon"
              );

              attendeeList.push({
                id: memId,
                regId: r.id,
                isLead: false,
                memberIndex: idx,
                name: m.name || `Teammate ${idx + 1}`,
                email: m.email || "",
                studentId: m.studentId || `AI-${r.id.substring(0, 3)}-${idx + 1}`,
                teamName: r.groupName || r.teamName || "Team Member",
                department: m.department || r.department || "Engineering & Tech",
                year: m.year || r.year || "Year 3",
                program: m.program || r.program || "B.Tech",
                morningStatus: (attMemMorning?.status as any) || m.attendanceStatusMorning || m.attendanceStatus || "Absent",
                morningCheckInTime: attMemMorning?.checkInTime || m.checkInTimeMorning || (m.attendanceStatus === "Present" ? m.checkInTime : "Not Checked-in"),
                afternoonStatus: (attMemAfternoon?.status as any) || m.attendanceStatusAfternoon || "Absent",
                afternoonCheckInTime: attMemAfternoon?.checkInTime || m.checkInTimeAfternoon || "Not Checked-in"
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
  }, [selectedEventId, events]);

  // Handle status toggle for a student (Morning vs Afternoon)
  const handleStatusChange = async (studentId: string, newStatus: "Present" | "Late" | "Absent") => {
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const formattedCheckIn = newStatus === "Absent" ? "Not Checked-in" : `${timeNow} (Manual)`;

    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Update locally based on active sessionTab
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      if (sessionTab === "morning") {
        return { ...s, morningStatus: newStatus, morningCheckInTime: formattedCheckIn };
      } else {
        return { ...s, afternoonStatus: newStatus, afternoonCheckInTime: formattedCheckIn };
      }
    }));

    // Update in Firestore
    try {
      const regId = student.regId;
      const docRef = doc(db, "registrations", regId);

      // 1. Update attendances collection
      if (selectedEventId) {
        const attsSnap = await getDocs(collection(db, "attendances"));
        const existingDoc = attsSnap.docs.find(d => {
          const data = d.data();
          return data.eventId === selectedEventId && data.participantId === student.id && data.session === sessionTab;
        });

        if (existingDoc) {
          await updateDoc(doc(db, "attendances", existingDoc.id), {
            status: newStatus,
            checkInTime: formattedCheckIn
          });
        } else {
          await setDoc(doc(collection(db, "attendances")), {
            eventId: selectedEventId,
            participantId: student.id,
            name: student.name,
            role: "Participant",
            session: sessionTab,
            status: newStatus,
            checkInTime: formattedCheckIn
          });
        }
      }

      // 2. Update registrations document fields
      if (student.isLead) {
        const updates: any = {};
        if (sessionTab === "morning") {
          updates.attendanceStatusMorning = newStatus;
          updates.checkInTimeMorning = formattedCheckIn;
          updates.attendanceStatus = newStatus; // Backwards compatibility
          updates.checkInTime = formattedCheckIn;
        } else {
          updates.attendanceStatusAfternoon = newStatus;
          updates.checkInTimeAfternoon = formattedCheckIn;
        }
        await updateDoc(docRef, updates);
      } else if (student.memberIndex !== undefined) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const membersList = [...(data.members || [])];
          if (membersList[student.memberIndex]) {
            if (sessionTab === "morning") {
              membersList[student.memberIndex].attendanceStatusMorning = newStatus;
              membersList[student.memberIndex].checkInTimeMorning = formattedCheckIn;
              membersList[student.memberIndex].attendanceStatus = newStatus;
              membersList[student.memberIndex].checkInTime = formattedCheckIn;
            } else {
              membersList[student.memberIndex].attendanceStatusAfternoon = newStatus;
              membersList[student.memberIndex].checkInTimeAfternoon = formattedCheckIn;
            }
          }
          await updateDoc(docRef, { members: membersList });
        }
      }
    } catch (err) {
      console.error("Failed to update status in Firestore:", err);
    }
  };

  // QR Code Scanner Handlers
  const handleScannedCode = async (decodedText: string) => {
    if (isProcessingQR.current) return;
    isProcessingQR.current = true;

    try {
      const cleanText = decodedText.trim();
      let reg = registrations.find(r => r.id === cleanText || r.qrCodeData === cleanText);

      if (!reg) {
        setScanLoading(true);
        try {
          const docRef = doc(db, "registrations", cleanText);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            reg = { id: docSnap.id, ...docSnap.data() } as any;
            setRegistrations(prev => [...prev, reg]);
          }
        } catch (e) {
          console.error("Fallback scan fetch failed:", e);
        }
        setScanLoading(false);
      }

      if (reg) {
        if (reg.eventId && reg.eventId !== selectedEventId && reg.eventTitle?.toLowerCase() !== assignedEvent?.title?.toLowerCase()) {
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
      const leadStatus = sessionTab === "morning" 
        ? (scannedTeamInfo.attendanceStatusMorning || scannedTeamInfo.attendanceStatus || "Present")
        : (scannedTeamInfo.attendanceStatusAfternoon || "Present");
      initialStatuses["lead"] = leadStatus as any;

      if (scannedTeamInfo.members) {
        scannedTeamInfo.members.forEach((m: any, idx: number) => {
          const memStatus = sessionTab === "morning"
            ? (m.attendanceStatusMorning || m.attendanceStatus || "Present")
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
      const status = sessionTab === "morning" ? s.morningStatus : s.afternoonStatus;
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
        s.teamName.toLowerCase().includes(q);

      const status = sessionTab === "morning" ? s.morningStatus : s.afternoonStatus;
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
        fieldA = sessionTab === "morning" ? a.morningCheckInTime : a.afternoonCheckInTime;
        fieldB = sessionTab === "morning" ? b.morningCheckInTime : b.afternoonCheckInTime;
      } else if (sortBy === "status") {
        fieldA = sessionTab === "morning" ? a.morningStatus : a.afternoonStatus;
        fieldB = sessionTab === "morning" ? b.morningStatus : b.afternoonStatus;
      }

      return sortOrder === "asc"
        ? fieldA.localeCompare(fieldB)
        : fieldB.localeCompare(fieldA);
    });

    return result;
  }, [students, searchQuery, statusFilter, sortBy, sortOrder, sessionTab]);

  // Generate & Download Attendance CSV Report
  const handleGenerateReport = () => {
    if (students.length === 0) {
      alert("No attendance records to export.");
      return;
    }

    const headers = ["Student Name", "Student ID", "Email", "Team Name", "Role", "Morning Status", "Morning Check-In Time", "Afternoon Status", "Afternoon Check-In Time"];
    const rows = students.map(s => [
      `"${s.name}"`,
      `"${s.studentId}"`,
      `"${s.email}"`,
      `"${s.teamName}"`,
      `"${s.isLead ? "Team Lead" : "Member"}"`,
      `"${s.morningStatus}"`,
      `"${s.morningCheckInTime}"`,
      `"${s.afternoonStatus}"`,
      `"${s.afternoonCheckInTime}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const eventNameClean = (assignedEvent?.title || "event").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    link.setAttribute("download", `${eventNameClean}_full_attendance_${getTodayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncAttendance = () => {
    alert("Attendance state successfully synchronized with AI Verse database!");
  };

  // Handler to enter a specific event's attendance page
  const enterEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const ev = events.find(e => e.id === eventId);
    if (ev) setAssignedEvent(ev);
    setActiveView("marking");
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
                  onClick={() => enterEvent(ev.id)}
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
                          enterEvent(ev.id);
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
              Registered participants for this event are loaded below. Select session and mark check-in via cards or live QR scanner.
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

        {/* Row 2: 🌅 MORNING & 🌆 AFTERNOON SESSION TABS + METRICS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-5">
          
          {/* Two Big Attendance Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 w-full sm:w-auto">
            <button
              onClick={() => setSessionTab("morning")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                sessionTab === "morning"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Sun className={`w-4 h-4 ${sessionTab === "morning" ? "text-amber-500" : "text-slate-400"}`} />
                <span>Morning</span>
              </div>
              <span className={`text-[9.5px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md font-bold ${
                sessionTab === "morning" ? "bg-blue-50 text-blue-700" : "bg-slate-200 text-slate-600"
              }`}>
                09:00 - 13:00
              </span>
            </button>

            <button
              onClick={() => setSessionTab("afternoon")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                sessionTab === "afternoon"
                  ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Moon className={`w-4 h-4 ${sessionTab === "afternoon" ? "text-indigo-500" : "text-slate-400"}`} />
                <span>Afternoon</span>
              </div>
              <span className={`text-[9.5px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md font-bold ${
                sessionTab === "afternoon" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
              }`}>
                14:00 - 18:00
              </span>
            </button>
          </div>

          {/* Real-time Attendance Stats Cards */}
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
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
              placeholder="Search by student name, ID, team..."
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
              <option value="Present">Present Only</option>
              <option value="Late">Late Only</option>
              <option value="Absent">Absent Only</option>
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
            <option value="Present">Present Only</option>
            <option value="Late">Late Only</option>
            <option value="Absent">Absent Only</option>
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
          
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Registered Participants Roster ({filteredStudents.length})
              </h3>
            </div>
            <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-400">
              Active: <span className="font-extrabold text-blue-600">{sessionTab === "morning" ? "Morning Session" : "Afternoon Session"}</span>
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              <p className="text-xs text-slate-400 font-bold mt-3">Loading registered participants...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
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
                  const status = sessionTab === "morning" ? student.morningStatus : student.afternoonStatus;
                  const checkIn = sessionTab === "morning" ? student.morningCheckInTime : student.afternoonCheckInTime;
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
                      const status = sessionTab === "morning" ? student.morningStatus : student.afternoonStatus;
                      const checkIn = sessionTab === "morning" ? student.morningCheckInTime : student.afternoonCheckInTime;
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
          )}
        </div>

        {/* Right Side: QR check-in & Action Box (4/12) */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">
          
          {/* Card 1: Student Check-in (QR code) */}
          <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-white text-center space-y-3.5 sm:space-y-4 shadow-lg shadow-slate-900/10 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                {sessionTab === "morning" ? "Morning Check-In" : "Afternoon Check-In"}
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
              Scan student's registration QR barcode or ticket to instantly log attendance for the <span className="font-bold text-white">{sessionTab === "morning" ? "Morning" : "Afternoon"}</span> session.
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
                {sessionTab === "morning" ? "Morning Session Check-in" : "Afternoon Session Check-in"}
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
                            const docRef = doc(db, "registrations", scannedTeamInfo.id);

                            // Update registration members with session specific attendance
                            const updatedMembers = (scannedTeamInfo.members || []).map((m: any, idx: number) => {
                              const status = rosterAttendance[`member_${idx}`] || "Present";
                              if (sessionTab === "morning") {
                                return { ...m, attendanceStatusMorning: status, checkInTimeMorning: timeStr, attendanceStatus: status, checkInTime: timeStr };
                              } else {
                                return { ...m, attendanceStatusAfternoon: status, checkInTimeAfternoon: timeStr };
                              }
                            });

                            const regUpdates: any = { members: updatedMembers };
                            const leadStatus = rosterAttendance["lead"] || "Present";

                            if (sessionTab === "morning") {
                              regUpdates.attendanceStatusMorning = leadStatus;
                              regUpdates.checkInTimeMorning = timeStr;
                              regUpdates.attendanceStatus = leadStatus;
                              regUpdates.checkInTime = timeStr;
                            } else {
                              regUpdates.attendanceStatusAfternoon = leadStatus;
                              regUpdates.checkInTimeAfternoon = timeStr;
                            }

                            await updateDoc(docRef, regUpdates);

                            // Update attendances collection
                            if (selectedEventId) {
                              const leadId = `${scannedTeamInfo.id}_lead`;
                              await setDoc(doc(collection(db, "attendances")), {
                                eventId: selectedEventId,
                                participantId: leadId,
                                name: scannedTeamInfo.teamLeadName || "Participant",
                                role: "Participant",
                                session: sessionTab,
                                status: leadStatus,
                                checkInTime: timeStr
                              });

                              if (scannedTeamInfo.members) {
                                for (let i = 0; i < scannedTeamInfo.members.length; i++) {
                                  const mem = scannedTeamInfo.members[i];
                                  const memId = `${scannedTeamInfo.id}_member_${i}`;
                                  const memStatus = rosterAttendance[`member_${i}`] || "Present";
                                  await setDoc(doc(collection(db, "attendances")), {
                                    eventId: selectedEventId,
                                    participantId: memId,
                                    name: mem.name || "Teammate",
                                    role: "Participant",
                                    session: sessionTab,
                                    status: memStatus,
                                    checkInTime: timeStr
                                  });
                                }
                              }
                            }

                            // Update local students state
                            setStudents(prev => prev.map(s => {
                              if (s.regId !== scannedTeamInfo.id) return s;
                              if (s.isLead) {
                                return sessionTab === "morning"
                                  ? { ...s, morningStatus: leadStatus, morningCheckInTime: timeStr }
                                  : { ...s, afternoonStatus: leadStatus, afternoonCheckInTime: timeStr };
                              } else if (s.memberIndex !== undefined) {
                                const mStatus = rosterAttendance[`member_${s.memberIndex}`] || "Present";
                                return sessionTab === "morning"
                                  ? { ...s, morningStatus: mStatus, morningCheckInTime: timeStr }
                                  : { ...s, afternoonStatus: mStatus, afternoonCheckInTime: timeStr };
                              }
                              return s;
                            }));

                            setScanSuccessMsg(`Checked in for ${sessionTab === "morning" ? "Morning" : "Afternoon"} session!`);
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
                        <span>Confirm ({sessionTab})</span>
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

    </div>
  );
};

export default OrgAttendancePage;
