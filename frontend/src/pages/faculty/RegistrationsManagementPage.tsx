import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  ClipboardList, 
  Search, 
  Trash2, 
  Check, 
  Loader2, 
  AlertCircle,
  FileSpreadsheet,
  User,
  Users as UsersIcon,
  X,
  RefreshCw,
  Download,
  CreditCard,
  ExternalLink,
  CheckCircle2,
  Phone,
  Mail,
  Building2,
  GraduationCap,
  Calendar,
  MapPin
} from "lucide-react";
import SEO from "../../components/layout/SEO";
import { 
  fetchRegistrations as apiFetchRegistrations, 
  updateRegistration,
  deleteParticipantCascade 
} from "../../services/apiClient";
import { sendResendEmail } from "../../utils/resendEmailService";
import { buildRegistrationConfirmationEmail } from "../../utils/emailTemplates";

interface RegistrationItem {
  id: string;
  eventId: string;
  eventTitle: string;
  groupName: string;
  teamEmail?: string;
  teamLeadName: string;
  teamLeadEmail: string;
  teamLeadCollegeEmail?: string;
  teamLeadPersonalEmail?: string;
  teamLeadStudentId: string;
  phoneNumber: string;
  teamLeadPhone?: string;
  collegeName?: string;
  college?: string;
  collegePlace?: string;
  branch: string;
  section: string;
  year: string;
  teamSize: number;
  members: Array<{ name: string; email: string; studentId: string; role?: string; phone?: string; phoneNumber?: string }>;
  status?: "Confirmed" | "Pending" | "Not Confirmed" | "Waitlisted";
  paymentProofPreview?: string;
  paymentProofFilename?: string;
  transactionId?: string;
  utrNumber?: string;
  paymentStatus?: string;
  totalFeePaid?: number;
  foodPreference?: string;
  foodOption?: string;
  needsFood?: boolean;
  isVishnuStudent?: boolean;
  createdAt: number;
}

const RegistrationsManagementPage: React.FC = () => {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedReg, setSelectedReg] = useState<RegistrationItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<RegistrationItem | null>(null);
  const [activeLongPressRegId, setActiveLongPressRegId] = useState<string | null>(null);
  const longPressTimer = useRef<any>(null);
  const isLongPressActive = useRef(false);
  const [deleteModeOption, setDeleteModeOption] = useState<"single" | "group" | "event">("single");
  const [selectedRegIds, setSelectedRegIds] = useState<string[]>([]);
  const [isDeleteSelectionMode, setIsDeleteSelectionMode] = useState(false);
  const [confirmingRegId, setConfirmingRegId] = useState<string | null>(null);
  const [confirmSuccessMsg, setConfirmSuccessMsg] = useState<string | null>(null);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSelectedEvent, setExportSelectedEvent] = useState("All");

  const handleExportCsv = () => {
    const targetRegs = exportSelectedEvent === "All"
      ? registrations
      : registrations.filter(r => r.eventTitle === exportSelectedEvent);

    if (targetRegs.length === 0) {
      alert("No registrations available for the selected event.");
      return;
    }

    const headers = [
      "Event Title",
      "Registration Type",
      "Student / Lead Name",
      "Roll Number / Student ID",
      "Email Address",
      "Phone Number",
      "Branch",
      "Section",
      "Year",
      "Food Preference",
      "Total Fee Paid",
      "Team Size",
      "Status",
      "Registration Date"
    ];

    const rows: string[] = [];

    targetRegs.forEach((reg) => {
      const regType = reg.groupName && reg.groupName !== "Individual RSVP" ? "Group" : "Individual";
      const regDate = new Date(reg.createdAt).toLocaleDateString("en-US");
      const status = reg.status || "Confirmed";
      const foodPref = reg.foodPreference || (reg.needsFood === false ? "No Food (Free)" : "Standard Entry");
      const totalFee = reg.totalFeePaid || 0;

      if (reg.members && reg.members.length > 0) {
        reg.members.forEach((m) => {
          const row = [
            `"${(reg.eventTitle || "").replace(/"/g, '""')}"`,
            `"${regType}"`,
            `"${(m.name || reg.teamLeadName || "").replace(/"/g, '""')}"`,
            `"${(m.studentId || reg.teamLeadStudentId || "").replace(/"/g, '""')}"`,
            `"${(m.email || reg.teamLeadEmail || "").replace(/"/g, '""')}"`,
            `"${((m as any).phoneNumber || reg.phoneNumber || "").replace(/"/g, '""')}"`,
            `"${((m as any).branch || reg.branch || "").replace(/"/g, '""')}"`,
            `"${((m as any).section || reg.section || "").replace(/"/g, '""')}"`,
            `"${((m as any).year || reg.year || "").replace(/"/g, '""')}"`,
            `"${foodPref.replace(/"/g, '""')}"`,
            `"₹${totalFee}"`,
            reg.teamSize || 1,
            `"${status}"`,
            `"${regDate}"`
          ];
          rows.push(row.join(","));
        });
      } else {
        const row = [
          `"${(reg.eventTitle || "").replace(/"/g, '""')}"`,
          `"${regType}"`,
          `"${(reg.teamLeadName || "").replace(/"/g, '""')}"`,
          `"${(reg.teamLeadStudentId || "").replace(/"/g, '""')}"`,
          `"${(reg.teamLeadEmail || "").replace(/"/g, '""')}"`,
          `"${(reg.phoneNumber || "").replace(/"/g, '""')}"`,
          `"${(reg.branch || "").replace(/"/g, '""')}"`,
          `"${(reg.section || "").replace(/"/g, '""')}"`,
          `"${(reg.year || "").replace(/"/g, '""')}"`,
          `"${foodPref.replace(/"/g, '""')}"`,
          `"₹${totalFee}"`,
          reg.teamSize || 1,
          `"${status}"`,
          `"${regDate}"`
        ];
        rows.push(row.join(","));
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const filename = exportSelectedEvent === "All"
      ? "all_event_registrations.csv"
      : `${exportSelectedEvent.toLowerCase().replace(/[^a-z0-9]/g, "_")}_registrations.csv`;

    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsExportModalOpen(false);
  };

  const toggleSelectReg = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRegIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRegIds.length === filteredRegistrations.length && filteredRegistrations.length > 0) {
      setSelectedRegIds([]);
    } else {
      setSelectedRegIds(filteredRegistrations.map(r => r.id));
    }
  };

  const handleBulkDeleteRegistrations = async () => {
    if (selectedRegIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedRegIds.length} selected registration(s)?\n\nThis will remove all participant accounts, quiz submissions, and data from BOTH Firebase and Supabase.`)) return;

    try {
      setLoading(true);
      const selectedRegs = registrations.filter(r => selectedRegIds.includes(r.id));
      
      for (const reg of selectedRegs) {
        await deleteParticipantCascade(reg.id, (reg.members || []).map((m: any) => m.email).filter(Boolean), reg.teamSize, reg.eventId);
      }

      setRegistrations(prev => prev.filter(r => !selectedRegIds.includes(r.id)));
      setSelectedRegIds([]);
      setIsDeleteSelectionMode(false);
      alert(`Successfully deleted ${selectedRegs.length} registration(s) and all participant records from Firebase and Supabase.`);
    } catch (err) {
      console.error("Error bulk deleting registrations:", err);
      alert("Failed to delete selected registrations.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroupRegistrations = async (groupName: string) => {
    if (!groupName || groupName === "Individual RSVP") return;
    if (!window.confirm(`Are you sure you want to delete team "${groupName}"?\n\nThis will purge all participant accounts and submissions from Firebase and Supabase.`)) return;
    try {
      setLoading(true);
      const targets = registrations.filter(r => r.groupName === groupName);
      for (const reg of targets) {
        await deleteParticipantCascade(reg.id, (reg.members || []).map((m: any) => m.email).filter(Boolean), reg.teamSize, reg.eventId);
      }
      setRegistrations(prev => prev.filter(r => r.groupName !== groupName));
      alert(`Successfully deleted all registrations and participant accounts for "${groupName}".`);
    } catch (err) {
      console.error("Error deleting group registrations:", err);
      alert("Failed to delete group registrations.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEventRegistrations = async (eventId: string) => {
    if (!eventId) return;
    if (!window.confirm("Are you sure you want to delete all registrations for this event?\n\nAll participant records and Supabase logins will be deleted.")) return;
    try {
      setLoading(true);
      const targets = registrations.filter(r => r.eventId === eventId);
      for (const reg of targets) {
        await deleteParticipantCascade(reg.id, (reg.members || []).map((m: any) => m.email).filter(Boolean), reg.teamSize, reg.eventId);
      }
      setRegistrations(prev => prev.filter(r => r.eventId !== eventId));
      alert("Successfully deleted all registrations and participant accounts for this event.");
    } catch (err) {
      console.error("Error deleting event registrations:", err);
      alert("Failed to delete event registrations.");
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const docs = await apiFetchRegistrations();
      const list: RegistrationItem[] = [];
      (docs || []).forEach((docSnap: any) => {
        const data = docSnap || {};
        const phone = data.phoneNumber || data.teamLeadPhone || data.phone || data.leadPhone || "";
        const collegeEmail = data.teamLeadCollegeEmail || data.collegeEmail || "";
        const personalEmail = data.teamLeadPersonalEmail || data.personalEmail || data.teamLeadEmail || data.email || "";
        const primaryEmail = data.teamLeadEmail || personalEmail || collegeEmail || "";

        const rawStatus = (data.status || "").trim();
        
        let resolvedStatus: "Confirmed" | "Not Confirmed" | "Waitlisted" = "Confirmed";
        if (rawStatus.toLowerCase() === "waitlisted") {
          resolvedStatus = "Waitlisted";
        } else if (rawStatus.toLowerCase() === "not confirmed" || rawStatus.toLowerCase() === "pending") {
          resolvedStatus = "Not Confirmed";
        } else {
          resolvedStatus = "Confirmed";
        }

        const teamName = data.groupName || data.teamName || "";
        const leadName = data.teamLeadName || data.fullName || data.name || data.userName || (data.members && data.members[0]?.name) || "Student Registrant";
        const studentId = data.teamLeadStudentId || data.studentId || data.rollNo || data.registrationNumber || (data.members && data.members[0]?.registrationNumber) || "";

        list.push({
          id: docSnap.id || docSnap._id || (docSnap._doc && docSnap._doc._id) || "",
          eventId: data.eventId || "",
          eventTitle: data.eventTitle || "Event",
          groupName: teamName || (data.teamSize > 1 ? "Team Registration" : "Individual RSVP"),
          teamEmail: data.teamEmail || data.generatedTeamEmail || "",
          teamLeadName: leadName,
          teamLeadEmail: primaryEmail || data.userEmail || data.leadEmail || "",
          teamLeadCollegeEmail: collegeEmail,
          teamLeadPersonalEmail: personalEmail,
          teamLeadStudentId: studentId,
          phoneNumber: phone,
          teamLeadPhone: phone,
          collegeName: data.collegeName || data.college || "",
          collegePlace: data.collegePlace || "",
          branch: data.branch || data.department || "",
          section: data.section || "",
          year: data.year || "",
          teamSize: data.teamSize || (Array.isArray(data.members) && data.members.length > 0 ? data.members.length : 1),
          members: (data.members || []).map((m: any) => ({
            name: m.name || "",
            email: m.email || "",
            studentId: m.studentId || m.rollNo || m.registrationNumber || "",
            role: m.role || "Developer",
            phone: m.phone || m.phoneNumber || "",
            phoneNumber: m.phone || m.phoneNumber || ""
          })),
          status: resolvedStatus,
          paymentProofPreview: data.paymentProofPreview || data.paymentProof || "",
          paymentProofFilename: data.paymentProofFilename || "",
          transactionId: data.transactionId || data.utrNumber || "",
          utrNumber: data.utrNumber || data.transactionId || "",
          paymentStatus: data.paymentStatus || "Confirmed",
          totalFeePaid: data.totalFeePaid || 0,
          createdAt: data.createdAt || Date.now()
        });
      });
      setRegistrations(list.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error("Error fetching registrations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, []);

  const handleDeleteRegistration = async (regId: string, eventId: string, teamSize: number) => {
    if (confirm("Are you sure you want to cancel and delete this registration?\n\nThis will permanently delete the participant/team account, quiz submissions, and all data from BOTH Firebase and Supabase.")) {
      try {
        const targetReg = registrations.find(r => r.id === regId);
        await deleteParticipantCascade(targetReg?.id || regId, (targetReg?.members || []).map((m: any) => m.email).filter(Boolean), teamSize, eventId);

        setRegistrations(prev => prev.filter(r => r.id !== regId));
        alert("Registration and participant account successfully deleted from Firebase and Supabase.");
      } catch (err) {
        console.error("Error deleting registration:", err);
        alert("Failed to delete registration.");
      }
    }
  };

  const handleConfirmRegistrationAndSendEmail = async (reg: RegistrationItem) => {
    setConfirmingRegId(reg.id);
    try {
      // 1. Update status to Confirmed in backend database
      await updateRegistration(reg.id, {
        status: "Confirmed",
        paymentStatus: "Confirmed",
        confirmedAt: Date.now()
      });

      // Update state
      setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: "Confirmed", paymentStatus: "Confirmed" } : r));
      if (selectedReg?.id === reg.id) {
        setSelectedReg(prev => prev ? { ...prev, status: "Confirmed", paymentStatus: "Confirmed" } : null);
      }

      // 2. Identify target personal mail (Priority: teamLeadPersonalEmail -> teamLeadEmail -> teamLeadCollegeEmail)
      const isQuizReg = Boolean(
        (reg as any).category === "QUIZ" ||
        (reg as any).category === "Quiz" ||
        (reg as any).isQuiz === true ||
        (reg as any).eventCategory === "Quiz" ||
        (reg as any).eventCategory === "QUIZ" ||
        (reg as any).sendConfirmationEmail === false
      );

      const targetEmail = (reg.teamLeadPersonalEmail || reg.teamLeadEmail || reg.teamLeadCollegeEmail || "").trim();

      if (targetEmail && !isQuizReg) {
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const siteBaseUrl = isLocal ? "https://aiversevitb.dpdns.org" : window.location.origin;
        const ticketUrl = `${siteBaseUrl}/ticket/${reg.id}`;

        const emailContent = buildRegistrationConfirmationEmail({
          teamLeadName: reg.teamLeadName || (reg as any).name || "Participant",
          eventTitle: reg.eventTitle || "AI Verse Event",
          groupName: reg.groupName,
          teamLeadStudentId: reg.teamLeadStudentId || (reg as any).studentId,
          teamSize: reg.teamSize,
          transactionId: reg.transactionId,
          members: reg.members,
          ticketUrl,
        });

        const emailResult = await sendResendEmail({
          to: targetEmail,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        if (emailResult.success) {
          setConfirmSuccessMsg(`Registration confirmed & receipt email delivered to ${targetEmail}!`);
        } else {
          setConfirmSuccessMsg(`Registration confirmed in database. (Email notice: ${emailResult.error || "failed"})`);
        }
      } else {
        setConfirmSuccessMsg(isQuizReg ? "Quiz registration confirmed in database (no confirmation email sent)." : "Registration confirmed successfully!");
      }

      setTimeout(() => setConfirmSuccessMsg(null), 6000);
    } catch (err) {
      console.error("Error confirming registration:", err);
      alert("Failed to confirm registration.");
    } finally {
      setConfirmingRegId(null);
    }
  };

  const handleSaveRoster = async () => {
    if (!editForm) return;
    try {
      await updateRegistration(editForm.id, {
        groupName: editForm.groupName,
        teamLeadName: editForm.teamLeadName,
        teamLeadEmail: editForm.teamLeadEmail,
        teamLeadPersonalEmail: editForm.teamLeadPersonalEmail || editForm.teamLeadEmail,
        teamLeadCollegeEmail: editForm.teamLeadCollegeEmail || "",
        teamLeadStudentId: editForm.teamLeadStudentId,
        phoneNumber: editForm.phoneNumber || "",
        teamLeadPhone: editForm.phoneNumber || "",
        branch: editForm.branch || "",
        section: editForm.section || "",
        year: editForm.year || "",
        members: editForm.members
      });
      
      // Update local state list
      setRegistrations(prev => prev.map(r => r.id === editForm.id ? { ...r, ...editForm } : r));
      setSelectedReg(editForm);
      setIsEditing(false);
      alert("Roster successfully updated.");
    } catch (err) {
      console.error("Error saving roster:", err);
      alert("Failed to save roster details.");
    }
  };

  // Get unique events list for filter dropdown
  const uniqueEvents = useMemo(() => {
    const eventsSet = new Set(registrations.map(r => r.eventTitle));
    return ["All", ...Array.from(eventsSet)];
  }, [registrations]);

  // Filtered registrations list
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(r => {
      const matchesSearch = 
        (r.teamLeadName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.groupName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.teamLeadStudentId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.eventTitle || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesEvent = selectedEvent === "All" || r.eventTitle === selectedEvent;
      
      const isGroup = r.groupName && r.groupName !== "Individual RSVP";
      const matchesType = selectedType === "All" || 
        (selectedType === "Group" && isGroup) || 
        (selectedType === "Individual" && !isGroup);
      
      const matchesStatus = selectedStatus === "All" || 
        (selectedStatus === "Confirmed" && r.status === "Confirmed") ||
        (selectedStatus === "Not Confirmed" && r.status !== "Confirmed" && r.status !== "Waitlisted") ||
        (selectedStatus === "Waitlisted" && r.status === "Waitlisted");

      return matchesSearch && matchesEvent && matchesType && matchesStatus;
    });
  }, [registrations, searchQuery, selectedEvent, selectedType, selectedStatus]);

  // Metrics
  const metrics = useMemo(() => {
    const total = registrations.length;
    const notConfirmed = registrations.filter(r => r.status !== "Confirmed").length;
    const groupCount = registrations.filter(r => r.groupName && r.groupName !== "Individual RSVP").length;
    const individualCount = total - groupCount;

    return {
      total: total,
      pending: notConfirmed,
      group: groupCount,
      individual: individualCount
    };
  }, [registrations]);

  return (
    <div className="space-y-8 pb-12 font-sans text-left">
      <SEO 
        title="Event Registrations - Faculty Portal" 
        description="Oversee and manage all student enrollments, waitlist allocations, and group sizes."
      />

      {/* ================= HEADER ================= */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Event Registrations</h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl font-medium leading-relaxed">
          Manage and oversee all participant enrollments across club events with real-time tracking and verification tools.
        </p>
      </div>

      {/* ================= METRIC CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registrations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <ClipboardList className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-0.5">
              +12%
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Registrations</span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 mt-1" /> : metrics.total}
            </h3>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100/50 text-amber-700 border border-amber-200/30">
              High Priority
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pending Approvals</span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 mt-1" /> : metrics.pending}
            </h3>
          </div>
        </div>

        {/* Group Registrations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shadow-inner">
              <UsersIcon className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-bold text-sky-500">
              13% of total
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Group Registrations</span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 mt-1" /> : metrics.group}
            </h3>
          </div>
        </div>

        {/* Individual Registrations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <User className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-bold text-indigo-500">
              87% of total
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Individual Registrations</span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 mt-1" /> : metrics.individual}
            </h3>
          </div>
        </div>
      </div>

      {/* ================= MAIN COLUMN WORKSPACE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Table Section (span 12) */}
        <div className="lg:col-span-12 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] overflow-hidden">
          
          {/* Controls Bar */}
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-grow max-w-md">
              <span className="text-sm font-bold text-slate-850 whitespace-nowrap">Registration Directory</span>
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search participants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-800 bg-slate-50/20 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-700 bg-white"
              >
                <option value="All">All Events</option>
                {uniqueEvents.filter(ev => ev !== "All").map((ev, i) => (
                  <option key={i} value={ev}>{ev}</option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-700 bg-white"
              >
                <option value="All">All Types</option>
                <option value="Individual">Individual</option>
                <option value="Group">Group</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-700 bg-white"
              >
                <option value="All">All Status</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Not Confirmed">Not Confirmed</option>
                <option value="Waitlisted">Waitlisted</option>
              </select>

              <button
                onClick={loadRegistrations}
                disabled={loading}
                className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-all flex items-center justify-center shadow-sm disabled:opacity-55"
                title="Refresh Directory"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 justify-center px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition-all whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export Data
              </button>

              {!isDeleteSelectionMode ? (
                <button
                  onClick={() => setIsDeleteSelectionMode(true)}
                  disabled={loading || filteredRegistrations.length === 0}
                  className="flex items-center gap-1.5 justify-center px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 font-bold rounded-xl text-xs shadow-sm hover:shadow transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Enable selection mode to delete registrations"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2 animate-in fade-in duration-200">
                  <button
                    onClick={() => {
                      setIsDeleteSelectionMode(false);
                      setSelectedRegIds([]);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDeleteRegistrations}
                    disabled={selectedRegIds.length === 0 || loading}
                    className={`flex items-center gap-1.5 justify-center px-4 py-2 font-bold rounded-xl text-xs shadow-sm transition-all whitespace-nowrap ${
                      selectedRegIds.length > 0
                        ? "bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-red-100"
                        : "bg-red-200 text-white cursor-not-allowed"
                    }`}
                    title={selectedRegIds.length > 0 ? `Delete ${selectedRegIds.length} selected registration(s)` : "Select registrations using radio buttons below"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Confirm Delete {selectedRegIds.length > 0 ? `(${selectedRegIds.length})` : ""}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Confirmation Success Toast Banner */}
          {confirmSuccessMsg && (
            <div className="mx-6 mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{confirmSuccessMsg}</span>
              </div>
              <button onClick={() => setConfirmSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Directory Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-600">
              <thead className="bg-slate-50/70 text-[9px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100">
                <tr>
                  {isDeleteSelectionMode && (
                    <th scope="col" className="px-4 py-4 w-10 text-center animate-in fade-in">
                      <input
                        type="checkbox"
                        checked={filteredRegistrations.length > 0 && selectedRegIds.length === filteredRegistrations.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded-full border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
                        title="Select / Deselect all"
                      />
                    </th>
                  )}
                  <th scope="col" className="px-6 py-4">Team Name / Lead</th>
                  <th scope="col" className="px-6 py-4">Event Name</th>
                  <th scope="col" className="px-6 py-4">Type</th>
                  <th scope="col" className="px-6 py-4">Date</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-750">
                {loading ? (
                  <tr>
                    <td colSpan={isDeleteSelectionMode ? 7 : 6} className="px-6 py-12 text-center">
                      <Loader2 className="h-6 w-6 text-blue-600 animate-spin mx-auto mb-2" />
                      <span className="text-slate-400 font-bold">Querying registration listings...</span>
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={isDeleteSelectionMode ? 7 : 6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                      No registrations matched current search filters.
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => {
                    const isGroup = reg.groupName && reg.groupName !== "Individual RSVP";
                    const displayTeamName = isGroup ? reg.groupName : (reg.teamLeadName || "Participant");
                    const initial = displayTeamName ? displayTeamName.substring(0, 2).toUpperCase() : "US";
                    const isSelected = selectedRegIds.includes(reg.id);
                    const isConfirmed = reg.status === "Confirmed";
                    
                    return (
                      <tr 
                        key={reg.id} 
                        className={`hover:bg-slate-50/40 transition-colors cursor-pointer ${isDeleteSelectionMode && isSelected ? "bg-red-50/30" : ""}`}
                        onClick={() => {
                          if (isDeleteSelectionMode) {
                            toggleSelectReg(reg.id);
                          } else {
                            setSelectedReg(reg);
                            setEditForm(JSON.parse(JSON.stringify(reg)));
                            setIsEditing(false);
                          }
                        }}
                      >
                        {isDeleteSelectionMode && (
                          <td className="px-4 py-4 text-center animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectReg(reg.id)}
                              className="w-4 h-4 rounded-full border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-extrabold flex items-center justify-center text-[10px] shrink-0 border border-blue-100">
                              {initial}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-800 text-xs">{displayTeamName}</span>
                              <span className="text-[10px] text-slate-450 font-medium">
                                Lead: {reg.teamLeadName} {reg.teamLeadStudentId ? `(${reg.teamLeadStudentId})` : ""}
                              </span>
                              {(reg.collegeName || reg.college || reg.collegePlace) && (
                                <span className="text-[10px] text-slate-400 font-medium whitespace-normal leading-tight mt-0.5 max-w-[250px]">
                                  {reg.collegeName || reg.college || "Unknown College"}{reg.collegePlace ? ` - ${reg.collegePlace}` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">
                          {reg.eventTitle}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-100/50 uppercase tracking-wide">
                            {isGroup ? `Group (${reg.teamSize})` : "Individual"}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                          {new Date(reg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/40 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              Confirmed
                            </span>
                          ) : reg.status === "Waitlisted" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-650 border border-slate-200/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-450"></span>
                              Waitlisted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Not Confirmed
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right whitespace-nowrap relative">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Confirm & Dispatch Email Button */}
                            <button
                              onClick={() => handleConfirmRegistrationAndSendEmail(reg)}
                              disabled={confirmingRegId === reg.id}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs border ${
                                isConfirmed
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/80"
                                  : "bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-blue-600/20"
                              }`}
                              title={
                                isConfirmed
                                  ? `Registration confirmed. Click to re-send confirmation email to ${(reg.teamLeadPersonalEmail || reg.teamLeadEmail)}`
                                  : `Confirm Registration & Send Confirmation Email to ${(reg.teamLeadPersonalEmail || reg.teamLeadEmail)}`
                              }
                            >
                              {confirmingRegId === reg.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin text-current" />
                                  <span>Confirming...</span>
                                </>
                              ) : isConfirmed ? (
                                <>
                                  <Check className="h-3 w-3 stroke-[2.5]" />
                                  <span>Confirmed</span>
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3 stroke-[2.5]" />
                                  <span>Confirm</span>
                                </>
                              )}
                            </button>

                            {/* Delete Button */}
                            <button
                              onMouseDown={() => {
                                isLongPressActive.current = false;
                                longPressTimer.current = setTimeout(() => {
                                  isLongPressActive.current = true;
                                  setActiveLongPressRegId(reg.id);
                                }, 600);
                              }}
                              onMouseUp={() => {
                                if (longPressTimer.current) {
                                  clearTimeout(longPressTimer.current);
                                  longPressTimer.current = null;
                                }
                                if (!isLongPressActive.current) {
                                  handleDeleteRegistration(reg.id, reg.eventId, reg.teamSize);
                                }
                              }}
                              onMouseLeave={() => {
                                if (longPressTimer.current) {
                                  clearTimeout(longPressTimer.current);
                                  longPressTimer.current = null;
                                }
                              }}
                              onTouchStart={() => {
                                isLongPressActive.current = false;
                                longPressTimer.current = setTimeout(() => {
                                  isLongPressActive.current = true;
                                  setActiveLongPressRegId(reg.id);
                                }, 600);
                              }}
                              onTouchEnd={() => {
                                if (longPressTimer.current) {
                                  clearTimeout(longPressTimer.current);
                                  longPressTimer.current = null;
                                }
                                if (!isLongPressActive.current) {
                                  handleDeleteRegistration(reg.id, reg.eventId, reg.teamSize);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-xl transition-all cursor-pointer relative"
                              title="Hold for Multiple Delete Options"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            {activeLongPressRegId === reg.id && (
                              <div className="absolute right-12 top-10 bg-slate-950 text-white rounded-xl shadow-xl border border-slate-800 p-4.5 z-40 w-64 space-y-4 text-left animate-in fade-in slide-in-from-top-1 duration-150 select-none">
                                <span className="text-[10px] font-black uppercase text-red-500 tracking-wider block">Delete Options</span>
                                
                                <select
                                  value={deleteModeOption}
                                  onChange={(e) => setDeleteModeOption(e.target.value as "single" | "group" | "event")}
                                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all cursor-pointer appearance-auto"
                                >
                                  <option value="single">Delete this registration only</option>
                                  {reg.groupName && reg.groupName !== "Individual RSVP" && (
                                    <option value="group">Delete all from group "{reg.groupName}"</option>
                                  )}
                                  <option value="event">Delete all for this event</option>
                                </select>

                                <div className="flex gap-2.5 pt-2.5 border-t border-slate-900">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveLongPressRegId(null);
                                      setDeleteModeOption("single");
                                    }}
                                    className="flex-1 border border-slate-800 hover:bg-slate-900 hover:border-slate-700 text-slate-300 font-extrabold text-[10px] py-2 rounded-lg transition-all text-center uppercase tracking-wider"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setActiveLongPressRegId(null);
                                      if (deleteModeOption === "single") {
                                        await handleDeleteRegistration(reg.id, reg.eventId, reg.teamSize);
                                      } else if (deleteModeOption === "group") {
                                        if (confirm(`Delete all registrations from group "${reg.groupName}"?`)) {
                                          await handleDeleteGroupRegistrations(reg.groupName);
                                        }
                                      } else if (deleteModeOption === "event") {
                                        if (confirm(`Delete all registrations for event "${reg.eventTitle}"?`)) {
                                          await handleDeleteEventRegistrations(reg.eventId);
                                        }
                                      }
                                      setDeleteModeOption("single");
                                    }}
                                    className="flex-1 bg-red-650 hover:bg-red-750 text-white font-extrabold text-[10px] py-2 rounded-lg transition-all text-center uppercase tracking-wider shadow-md shadow-red-950/40"
                                  >
                                    Confirm
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span>Showing {filteredRegistrations.length} of {registrations.length} results</span>
            <div className="flex items-center gap-1">
              <button disabled className="px-2.5 py-1 bg-slate-50 border border-slate-200/50 rounded-lg text-slate-350 shrink-0">Previous</button>
              <button disabled className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 shrink-0">Next</button>
            </div>
          </div>
        </div>


      </div>

      {/* Registration Details Modal */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-left">
            {/* Sticky Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <div>
                <span className="text-[10px] font-black text-blue-600 tracking-wider uppercase block">Roster & Registration Details</span>
                <h3 className="text-lg font-black text-slate-800 tracking-tight mt-0.5 flex flex-wrap items-center gap-2.5">
                  <span>{selectedReg.eventTitle}</span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-md">
                    #{selectedReg.id.slice(0, 8).toUpperCase()}
                  </span>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-2.5 py-1 text-[10px] font-black bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/50 rounded-lg transition-all cursor-pointer"
                    >
                      Edit Roster
                    </button>
                  )}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedReg(null);
                  setIsEditing(false);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 sm:p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Group Summary & Lead Profile */}
              <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-5 space-y-4">
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <UsersIcon className="h-3.5 w-3.5 text-blue-600" />
                  Group Summary & Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  {/* Group Name */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Group Name</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 bg-white" 
                        value={editForm?.groupName || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, groupName: e.target.value } : null)}
                      />
                    ) : (
                      <span className="text-xs font-black text-slate-800 block">{selectedReg.groupName || "Individual RSVP"}</span>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Contact / Phone Number</span>
                    {isEditing ? (
                      <input 
                        type="tel" 
                        placeholder="e.g. 9876543210"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 bg-white" 
                        value={editForm?.phoneNumber || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        {selectedReg.phoneNumber ? (
                          <a 
                            href={`tel:${selectedReg.phoneNumber}`}
                            className="text-xs font-black text-blue-600 hover:underline inline-flex items-center gap-1"
                            title="Click to call"
                          >
                            {selectedReg.phoneNumber}
                          </a>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Not Provided</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Team Size & Status */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Team Size & Status</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-2 py-0.5 bg-blue-100/80 text-blue-700 font-black rounded-md text-[10px]">
                        {selectedReg.teamSize || selectedReg.members.length + 1} Member{selectedReg.members.length > 0 ? "s" : ""}
                      </span>
                      <span className={`px-2 py-0.5 font-black rounded-md text-[10px] ${
                        selectedReg.status === "Confirmed" 
                          ? "bg-emerald-100 text-emerald-700" 
                          : selectedReg.status === "Waitlisted"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-100 text-amber-700 border border-amber-200/60"
                      }`}>
                        {selectedReg.status === "Confirmed" ? "Confirmed" : selectedReg.status === "Waitlisted" ? "Waitlisted" : "Not Confirmed"}
                      </span>
                    </div>
                  </div>

                  {/* Lead Personal Email */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Personal Email</span>
                    {isEditing ? (
                      <input 
                        type="email" 
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 bg-white" 
                        value={editForm?.teamLeadPersonalEmail || editForm?.teamLeadEmail || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, teamLeadPersonalEmail: e.target.value, teamLeadEmail: e.target.value } : null)}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate" title={selectedReg.teamLeadPersonalEmail || selectedReg.teamLeadEmail}>
                          {selectedReg.teamLeadPersonalEmail || selectedReg.teamLeadEmail || "Not Provided"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Lead College Email */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">College Email</span>
                    {isEditing ? (
                      <input 
                        type="email" 
                        placeholder="student@vishnu.edu.in"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 bg-white" 
                        value={editForm?.teamLeadCollegeEmail || ""}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, teamLeadCollegeEmail: e.target.value } : null)}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-700 truncate" title={selectedReg.teamLeadCollegeEmail}>
                          {selectedReg.teamLeadCollegeEmail || "Not Provided"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Academic Details (Branch / Year / Section) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Academic Info</span>
                    {isEditing ? (
                      <div className="grid grid-cols-3 gap-1">
                        <input 
                          type="text" 
                          placeholder="Branch"
                          className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white" 
                          value={editForm?.branch || ""}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, branch: e.target.value } : null)}
                        />
                        <input 
                          type="text" 
                          placeholder="Year"
                          className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white" 
                          value={editForm?.year || ""}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, year: e.target.value } : null)}
                        />
                        <input 
                          type="text" 
                          placeholder="Sec"
                          className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white" 
                          value={editForm?.section || ""}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, section: e.target.value } : null)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold text-slate-700">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          {selectedReg.branch || selectedReg.year || selectedReg.section ? (
                            <>
                              {selectedReg.branch || "General"}
                              {selectedReg.year ? ` • Year ${selectedReg.year}` : ""}
                              {selectedReg.section ? ` • Sec ${selectedReg.section}` : ""}
                            </>
                          ) : (
                            <span className="text-slate-400 font-semibold">Not Specified</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* College Details */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">College Info</span>
                    {isEditing ? (
                      <div className="space-y-1">
                        <input 
                          type="text" 
                          placeholder="College Name"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 bg-white" 
                          value={editForm?.collegeName || editForm?.college || ""}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, collegeName: e.target.value } : null)}
                        />
                        <input 
                          type="text" 
                          placeholder="College Place"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 bg-white" 
                          value={editForm?.collegePlace || ""}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, collegePlace: e.target.value } : null)}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col mt-0.5">
                        <span className="text-xs font-bold text-slate-800 truncate" title={selectedReg.collegeName || selectedReg.college}>
                          <Building2 className="w-3 h-3 inline mr-1 text-slate-400" />
                          {selectedReg.collegeName || selectedReg.college || "Not Provided"}
                        </span>
                        {selectedReg.collegePlace && (
                          <span className="text-[10px] font-medium text-slate-450 truncate mt-0.5 block">
                            <MapPin className="w-2.5 h-2.5 inline mr-1 text-slate-400" />
                            {selectedReg.collegePlace}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Food / Hospitality Preference */}
                  {selectedReg.foodPreference && (
                    <div className="space-y-1 sm:col-span-2 md:col-span-4 pt-2 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dining / Food Preference:</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {selectedReg.foodPreference}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Registration Date */}
                  <div className="space-y-1 sm:col-span-2 md:col-span-4 pt-2 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-2 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-600">
                        Registered on: <strong className="text-slate-800">{new Date(selectedReg.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Roster Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pl-1">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                    Roster List ({selectedReg.members.length + 1} members)
                  </h4>
                </div>
                
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[9px] font-black text-slate-450 tracking-wider uppercase border-b border-slate-200/70">
                        <tr>
                          <th className="px-4 py-3">Member</th>
                          <th className="px-4 py-3">Student ID</th>
                          <th className="px-4 py-3">Email Address</th>
                          <th className="px-4 py-3">Phone Number</th>
                          <th className="px-4 py-3 text-right">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {/* Team Lead */}
                        <tr className="bg-blue-50/20">
                          <td className="px-4 py-3.5">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input 
                                  type="text" 
                                  className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-850" 
                                  value={editForm?.teamLeadName || ""}
                                  onChange={(e) => setEditForm(prev => prev ? { ...prev, teamLeadName: e.target.value } : null)}
                                />
                                <span className="text-[8px] font-bold text-blue-600 uppercase tracking-wider block">Team Lead</span>
                              </div>
                            ) : (
                              <>
                                <span className="font-extrabold text-slate-850 block">{selectedReg.teamLeadName}</span>
                                <span className="text-[8px] font-bold text-blue-600 uppercase tracking-wider block mt-0.5">Team Lead</span>
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-600">
                            {isEditing ? (
                              <input 
                                type="text" 
                                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 font-bold" 
                                value={editForm?.teamLeadStudentId || ""}
                                onChange={(e) => setEditForm(prev => prev ? { ...prev, teamLeadStudentId: e.target.value } : null)}
                              />
                            ) : (
                              <span className="font-mono">{selectedReg.teamLeadStudentId || "N/A"}</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-655 space-y-0.5">
                            {isEditing ? (
                              <input 
                                type="text" 
                                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-705" 
                                value={editForm?.teamLeadEmail || ""}
                                onChange={(e) => setEditForm(prev => prev ? { ...prev, teamLeadEmail: e.target.value } : null)}
                              />
                            ) : (
                              <>
                                <span className="font-bold text-slate-800 text-xs block">{selectedReg.teamLeadEmail}</span>
                                {selectedReg.teamLeadCollegeEmail && selectedReg.teamLeadCollegeEmail !== selectedReg.teamLeadEmail && (
                                  <span className="text-[10px] text-slate-400 font-medium block">
                                    🏛️ {selectedReg.teamLeadCollegeEmail}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700">
                            {isEditing ? (
                              <input 
                                type="tel" 
                                placeholder="Phone"
                                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-705 font-bold" 
                                value={editForm?.phoneNumber || ""}
                                onChange={(e) => setEditForm(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)}
                              />
                            ) : selectedReg.phoneNumber ? (
                              <a href={`tel:${selectedReg.phoneNumber}`} className="font-mono font-bold text-blue-600 hover:underline flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {selectedReg.phoneNumber}
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="inline-block px-2.5 py-0.5 bg-blue-100 border border-blue-200 text-blue-700 font-black rounded-md text-[8.5px] uppercase tracking-wide">
                              Leader
                            </span>
                          </td>
                        </tr>

                        {/* Teammates */}
                        {selectedReg.members.map((m, idx) => {
                          const roles = ["Developer", "Researcher", "Analyst"];
                          const badgeStyles = [
                            "bg-sky-50 text-sky-700 border-sky-100",
                            "bg-emerald-50 text-emerald-700 border-emerald-100",
                            "bg-indigo-50 text-indigo-700 border-indigo-100"
                          ];
                          const roleName = roles[idx % roles.length];
                          const badgeStyle = badgeStyles[idx % badgeStyles.length];

                          return (
                            <tr key={idx} className="hover:bg-slate-50/40">
                              <td className="px-4 py-3.5">
                                {isEditing ? (
                                  <div className="space-y-1">
                                    <input 
                                      type="text" 
                                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-850" 
                                      value={editForm?.members[idx]?.name || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditForm(prev => {
                                          if (!prev) return null;
                                          const members = [...prev.members];
                                          members[idx] = { ...members[idx], name: val };
                                          return { ...prev, members };
                                        });
                                      }}
                                    />
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Member #{idx + 2}</span>
                                  </div>
                                ) : (
                                  <>
                                    <span className="font-bold text-slate-850 block">{m.name}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Member #{idx + 2}</span>
                                  </>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-bold text-slate-600">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 font-bold" 
                                    value={editForm?.members[idx]?.studentId || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditForm(prev => {
                                        if (!prev) return null;
                                        const members = [...prev.members];
                                        members[idx] = { ...members[idx], studentId: val };
                                        return { ...prev, members };
                                      });
                                    }}
                                  />
                                ) : (
                                  <span className="font-mono">{m.studentId || "N/A"}</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-slate-655">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-705" 
                                    value={editForm?.members[idx]?.email || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditForm(prev => {
                                        if (!prev) return null;
                                        const members = [...prev.members];
                                        members[idx] = { ...members[idx], email: val };
                                        return { ...prev, members };
                                      });
                                    }}
                                  />
                                ) : (
                                  m.email
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-slate-700">
                                {isEditing ? (
                                  <input 
                                    type="tel" 
                                    placeholder="Phone"
                                    className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-705" 
                                    value={editForm?.members[idx]?.phone || editForm?.members[idx]?.phoneNumber || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditForm(prev => {
                                        if (!prev) return null;
                                        const members = [...prev.members];
                                        members[idx] = { ...members[idx], phone: val, phoneNumber: val };
                                        return { ...prev, members };
                                      });
                                    }}
                                  />
                                ) : m.phone || m.phoneNumber ? (
                                  <a href={`tel:${m.phone || m.phoneNumber}`} className="font-mono font-bold text-blue-600 hover:underline flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {m.phone || m.phoneNumber}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                {isEditing ? (
                                  <select 
                                    className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 bg-white focus:outline-none" 
                                    value={editForm?.members[idx]?.role || roleName}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditForm(prev => {
                                        if (!prev) return null;
                                        const members = [...prev.members];
                                        members[idx] = { ...members[idx], role: val };
                                        return { ...prev, members };
                                      });
                                    }}
                                  >
                                    <option value="Developer">Developer</option>
                                    <option value="Researcher">Researcher</option>
                                    <option value="Analyst">Analyst</option>
                                  </select>
                                ) : (
                                  <span className={`inline-block px-2.5 py-0.5 border font-black rounded text-[8px] uppercase tracking-wide ${badgeStyle}`}>
                                    {m.role || roleName}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Payment Proof & Transaction Details for Faculty View */}
              {(selectedReg.paymentProofPreview || selectedReg.transactionId || selectedReg.totalFeePaid) && (
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Payment Proof & Verification Details
                    </span>
                    {selectedReg.paymentStatus && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-full text-[9.5px] border border-emerald-200">
                        {selectedReg.paymentStatus}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transaction ID / UTR Number</span>
                      <span className="font-mono font-extrabold text-slate-850 text-xs block mt-1 select-all">
                        {selectedReg.transactionId || selectedReg.utrNumber || "N/A"}
                      </span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Amount Paid</span>
                      <span className="font-black text-emerald-600 text-sm block mt-1">
                        ₹{selectedReg.totalFeePaid || 0}
                      </span>
                    </div>
                  </div>

                  {selectedReg.paymentProofPreview && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attached Payment Receipt</span>
                      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-28 h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-1 shrink-0 flex items-center justify-center">
                          <img 
                            src={selectedReg.paymentProofPreview} 
                            alt="Payment Proof" 
                            className="w-full h-full object-contain rounded-lg"
                          />
                        </div>
                        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                          <div className="font-mono text-xs font-bold text-slate-700 truncate">
                            {selectedReg.paymentProofFilename || "payment-proof-receipt.jpg"}
                          </div>
                          <p className="text-[11px] text-slate-450 font-medium">
                            Submitted screenshot for payment verification.
                          </p>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                            <a 
                              href={selectedReg.paymentProofPreview} 
                              target="_blank" 
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/70 font-bold rounded-xl text-[11px] inline-flex items-center gap-1.5 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View Full Size Receipt
                            </a>
                            <a 
                              href={selectedReg.paymentProofPreview} 
                              download={selectedReg.paymentProofFilename || "payment-receipt.jpg"}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-xl text-[11px] inline-flex items-center gap-1.5 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Sticky Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-2 shrink-0">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm(JSON.parse(JSON.stringify(selectedReg)));
                    }}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRoster}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl text-xs hover:shadow-lg transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                (() => {
                  const isModalRegConfirmed = selectedReg.status === "Confirmed";

                  return isModalRegConfirmed ? (
                    <div className="flex items-center gap-2">
                      <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200/90 text-emerald-700 font-extrabold rounded-2xl text-xs flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Confirmed</span>
                      </div>
                      <button
                        onClick={() => handleConfirmRegistrationAndSendEmail(selectedReg)}
                        disabled={confirmingRegId === selectedReg.id}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title={`Resend confirmation email to ${(selectedReg.teamLeadPersonalEmail || selectedReg.teamLeadEmail)}`}
                      >
                        {confirmingRegId === selectedReg.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Resending Email...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span>Resend Confirmation Email</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedReg(null)}
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-2xl text-xs transition-colors cursor-pointer shadow-2xs"
                      >
                        Close Roster
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConfirmRegistrationAndSendEmail(selectedReg)}
                        disabled={confirmingRegId === selectedReg.id}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {confirmingRegId === selectedReg.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending Confirmation...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Confirm & Send Email</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedReg(null)}
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-2xl text-xs transition-colors cursor-pointer shadow-2xs"
                      >
                        Close Roster
                      </button>
                    </div>
                  );
                })()
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= EXPORT DATA MODAL ================= */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-100 shadow-2xl overflow-hidden p-6 space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold shadow-inner">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-850">Export Registration Records</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Select an event to generate and download CSV data report.</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Event</label>
                <select
                  value={exportSelectedEvent}
                  onChange={(e) => setExportSelectedEvent(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-800 bg-slate-50/30 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="All">All Events (All Registrations)</option>
                  {uniqueEvents.filter(ev => ev !== "All").map((ev, idx) => (
                    <option key={idx} value={ev}>{ev}</option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/60 text-xs text-slate-600 space-y-1">
                <span className="font-bold text-blue-700 block">Report Summary:</span>
                <p>
                  Will export {exportSelectedEvent === "All" ? registrations.length : registrations.filter(r => r.eventTitle === exportSelectedEvent).length} registration record(s) 
                  for <span className="font-bold text-slate-800">{exportSelectedEvent}</span> into CSV spreadsheet format.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Export CSV Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrationsManagementPage;
