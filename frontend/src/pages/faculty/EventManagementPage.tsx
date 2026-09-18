import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import SEO from "../../components/layout/SEO";
import Papa from "papaparse";
import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  deleteDoc, 
  getDoc, 
  setDoc, 
  writeBatch 
} from "../../config/firebase";
import { userService } from "../../services/userService";
import { deleteQuizzesByEventId, evaluateQuizAnswers } from "../../services/quizService";
import { 
  fetchEvents, 
  fetchEventById, 
  fetchRegistrations, 
  createEvent, 
  updateEvent, 
  deleteEvent, 
  createRegistration,
  updateRegistration,
  fetchAllQuizzes,
  fetchQuizSubmissions,
  fetchJuryEvaluations,
  uploadImage
} from "../../services/apiClient";
import { useModal } from "../../context/ModalContext";
import {
  Calendar,
  User,
  Users,
  UserPlus,
  TrendingUp,
  Clock,
  Plus,
  SlidersHorizontal,
  Download,
  HelpCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Trash2,
  Upload,
  Info,
  Settings2,
  Pencil,
  CheckSquare,
  MessageSquare,
  Eye,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  FileText,
  FileCode,
  X,
  Loader2,
  Key,
  Lock,
  UserCheck,
  IndianRupee,
  CreditCard,
  Layers,
  Trophy,
  Award,
  QrCode,
  Ticket,
  Mail,
  Send,
  CheckCircle2,
  FileSpreadsheet
} from "lucide-react";
import DatePicker from "../../components/ui/DatePicker";
import TimePicker from "../../components/ui/TimePicker";
import MemberSelectCombobox from "../../components/ui/MemberSelectCombobox";
import { sendResendEmail } from "../../utils/resendEmailService";
import { buildRoundPromotionEmail, buildCertificateEmail } from "../../utils/emailTemplates";
import { dataCache } from "../../utils/dataCache";
import { EventLaunchSplash, type EventLaunchData } from "../../components/common/EventLaunchSplash";

// Import local assets
import sparkImg from "../../assets/images/spark.png";
import hackathonImg from "../../assets/images/hackathon.png";
import seminarImg from "../../assets/images/seminar.png";

interface EventItem {
  id: string;
  title: string;
  date: string;
  location: string;
  category: "HACKATHONS" | "LECTURES" | "WORKSHOPS" | "TECH_EVENTS" | "ALUMNI_MEETUPS" | "QUIZ" | string;
  status: "Draft" | "Active" | "Opened" | "Completed";
  currentReg: number;
  maxReg: number;
  image?: string;
  [key: string]: any;
}

const EventManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const cachedEvents = dataCache.get<EventItem[]>("faculty_events");
  const [events, setEvents] = useState<EventItem[]>(cachedEvents || []);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(!cachedEvents);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const paymentQrFileInputRef = React.useRef<HTMLInputElement>(null);
  const ticketBgFileInputRef = React.useRef<HTMLInputElement>(null);

  // Celebratory Launch Splash state when saving or publishing an event
  const [launchedEventData, setLaunchedEventData] = useState<EventLaunchData | null>(null);
  const [isLaunchSplashOpen, setIsLaunchSplashOpen] = useState<boolean>(false);

  const handleCloseLaunchSplash = () => {
    setIsLaunchSplashOpen(false);
    setLaunchedEventData(null);
    setEditingEventId(null);
    setView("list");
  };

  const handleViewLaunchedEvent = (targetId?: string) => {
    setIsLaunchSplashOpen(false);
    setLaunchedEventData(null);
    setEditingEventId(null);
    setView("list");
    if (targetId) {
      handleOpenEventDetails(targetId);
    }
  };

  // Client-side image compression utility to keep Firestore documents well below the 1MB limit
  const compressImageFile = (
    file: File,
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.75
  ): Promise<string> => {
    return new Promise((resolve) => {
      if (!file) {
        resolve("");
        return;
      }
      if (file.type === "image/svg+xml") {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || "");
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / maxWidth > height / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(compressedDataUrl);
          } else {
            resolve((e.target?.result as string) || "");
          }
        };
        img.onerror = () => resolve((e.target?.result as string) || "");
        img.src = (e.target?.result as string) || "";
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  const compressBase64String = (
    dataUrl: string,
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.75
  ): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith("data:image")) {
        resolve(dataUrl || "");
        return;
      }
      if (dataUrl.length < 100000) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleTicketBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormTicketBgFilename(file.name);
      try {
        const compressed = await compressImageFile(file, 1200, 1200, 0.75);
        setFormTicketBgPreview(compressed);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => setFormTicketBgPreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handlePaymentQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormPaymentQrImageFilename(file.name);
      try {
        const compressed = await compressImageFile(file, 600, 600, 0.8);
        setFormPaymentQrImagePreview(compressed);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => setFormPaymentQrImagePreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        try {
          const compressed = await compressImageFile(file, 1200, 1200, 0.75);
          setFormPosterImages(prev => [...prev, { filename: file.name, preview: compressed }]);
        } catch {
          const reader = new FileReader();
          reader.onloadend = () => {
            setFormPosterImages(prev => [...prev, { filename: file.name, preview: reader.result as string }]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Fetch events from backend API on mount
  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const [rawEvents, rawRegs] = await Promise.all([
          fetchEvents().catch(() => []),
          fetchRegistrations().catch(() => [])
        ]);

        const rawList = Array.isArray(rawEvents) ? rawEvents : (rawEvents?.events || rawEvents?.data || []);
        const regList = Array.isArray(rawRegs) ? rawRegs : (rawRegs?.registrations || rawRegs?.data || []);

        // Build dynamic team count and seat count maps per event
        const liveTeamCountMap: Record<string, number> = {};
        const liveSeatCountMap: Record<string, number> = {};
        regList.forEach((r: any) => {
          const eid = String(r.eventId || r.event || "").trim();
          const eTitle = String(r.eventTitle || "").trim().toLowerCase();
          const membersLen = Array.isArray(r.members) ? r.members.length : 0;
          const seatCount = membersLen > 0 ? membersLen + 1 : (Number(r.teamSize) || 1);

          if (eid) {
            liveTeamCountMap[eid] = (liveTeamCountMap[eid] || 0) + 1;
            liveTeamCountMap[eid.toLowerCase()] = liveTeamCountMap[eid];
            liveSeatCountMap[eid] = (liveSeatCountMap[eid] || 0) + seatCount;
            liveSeatCountMap[eid.toLowerCase()] = liveSeatCountMap[eid];
          }
          if (eTitle) {
            liveTeamCountMap[eTitle] = (liveTeamCountMap[eTitle] || 0) + 1;
            liveSeatCountMap[eTitle] = (liveSeatCountMap[eTitle] || 0) + seatCount;
          }
        });

        const mapped = rawList.map((data: any) => {
          let poster = 
            data.posterPreview || 
            (Array.isArray(data.posterImages) && data.posterImages[0]?.preview) ||
            data.image || 
            data.imageUrl || 
            data.poster || 
            data.coverImage || 
            data.bannerImage || 
            data.banner || 
            "";

          if (!poster) {
            const cat = (data.category || "").toUpperCase();
            if (cat.includes("HACKATHON")) poster = hackathonImg;
            else if (cat.includes("SPARK")) poster = sparkImg;
            else poster = seminarImg;
          }

          const evId = String(data._id || data.id || "").trim();
          const evTitle = String(data.title || "").trim().toLowerCase();
          const liveTeams = liveTeamCountMap[evId] || liveTeamCountMap[evId.toLowerCase()] || (evTitle ? liveTeamCountMap[evTitle] : 0) || 0;
          const liveSeats = liveSeatCountMap[evId] || liveSeatCountMap[evId.toLowerCase()] || (evTitle ? liveSeatCountMap[evTitle] : 0) || 0;
          // Use live registered team count from active registrations
          const currentReg = Array.isArray(rawRegs) ? liveTeams : (Number(data.currentReg) || 0);

          return {
            ...data,
            id: data._id || data.id,
            title: data.title || "",
            date: data.date || data.startDate || "",
            location: data.location || data.venue || "",
            category: data.category || "WORKSHOPS",
            status: data.status || "Draft",
            currentReg,
            maxReg: data.maxReg || 100,
            image: poster,
            posterPreview: data.posterPreview || (Array.isArray(data.posterImages) && data.posterImages[0]?.preview) || poster,
          } as EventItem;
        });
        setEvents(mapped);
        dataCache.set("faculty_events", mapped, 60_000);
      } catch (err) {
        console.error("Error reading events from API:", err);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const mergedUsers: any[] = [];
        const seenEmails = new Set<string>();

        // 1. Fetch from Supabase users
        try {
          const supaUsers = await userService.getUsers();
          if (supaUsers && supaUsers.length > 0) {
            supaUsers.forEach((u) => {
              const emailKey = (u.email || "").toLowerCase().trim();
              if (emailKey && !seenEmails.has(emailKey)) {
                seenEmails.add(emailKey);
                mergedUsers.push({
                  id: u.id,
                  name: u.name || u.display_name || u.email?.split("@")[0] || "User",
                  displayName: u.display_name || u.name,
                  email: u.email,
                  role: u.role || "Member",
                  position: u.position || u.role || "Team Member",
                  image: u.image || "",
                  phone: u.phone || "",
                  status: u.status || "Active"
                });
              }
            });
          }
        } catch (supaErr) {
          console.warn("Notice loading users from Supabase:", supaErr);
        }

        // 2. Fetch from Firestore collections removed; rely on Supabase users only

        // Sort by name alphabetically
        mergedUsers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setAllUsers(mergedUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
  }, []);

  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"list" | "create">("list");
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Event Details Modal State
  const [selectedEventDetails, setSelectedEventDetails] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [copiedWhatsLink, setCopiedWhatsLink] = useState(false);
  const [activeImageLightbox, setActiveImageLightbox] = useState<string | null>(null);

  // Event Access Modal State & Handlers
  const [isEventAccessModalOpen, setIsEventAccessModalOpen] = useState(false);
  const [isEventRosterModalOpen, setIsEventRosterModalOpen] = useState(false);
  const [eventAccessEvent, setEventAccessEvent] = useState<any | null>(null);
  const [eventAccessRegistrations, setEventAccessRegistrations] = useState<any[]>([]);
  const [loadingEventAccessRegs, setLoadingEventAccessRegs] = useState(false);
  const [eventAccessSearchQuery, setEventAccessSearchQuery] = useState("");
  const [loginAccessSuccessMsg, setLoginAccessSuccessMsg] = useState<string | null>(null);
  const [isProvisioningLoginAccess, setIsProvisioningLoginAccess] = useState(false);
  const [provisionedTeamIds, setProvisionedTeamIds] = useState<string[]>([]);
  const [eventRosterViewMode, setEventRosterViewMode] = useState<"teams" | "individuals">("teams");
  const [eventRosterFilter, setEventRosterFilter] = useState<"all" | "teams" | "individuals" | "confirmed" | "pending">("all");
  const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([]);

  // Step Lock Modal State & Handlers
  const [stepLockTarget, setStepLockTarget] = useState<{ stepId: number; name: string } | null>(null);
  const [isLockingStep, setIsLockingStep] = useState(false);

  // Real-time listener for registrations when Event Access / Matrix Monitor is open
  useEffect(() => {
    if (!isEventAccessModalOpen || !eventAccessEvent) return;

    let poll: any = null;
    const loadRegs = async () => {
      try {
        const rawRegs = await fetchRegistrations().catch(() => []);
        const snapshot = Array.isArray(rawRegs) ? rawRegs : (rawRegs?.registrations || rawRegs?.data || []);
        const list: any[] = [];
        const grantedIds: string[] = [];
        const curEid = (eventAccessEvent?.id ? String(eventAccessEvent.id) : "").trim();
        const curTitle = (eventAccessEvent?.title || "").toLowerCase().trim();
        const cleanCurEid = curEid.replace(/[Il]/g, "i").toLowerCase();

        snapshot.forEach((data: any) => {
          const regId = data.id || data._id;
          const regEid = (data.eventId ? String(data.eventId) : "").trim();
          const regTitle = (data.eventTitle || "").toLowerCase().trim();

          const isIdMatch = Boolean(
            regEid && curEid && (
              regEid === curEid ||
              regEid.toLowerCase() === curEid.toLowerCase() ||
              regEid.replace(/[Il]/g, "i").toLowerCase() === cleanCurEid
            )
          );
          const isTitleMatch = Boolean(regTitle && curTitle && (regTitle === curTitle || regTitle.includes(curTitle) || curTitle.includes(regTitle)));

          if (isIdMatch || isTitleMatch) {
            list.push({ id: regId, ...data });
            const isConfirmed = String(data.status || "").toLowerCase().trim() === "confirmed";
            if (isConfirmed && (data.accessGranted || data.loginAccessGranted)) {
              grantedIds.push(regId);
            }
          }
        });
        setEventAccessRegistrations(list);
        setProvisionedTeamIds(grantedIds);
        setLoadingEventAccessRegs(false);
      } catch (err) {
        console.error("Error loading event registrations:", err);
      }
    };

    loadRegs();
    poll = setInterval(loadRegs, 10000);
    return () => { if (poll) clearInterval(poll); };
  }, [isEventAccessModalOpen, eventAccessEvent?.id]);

  // Real-time listener for event document state (rounds, lockedSteps, currentRound, etc.)
  useEffect(() => {
    if (!isEventAccessModalOpen || !eventAccessEvent?.id) return;

    let pollEv: any = null;
    const loadEv = async () => {
      try {
        const evData = await fetchEventById(eventAccessEvent.id).catch(() => null);
        if (evData) {
          setEventAccessEvent((prev: any) => ({ ...prev, ...evData, id: evData.id || evData._id || eventAccessEvent.id }));
        }
      } catch (err) {
        console.error("Error loading event doc:", err);
      }
    };
    loadEv();
    pollEv = setInterval(loadEv, 5000);
    return () => { if (pollEv) clearInterval(pollEv); };
  }, [isEventAccessModalOpen, eventAccessEvent?.id]);

  // Automatically open Event Access modal when navigated with ?accessEventId= or ?eventId=
  useEffect(() => {
    const accessEventId = searchParams.get("accessEventId") || searchParams.get("eventId");
    if (accessEventId && events.length > 0) {
      if (!isEventAccessModalOpen || eventAccessEvent?.id !== accessEventId) {
        const cleanAccess = accessEventId.replace(/[Il]/g, "i").toLowerCase();
        const targetEvent = events.find((e) =>
          e.id === accessEventId ||
          e.id.toLowerCase() === accessEventId.toLowerCase() ||
          e.id.replace(/[Il]/g, "i").toLowerCase() === cleanAccess
        );
        if (targetEvent) {
          handleOpenEventAccess(targetEvent);
        }
      }
    }
  }, [searchParams, events]);

  const handleCloseEventAccess = () => {
    setIsEventAccessModalOpen(false);
    setEventAccessEvent(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("accessEventId");
    newParams.delete("eventId");
    setSearchParams(newParams, { replace: true });
  };

  const handleConfirmStepLockToggle = async () => {
    if (!eventAccessEvent || !stepLockTarget) return;
    setIsLockingStep(true);
    const { stepId, name } = stepLockTarget;
    const currentLocked = eventAccessEvent.lockedSteps || {};
    const isCurrentlyLocked = !!currentLocked[stepId];
    const newLocked = { ...currentLocked, [stepId]: !isCurrentlyLocked };

    try {
      await updateEvent(eventAccessEvent.id, {
        lockedSteps: newLocked,
        updatedAt: Date.now()
      });

      setEventAccessEvent((prev: any) => ({
        ...prev,
        lockedSteps: newLocked
      }));

      setLoginAccessSuccessMsg(`Successfully ${newLocked[stepId] ? 'LOCKED 🔒' : 'UNLOCKED 🔓'} Step ${stepId} (${name}) for all teams!`);
      setTimeout(() => setLoginAccessSuccessMsg(null), 4500);
    } catch (err) {
      console.error("Error toggling step lock in Firestore:", err);
      alert("Failed to update step lock state.");
    } finally {
      setIsLockingStep(false);
      setStepLockTarget(null);
    }
  };

  // Team Submissions Monitor State
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [selectedTeamSubmission, setSelectedTeamSubmission] = useState<any | null>(null);
  const [submissionsFilter, setSubmissionsFilter] = useState<"All" | "Submitted" | "Draft" | "Pending">("All");
  const [submissionsSearchQuery, setSubmissionsSearchQuery] = useState("");
  const [matrixViewRound, setMatrixViewRound] = useState<number>(0); // 0 = current round (live data)

  const handleOpenSubmissionsModal = () => {
    setSubmissionsFilter("All");
    setSubmissionsSearchQuery("");
    setMatrixViewRound(0);
    setIsSubmissionsModalOpen(true);
  };

  const handleExportSubmissionsCsv = () => {
    if (eventAccessRegistrations.length === 0) {
      alert("No registered teams to export.");
      return;
    }

    const exportData = eventAccessRegistrations.map((reg, idx) => {
      const isGroup = reg.groupName && reg.groupName !== "Individual RSVP";
      const teamName = isGroup ? reg.groupName : (reg.teamLeadName || reg.name || "Individual Participant");
      const isSubmitted = reg.submissionStatus === "Submitted" || !!reg.submittedAt;
      const isDraft = reg.submissionStatus === "Draft" || (!!reg.problemStatement && !isSubmitted);
      const status = isSubmitted ? "Submitted" : isDraft ? "Draft" : "Not Started";

      return {
        "S.No": idx + 1,
        "Team / Project Name": teamName,
        "Team Lead Name": reg.teamLeadName || reg.name || "",
        "Roll Number": reg.teamLeadStudentId || reg.studentId || "",
        "Email Address": reg.teamLeadPersonalEmail || reg.personalEmail || reg.teamLeadEmail || reg.email || "",
        "Phone Number": reg.phoneNumber || "",
        "Branch": reg.branch || "CSE",
        "Section": reg.section || "",
        "Team Size": reg.teamSize || (reg.members?.length || 1),
        "Problem Statement ID": reg.selectedProblemStatementId || reg.problemStatementCode || "",
        "Problem Statement Title": reg.selectedProblemStatement?.title || reg.problemStatement || "",
        "Track": reg.selectedProblemStatement?.track || reg.problemStatementTrack || "General",
        "Submission Status": status,
        "Submitted Timestamp": reg.submittedAt ? new Date(reg.submittedAt).toLocaleString() : "",
        "GitHub Repo": reg.githubUrl || "",
        "Prototype Link": reg.prototypeUrl || "",
        "Demo Video Link": reg.demoVideoUrl || "",
        "SRS Document": reg.srsFileName || "",
        "Presentation Deck": reg.presentationFileName || "",
        "Key Features / Summary": reg.keyFeatures || ""
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${(eventAccessEvent?.title || "event").replace(/[^a-z0-9]/gi, "_")}_submissions_matrix.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUnlockSingleTeamSubmission = async (regId: string, teamName: string) => {
    const confirmed = await showConfirm({
      title: "Unlock Team Submission?",
      message: `Unlock submission for team "${teamName}"?\n\nThis will allow them to update problem statements, re-upload documents, and resubmit.`,
      confirmText: "Unlock Submission",
      cancelText: "Cancel",
      type: "warning",
      icon: "alert"
    });
    if (!confirmed) return;

    try {
      await updateRegistration(regId, {
        isPsLocked: false,
        problemStatementLocked: false,
        submissionLocked: false,
        submissionStatus: "Draft",
        updatedAt: Date.now()
      });
      await showAlert({
        title: "Submission Unlocked",
        message: `Successfully unlocked submission for "${teamName}".`,
        type: "success",
        icon: "check"
      });
      setSelectedTeamSubmission((prev: any) => prev ? { ...prev, isPsLocked: false, problemStatementLocked: false, submissionLocked: false, submissionStatus: "Draft" } : null);
    } catch (err) {
      console.error("Error unlocking team submission:", err);
      await showAlert({
        title: "Unlock Failed",
        message: "Failed to unlock team submission. Please try again.",
        type: "danger"
      });
    }
  };

  // 🎓 CERTIFICATE MANAGEMENT & EMAIL DISTRIBUTION STATE & HANDLERS
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [certTab, setCertTab] = useState<"studio" | "distribution" | "logs">("studio");
  const [certTemplateMode, setCertTemplateMode] = useState<"custom" | "builtin">("custom");
  const [certCustomTemplateUrl, setCertCustomTemplateUrl] = useState<string>("");
  const [certCustomTemplateFilename, setCertCustomTemplateFilename] = useState<string>("");
  const [certType, setCertType] = useState<string>("Certificate of Appreciation");
  const [certCollegeName, setCertCollegeName] = useState<string>("Vishnu Institute of Technology (Autonomous), Bhimavaram");
  const [certDeptName, setCertDeptName] = useState<string>("Department of Computer Science & Engineering");
  const [certIssueDate, setCertIssueDate] = useState<string>(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  const [certAudienceFilter, setCertAudienceFilter] = useState<string>("all");
  const [certSearchQuery, setCertSearchQuery] = useState<string>("");
  const [selectedCertRecipients, setSelectedCertRecipients] = useState<string[]>([]);
  const [isSendingCertificates, setIsSendingCertificates] = useState<boolean>(false);
  const [certSendingProgress, setCertSendingProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
    currentEmail: string;
    successCount: number;
    failCount: number;
    errorMsg?: string;
  } | null>(null);
  const [testCertEmail, setTestCertEmail] = useState<string>("");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [certSuccessToast, setCertSuccessToast] = useState<string | null>(null);

  // Custom Template Fine-tuning Options (Participant, Team, Roll Placeholders)
  const [certNamePosY, setCertNamePosY] = useState<number>(38); // % from top
  const [certNameFontSize, setCertNameFontSize] = useState<number>(64); // px in 2000px canvas
  const [certNameColor, setCertNameColor] = useState<string>("#1E3A8A");

  const [certShowTeamName, setCertShowTeamName] = useState<boolean>(true);
  const [certTeamPosY, setCertTeamPosY] = useState<number>(53); // % from top
  const [certTeamFontSize, setCertTeamFontSize] = useState<number>(32);
  const [certTeamColor, setCertTeamColor] = useState<string>("#1E3A8A");

  const [certShowRollNo, setCertShowRollNo] = useState<boolean>(true);
  const [certRollPosY, setCertRollPosY] = useState<number>(45); // % from top
  const [certRollFontSize, setCertRollFontSize] = useState<number>(20);
  const [certRollColor, setCertRollColor] = useState<string>("#475569");

  const [certShowQrCode, setCertShowQrCode] = useState<boolean>(false);
  const [isSavingCertTemplate, setIsSavingCertTemplate] = useState<boolean>(false);
  const [certTemplateSaveSuccess, setCertTemplateSaveSuccess] = useState<string | null>(null);

  const certFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCertTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG, JPG, JPEG, WEBP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit. Please choose an image smaller than 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setCertCustomTemplateUrl(dataUrl);
        setCertCustomTemplateFilename(file.name);
        setCertTemplateMode("custom");
        setCertShowQrCode(false);
        setCertTemplateSaveSuccess(`Template "${file.name}" uploaded! You can now adjust Participant and Team Name positions.`);
        setTimeout(() => setCertTemplateSaveSuccess(null), 5000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCertTemplate = () => {
    setCertCustomTemplateUrl("");
    setCertCustomTemplateFilename("");
    setCertTemplateMode("builtin");
  };

  const compressBase64Image = (dataUrl: string, maxWidth = 1600, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleSaveCertificateTemplateConfig = async () => {
    if (!eventAccessEvent?.id) {
      alert("No active event selected.");
      return;
    }

    setIsSavingCertTemplate(true);
    setCertTemplateSaveSuccess(null);

    try {
      let resolvedTemplateUrl = certCustomTemplateUrl || "";

      // If user uploaded a new local base64 template image, upload to Cloudinary/server or compress
      if (resolvedTemplateUrl && resolvedTemplateUrl.startsWith("data:image/")) {
        try {
          const uploadRes = await uploadImage(resolvedTemplateUrl, "ai_verse_certificates");
          if (uploadRes?.secure_url || uploadRes?.url) {
            resolvedTemplateUrl = uploadRes.secure_url || uploadRes.url;
            setCertCustomTemplateUrl(resolvedTemplateUrl);
          }
        } catch (uploadErr) {
          console.warn("Cloudinary upload notice, compressing base64 for reliable persistence:", uploadErr);
          if (resolvedTemplateUrl.length > 350000) {
            try {
              const compressed = await compressBase64Image(resolvedTemplateUrl, 1600, 0.78);
              resolvedTemplateUrl = compressed;
              setCertCustomTemplateUrl(resolvedTemplateUrl);
            } catch (compErr) {
              console.warn("Base64 compression fallback warning:", compErr);
            }
          }
        }
      }

      const certConfig = {
        templateMode: resolvedTemplateUrl ? "custom" : certTemplateMode,
        customTemplateUrl: resolvedTemplateUrl,
        customTemplateFilename: certCustomTemplateFilename || "",
        certType,
        collegeName: certCollegeName,
        deptName: certDeptName,
        issueDate: certIssueDate,
        namePosY: certNamePosY,
        nameFontSize: certNameFontSize,
        nameColor: certNameColor,
        showTeamName: certShowTeamName,
        teamPosY: certTeamPosY,
        teamFontSize: certTeamFontSize,
        teamColor: certTeamColor,
        showRollNo: certShowRollNo,
        rollPosY: certRollPosY,
        rollFontSize: certRollFontSize,
        rollColor: certRollColor,
        showQrCode: certShowQrCode,
        updatedAt: Date.now(),
      };

      // 1. Save certificate config
      await updateEvent(eventAccessEvent.id, {
        certificateConfig: certConfig,
        updatedAt: Date.now(),
      });

      // 2. Sync to MongoDB/backend if available
      try {
        await updateEvent(eventAccessEvent.id, {
          certificateConfig: certConfig
        });
      } catch (apiErr) {
        console.warn("Backend updateEvent notice (Firestore saved successfully):", apiErr);
      }

      // 3. Update local state
      setEventAccessEvent((prev: any) => ({
        ...prev,
        certificateConfig: certConfig,
      }));

      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventAccessEvent.id ? { ...e, certificateConfig: certConfig } : e
        )
      );

      setCertTemplateSaveSuccess("✅ Template & positioning saved permanently for this event!");
      setTimeout(() => setCertTemplateSaveSuccess(null), 6000);
    } catch (err: any) {
      console.error("Error saving certificate config:", err);
      alert(`Failed to save certificate template configuration: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSavingCertTemplate(false);
    }
  };

  const handleDownloadBlankTemplateGuide = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 2000;
    const H = 1414;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 12]);
    ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.setLineDash([]);

    ctx.fillStyle = "#64748B";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AI VERSE CERTIFICATE CANVAS (2000 × 1414 px)", W / 2, 220);
    ctx.font = "22px sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("Recommended canvas aspect ratio for custom Canva / Photoshop certificate background designs.", W / 2, 280);

    ctx.strokeStyle = "#93C5FD";
    ctx.lineWidth = 2;
    ctx.strokeRect(300, 520, 1400, 240);
    ctx.fillStyle = "#2563EB";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("✦ PARTICIPANT NAME & CREDENTIALS ZONE ✦", W / 2, 640);

    const link = document.createElement("a");
    link.download = `AI_Verse_Blank_Certificate_Template_Guide_2000x1414.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Flattened list of all individual recipients (Lead + all Team Members)
  const flattenedCertRecipients = useMemo(() => {
    const list: any[] = [];
    (eventAccessRegistrations || []).forEach((reg: any) => {
      const regId = reg.id || reg._id;
      const isGroup = !!reg.groupName && reg.groupName !== "Individual RSVP";
      const teamName = isGroup ? reg.groupName : "";
      const leadEmail = (reg.teamLeadPersonalEmail || reg.userEmail || reg.personalEmail || reg.teamLeadEmail || reg.email || "").trim().toLowerCase();
      const leadName = reg.teamLeadName || reg.fullName || reg.name || "Participant";
      const leadStudentId = reg.teamLeadStudentId || reg.studentId || "";

      // 1. Add Team Lead / Individual
      if (leadEmail) {
        list.push({
          key: `${regId}_lead`,
          regId,
          isLead: true,
          memberIndex: -1,
          name: leadName,
          email: leadEmail,
          studentId: leadStudentId,
          teamName,
          currentRound: reg.currentRound || 1,
          roundStatus: reg.roundStatus || "Active",
          attendanceMarked: !!reg.attendanceMarked,
          submissionStatus: reg.submissionStatus === "Submitted" || !!reg.submittedAt ? "Submitted" : (reg.submissionStatus || "Draft"),
          isPromoted: (reg.currentRound || 1) > 1 || reg.roundStatus === "Qualified",
          isWinner: reg.isWinner || reg.rank || (reg.roundStatus === "Qualified" && reg.currentRound >= (eventAccessEvent?.totalRounds || 3)),
          certificateIssued: !!reg.certificateIssued,
          certificateId: reg.certificateId || `AIV-${regId.slice(-6).toUpperCase()}-L`,
          certificateSentAt: reg.certificateSentAt || null,
          certificateType: reg.certificateType || certType,
        });
      }

      // 2. Add Team Members
      if (Array.isArray(reg.members)) {
        reg.members.forEach((m: any, mIdx: number) => {
          const mEmail = (m.email || m.personalEmail || "").trim().toLowerCase();
          if (mEmail && m.name) {
            list.push({
              key: `${regId}_m_${mIdx}`,
              regId,
              isLead: false,
              memberIndex: mIdx,
              name: m.name,
              email: mEmail,
              studentId: m.studentId || m.rollNo || "",
              teamName,
              currentRound: reg.currentRound || 1,
              roundStatus: reg.roundStatus || "Active",
              attendanceMarked: !!reg.attendanceMarked,
              submissionStatus: reg.submissionStatus === "Submitted" || !!reg.submittedAt ? "Submitted" : (reg.submissionStatus || "Draft"),
              isPromoted: (reg.currentRound || 1) > 1 || reg.roundStatus === "Qualified",
              isWinner: reg.isWinner || reg.rank || (reg.roundStatus === "Qualified" && reg.currentRound >= (eventAccessEvent?.totalRounds || 3)),
              certificateIssued: !!(m.certificateIssued || (reg.certificateIssued && m.certificateIssued !== false)),
              certificateId: m.certificateId || `AIV-${regId.slice(-4).toUpperCase()}-M${mIdx + 1}`,
              certificateSentAt: m.certificateSentAt || reg.certificateSentAt || null,
              certificateType: m.certificateType || reg.certificateType || certType,
            });
          }
        });
      }
    });
    return list;
  }, [eventAccessRegistrations, eventAccessEvent, certType]);

  // Filtered recipients based on Audience Tab and Search Query
  const filteredCertRecipients = useMemo(() => {
    let result = flattenedCertRecipients;

    // Audience Filter
    if (certAudienceFilter === "promoted" || certAudienceFilter === "promoted_r2") {
      result = result.filter(r => (r.currentRound || 1) >= 2 || r.isPromoted);
    } else if (certAudienceFilter === "all_r2") {
      result = result.filter(r => (r.currentRound || 1) >= 2);
    } else if (certAudienceFilter === "promoted_r3") {
      result = result.filter(r => (r.currentRound || 1) >= 3 || ((r.currentRound || 1) === 2 && r.roundStatus === "Qualified"));
    } else if (certAudienceFilter === "all_r3") {
      result = result.filter(r => (r.currentRound || 1) >= 3);
    } else if (certAudienceFilter === "attended") {
      result = result.filter(r => r.attendanceMarked);
    } else if (certAudienceFilter === "submitted") {
      result = result.filter(r => r.submissionStatus === "Submitted");
    } else if (certAudienceFilter === "winners") {
      result = result.filter(r => r.isWinner);
    } else if (certAudienceFilter === "unsent") {
      result = result.filter(r => !r.certificateIssued);
    }

    // Search Query Filter
    if (certSearchQuery.trim()) {
      const q = certSearchQuery.toLowerCase().trim();
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.studentId.toLowerCase().includes(q) ||
        r.teamName.toLowerCase().includes(q) ||
        (r.certificateId && r.certificateId.toLowerCase().includes(q))
      );
    }

    return result;
  }, [flattenedCertRecipients, certAudienceFilter, certSearchQuery]);

  const handleOpenCertificateModal = () => {
    setCertAudienceFilter("all");
    setCertSearchQuery("");
    setCertSendingProgress(null);
    setTestEmailFeedback(null);
    // Select all recipients by default
    setSelectedCertRecipients(flattenedCertRecipients.map(r => r.key));

    // Hydrate template configuration from event if exists
    const cfg = eventAccessEvent?.certificateConfig || {};
    if (cfg.templateMode) setCertTemplateMode(cfg.templateMode);
    if (cfg.customTemplateUrl) {
      setCertCustomTemplateUrl(cfg.customTemplateUrl);
      setCertCustomTemplateFilename(cfg.customTemplateFilename || "custom_template.png");
    }
    if (cfg.certType) setCertType(cfg.certType);
    if (cfg.collegeName) setCertCollegeName(cfg.collegeName);
    if (cfg.deptName) setCertDeptName(cfg.deptName);
    if (cfg.issueDate) setCertIssueDate(cfg.issueDate);
    if (cfg.namePosY !== undefined) setCertNamePosY(cfg.namePosY);
    if (cfg.nameFontSize !== undefined) setCertNameFontSize(cfg.nameFontSize);
    if (cfg.nameColor) setCertNameColor(cfg.nameColor);
    if (cfg.showTeamName !== undefined) setCertShowTeamName(cfg.showTeamName);
    if (cfg.teamPosY !== undefined) setCertTeamPosY(cfg.teamPosY);
    if (cfg.teamFontSize !== undefined) setCertTeamFontSize(cfg.teamFontSize);
    if (cfg.teamColor) setCertTeamColor(cfg.teamColor);
    if (cfg.showRollNo !== undefined) setCertShowRollNo(cfg.showRollNo);
    if (cfg.rollPosY !== undefined) setCertRollPosY(cfg.rollPosY);
    if (cfg.rollFontSize !== undefined) setCertRollFontSize(cfg.rollFontSize);
    if (cfg.rollColor) setCertRollColor(cfg.rollColor);
    if (cfg.showQrCode !== undefined) setCertShowQrCode(cfg.showQrCode);

    setIsCertificateModalOpen(true);
  };

  const handleToggleSelectAllCertRecipients = () => {
    const currentFilteredKeys = filteredCertRecipients.map(r => r.key);
    const allFilteredSelected = currentFilteredKeys.every(k => selectedCertRecipients.includes(k));

    if (allFilteredSelected) {
      setSelectedCertRecipients(prev => prev.filter(k => !currentFilteredKeys.includes(k)));
    } else {
      setSelectedCertRecipients(prev => Array.from(new Set([...prev, ...currentFilteredKeys])));
    }
  };

  const handleToggleSelectCertRecipient = (key: string) => {
    setSelectedCertRecipients(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Bulk Dispatch Certificates via Email
  const handleSendCertificatesBatch = async () => {
    const recipientsToSend = flattenedCertRecipients.filter(r => selectedCertRecipients.includes(r.key));

    if (recipientsToSend.length === 0) {
      await showAlert({
        title: "No Recipients Selected",
        message: "Please select at least one participant to send certificates.",
        type: "warning",
      });
      return;
    }

    const confirmed = await showConfirm({
      title: `Dispatch ${recipientsToSend.length} Certificate(s)?`,
      message: `You are about to email official "${certType}" certificates directly to ${recipientsToSend.length} participant(s). Would you like to proceed?`,
      confirmText: `🚀 Send ${recipientsToSend.length} Certificates`,
      cancelText: "Cancel",
      type: "primary",
    });
    if (!confirmed) return;

    setIsSendingCertificates(true);
    setCertSendingProgress({
      current: 0,
      total: recipientsToSend.length,
      currentName: "",
      currentEmail: "",
      successCount: 0,
      failCount: 0,
    });

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const siteBaseUrl = isLocal ? "https://aiversevitb.in" : window.location.origin;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < recipientsToSend.length; i++) {
      const recipient = recipientsToSend[i];
      const certId = recipient.certificateId || `AIV-${Date.now().toString(36).toUpperCase()}-${i + 1}`;
      const certUrl = `${siteBaseUrl}/certificate/${certId}?name=${encodeURIComponent(recipient.name)}&event=${encodeURIComponent(eventAccessEvent?.title || "AI Verse Event")}&type=${encodeURIComponent(certType)}&college=${encodeURIComponent(certCollegeName)}&date=${encodeURIComponent(certIssueDate)}&studentId=${encodeURIComponent(recipient.studentId)}&team=${encodeURIComponent(recipient.teamName)}&mode=${encodeURIComponent(certTemplateMode)}&nameY=${encodeURIComponent(certNamePosY)}&nameSize=${encodeURIComponent(certNameFontSize)}&nameColor=${encodeURIComponent(certNameColor)}&teamY=${encodeURIComponent(certTeamPosY)}&teamSize=${encodeURIComponent(certTeamFontSize)}&teamColor=${encodeURIComponent(certTeamColor)}&showTeam=${certShowTeamName}&rollY=${encodeURIComponent(certRollPosY)}&rollSize=${encodeURIComponent(certRollFontSize)}&rollColor=${encodeURIComponent(certRollColor)}&showRoll=${certShowRollNo}&showQr=${certShowQrCode}`;

      setCertSendingProgress({
        current: i + 1,
        total: recipientsToSend.length,
        currentName: recipient.name,
        currentEmail: recipient.email,
        successCount,
        failCount,
      });

      try {
        const emailData = buildCertificateEmail({
          recipientName: recipient.name,
          eventTitle: eventAccessEvent?.title || "AI Verse Event",
          certificateType: certType,
          groupName: recipient.teamName,
          studentId: recipient.studentId,
          certificateId: certId,
          issueDate: certIssueDate,
          collegeName: certCollegeName,
          certificateUrl: certUrl,
        });

        const emailRes = await sendResendEmail({
          to: recipient.email,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html,
        });

        if (emailRes.success) {
          successCount++;
          const now = Date.now();

          // Persist status to Firebase
          try {
            if (recipient.isLead) {
              await updateRegistration(recipient.regId, {
                certificateIssued: true,
                certificateId: certId,
                certificateType: certType,
                certificateSentAt: now,
                certificateTemplateMode: certTemplateMode,
                certificateNamePosY: certNamePosY,
                certificateNameFontSize: certNameFontSize,
                certificateNameColor: certNameColor,
                certificateTeamPosY: certTeamPosY,
                certificateTeamFontSize: certTeamFontSize,
                certificateTeamColor: certTeamColor,
                certificateShowTeamName: certShowTeamName,
                certificateRollPosY: certRollPosY,
                certificateRollFontSize: certRollFontSize,
                certificateRollColor: certRollColor,
                certificateShowRollNo: certShowRollNo,
                certificateShowQrCode: certShowQrCode,
                updatedAt: now,
              });
            } else {
              // Update specific member inside members array
              const regDoc = (eventAccessRegistrations || []).find((r: any) => (r.id || r._id) === recipient.regId);
              if (regDoc && Array.isArray(regDoc.members)) {
                const updatedMembers = [...regDoc.members];
                if (updatedMembers[recipient.memberIndex]) {
                  updatedMembers[recipient.memberIndex] = {
                    ...updatedMembers[recipient.memberIndex],
                    certificateIssued: true,
                    certificateId: certId,
                    certificateSentAt: now,
                  };
                  await updateRegistration(recipient.regId, {
                    members: updatedMembers,
                    certificateIssued: true,
                    updatedAt: now,
                  });
                }
              }
            }

            // Sync local state
            setEventAccessRegistrations((prev: any[]) =>
              prev.map(r => {
                if ((r.id || r._id) === recipient.regId) {
                  if (recipient.isLead) {
                    return { ...r, certificateIssued: true, certificateId: certId, certificateSentAt: now, certificateType: certType };
                  } else {
                    const newMembers = Array.isArray(r.members) ? [...r.members] : [];
                    if (newMembers[recipient.memberIndex]) {
                      newMembers[recipient.memberIndex] = {
                        ...newMembers[recipient.memberIndex],
                        certificateIssued: true,
                        certificateId: certId,
                        certificateSentAt: now,
                      };
                    }
                    return { ...r, members: newMembers, certificateIssued: true };
                  }
                }
                return r;
              })
            );
          } catch (dbErr) {
            console.warn("Could not update Firestore certificate status:", dbErr);
          }
        } else {
          failCount++;
          console.error(`Failed to send certificate to ${recipient.email}:`, emailRes.error);
        }
      } catch (sendErr) {
        failCount++;
        console.error(`Exception sending certificate to ${recipient.email}:`, sendErr);
      }

      // Small delay between mail deliveries for smooth queue dispatch
      if (i < recipientsToSend.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setIsSendingCertificates(false);
    setCertSuccessToast(`Successfully sent ${successCount} certificate(s) via email!${failCount > 0 ? ` (${failCount} failed)` : ""}`);
    setTimeout(() => setCertSuccessToast(null), 5000);
  };

  // Send Single Test Certificate Email
  const handleSendTestCertificate = async () => {
    if (!testCertEmail || !testCertEmail.includes("@")) {
      setTestEmailFeedback({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailFeedback(null);

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const siteBaseUrl = isLocal ? "https://aiversevitb.in" : window.location.origin;
    const testCertId = `AIV-TEST-${Date.now().toString(36).toUpperCase()}`;
    const certUrl = `${siteBaseUrl}/certificate/${testCertId}?name=${encodeURIComponent("Faculty Test Recipient")}&event=${encodeURIComponent(eventAccessEvent?.title || "AI Verse Event")}&type=${encodeURIComponent(certType)}&college=${encodeURIComponent(certCollegeName)}&date=${encodeURIComponent(certIssueDate)}&studentId=23PA1A0501&team=CodeCrafters&mode=${encodeURIComponent(certTemplateMode)}&nameY=${encodeURIComponent(certNamePosY)}&nameSize=${encodeURIComponent(certNameFontSize)}&nameColor=${encodeURIComponent(certNameColor)}&teamY=${encodeURIComponent(certTeamPosY)}&teamSize=${encodeURIComponent(certTeamFontSize)}&teamColor=${encodeURIComponent(certTeamColor)}&showTeam=${certShowTeamName}&rollY=${encodeURIComponent(certRollPosY)}&rollSize=${encodeURIComponent(certRollFontSize)}&rollColor=${encodeURIComponent(certRollColor)}&showRoll=${certShowRollNo}&showQr=${certShowQrCode}`;

    try {
      const emailData = buildCertificateEmail({
        recipientName: "Faculty Test Recipient",
        eventTitle: eventAccessEvent?.title || "AI Verse Event",
        certificateType: certType,
        groupName: "CodeCrafters",
        studentId: "23PA1A0501",
        certificateId: testCertId,
        issueDate: certIssueDate,
        collegeName: certCollegeName,
        certificateUrl: certUrl,
      });

      const res = await sendResendEmail({
        to: testCertEmail.trim().toLowerCase(),
        subject: `[TEST PREVIEW] ${emailData.subject}`,
        text: emailData.text,
        html: emailData.html,
      });

      if (res.success) {
        setTestEmailFeedback({ type: "success", message: `Test certificate email dispatched successfully to ${testCertEmail}!` });
      } else {
        setTestEmailFeedback({ type: "error", message: res.error || "Failed to send test email." });
      }
    } catch (err: any) {
      setTestEmailFeedback({ type: "error", message: err?.message || "Network error sending test email." });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Export Certificate Issuance Log CSV
  const handleExportCertificateLogsCsv = () => {
    if (flattenedCertRecipients.length === 0) {
      alert("No participant records found.");
      return;
    }

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const siteBaseUrl = isLocal ? "https://aiversevitb.in" : window.location.origin;

    const exportData = flattenedCertRecipients.map((r, idx) => ({
      "S.No": idx + 1,
      "Certificate ID": r.certificateId || `AIV-${r.regId.slice(-6).toUpperCase()}`,
      "Participant Name": r.name,
      "Email Address": r.email,
      "Roll / Student ID": r.studentId || "N/A",
      "Team Name": r.teamName || "Individual",
      "Role": r.isLead ? "Team Lead" : "Member",
      "Event Title": eventAccessEvent?.title || "Event",
      "Certificate Type": r.certificateType || certType,
      "Issuance Status": r.certificateIssued ? "Issued & Emailed" : "Pending",
      "Dispatched Timestamp": r.certificateSentAt ? new Date(r.certificateSentAt).toLocaleString() : "Not Sent",
      "Online Verification URL": `${siteBaseUrl}/certificate/${r.certificateId || `AIV-${r.regId.slice(-6).toUpperCase()}`}`,
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Certificates_Log_${(eventAccessEvent?.title || "Event").replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample Certificate PNG (with custom background & coordinate overlays)
  const handleDownloadSampleCertificatePng = () => {
    if (!certCustomTemplateUrl) {
      alert("Please upload a certificate template background image first.");
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 2000;
    const H = 1414;
    canvas.width = W;
    canvas.height = H;

    const renderOverlayContent = () => {
      // 1. Participant Name (Positioned dynamically by slider)
      const nameY = (H * certNamePosY) / 100;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = certNameColor || "#0F172A";
      ctx.font = `bold ${certNameFontSize || 64}px Georgia, Cambria, 'Times New Roman', serif`;
      ctx.fillText("Sample Participant Name", W / 2, nameY);

      // 2. Roll No / Student ID (if enabled)
      if (certShowRollNo) {
        const rollY = (H * certRollPosY) / 100;
        ctx.fillStyle = certRollColor || "#475569";
        ctx.font = `bold ${certRollFontSize || 20}px -apple-system, BlinkMacSystemFont, monospace`;
        ctx.fillText("Roll: 23PA1A0501", W / 2, rollY);
      }

      // 3. Team Name (if enabled)
      if (certShowTeamName) {
        const teamY = (H * certTeamPosY) / 100;
        ctx.fillStyle = certTeamColor || "#1E3A8A";
        ctx.font = `bold ${certTeamFontSize || 32}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.fillText("CodeCrafters", W / 2, teamY);
      }

      // 4. Verification ID / Footer (if enabled)
      if (certShowQrCode) {
        ctx.fillStyle = "#64748B";
        ctx.font = "bold 16px monospace";
        ctx.fillText(`Certificate ID: AIV-SAMPLE-2026   •   Issue Date: ${certIssueDate}   •   Verify at: aiversevitb.in/certificate`, W / 2, H - 35);
      }

      const link = document.createElement("a");
      link.download = `Sample_Certificate_${certType.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, W, H);
      renderOverlayContent();
    };
    img.onerror = () => {
      alert("Failed to load certificate template background image for export.");
    };
    img.src = certCustomTemplateUrl;
  };

  // Multi-Problem Statements State
  const [isMultiProblemModalOpen, setIsMultiProblemModalOpen] = useState(false);
  const [problemList, setProblemList] = useState<any[]>([]);
  const [editingPsId, setEditingPsId] = useState<string | null>(null);
  const [psCodeInput, setPsCodeInput] = useState("");
  const [psTitleInput, setPsTitleInput] = useState("");
  const [psTrackInput, setPsTrackInput] = useState("");
  const [psRoundInput, setPsRoundInput] = useState<string>("all");
  const [problemRoundFilter, setProblemRoundFilter] = useState<string>("all");
  const [psDescInput, setPsDescInput] = useState("");
  const [psDeliverablesInput, setPsDeliverablesInput] = useState("");
  const [savingMultiProblems, setSavingMultiProblems] = useState(false);
  const [problemSuccessMsg, setProblemSuccessMsg] = useState<string | null>(null);

  const handleOpenMultiProblemModal = () => {
    const existing = eventAccessEvent?.problemStatements || [];
    const currR = eventAccessEvent?.currentRound || 1;
    if (existing.length > 0) {
      setProblemList(existing);
    } else if (eventAccessEvent?.problemStatementTitle) {
      setProblemList([{
        id: "ps_1",
        code: "PS-01",
        title: eventAccessEvent.problemStatementTitle,
        track: eventAccessEvent.problemStatementTrack || "General Track",
        round: currR,
        description: eventAccessEvent.problemStatement || "",
        deliverables: ""
      }]);
    } else {
      setProblemList([]);
    }
    setEditingPsId(null);
    setPsCodeInput(`PS-0${(existing.length || 0) + 1}`);
    setPsTitleInput("");
    setPsTrackInput("");
    setPsRoundInput(String(currR));
    setProblemRoundFilter("all");
    setPsDescInput("");
    setPsDeliverablesInput("");
    setIsMultiProblemModalOpen(true);
  };

  const handleAddOrUpdateProblemItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!psTitleInput.trim()) return;

    const assignedRound = psRoundInput === "all" ? "all" : Number(psRoundInput);

    if (editingPsId) {
      setProblemList(prev => prev.map(item => item.id === editingPsId ? {
        ...item,
        code: psCodeInput || item.code,
        title: psTitleInput,
        track: psTrackInput,
        round: assignedRound,
        description: psDescInput,
        deliverables: psDeliverablesInput
      } : item));
      setEditingPsId(null);
    } else {
      const newItem = {
        id: `ps_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        code: psCodeInput || `PS-0${problemList.length + 1}`,
        title: psTitleInput,
        track: psTrackInput || "General",
        round: assignedRound,
        description: psDescInput,
        deliverables: psDeliverablesInput
      };
      setProblemList(prev => [...prev, newItem]);
    }

    setPsCodeInput(`PS-0${problemList.length + 2}`);
    setPsTitleInput("");
    setPsTrackInput("");
    setPsDescInput("");
    setPsDeliverablesInput("");
  };

  const handleEditProblemItem = (item: any) => {
    setEditingPsId(item.id);
    setPsCodeInput(item.code);
    setPsTitleInput(item.title);
    setPsTrackInput(item.track);
    setPsRoundInput(item.round ? String(item.round) : "all");
    setPsDescInput(item.description);
    setPsDeliverablesInput(item.deliverables || "");
  };

  const handleDeleteProblemItem = (id: string) => {
    setProblemList(prev => prev.filter(item => item.id !== id));
    if (editingPsId === id) {
      setEditingPsId(null);
      setPsTitleInput("");
      setPsTrackInput("");
      setPsDescInput("");
      setPsDeliverablesInput("");
    }
  };

  const handlePublishAllProblemStatements = async () => {
    if (!eventAccessEvent?.id) return;
    setSavingMultiProblems(true);
    try {
      const primaryPs = problemList[0] || null;

      await updateEvent(eventAccessEvent.id, {
        problemStatements: problemList,
        problemStatementTitle: primaryPs?.title || "",
        problemStatementTrack: primaryPs?.track || "",
        problemStatement: primaryPs?.description || "",
        updatedAt: Date.now()
      });

      setEventAccessEvent((prev: any) => ({
        ...prev,
        problemStatements: problemList,
        problemStatementTitle: primaryPs?.title || "",
        problemStatementTrack: primaryPs?.track || "",
        problemStatement: primaryPs?.description || ""
      }));

      setProblemSuccessMsg(`Successfully published ${problemList.length} problem statement(s) to all participant portals!`);
      setIsMultiProblemModalOpen(false);
      setTimeout(() => setProblemSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Error publishing problem statements:", err);
      alert("Failed to save and publish problem statements.");
    } finally {
      setSavingMultiProblems(false);
    }
  };

  // Event Access - Round Management & Participant Promotion States
  const [isEventRoundsModalOpen, setIsEventRoundsModalOpen] = useState(false);
  const [roundModalTab, setRoundModalTab] = useState<"promotion" | "stages">("promotion");
  const [liveRoundsList, setLiveRoundsList] = useState<any[]>([]);
  const [liveCurrentRound, setLiveCurrentRound] = useState<number>(1);
  const [liveTotalRounds, setLiveTotalRounds] = useState<number>(3);
  const [savingLiveRounds, setSavingLiveRounds] = useState(false);
  const [roundsSuccessMsg, setRoundsSuccessMsg] = useState<string | null>(null);

  // Promotion Engine Specific States
  const [promoteFromRound, setPromoteFromRound] = useState<number>(1);
  const [promoteToRound, setPromoteToRound] = useState<number>(2);
  const [promotionMode, setPromotionMode] = useState<"quiz" | "jury" | "manual">("quiz");
  const [promotionSearchQuery, setPromotionSearchQuery] = useState("");
  const [promotionStatusFilter, setPromotionStatusFilter] = useState<"all" | "selected" | "qualified" | "pending" | "eliminated">("all");

  // Quiz Promotion Criteria
  const [eventQuizzesList, setEventQuizzesList] = useState<any[]>([]);
  const [selectedPromotionQuizId, setSelectedPromotionQuizId] = useState<string>("all");
  const [quizCutoffType, setQuizCutoffType] = useState<"score" | "percentage" | "topN">("score");
  const [quizCutoffScore, setQuizCutoffScore] = useState<number>(20);
  const [quizCutoffPercentage, setQuizCutoffPercentage] = useState<number>(60);
  const [quizTopNCount, setQuizTopNCount] = useState<number>(10);

  // Jury Promotion Criteria
  const [juryCutoffType, setJuryCutoffType] = useState<"score" | "topN">("score");
  const [juryCutoffScore, setJuryCutoffScore] = useState<number>(60);
  const [juryTopNCount, setJuryTopNCount] = useState<number>(10);

  // Promotion Selection & Execution
  const [selectedPromoteRegIds, setSelectedPromoteRegIds] = useState<string[]>([]);
  const [markUnselectedAsEliminated, setMarkUnselectedAsEliminated] = useState<boolean>(false);
  const [advanceEventRoundOnPromote, setAdvanceEventRoundOnPromote] = useState<boolean>(true);
  const [isExecutingPromotion, setIsExecutingPromotion] = useState(false);

  // Correlation Cache
  const [allQuizSubmissions, setAllQuizSubmissions] = useState<any[]>([]);
  const [allJuryEvaluations, setAllJuryEvaluations] = useState<any[]>([]);
  const [loadingPromotionMetrics, setLoadingPromotionMetrics] = useState(false);

  const fetchPromotionData = async () => {
    setLoadingPromotionMetrics(true);
    try {
      // 1. Fetch Quizzes for this event
      let qList: any[] = [];
      try {
        const qListRaw = await fetchAllQuizzes({ eventId: eventAccessEvent?.id });
        qList = Array.isArray(qListRaw) ? qListRaw : (qListRaw?.data || []);
      } catch (apiErr) {
        console.warn("Failed to fetch quizzes via API, falling back to Firebase", apiErr);
        const quizSnap = await getDocs(collection(db, "quizzes"));
        quizSnap.forEach((d) => {
          const qData = d.data();
          if (
            !qData.eventId ||
            (eventAccessEvent?.id && qData.eventId === eventAccessEvent.id) ||
            (eventAccessEvent?.title && qData.eventTitle?.toLowerCase().trim() === eventAccessEvent.title.toLowerCase().trim())
          ) {
            qList.push({ id: d.id, ...qData });
          }
        });
      }
      setEventQuizzesList(qList);
      if (qList.length > 0) {
        setSelectedPromotionQuizId(qList[0].id);
      } else {
        setSelectedPromotionQuizId("all");
      }

      // 2. Fetch Quiz Submissions & auto-evaluate scores if missing
      const subs: any[] = [];
      for (const qDef of qList) {
        try {
          const qSubsRaw = await fetchQuizSubmissions(qDef.id);
          const qSubs = Array.isArray(qSubsRaw) ? qSubsRaw : (qSubsRaw?.data || []);
          const overridden = qDef.overriddenScores || {};
          
          for (const sDataRaw of qSubs) {
             let sData = { ...sDataRaw };
             // Apply overriding logic if exists
             if (overridden[sData.id]) {
                sData = { ...sData, ...overridden[sData.id] };
             }

             if ((sData.score === undefined || sData.score === null) && sData.answers) {
                const evaluated = evaluateQuizAnswers(qDef, sData.answers);
                sData.score = evaluated.score;
                sData.maxScore = evaluated.maxScore;
                sData.percentage = evaluated.percentage;
                sData.passed = evaluated.passed;
             }
             subs.push(sData);
          }
        } catch (err) {
          console.error(`Error fetching submissions for quiz ${qDef.id}:`, err);
        }
      }
      
      if (subs.length === 0) {
        const subSnap = await getDocs(collection(db, "quizSubmissions"));
        subSnap.forEach((d) => {
          const sData = { id: d.id, ...d.data() } as any;
          
          // Apply overridden logic here too just in case
          const qDef = qList.find((q) => q.id === sData.quizId) || qList[0];
          if (qDef) {
             const overridden = qDef.overriddenScores || {};
             if (overridden[sData.id]) {
                Object.assign(sData, overridden[sData.id]);
             }
             if ((sData.score === undefined || sData.score === null) && sData.answers) {
               const evaluated = evaluateQuizAnswers(qDef, sData.answers);
               sData.score = evaluated.score;
               sData.maxScore = evaluated.maxScore;
               sData.percentage = evaluated.percentage;
               sData.passed = evaluated.passed;
             }
          }
          subs.push(sData);
        });
      }
      setAllQuizSubmissions(subs);

      // 3. Fetch Jury Evaluations
      let jList: any[] = [];
      try {
        const juryRaw = await fetchJuryEvaluations({ eventId: eventAccessEvent?.id });
        jList = Array.isArray(juryRaw) ? juryRaw : (juryRaw?.data || []);
      } catch (apiErr) {
        console.warn("Failed to fetch jury evaluations via API, falling back to Firebase", apiErr);
      }
      if (jList.length === 0) {
        const jurySnap = await getDocs(collection(db, "jury_evaluations"));
        jurySnap.forEach((d) => jList.push({ id: d.id, ...d.data() }));
      }
      setAllJuryEvaluations(jList);
    } catch (err) {
      console.error("Error fetching promotion metrics:", err);
    } finally {
      setLoadingPromotionMetrics(false);
    }
  };

  const getCleanRoundTitle = (nameStr?: string, roundNum?: number) => {
    if (!nameStr) return `Stage ${roundNum || 1}`;
    return nameStr.replace(/^Round\s*\d+:?\s*/i, "").trim() || `Stage ${roundNum || 1}`;
  };

  const handleOpenEventRoundsModal = () => {
    const existingRounds = eventAccessEvent?.rounds || [];
    const currRound = Number(eventAccessEvent?.currentRound) || 1;
    const totRounds = Number(eventAccessEvent?.totalRounds) || (Array.isArray(existingRounds) && existingRounds.length > 0 ? existingRounds.length : 3);

    if (Array.isArray(existingRounds) && existingRounds.length > 0) {
      const mappedRounds = existingRounds.map((r: any, idx: number) => ({
        roundNumber: Number(r.roundNumber) || idx + 1,
        name: r.name ? getCleanRoundTitle(r.name, idx + 1) : `Stage ${idx + 1}`,
        type: r.type || "Screening",
        description: r.description || "",
        startDate: r.startDate || "",
        endDate: r.endDate || "",
        startTime: r.startTime || "",
        endTime: r.endTime || "",
        status: r.status || (idx + 1 === currRound ? "Active" : idx + 1 < currRound ? "Completed" : "Upcoming")
      }));
      setLiveRoundsList(mappedRounds);
      setLiveTotalRounds(totRounds);
      setLiveCurrentRound(currRound);
    } else {
      const evStart = eventAccessEvent?.startDate || eventAccessEvent?.date || "";
      const evEnd = eventAccessEvent?.endDate || "";
      const defaultRounds = [
        { roundNumber: 1, name: "Screening & Online Assessment", type: "Screening", description: "Initial abstract, quiz test, problem track selection, and idea deck evaluation.", startDate: evStart, endDate: evEnd, startTime: eventAccessEvent?.startTime || "", endTime: eventAccessEvent?.endTime || "", status: "Active" },
        { roundNumber: 2, name: "Prototype & SRS Assessment", type: "Assessment", description: "Working code submission, system requirements specification, or MVP demonstration.", startDate: "", endDate: "", startTime: "", endTime: "", status: "Upcoming" },
        { roundNumber: 3, name: "Grand Finale & Jury Pitch", type: "Finals", description: "Live onstage presentation, demo execution, and final jury evaluation.", startDate: "", endDate: "", startTime: "", endTime: "", status: "Upcoming" }
      ];
      setLiveRoundsList(defaultRounds);
      setLiveTotalRounds(3);
      setLiveCurrentRound(1);
    }
    setPromoteFromRound(currRound);
    setPromoteToRound(Math.min((existingRounds.length || 3), currRound + 1));
    setRoundModalTab("promotion");
    fetchPromotionData();
    setIsEventRoundsModalOpen(true);
  };

  // Memoized team score matrix for all registrations in the current event
  const promotionRoster = useMemo(() => {
    return eventAccessRegistrations.map((reg) => {
      const regId = (reg.id || "").toLowerCase().trim();
      const groupName = (reg.groupName || reg.teamName || "").toLowerCase().trim();
      const cleanGroupName = groupName.replace(/[^a-z0-9]/g, "");
      const leadName = (reg.teamLeadName || reg.name || "").toLowerCase().trim();
      const leadEmail = (reg.teamLeadEmail || reg.email || "").toLowerCase().trim();
      const teamEmail = (reg.teamEmail || "").toLowerCase().trim();
      const personalEmail = (reg.teamLeadPersonalEmail || reg.personalEmail || "").toLowerCase().trim();
      const collegeEmail = (reg.teamLeadCollegeEmail || reg.collegeEmail || "").toLowerCase().trim();
      const studentId = (reg.teamLeadStudentId || reg.studentId || "").toLowerCase().trim();
      
      const generatedEmail = cleanGroupName ? `${cleanGroupName}@aiverse.in` : "";
      const memberEmails = Array.isArray(reg.members)
        ? reg.members.map((m: any) => (m.email || "").toLowerCase().trim()).filter(Boolean)
        : [];

      const allTeamEmails = Array.from(new Set([
        leadEmail,
        teamEmail,
        generatedEmail,
        personalEmail,
        collegeEmail,
        ...memberEmails
      ].filter(Boolean)));

      // Helper to match a quiz submission to this registration
      const isSubmissionMatch = (sub: any): boolean => {
        if (!sub) return false;
        
        // Match by registration / team doc ID
        const sTeamId = (sub.teamId || sub.registrationId || sub.userId || "").toLowerCase().trim();
        if (sTeamId && (sTeamId === regId || sTeamId === reg.id)) return true;

        // Match by team / lead / member emails
        const sUserEmail = (sub.userEmail || "").toLowerCase().trim();
        if (sUserEmail && allTeamEmails.includes(sUserEmail)) return true;

        // Match by team name (exact or alphanumeric)
        const sTeamName = (sub.teamName || "").toLowerCase().trim();
        if (sTeamName && groupName) {
          if (sTeamName === groupName) return true;
          if (cleanGroupName && sTeamName.replace(/[^a-z0-9]/g, "") === cleanGroupName) return true;
        }

        // Match by user / leader name
        const sUserName = (sub.userName || "").toLowerCase().trim();
        if (sUserName) {
          if (leadName && (sUserName === leadName || sUserName.includes(leadName) || leadName.includes(sUserName))) return true;
          if (groupName && (sUserName === groupName || (cleanGroupName && sUserName.replace(/[^a-z0-9]/g, "") === cleanGroupName))) return true;
        }

        // Match by student ID
        if (studentId && sub.studentId && sub.studentId.toLowerCase().trim() === studentId) return true;

        return false;
      };

      // Find matching quiz submission (priority: selected quiz, fallback: any quiz of event)
      const primaryTargetSubs = selectedPromotionQuizId !== "all"
        ? allQuizSubmissions.filter((s) => s.quizId === selectedPromotionQuizId)
        : allQuizSubmissions;

      const matchedQuiz = primaryTargetSubs.find(isSubmissionMatch) || allQuizSubmissions.find(isSubmissionMatch);

      // Find matching jury evaluation
      const matchedJury = allJuryEvaluations.find((j) => {
        if (j.id && (j.id === reg.id || j.id.toLowerCase().trim() === regId)) return true;
        if (j.teamName && groupName && j.teamName.toLowerCase().trim() === groupName) return true;
        if (j.teamName && leadName && j.teamName.toLowerCase().trim() === leadName) return true;
        return false;
      });

      const activeQuizDef = eventQuizzesList.find(q => q.id === (matchedQuiz?.quizId || selectedPromotionQuizId));
      const fallbackMaxScore = activeQuizDef?.totalMarks ? Number(activeQuizDef.totalMarks) : 100;
      const quizMaxScore = matchedQuiz 
        ? (matchedQuiz.maxScore ? Number(matchedQuiz.maxScore) : fallbackMaxScore) 
        : fallbackMaxScore;
      const quizScore = matchedQuiz 
        ? (matchedQuiz.score !== undefined && matchedQuiz.score !== null ? Number(matchedQuiz.score) : 0) 
        : null;
      const quizPct = matchedQuiz 
        ? (matchedQuiz.percentage !== undefined && matchedQuiz.percentage !== null 
            ? Number(matchedQuiz.percentage) 
            : (quizMaxScore > 0 ? Math.round(((quizScore || 0) / quizMaxScore) * 100) : 0)) 
        : null;
      const quizPassed = matchedQuiz?.passed ?? (quizPct !== null ? quizPct >= (quizCutoffPercentage || 40) : false);

      const juryScore = matchedJury ? Number(matchedJury.totalScore) || 0 : null;

      const currentTeamRound = Number(reg.currentRound) || 1;
      const roundStatus = reg.roundStatus || (currentTeamRound > 1 ? "Qualified" : "Pending");

      return {
        ...reg,
        currentTeamRound,
        roundStatus,
        quizScore,
        quizMaxScore,
        quizPercentage: quizPct,
        quizPassed,
        quizSubmission: matchedQuiz || null,
        juryScore,
        juryEvaluation: matchedJury || null,
        isQualifiedForTarget: currentTeamRound >= promoteToRound && roundStatus === "Qualified",
        isEliminated: roundStatus === "Eliminated" || (reg.eliminatedInRound && reg.eliminatedInRound <= promoteFromRound)
      };
    });
  }, [eventAccessRegistrations, allQuizSubmissions, allJuryEvaluations, selectedPromotionQuizId, eventQuizzesList, quizCutoffPercentage, promoteFromRound, promoteToRound]);

  // Auto-compute eligible teams based on selected criteria
  const eligibleTeamIds = useMemo(() => {
    const activeCandidates = promotionRoster.filter((t) => !t.isEliminated);

    if (promotionMode === "quiz") {
      if (quizCutoffType === "score") {
        return activeCandidates
          .filter((t) => t.quizScore !== null && t.quizScore !== undefined && Number(t.quizScore) >= Number(quizCutoffScore))
          .map((t) => t.id);
      }
      if (quizCutoffType === "percentage") {
        return activeCandidates
          .filter((t) => t.quizPercentage !== null && t.quizPercentage !== undefined && Number(t.quizPercentage) >= Number(quizCutoffPercentage))
          .map((t) => t.id);
      }
      if (quizCutoffType === "topN") {
        return [...activeCandidates]
          .filter((t) => t.quizScore !== null && t.quizScore !== undefined)
          .sort((a, b) => (b.quizScore || 0) - (a.quizScore || 0))
          .slice(0, quizTopNCount)
          .map((t) => t.id);
      }
    } else if (promotionMode === "jury") {
      if (juryCutoffType === "score") {
        return activeCandidates
          .filter((t) => t.juryScore !== null && t.juryScore !== undefined && Number(t.juryScore) >= Number(juryCutoffScore))
          .map((t) => t.id);
      }
      if (juryCutoffType === "topN") {
        return [...activeCandidates]
          .filter((t) => t.juryScore !== null && t.juryScore !== undefined)
          .sort((a, b) => (b.juryScore || 0) - (a.juryScore || 0))
          .slice(0, juryTopNCount)
          .map((t) => t.id);
      }
    }
    return [];
  }, [promotionRoster, promotionMode, quizCutoffType, quizCutoffScore, quizCutoffPercentage, quizTopNCount, juryCutoffType, juryCutoffScore, juryTopNCount]);

  // When criteria changes in quiz/jury mode, sync selectedPromoteRegIds
  useEffect(() => {
    if (promotionMode === "quiz" || promotionMode === "jury") {
      setSelectedPromoteRegIds(eligibleTeamIds);
    }
  }, [eligibleTeamIds, promotionMode]);

  const handleApplyQuizAutoSelect = () => {
    const matched = promotionRoster
      .filter((t) => {
        if (t.isEliminated) return false;
        if (t.quizScore === null || t.quizScore === undefined) return false;
        if (quizCutoffType === "score") return Number(t.quizScore) >= Number(quizCutoffScore);
        if (quizCutoffType === "percentage") return Number(t.quizPercentage ?? 0) >= Number(quizCutoffPercentage);
        if (quizCutoffType === "topN") {
          const sorted = [...promotionRoster]
            .filter(r => !r.isEliminated && r.quizScore !== null && r.quizScore !== undefined)
            .sort((a, b) => (b.quizScore || 0) - (a.quizScore || 0));
          return sorted.slice(0, quizTopNCount).map(r => r.id).includes(t.id);
        }
        return false;
      })
      .map((t) => t.id);

    setSelectedPromoteRegIds(matched);
  };

  const handleApplyJuryAutoSelect = () => {
    const matched = promotionRoster
      .filter((t) => {
        if (t.isEliminated) return false;
        if (t.juryScore === null || t.juryScore === undefined) return false;
        if (juryCutoffType === "score") return Number(t.juryScore) >= Number(juryCutoffScore);
        if (juryCutoffType === "topN") {
          const sorted = [...promotionRoster]
            .filter(r => !r.isEliminated && r.juryScore !== null && r.juryScore !== undefined)
            .sort((a, b) => (b.juryScore || 0) - (a.juryScore || 0));
          return sorted.slice(0, juryTopNCount).map(r => r.id).includes(t.id);
        }
        return false;
      })
      .map((t) => t.id);

    setSelectedPromoteRegIds(matched);
  };

  const handleExecuteBatchPromotion = async () => {
    if (selectedPromoteRegIds.length === 0) {
      await showAlert({
        title: "No Eligible Teams Selected",
        message: promotionMode === "quiz" 
          ? `No teams currently meet the minimum quiz cutoff threshold (${quizCutoffType === "score" ? `${quizCutoffScore} marks` : `${quizCutoffPercentage}%`}). Only participants with score equal or greater than the cutoff can be selected to promote.`
          : "Please select at least one team to promote to the next round.",
        type: "warning",
        icon: "alert"
      });
      return;
    }

    // Strict validation: In quiz mode, ensure every selected team has score >= cutoff
    if (promotionMode === "quiz") {
      const belowCutoffTeams = selectedPromoteRegIds
        .map(id => promotionRoster.find(t => t.id === id))
        .filter(t => {
          if (!t) return true;
          if (t.quizScore === null) return true;
          if (quizCutoffType === "score") return Number(t.quizScore) < Number(quizCutoffScore);
          if (quizCutoffType === "percentage") return Number(t.quizPercentage ?? 0) < Number(quizCutoffPercentage);
          if (quizCutoffType === "topN") return !eligibleTeamIds.includes(t.id);
          return false;
        });

      if (belowCutoffTeams.length > 0) {
        await showAlert({
          title: "Cannot Promote Teams Below Cutoff",
          message: `${belowCutoffTeams.length} selected team(s) do not meet the minimum quiz cutoff (${quizCutoffType === "score" ? `${quizCutoffScore} marks` : `${quizCutoffPercentage}%`}). Only participants with score equal or greater than the cutoff can be promoted to Round ${promoteToRound}.`,
          type: "danger",
          icon: "alert"
        });
        return;
      }
    }

    const confirmed = await showConfirm({
      title: `Promote Teams to Round ${promoteToRound}?`,
      message: `Are you sure you want to promote ${selectedPromoteRegIds.length} qualified team(s) from Round ${promoteFromRound} to Round ${promoteToRound}?`,
      confirmText: `Promote ${selectedPromoteRegIds.length} Qualified Team(s)`,
      cancelText: "Cancel",
      type: "primary",
      icon: "play"
    });
    if (!confirmed) return;

    setIsExecutingPromotion(true);
    try {
      const now = Date.now();
      const promotePromises = selectedPromoteRegIds.map(async (regId) => {
        const teamInfo = promotionRoster.find((t) => t.id === regId);
        const scoreUsed = promotionMode === "quiz" 
          ? teamInfo?.quizScore ?? 0 
          : promotionMode === "jury" 
            ? teamInfo?.juryScore ?? 0 
            : null;

        await updateRegistration(regId, {
          currentRound: promoteToRound,
          roundStatus: "Qualified",
          promotedToRound: promoteToRound,
          promotionMethod: promotionMode,
          promotionScore: scoreUsed,
          promotedAt: now,
          updatedAt: now,
          // Archive previous submission data to prevent data loss while clearing UI for new round
          [`r${promoteFromRound}_problemStatement`]: teamInfo?.problemStatement || "",
          [`r${promoteFromRound}_selectedProblemStatementId`]: teamInfo?.selectedProblemStatementId || "",
          [`r${promoteFromRound}_srsFileName`]: teamInfo?.srsFileName || "",
          [`r${promoteFromRound}_srsFileUrl`]: teamInfo?.srsFileUrl || "",
          [`r${promoteFromRound}_presentationFileName`]: teamInfo?.presentationFileName || "",
          [`r${promoteFromRound}_presentationUrl`]: teamInfo?.presentationUrl || "",
          [`r${promoteFromRound}_keyFeatures`]: teamInfo?.keyFeatures || "",
          [`r${promoteFromRound}_githubUrl`]: teamInfo?.githubUrl || teamInfo?.repoUrl || "",
          [`r${promoteFromRound}_repoUrl`]: teamInfo?.repoUrl || teamInfo?.githubUrl || "",
          [`r${promoteFromRound}_prototypeUrl`]: teamInfo?.prototypeUrl || "",
          [`r${promoteFromRound}_demoVideoUrl`]: teamInfo?.demoVideoUrl || "",
          // Clear active submission fields so they can start fresh in the new round
          problemStatement: "",
          selectedProblemStatementId: "",
          srsFileName: "",
          srsFileUrl: "",
          presentationFileName: "",
          presentationUrl: "",
          keyFeatures: "",
          githubUrl: "",
          repoUrl: "",
          prototypeUrl: "",
          demoVideoUrl: "",
          submissionStatus: "Pending",
          submittedAt: null,
          isPsSaved: false,
          isPsLocked: false
        });
      });

      // Handle unselected elimination if checked
      let eliminatePromises: Promise<any>[] = [];
      if (markUnselectedAsEliminated) {
        const unselectedTeams = promotionRoster.filter(
          (t) => t.currentTeamRound === promoteFromRound && !selectedPromoteRegIds.includes(t.id)
        );
        eliminatePromises = unselectedTeams.map(async (t) => {
          await updateRegistration(t.id, {
            roundStatus: "Eliminated",
            eliminatedInRound: promoteFromRound,
            eliminatedAt: now,
            updatedAt: now
          });
        });
      }

      await Promise.all([...promotePromises, ...eliminatePromises]);

      // Dispatch Congratulation & Promotion Emails via Resend to Team Leads
      const targetRoundDef = liveRoundsList.find(r => r.roundNumber === promoteToRound);
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const siteBaseUrl = isLocal ? "https://aiversevitb.in" : window.location.origin;
      const dashboardUrl = `${siteBaseUrl}/participant`;

      let emailsSentCount = 0;
      const emailPromises = selectedPromoteRegIds.map(async (regId) => {
        try {
          const teamInfo = promotionRoster.find((t) => t.id === regId);
          if (!teamInfo) return;

          const targetEmail = teamInfo.teamLeadPersonalEmail || teamInfo.personalEmail || teamInfo.teamLeadEmail || teamInfo.email;
          if (!targetEmail) return;

          const emailContent = buildRoundPromotionEmail({
            teamLeadName: teamInfo.teamLeadName || teamInfo.name || "Participant",
            eventTitle: eventAccessEvent?.title || "AI Verse Event",
            groupName: teamInfo.groupName,
            fromRound: promoteFromRound,
            toRound: promoteToRound,
            roundName: targetRoundDef?.name,
            roundDescription: targetRoundDef?.description,
            teamEmail: teamInfo.teamEmail,
            dashboardUrl,
            quizScore: teamInfo.quizScore,
            quizMaxScore: teamInfo.quizMaxScore,
            quizPercentage: teamInfo.quizPercentage,
            juryScore: teamInfo.juryScore,
          });

          const emailRes = await sendResendEmail({
            to: targetEmail,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });

          if (emailRes.success) {
            emailsSentCount++;
          }
        } catch (emailErr) {
          console.warn("Failed to dispatch promotion email for regId:", regId, emailErr);
        }
      });

      await Promise.allSettled(emailPromises);

      // Advance active event stage if requested
      if (advanceEventRoundOnPromote && eventAccessEvent?.id && promoteToRound > (eventAccessEvent.currentRound || 1)) {
        await updateEvent(eventAccessEvent.id, {
          currentRound: promoteToRound,
          updatedAt: now
        });
        setLiveCurrentRound(promoteToRound);
        setEventAccessEvent((prev: any) => ({
          ...prev,
          currentRound: promoteToRound
        }));
        setEvents((prev) => prev.map((ev) => ev.id === eventAccessEvent.id ? { ...ev, currentRound: promoteToRound } : ev));
      }

      // Update local eventAccessRegistrations state
      setEventAccessRegistrations((prev) =>
        prev.map((r) => {
          if (selectedPromoteRegIds.includes(r.id)) {
            const teamInfo = promotionRoster.find((t) => t.id === r.id);
            const scoreUsed = promotionMode === "quiz" ? teamInfo?.quizScore ?? 0 : promotionMode === "jury" ? teamInfo?.juryScore ?? 0 : null;
            return {
              ...r,
              currentRound: promoteToRound,
              roundStatus: "Qualified",
              promotedToRound: promoteToRound,
              promotionMethod: promotionMode,
              promotionScore: scoreUsed,
              promotedAt: now
            };
          }
          if (markUnselectedAsEliminated && (r.currentRound || 1) === promoteFromRound) {
            return {
              ...r,
              roundStatus: "Eliminated",
              eliminatedInRound: promoteFromRound,
              eliminatedAt: now
            };
          }
          return r;
        })
      );

      setRoundsSuccessMsg(`🎉 Successfully promoted ${selectedPromoteRegIds.length} team(s) to Round ${promoteToRound} & dispatched congratulations emails!`);
      setTimeout(() => setRoundsSuccessMsg(null), 7000);
    } catch (err) {
      console.error("Error executing batch round promotion:", err);
      alert("Failed to execute round promotion. Please check console.");
    } finally {
      setIsExecutingPromotion(false);
    }
  };

  const handleExportShortlistCSV = () => {
    const targetTeams = promotionRoster.filter(t => selectedPromoteRegIds.includes(t.id));
    if (targetTeams.length === 0) {
      alert("No teams selected for export. Select teams first.");
      return;
    }

    const headers = [
      "Rank",
      "Team Name",
      "Team Lead Name",
      "Student ID / Roll No",
      "Email Address",
      "Phone Number",
      "Team Size",
      "Current Round",
      "Target Promoted Round",
      "Quiz Score",
      "Quiz Max Score",
      "Quiz Percentage",
      "Jury Score",
      "Submission Status",
      "Promotion Status"
    ];

    const rows = targetTeams.map((t, idx) => [
      idx + 1,
      `"${(t.groupName || t.teamLeadName || "Team").replace(/"/g, '""')}"`,
      `"${(t.teamLeadName || t.name || "").replace(/"/g, '""')}"`,
      `"${(t.teamLeadStudentId || t.studentId || "N/A").replace(/"/g, '""')}"`,
      `"${(t.teamLeadEmail || t.email || "").replace(/"/g, '""')}"`,
      `"${(t.phoneNumber || t.teamLeadPhone || "").replace(/"/g, '""')}"`,
      t.teamSize || (Array.isArray(t.members) ? t.members.length + 1 : 1),
      t.currentTeamRound,
      promoteToRound,
      t.quizScore !== null ? t.quizScore : "N/A",
      t.quizMaxScore || 50,
      t.quizPercentage !== null ? `${t.quizPercentage}%` : "N/A",
      t.juryScore !== null ? `${t.juryScore}/100` : "N/A",
      `"${(t.submissionStatus || "Draft").replace(/"/g, '""')}"`,
      "Qualified"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${(eventAccessEvent?.title || "event").replace(/[^a-zA-Z0-9]/g, "_")}_Round_${promoteToRound}_Shortlist.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveLiveEventRounds = async () => {
    if (!eventAccessEvent?.id) return;
    setSavingLiveRounds(true);
    try {
      await updateEvent(eventAccessEvent.id, {
        rounds: liveRoundsList,
        currentRound: liveCurrentRound,
        totalRounds: liveTotalRounds,
        allowRoundManagement: true,
        updatedAt: Date.now()
      });

      setEventAccessEvent((prev: any) => ({
        ...prev,
        rounds: liveRoundsList,
        currentRound: liveCurrentRound,
        totalRounds: liveTotalRounds,
        allowRoundManagement: true
      }));

      setEvents(prev => prev.map(ev => ev.id === eventAccessEvent.id ? {
        ...ev,
        rounds: liveRoundsList,
        currentRound: liveCurrentRound,
        totalRounds: liveTotalRounds,
        allowRoundManagement: true
      } : ev));

      setRoundsSuccessMsg(`Successfully updated competition round stages & active stage (Round ${liveCurrentRound})!`);
      setTimeout(() => setRoundsSuccessMsg(null), 5000);
    } catch (err) {
      console.error("Error updating live event rounds:", err);
      alert("Failed to save event rounds.");
    } finally {
      setSavingLiveRounds(false);
    }
  };


  const generateTeamEmail = (reg: any): string => {
    const rawName = reg.groupName && reg.groupName !== "Individual RSVP"
      ? reg.groupName
      : (reg.teamLeadName || reg.name || "team");

    const cleanName = rawName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    return `${cleanName || "team"}@aiverse.in`;
  };

  const handleEnableLoginAccess = async () => {
    if (!eventAccessRegistrations || eventAccessRegistrations.length === 0) {
      await showAlert({
        title: "No Teams Available",
        message: "No registered teams available to grant access to.",
        type: "info"
      });
      return;
    }

    const confirmedTeams = eventAccessRegistrations.filter(
      (r) => String(r.status || "").toLowerCase().trim() === "confirmed"
    );

    if (confirmedTeams.length === 0) {
      await showAlert({
        title: "No Confirmed Teams",
        message: "There are no confirmed team registrations for this event yet. Please confirm the team(s) in the Registration Directory before granting portal login access.",
        type: "warning",
        icon: "alert"
      });
      return;
    }

    const unconfirmedCount = eventAccessRegistrations.length - confirmedTeams.length;
    const confirmMsg = unconfirmedCount > 0
      ? `Allow login access for ${confirmedTeams.length} confirmed team(s)? Note: ${unconfirmedCount} unconfirmed team(s) will not be granted access until they are confirmed in the Registration Directory.`
      : `Are you sure you want to allow login access for all ${confirmedTeams.length} confirmed registered team(s)?`;

    const confirmGrant = await showConfirm({
      title: "Allow Login Access?",
      message: confirmMsg,
      confirmText: "Allow Access",
      cancelText: "Cancel",
      type: "warning",
      icon: "alert"
    });
    if (!confirmGrant) return;

    setIsProvisioningLoginAccess(true);

    try {
      const allIds: string[] = [];
      const firestoreRegUpdates: Array<{ id: string; data: any }> = [];
      const now = Date.now();

      // 1. Prepare all confirmed records synchronously in memory
      for (const reg of confirmedTeams) {
        allIds.push(reg.id);

        // Registration doc update in Firestore
        firestoreRegUpdates.push({
          id: reg.id,
          data: {
            accessGranted: true,
            loginAccessGranted: true,
            accessProvisionedAt: now,
          }
        });
      }

      // 2. High-speed Firestore Batch Commits (400 items per batch)
      const commitBatches = async (collectionName: string, items: Array<{ id: string; data: any }>) => {
        for (let i = 0; i < items.length; i += 400) {
          const chunk = items.slice(i, i + 400);
          try {
            const batch = writeBatch(db);
            for (const item of chunk) {
              const docRef = doc(db, collectionName, item.id);
              batch.set(docRef, item.data, { merge: true });
            }
            await batch.commit();
          } catch {
            // Gracefully continue without throwing permission alerts
          }
        }
      };

      // Execute all Firestore batch writes concurrently
      await Promise.allSettled([
        commitBatches("registrations", firestoreRegUpdates),
        ...confirmedTeams.map(reg => updateRegistration(reg.id, {
          accessGranted: true,
          loginAccessGranted: true,
          accessProvisionedAt: now
        }).catch(() => null))
      ]);

      if (eventAccessEvent?.id) {
        try {
          await updateEvent(eventAccessEvent.id, { allowLoginAccess: true });
        } catch (evErr) {
          console.warn("Notice updating allowLoginAccess on event:", evErr);
        }
      }

      setProvisionedTeamIds((prev) => Array.from(new Set([...prev, ...allIds])));

      setLoginAccessSuccessMsg(`✅ Successfully granted login access for ${allIds.length} confirmed team(s)!`);
      setTimeout(() => {
        setLoginAccessSuccessMsg(null);
      }, 5000);
    } catch (err) {
      console.error("Error granting login access:", err);
      alert("Failed to grant login access.");
    } finally {
      setIsProvisioningLoginAccess(false);
    }
  };

  const handleRevokeAllTeamsLoginAccess = async () => {
    if (!eventAccessRegistrations || eventAccessRegistrations.length === 0) {
      await showAlert({
        title: "No Teams Available",
        message: "No registered teams available.",
        type: "info"
      });
      return;
    }
    const confirmRevoke = await showConfirm({
      title: "Revoke All Login Access?",
      message: "Are you sure you want to revoke team portal login access for all teams? They will no longer be able to log in using their credentials.",
      confirmText: "Revoke Access for All",
      cancelText: "Cancel",
      type: "danger",
      icon: "alert"
    });
    if (!confirmRevoke) return;

    setIsProvisioningLoginAccess(true);
    try {
      const now = Date.now();
      const firestoreRegUpdates: Array<{ id: string; data: any }> = [];
      const supaEmailsToDelete: string[] = [];

      const isQuiz = Boolean(
        eventAccessEvent?.category === "QUIZ" ||
        eventAccessEvent?.category === "Quiz" ||
        eventAccessEvent?.category?.toLowerCase()?.includes("quiz")
      );

      for (const reg of eventAccessRegistrations) {
        firestoreRegUpdates.push({
          id: reg.id,
          data: {
            accessGranted: false,
            loginAccessGranted: false,
            accessRevokedAt: now,
          }
        });

        const supaEmails = isQuiz
          ? [reg.personalEmail, reg.email, reg.collegeEmail].filter(Boolean)
          : [reg.teamEmail || generateTeamEmail(reg)].filter(Boolean);
        supaEmailsToDelete.push(...supaEmails);
      }

      // High-speed Batched Firestore Commits
      const commitBatches = async (collectionName: string, items: Array<{ id: string; data: any }>) => {
        for (let i = 0; i < items.length; i += 400) {
          const chunk = items.slice(i, i + 400);
          try {
            const batch = writeBatch(db);
            for (const item of chunk) {
              const docRef = doc(db, collectionName, item.id);
              batch.set(docRef, item.data, { merge: true });
            }
            await batch.commit();
          } catch {
            // Gracefully handle permission notices
          }
        }
      };

      await Promise.allSettled([
        commitBatches("registrations", firestoreRegUpdates),
        ...eventAccessRegistrations.map(reg => updateRegistration(reg.id, {
          accessGranted: false,
          loginAccessGranted: false,
          accessRevokedAt: now
        }).catch(() => null))
      ]);

      // Concurrent delete in Supabase
      const uniqueSupaEmails = Array.from(new Set(supaEmailsToDelete));
      const CHUNK_SIZE = 20;
      for (let i = 0; i < uniqueSupaEmails.length; i += CHUNK_SIZE) {
        const chunk = uniqueSupaEmails.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(
          chunk.map((email) => userService.deleteUserByEmail(email))
        );
      }

      if (eventAccessEvent?.id) {
        try {
          await updateEvent(eventAccessEvent.id, { allowLoginAccess: false });
        } catch (evErr) {
          console.warn("Notice updating allowLoginAccess on event upon revoke:", evErr);
        }
      }

      setProvisionedTeamIds([]);
      setEventAccessRegistrations((prev) =>
        prev.map((r) => ({ ...r, accessGranted: false, loginAccessGranted: false }))
      );
      setLoginAccessSuccessMsg("Successfully revoked portal login access and updated credentials in real time!");
      setTimeout(() => {
        setLoginAccessSuccessMsg(null);
      }, 5500);
    } catch (err) {
      console.error("Error revoking login access:", err);
      await showAlert({
        title: "Revoke Error",
        message: "Failed to revoke login access.",
        type: "danger"
      });
    } finally {
      setIsProvisioningLoginAccess(false);
    }
  };

  const handleGrantSingleTeamAccess = async (regId: string, teamNameStr: string) => {
    setIsProvisioningLoginAccess(true);
    try {
      const now = Date.now();
      await updateRegistration(regId, {
        accessGranted: true,
        loginAccessGranted: true,
        accessProvisionedAt: now,
        updatedAt: now
      });

      setProvisionedTeamIds((prev) => Array.from(new Set([...prev, regId])));
      setEventAccessRegistrations((prev) =>
        prev.map((r) => (r.id === regId ? { ...r, accessGranted: true, loginAccessGranted: true } : r))
      );
      setLoginAccessSuccessMsg(`✅ Login access granted for "${teamNameStr}".`);
      setTimeout(() => setLoginAccessSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Error granting single team access:", err);
      alert("Failed to grant login access for team.");
    } finally {
      setIsProvisioningLoginAccess(false);
    }
  };

  const handleRevokeSingleTeamAccess = async (regId: string, teamNameStr: string) => {
    const confirmRevoke = await showConfirm({
      title: "Revoke Login Access?",
      message: `Are you sure you want to revoke login access for "${teamNameStr}"?`,
      confirmText: "Revoke Access",
      cancelText: "Cancel",
      type: "danger",
      icon: "alert"
    });
    if (!confirmRevoke) return;

    try {
      await updateRegistration(regId, {
        accessGranted: false,
        loginAccessGranted: false,
        accessRevokedAt: Date.now(),
      });

      try {
        await updateRegistration(regId, {
          accessGranted: false,
          loginAccessGranted: false,
          accessRevokedAt: Date.now()
        });
      } catch (apiErr) {
        console.warn("Notice updating registration via API:", apiErr);
      }

      // Also revoke in users collection & users_by_phone
      try {
        const reg = eventAccessRegistrations.find((r) => r.id === regId);
        if (reg) {
          const isQuiz = Boolean(
            eventAccessEvent?.category === "QUIZ" ||
            eventAccessEvent?.category === "Quiz" ||
            eventAccessEvent?.category?.toLowerCase()?.includes("quiz") ||
            reg.isQuiz === true
          );

          // Delete from Supabase Auth
          const supaEmails = isQuiz
            ? [reg.personalEmail, reg.email, reg.collegeEmail].filter(Boolean)
            : [reg.teamEmail || generateTeamEmail(reg)].filter(Boolean);

          for (const sEmail of supaEmails) {
            await userService.deleteUserByEmail(sEmail);
          }
        }
      } catch (userErr) {
        console.warn("Firestore revoke user error:", userErr);
      }

      setProvisionedTeamIds((prev) => prev.filter((id) => id !== regId));
      setEventAccessRegistrations((prev) =>
        prev.map((r) => (r.id === regId ? { ...r, accessGranted: false, loginAccessGranted: false } : r))
      );
      setLoginAccessSuccessMsg(`Revoked login access for ${teamNameStr}.`);
      setTimeout(() => {
        setLoginAccessSuccessMsg(null);
      }, 4000);
    } catch (err) {
      console.error("Error revoking single team access:", err);
      alert("Failed to revoke access for team.");
    }
  };

  const handleOpenEventAccess = async (eventObj: any) => {
    let fullEvent = eventObj;
    if (eventObj?.id) {
      try {
        const evDoc = await getDoc(doc(db, "events", eventObj.id));
        if (evDoc.exists()) {
          fullEvent = { id: evDoc.id, ...evDoc.data() };
        }
      } catch (err) {
        console.warn("Could not fetch full event document:", err);
      }
    }
    setEventAccessEvent(fullEvent);
    setIsEventAccessModalOpen(true);
    setLoadingEventAccessRegs(true);
    setEventAccessSearchQuery("");
    if (eventObj?.id && searchParams.get("accessEventId") !== eventObj.id) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("accessEventId", eventObj.id);
      setSearchParams(newParams, { replace: true });
    }
    try {
      const rawRegs = await fetchRegistrations().catch(() => []);
      let snapshot = Array.isArray(rawRegs) ? rawRegs : (rawRegs?.registrations || rawRegs?.data || []);
      if (snapshot.length === 0) {
        const querySnapshot = await getDocs(collection(db, "registrations")).catch(() => null);
        if (querySnapshot && querySnapshot.forEach) {
          const fbList: any[] = [];
          querySnapshot.forEach((docSnap: any) => fbList.push({ id: docSnap.id, ...docSnap.data() }));
          snapshot = fbList;
        }
      }

      const list: any[] = [];
      const grantedIds: string[] = [];
      const curEid = (eventObj?.id ? String(eventObj.id) : "").trim();
      const curTitle = (eventObj?.title || "").toLowerCase().trim();
      const cleanCurEid = curEid.replace(/[Il]/g, "i").toLowerCase();

      snapshot.forEach((data: any) => {
        const regId = data.id || data._id;
        const regEid = (data.eventId ? String(data.eventId) : "").trim();
        const regTitle = (data.eventTitle || "").toLowerCase().trim();

        const isIdMatch = Boolean(
          regEid && curEid && (
            regEid === curEid ||
            regEid.toLowerCase() === curEid.toLowerCase() ||
            regEid.replace(/[Il]/g, "i").toLowerCase() === cleanCurEid
          )
        );
        const isTitleMatch = Boolean(regTitle && curTitle && (regTitle === curTitle || regTitle.includes(curTitle) || curTitle.includes(regTitle)));

        if (isIdMatch || isTitleMatch) {
          list.push({ id: regId, ...data });
          const isConfirmed = String(data.status || "").toLowerCase().trim() === "confirmed";
          if (isConfirmed && (data.accessGranted || data.loginAccessGranted)) {
            grantedIds.push(regId);
          }
        }
      });
      setEventAccessRegistrations(list);
      setProvisionedTeamIds(grantedIds);
    } catch (err) {
      console.error("Error fetching event registrations for Event Access:", err);
    } finally {
      setLoadingEventAccessRegs(false);
    }
  };

  // Flattened list of all individual registered attendees (Team Leads + Members + Solo Registrants)
  const flattenedEventAttendees = useMemo(() => {
    const list: Array<{
      id: string;
      regId: string;
      teamId: string;
      name: string;
      studentId: string;
      email: string;
      phone: string;
      branch: string;
      section: string;
      year: string;
      college: string;
      role: string;
      isLead: boolean;
      isGroup: boolean;
      groupName: string;
      status: string;
      accessGranted: boolean;
      createdAt: number;
      teamNumber?: number;
      foodPreference?: string;
    }> = [];

    (eventAccessRegistrations || []).forEach((reg, idx) => {
      const isGroup = Boolean(reg.groupName && reg.groupName !== "Individual RSVP");
      const groupName = isGroup ? reg.groupName : "Individual RSVP";
      const status = reg.status || "Not Confirmed";
      const accessGranted = Boolean(reg.accessGranted || reg.loginAccessGranted);
      const regId = reg.id || reg._id || `reg_${idx}`;
      const branch = reg.branch || reg.department || "CSE";
      const section = reg.section || "";
      const year = reg.year || "";
      const college = reg.collegeName || reg.college || "";
      const teamNum = reg.teamNumber || reg.teamNo || idx + 1;
      const foodPref = reg.foodPreference || "";

      // 1. Team Lead / Solo Participant
      const leadName = reg.teamLeadName || reg.fullName || reg.name || "Student Participant";
      const leadEmail = reg.teamLeadPersonalEmail || reg.personalEmail || reg.teamLeadEmail || reg.email || "";
      const leadStudentId = reg.teamLeadStudentId || reg.studentId || reg.rollNo || "";
      const leadPhone = reg.phoneNumber || reg.teamLeadPhone || reg.phone || "";

      list.push({
        id: `${regId}_lead`,
        regId,
        teamId: regId,
        name: leadName,
        studentId: leadStudentId,
        email: leadEmail,
        phone: leadPhone,
        branch,
        section,
        year,
        college,
        role: isGroup ? "Team Lead" : "Solo Participant",
        isLead: true,
        isGroup,
        groupName,
        status,
        accessGranted,
        createdAt: reg.createdAt || Date.now(),
        teamNumber: teamNum,
        foodPreference: foodPref
      });

      // 2. Team Members
      if (Array.isArray(reg.members)) {
        reg.members.forEach((m: any, mIdx: number) => {
          if (m && (m.name || m.email || m.studentId)) {
            list.push({
              id: `${regId}_m_${mIdx}`,
              regId,
              teamId: regId,
              name: m.name || `Member #${mIdx + 2}`,
              studentId: m.studentId || m.rollNo || m.registrationNumber || "",
              email: m.email || m.personalEmail || "",
              phone: m.phone || m.phoneNumber || leadPhone,
              branch: m.branch || branch,
              section: m.section || section,
              year: m.year || year,
              college: m.college || college,
              role: m.role || `Team Member #${mIdx + 2}`,
              isLead: false,
              isGroup: true,
              groupName,
              status,
              accessGranted,
              createdAt: reg.createdAt || Date.now(),
              teamNumber: teamNum,
              foodPreference: foodPref
            });
          }
        });
      }
    });

    return list;
  }, [eventAccessRegistrations]);

  const filteredEventAccessRegistrations = useMemo(() => {
    let list = eventAccessRegistrations;

    if (eventRosterFilter === "teams") {
      list = list.filter(r => r.groupName && r.groupName !== "Individual RSVP");
    } else if (eventRosterFilter === "individuals") {
      list = list.filter(r => !r.groupName || r.groupName === "Individual RSVP");
    } else if (eventRosterFilter === "confirmed") {
      list = list.filter(r => String(r.status || "").toLowerCase().trim() === "confirmed");
    } else if (eventRosterFilter === "pending") {
      list = list.filter(r => String(r.status || "").toLowerCase().trim() !== "confirmed");
    }

    if (!eventAccessSearchQuery.trim()) return list;
    const q = eventAccessSearchQuery.toLowerCase().trim();
    return list.filter((r) => {
      const leadName = (r.teamLeadName || r.fullName || r.name || "").toLowerCase();
      const leadEmail = (r.teamLeadPersonalEmail || r.teamLeadEmail || r.email || "").toLowerCase();
      const studentId = (r.teamLeadStudentId || r.studentId || r.rollNo || "").toLowerCase();
      const groupName = (r.groupName || "").toLowerCase();
      const phone = (r.phoneNumber || r.phone || "").toLowerCase();
      const membersMatch = Array.isArray(r.members) && r.members.some((m: any) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.studentId || m.rollNo || "").toLowerCase().includes(q)
      );

      return leadName.includes(q) || leadEmail.includes(q) || studentId.includes(q) || groupName.includes(q) || phone.includes(q) || membersMatch;
    });
  }, [eventAccessRegistrations, eventAccessSearchQuery, eventRosterFilter]);

  const filteredIndividualAttendees = useMemo(() => {
    let list = flattenedEventAttendees;

    if (eventRosterFilter === "teams") {
      list = list.filter(a => a.isGroup);
    } else if (eventRosterFilter === "individuals") {
      list = list.filter(a => !a.isGroup);
    } else if (eventRosterFilter === "confirmed") {
      list = list.filter(a => String(a.status || "").toLowerCase().trim() === "confirmed");
    } else if (eventRosterFilter === "pending") {
      list = list.filter(a => String(a.status || "").toLowerCase().trim() !== "confirmed");
    }

    if (!eventAccessSearchQuery.trim()) return list;
    const q = eventAccessSearchQuery.toLowerCase().trim();
    return list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.studentId.toLowerCase().includes(q) ||
      a.groupName.toLowerCase().includes(q) ||
      a.phone.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    );
  }, [flattenedEventAttendees, eventAccessSearchQuery, eventRosterFilter]);

  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const toggleExpandAllTeams = () => {
    if (expandedTeamIds.length >= eventAccessRegistrations.length) {
      setExpandedTeamIds([]);
    } else {
      setExpandedTeamIds(eventAccessRegistrations.map(r => r.id));
    }
  };

  const handleOpenEventRoster = (eventObj: any) => {
    handleOpenEventAccess(eventObj);
    setIsEventRosterModalOpen(true);
  };

  const handleExportEventAccessCsv = () => {
    if (!flattenedEventAttendees || flattenedEventAttendees.length === 0) {
      alert("No registered participants found to export.");
      return;
    }
    const headers = [
      "Student / Participant Name",
      "Student ID / Roll No",
      "Email Address",
      "Phone Number",
      "Role in Team",
      "Team / Group Name",
      "Registration Type",
      "College Name",
      "Branch",
      "Section",
      "Year",
      "Status",
      "Login Access",
      "Registered Date"
    ];

    const rows = flattenedEventAttendees.map(a => [
      `"${(a.name || "").replace(/"/g, '""')}"`,
      `"${(a.studentId || "N/A").replace(/"/g, '""')}"`,
      `"${(a.email || "").replace(/"/g, '""')}"`,
      `"${(a.phone || "").replace(/"/g, '""')}"`,
      `"${(a.role || (a.isLead ? "Team Lead" : "Member")).replace(/"/g, '""')}"`,
      `"${(a.isGroup ? a.groupName : "Individual RSVP").replace(/"/g, '""')}"`,
      `"${a.isGroup ? "Group Team" : "Individual"}"`,
      `"${(a.college || "").replace(/"/g, '""')}"`,
      `"${(a.branch || "").replace(/"/g, '""')}"`,
      `"${(a.section || "").replace(/"/g, '""')}"`,
      `"${(a.year || "").replace(/"/g, '""')}"`,
      `"${a.status}"`,
      `"${a.accessGranted ? "Granted" : "Pending"}"`,
      `"${new Date(a.createdAt).toLocaleDateString("en-US")}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const eventNameSlug = (eventAccessEvent?.title || "event").toLowerCase().replace(/[^a-z0-9]/g, "_");
    link.setAttribute("download", `${eventNameSlug}_all_registered_members_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenEventDetails = async (eventId: string) => {
    setIsDetailsModalOpen(true);
    setLoadingDetails(true);
    setCopiedWhatsLink(false);
    try {
      const docRef = doc(db, "events", eventId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSelectedEventDetails({ id: docSnap.id, ...docSnap.data() });
      } else {
        const fallback = events.find(e => e.id === eventId);
        setSelectedEventDetails(fallback || null);
      }
    } catch (err) {
      console.error("Error fetching full event details:", err);
      const fallback = events.find(e => e.id === eventId);
      setSelectedEventDetails(fallback || null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // New Detailed Event Form State
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<"Workshop" | "Hackathon" | "Seminar" | "Tech Event" | "Alumni Meetup" | "Quiz">("Workshop");
  const [formPrimaryTag, setFormPrimaryTag] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formIsVirtual, setFormIsVirtual] = useState(true);
  const [formLocation, setFormLocation] = useState("");
  const [formRegDeadline, setFormRegDeadline] = useState("");
  const [formRegDeadlineTime, setFormRegDeadlineTime] = useState("");
  const [formMaxParticipants, setFormMaxParticipants] = useState("");
  const [formEnableWaitlist, setFormEnableWaitlist] = useState(false);
  const [formMinTeamSize, setFormMinTeamSize] = useState("1");
  const [formMaxTeamSize, setFormMaxTeamSize] = useState("4");
  const [formRegistrationFee, setFormRegistrationFee] = useState("0");
  const [formIsPaidEvent, setFormIsPaidEvent] = useState<boolean>(false);
  const [formPricingType, setFormPricingType] = useState<"per_person" | "per_team">("per_person");
  const [formPaymentQrImageFilename, setFormPaymentQrImageFilename] = useState("");
  const [formPaymentQrImagePreview, setFormPaymentQrImagePreview] = useState("");
  const [formUpiId, setFormUpiId] = useState("");
  const [formPosterImages, setFormPosterImages] = useState<{ filename: string, preview: string }[]>([]);
  const [formWhatsGroupLink, setFormWhatsGroupLink] = useState("");
  const [formFacultyCoordinator, setFormFacultyCoordinator] = useState("");
  const [formFacultyCoordinatorEmail, setFormFacultyCoordinatorEmail] = useState("");
  const [formFacultyCoordinatorPhone, setFormFacultyCoordinatorPhone] = useState("");
  const [formStudentCoordinator, setFormStudentCoordinator] = useState("");
  const [formStudentCoordinatorEmail, setFormStudentCoordinatorEmail] = useState("");
  const [formStudentCoordinatorPhone, setFormStudentCoordinatorPhone] = useState("");

  const [formJuryName, setFormJuryName] = useState("");
  const [formJuryRole, setFormJuryRole] = useState("");
  const [formJuryBio, setFormJuryBio] = useState("");
  const [formJuryLinkedin, setFormJuryLinkedin] = useState("");
  const [formJurySameAsSpeaker, setFormJurySameAsSpeaker] = useState(false);
  const [formJuryImageFilename, setFormJuryImageFilename] = useState("");
  const [formJuryImagePreview, setFormJuryImagePreview] = useState("");

  const [formVisibility, setFormVisibility] = useState<"Public" | "Internal Only">("Public");

  const [formSpeakerName, setFormSpeakerName] = useState("");
  const [formSpeakerRole, setFormSpeakerRole] = useState("");
  const [formSpeakerBio, setFormSpeakerBio] = useState("");
  const [formSpeakerLinkedin, setFormSpeakerLinkedin] = useState("");
  const [formSpeakerImageFilename, setFormSpeakerImageFilename] = useState("");
  const [formSpeakerImagePreview, setFormSpeakerImagePreview] = useState("");

  // Sync Jury info to Speaker info if Same as Speaker is enabled
  useEffect(() => {
    if (formJurySameAsSpeaker) {
      setFormSpeakerName(formJuryName);
      setFormSpeakerRole(formJuryRole);
      setFormSpeakerBio(formJuryBio);
      setFormSpeakerLinkedin(formJuryLinkedin);
      setFormSpeakerImageFilename(formJuryImageFilename);
      setFormSpeakerImagePreview(formJuryImagePreview);
    }
  }, [
    formJurySameAsSpeaker,
    formJuryName,
    formJuryRole,
    formJuryBio,
    formJuryLinkedin,
    formJuryImageFilename,
    formJuryImagePreview
  ]);

  // Alumni Meetup Specific Fields
  const [formCompany, setFormCompany] = useState("");
  const [formBatch, setFormBatch] = useState("");
  const [formIsPastEvent, setFormIsPastEvent] = useState(false);

  // Add Bulk Registers Card States (for non-Hackathon events)
  const [formCustomRegLink, setFormCustomRegLink] = useState("");
  const [formRegType, setFormRegType] = useState("Open");
  const [formPreRegisteredEmails, setFormPreRegisteredEmails] = useState("");
  const [bulkRegCsvFilename, setBulkRegCsvFilename] = useState("");
  const [bulkRegCsvData, setBulkRegCsvData] = useState<any[]>([]);
  const bulkCsvFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadBulkRegTemplate = () => {
    const headers = ["RollNumber", "Name", "CollegeEmailID", "Branch", "Section", "Year", "PhoneNumber"];
    const sampleRows = [
      "21A91A0501,Jane Doe,jane.doe@university.edu,CSE,A,3rd Year,9876543210",
      "21A91A0502,John Smith,john.smith@university.edu,AIML,B,3rd Year,9876543211"
    ];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...sampleRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bulk_registers_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBulkRegCsvFilename(file.name);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data) {
            setBulkRegCsvData(results.data);
          }
        },
        error: (err) => {
          console.error("CSV parse error:", err);
          alert("Failed to parse CSV file. Please verify CSV format.");
        }
      });
    }
  };

  // Agenda States
  const [formHasAgenda, setFormHasAgenda] = useState(true);
  const [formAgendaItems, setFormAgendaItems] = useState<any[]>([
    { time: "09:00 AM - 10:30 AM", title: "Morning Keynote: The Future of Compute", description: "Opening session detailing next-gen silicon compute." },
    { time: "11:30 AM - 01:00 PM", title: "Workshop: Transformer Efficiency", description: "Hands-on FlashAttention, quantization, and sparse computation models." },
    { time: "03:00 PM - 04:30 PM", title: "Panel: Ethical Scaling", description: "A roundtable discussion with industry leaders on model deployment." }
  ]);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formSendEmail, setFormSendEmail] = useState(true);
  const [formStatus, setFormStatus] = useState<"Draft" | "Active" | "Opened">("Opened");
  const [isSavingEvent, setIsSavingEvent] = useState<boolean>(false);

  // Give Event Access States
  const [formAllowRegistrations, setFormAllowRegistrations] = useState<boolean>(true);
  const [formAllowLoginAccess, setFormAllowLoginAccess] = useState<boolean>(true);
  const [formAllowSubmissions, setFormAllowSubmissions] = useState<boolean>(true);
  const [formAllowQuizAccess, setFormAllowQuizAccess] = useState<boolean>(true);
  const [formAllowProblemStatements, setFormAllowProblemStatements] = useState<boolean>(true);
  const [formAllowCertificates, setFormAllowCertificates] = useState<boolean>(false);
  const [formAllowRoundManagement, setFormAllowRoundManagement] = useState<boolean>(true);

  // Round Management States
  const [formTotalRounds, setFormTotalRounds] = useState<number>(3);
  const [formCurrentRound, setFormCurrentRound] = useState<number>(1);
  const [formRounds, setFormRounds] = useState<Array<{
    roundNumber: number;
    name: string;
    type: string;
    description: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    status: "Active" | "Upcoming" | "Completed";
  }>>([
    { roundNumber: 1, name: "Round 1: Screening & Idea Submission", type: "Screening", description: "Initial abstract, problem track selection, and idea deck evaluation.", startDate: "", endDate: "", startTime: "", endTime: "", status: "Active" },
    { roundNumber: 2, name: "Round 2: Prototype & Online Assessment", type: "Assessment", description: "Working code submission, online MCQ screening, or MVP demonstration.", startDate: "", endDate: "", startTime: "", endTime: "", status: "Upcoming" },
    { roundNumber: 3, name: "Round 3: Grand Finale & Jury Pitch", type: "Finals", description: "Live onstage presentation, demo execution, and final jury evaluation.", startDate: "", endDate: "", startTime: "", endTime: "", status: "Upcoming" }
  ]);

  // Ticket Design Upload & Dynamic QR Placement States
  const [formTicketBgPreview, setFormTicketBgPreview] = useState<string>("");
  const [formTicketBgFilename, setFormTicketBgFilename] = useState<string>("");
  const [formTicketQrPosition, setFormTicketQrPosition] = useState<"bottom-right" | "bottom-center" | "top-right" | "top-left" | "bottom-left" | "center" | "custom">("bottom-right");
  const [formTicketQrX, setFormTicketQrX] = useState<number>(75); // % from left
  const [formTicketQrY, setFormTicketQrY] = useState<number>(75); // % from top
  const [formTicketQrWidthPercent, setFormTicketQrWidthPercent] = useState<number>(22); // % width of ticket
  const [formTicketQrBg, setFormTicketQrBg] = useState<"white" | "transparent" | "glow">("white");
  const [formTicketShowAttendeeText, setFormTicketShowAttendeeText] = useState<boolean>(false);
  const [formTicketTextX, setFormTicketTextX] = useState<number>(20);
  const [formTicketTextY, setFormTicketTextY] = useState<number>(80);
  const [formTicketTextColor, setFormTicketTextColor] = useState<string>("#FFFFFF");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Filter logic
  const filteredEvents = useMemo(() => {
    return events.filter(e =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [events, searchQuery]);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(start, start + itemsPerPage);
  }, [filteredEvents, currentPage]);

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage) || 1;

  // Handlers
  const handleCreateEvent = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingEvent) return; // Prevent duplicate event creation on double-click
    if (!formTitle.trim()) {
      alert("Event Name is required!");
      return;
    }

    setIsSavingEvent(true);

    try {
      const mappedCategory = formCategory === "Workshop" ? "WORKSHOPS" : formCategory === "Hackathon" ? "HACKATHONS" : formCategory === "Seminar" ? "LECTURES" : formCategory === "Tech Event" ? "TECH_EVENTS" : formCategory === "Quiz" ? "QUIZ" : "ALUMNI_MEETUPS";

      let imageName = "sparkImg";
      let imageFile = sparkImg;
      if (mappedCategory === "HACKATHONS") {
        imageName = "hackathonImg";
        imageFile = hackathonImg;
      } else if (mappedCategory === "LECTURES") {
        imageName = "seminarImg";
        imageFile = seminarImg;
      }

      let displayDate = "TBD";
      if (formStartDate) {
        const d = new Date(formStartDate);
        if (!isNaN(d.getTime())) {
          displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
          displayDate = formStartDate;
        }
      }

      // Parallel compression for any remaining preview strings
      const [
        safePosterPreview,
        safeTicketBgPreview,
        safeSpeakerPreview,
        safeJuryPreview,
        safePaymentQrPreview,
        safePosterImages
      ] = await Promise.all([
        compressBase64String(formPosterImages[0]?.preview || "", 1200, 1200, 0.75),
        compressBase64String(formTicketBgPreview, 1200, 1200, 0.75),
        compressBase64String(formSpeakerImagePreview, 400, 400, 0.75),
        compressBase64String(formJuryImagePreview, 400, 400, 0.75),
        compressBase64String(formPaymentQrImagePreview, 600, 600, 0.8),
        Promise.all(
          formPosterImages.slice(0, 3).map(async (img) => ({
            filename: img.filename,
            preview: await compressBase64String(img.preview, 1200, 1200, 0.75)
          }))
        )
      ]);

      const payload = {
        title: formTitle.trim(),
        date: displayDate,
        location: formLocation || "Virtual Hub",
        venue: formLocation || "Virtual Hub",
        category: mappedCategory,
        currentReg: editingEventId ? (events.find(e => e.id === editingEventId)?.currentReg || 0) : 0,
        maxReg: formMaxParticipants ? Number(formMaxParticipants) : 100,
        imageName: imageName,
        primaryTag: formPrimaryTag,
        description: formDescription,
        startDate: formStartDate,
        endDate: formEndDate,
        startTime: formStartTime,
        endTime: formEndTime,
        isVirtual: formIsVirtual,
        regDeadline: formRegDeadline,
        regDeadlineTime: formRegDeadlineTime,
        registrationDeadline: formRegDeadline,
        registrationDeadlineTime: formRegDeadlineTime,
        enableWaitlist: formEnableWaitlist,
        posterFilename: formPosterImages[0]?.filename || "",
        posterPreview: safePosterPreview,
        posterImages: safePosterImages,
        visibility: formVisibility,
        isFeatured: formIsFeatured,
        sendEmail: formSendEmail,
        speakerName: formSpeakerName,
        speakerRole: formSpeakerRole,
        speakerBio: formSpeakerBio,
        speakerLinkedin: formSpeakerLinkedin,
        speakerImagePreview: safeSpeakerPreview,
        speakerImageFilename: formSpeakerImageFilename,
        hasAgenda: formHasAgenda,
        agendaItems: formHasAgenda ? formAgendaItems : [],
        agendaTime1: formHasAgenda ? (formAgendaItems[0]?.time || "") : "",
        agendaTitle1: formHasAgenda ? (formAgendaItems[0]?.title || "") : "",
        agendaDesc1: formHasAgenda ? (formAgendaItems[0]?.description || "") : "",
        agendaTime2: formHasAgenda ? (formAgendaItems[1]?.time || "") : "",
        agendaTitle2: formHasAgenda ? (formAgendaItems[1]?.title || "") : "",
        agendaDesc2: formHasAgenda ? (formAgendaItems[1]?.description || "") : "",
        agendaTime3: formHasAgenda ? (formAgendaItems[2]?.time || "") : "",
        agendaTitle3: formHasAgenda ? (formAgendaItems[2]?.title || "") : "",
        agendaDesc3: formHasAgenda ? (formAgendaItems[2]?.description || "") : "",
        minTeamSize: formMinTeamSize ? Number(formMinTeamSize) : 1,
        maxTeamSize: formMaxTeamSize ? Number(formMaxTeamSize) : 4,
        isPaidEvent: formIsPaidEvent,
        pricingType: formIsPaidEvent ? formPricingType : "per_person",
        pricingModel: formIsPaidEvent ? formPricingType : "per_person",
        registrationFee: formIsPaidEvent && formRegistrationFee ? Number(formRegistrationFee) : 0,
        paymentQrImageFilename: formIsPaidEvent ? formPaymentQrImageFilename : "",
        paymentQrImagePreview: formIsPaidEvent ? safePaymentQrPreview : "",
        paymentQr: formIsPaidEvent ? safePaymentQrPreview : "",
        upiId: formIsPaidEvent ? formUpiId.trim() : "",
        status: formStatus || "Opened",
        whatsGroupLink: formWhatsGroupLink,
        facultyCoordinator: formFacultyCoordinator,
        facultyCoordinatorEmail: formFacultyCoordinatorEmail,
        facultyCoordinatorPhone: formFacultyCoordinatorPhone,
        studentCoordinator: formStudentCoordinator,
        studentCoordinatorEmail: formStudentCoordinatorEmail,
        studentCoordinatorPhone: formStudentCoordinatorPhone,
        coordinators: [
          ...(formFacultyCoordinator ? [{
            name: formFacultyCoordinator,
            email: formFacultyCoordinatorEmail,
            phone: formFacultyCoordinatorPhone,
            role: "Faculty Coordinator"
          }] : []),
          ...(formStudentCoordinator ? [{
            name: formStudentCoordinator,
            email: formStudentCoordinatorEmail,
            phone: formStudentCoordinatorPhone,
            role: "Student Coordinator"
          }] : [])
        ],
        juryName: formJuryName,
        juryRole: formJuryRole,
        juryBio: formJuryBio,
        juryLinkedin: formJuryLinkedin,
        jurySameAsSpeaker: formJurySameAsSpeaker,
        juryImageFilename: formJuryImageFilename,
        juryImagePreview: safeJuryPreview,
        company: formCategory === "Alumni Meetup" ? formCompany : "",
        batch: formCategory === "Alumni Meetup" ? formBatch : "",
        customRegLink: formCategory !== "Hackathon" ? formCustomRegLink : "",
        regType: formCategory !== "Hackathon" ? formRegType : "Open",
        preRegisteredEmails: formCategory !== "Hackathon" ? formPreRegisteredEmails : "",
        bulkRegCsvFilename: formCategory !== "Hackathon" ? bulkRegCsvFilename : "",
        bulkRegCsvCount: (formCategory !== "Hackathon" && bulkRegCsvData) ? bulkRegCsvData.length : 0,
        isPastEvent: formIsPastEvent,
        allowRegistrations: formAllowRegistrations,
        allowLoginAccess: formAllowLoginAccess,
        allowSubmissions: formAllowSubmissions,
        allowQuizAccess: formAllowQuizAccess,
        allowProblemStatements: formAllowProblemStatements,
        allowCertificates: formAllowCertificates,
        allowRoundManagement: formAllowRoundManagement,
        totalRounds: formTotalRounds,
        currentRound: formCurrentRound,
        rounds: formRounds,
        ticketDesign: {
          bgPreview: safeTicketBgPreview,
          bgFilename: formTicketBgFilename,
          qrPosition: formTicketQrPosition,
          qrX: formTicketQrX,
          qrY: formTicketQrY,
          qrWidthPercent: formTicketQrWidthPercent,
          qrBg: formTicketQrBg,
          showAttendeeText: formTicketShowAttendeeText,
          textX: formTicketTextX,
          textY: formTicketTextY,
          textColor: formTicketTextColor,
        },
        ...(editingEventId ? {} : { createdAt: Date.now() })
      };

      let targetEventId = editingEventId;
      if (editingEventId) {
        // 1. Update backend MongoDB
        const res = await updateEvent(editingEventId, payload);
        const savedDoc = res?.event || payload;

        const existingReg = events.find(e => e.id === editingEventId)?.currentReg || 0;
        const posterImg = formPosterImages[0]?.preview || safePosterPreview || imageFile;
        const updatedEvent: EventItem = {
          ...savedDoc,
          id: editingEventId,
          title: formTitle,
          date: displayDate,
          location: formLocation || "Virtual Hub",
          venue: formLocation || "Virtual Hub",
          category: mappedCategory,
          status: formStatus || "Opened",
          currentReg: existingReg,
          maxReg: formMaxParticipants ? Number(formMaxParticipants) : 100,
          image: posterImg,
          posterPreview: posterImg,
          posterImages: safePosterImages,
          whatsGroupLink: formWhatsGroupLink.trim(),
        };
        setEvents(prev => prev.map(e => e.id === editingEventId ? { ...e, ...updatedEvent } : e));
        setEditingEventId(null);
      } else {
        // 1. Create in backend MongoDB
        const res = await createEvent(payload);
        const createdId = res?.id || res?.event?.id || res?.event?._id;
        targetEventId = createdId;

        const posterImg = formPosterImages[0]?.preview || safePosterPreview || imageFile;
        const newEvent: EventItem = {
          id: targetEventId || `event_${Date.now()}`,
          title: formTitle,
          date: displayDate,
          location: formLocation || "Virtual Hub",
          category: mappedCategory,
          status: formStatus || "Opened",
          currentReg: 0,
          maxReg: formMaxParticipants ? Number(formMaxParticipants) : 100,
          image: posterImg,
          posterPreview: posterImg,
          posterImages: safePosterImages,
          whatsGroupLink: formWhatsGroupLink.trim(),
        };
        setEvents(prev => [newEvent, ...prev]);
      }

      // Process bulk CSV registrations into registrations collection
      if (targetEventId && formCategory !== "Hackathon" && bulkRegCsvData && bulkRegCsvData.length > 0) {
        let addedCount = 0;
        for (const row of bulkRegCsvData) {
          const rollNo = (row["RollNumber"] || row["rollNumber"] || row["Roll Number"] || "").toString().trim();
          const name = (row["Name"] || row["name"] || row["Full Name"] || "").toString().trim();
          const email = (row["CollegeEmailID"] || row["collegeEmailID"] || row["Email"] || row["Email Address"] || "").toString().trim();
          const branch = (row["Branch"] || row["branch"] || "").toString().trim();
          const section = (row["Section"] || row["section"] || "").toString().trim();
          const year = (row["Year"] || row["year"] || "").toString().trim();
          const phone = (row["PhoneNumber"] || row["phoneNumber"] || row["Phone"] || "").toString().trim();

          if (name || email || rollNo) {
            const regPayload = {
              eventId: targetEventId,
              eventTitle: formTitle,
              groupName: rollNo ? `${name} (${rollNo})` : name || "Student Registrant",
              teamLeadName: name || "Student Registrant",
              teamLeadEmail: email,
              teamLeadStudentId: rollNo,
              phoneNumber: phone,
              branch: branch,
              section: section,
              year: year,
              teamSize: 1,
              members: [
                {
                  name: name,
                  email: email,
                  studentId: rollNo,
                  phoneNumber: phone,
                  branch: branch,
                  section: section,
                  year: year
                }
              ],
              status: "Confirmed",
              createdAt: Date.now()
            };
            await createRegistration(regPayload).catch(() => {});
            addedCount++;
          }
        }

        if (addedCount > 0) {
          setEvents(prev => prev.map(e => e.id === targetEventId ? { ...e, currentReg: (e.currentReg || 0) + addedCount } : e));
        }
      }

      // Invalidate caches across the portal
      dataCache.remove("public_events");
      dataCache.remove("all_events");
      dataCache.remove("faculty_events");
      if (targetEventId) {
        dataCache.remove(`event_detail_${targetEventId}`);
        dataCache.remove(`event_${targetEventId}`);
      }
      if (editingEventId) {
        dataCache.remove(`event_detail_${editingEventId}`);
        dataCache.remove(`event_${editingEventId}`);
      }
      dataCache.invalidate("event_detail_");
      dataCache.invalidate("event_");
      window.dispatchEvent(new Event("eventsUpdated"));
      window.dispatchEvent(new Event("storage"));

      // Trigger celebratory Launch Splash Animation for this event
      const launchInfo: EventLaunchData = {
        title: formTitle.trim() || "AI Verse Event",
        category: formCategory,
        date: displayDate,
        location: formLocation || "Virtual Hub",
        poster: formPosterImages[0]?.preview || imageFile,
        status: formStatus || "Opened",
        eventId: targetEventId || editingEventId || undefined,
        isEditing: Boolean(editingEventId)
      };
      setLaunchedEventData(launchInfo);
      setIsLaunchSplashOpen(true);

      // Reset form fields
      setFormTitle("");
      setFormCategory("Workshop");
      setFormPrimaryTag("");
      setFormDescription("");
      setFormStartDate("");
      setFormEndDate("");
      setFormStartTime("");
      setFormEndTime("");
      setFormIsVirtual(true);
      setFormLocation("");
      setFormRegDeadline("");
      setFormRegDeadlineTime("");
      setFormMaxParticipants("");
      setFormEnableWaitlist(false);
      setFormPosterImages([]);
      setFormVisibility("Public");
      setFormIsFeatured(false);
      setFormSendEmail(true);
      setFormStatus("Opened");
      setFormMinTeamSize("1");
      setFormMaxTeamSize("4");
      setFormIsPaidEvent(false);
      setFormPricingType("per_person");
      setFormRegistrationFee("0");
      setFormPaymentQrImageFilename("");
      setFormPaymentQrImagePreview("");
      setFormUpiId("");
      setFormWhatsGroupLink("");
      setFormFacultyCoordinator("");
      setFormFacultyCoordinatorEmail("");
      setFormFacultyCoordinatorPhone("");
      setFormStudentCoordinator("");
      setFormStudentCoordinatorEmail("");
      setFormStudentCoordinatorPhone("");
      setFormJuryName("");
      setFormJuryRole("");
      setFormJuryBio("");
      setFormJuryLinkedin("");
      setFormJurySameAsSpeaker(false);
      setFormJuryImageFilename("");
      setFormJuryImagePreview("");

      setFormSpeakerName("");
      setFormSpeakerRole("");
      setFormSpeakerBio("");
      setFormSpeakerLinkedin("");
      setFormSpeakerImageFilename("");
      setFormSpeakerImagePreview("");
      setFormCompany("");
      setFormBatch("");
      setFormCustomRegLink("");
      setFormRegType("Open");
      setFormPreRegisteredEmails("");
      setBulkRegCsvFilename("");
      setBulkRegCsvData([]);
      setFormIsPastEvent(false);
      setFormHasAgenda(true);
      setFormAllowRegistrations(true);
      setFormAllowLoginAccess(true);
      setFormAllowSubmissions(true);
      setFormAllowQuizAccess(true);
      setFormAllowProblemStatements(true);
      setFormAllowCertificates(false);
      setFormAllowRoundManagement(true);
      setFormTotalRounds(3);
      setFormCurrentRound(1);
      setFormRounds([
        { roundNumber: 1, name: "Round 1: Screening & Idea Submission", type: "Screening", description: "Initial abstract, problem track selection, and idea deck evaluation.", status: "Active" },
        { roundNumber: 2, name: "Round 2: Prototype & Online Assessment", type: "Assessment", description: "Working code submission, online MCQ screening, or MVP demonstration.", status: "Upcoming" },
        { roundNumber: 3, name: "Round 3: Grand Finale & Jury Pitch", type: "Finals", description: "Live onstage presentation, demo execution, and final jury evaluation.", status: "Upcoming" }
      ]);
      setFormAgendaItems([
        { time: "09:00 AM - 10:30 AM", title: "Morning Keynote: The Future of Compute", description: "Opening session detailing next-gen silicon compute." },
        { time: "11:30 AM - 01:00 PM", title: "Workshop: Transformer Efficiency", description: "Hands-on FlashAttention, quantization, and sparse computation models." },
        { time: "03:00 PM - 04:30 PM", title: "Panel: Ethical Scaling", description: "A roundtable discussion with industry leaders on model deployment." }
      ]);
      setFormTicketBgPreview("");
      setFormTicketBgFilename("");
      setFormTicketQrPosition("bottom-right");
      setFormTicketQrX(75);
      setFormTicketQrY(75);
      setFormTicketQrWidthPercent(22);
      setFormTicketQrBg("white");
      setFormTicketShowAttendeeText(false);
      setFormTicketTextX(20);
      setFormTicketTextY(80);
      setFormTicketTextColor("#FFFFFF");

      setView("list");
    } catch (err: any) {
      console.error("Error saving event:", err);
      alert("Failed to save event: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    const confirmed = await showConfirm({
      title: "Delete Event?",
      message: `Are you sure you want to delete the event "${title}"?\n\nThis will permanently delete the event along with all its quizzes, submissions, sessions, and records.`,
      confirmText: "Delete Event",
      cancelText: "Cancel",
      type: "danger",
      icon: "trash"
    });
    if (!confirmed) return;

    try {
      // 1. Cascading delete of all quizzes and submissions belonging to this event
      try {
        await deleteQuizzesByEventId(id, title);
      } catch (quizErr) {
        console.warn("Notice deleting associated quizzes for event:", quizErr);
      }

      // 2. Delete the event doc from backend MongoDB
      try {
        await deleteEvent(id);
      } catch (apiErr) {
        console.warn("[EventManagement] Backend deleteEvent notice:", apiErr);
      }

      // 3. Delete from Firestore if present
      try {
        const docRef = doc(db, "events", id);
        await deleteDoc(docRef);
      } catch (e) {}

      setEvents(prev => prev.filter(e => e.id !== id));
      await showAlert({
        title: "Event Deleted",
        message: `Event "${title}" has been deleted.`,
        type: "success",
        icon: "check"
      });
    } catch (err) {
      console.error("Error deleting event:", err);
      await showAlert({
        title: "Delete Failed",
        message: "Failed to delete event from database.",
        type: "danger"
      });
    }
  };

  const handleStartEditEvent = async (id: string) => {
    try {
      let data: any = null;

      // 1. Check local events array
      const localEvt = events.find(e => e.id === id);
      if (localEvt) {
        data = { ...localEvt };
      }

      // 2. Try fetching full document from backend API
      try {
        const fullEvt = await fetchEventById(id);
        if (fullEvt) {
          data = { ...data, ...fullEvt };
        }
      } catch (e) {
        console.warn("[EventManagementPage] Notice fetching full event:", e);
      }

      // 3. Fallback to Firestore
      if (!data) {
        try {
          const docRef = doc(db, "events", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) data = docSnap.data();
        } catch (e) {}
      }

      if (data) {
        setEditingEventId(id);

        setFormTitle(data.title || "");

        let cat: "Workshop" | "Hackathon" | "Seminar" | "Tech Event" | "Alumni Meetup" | "Quiz" = "Workshop";
        if (data.category === "HACKATHONS" || data.category === "Hackathon") cat = "Hackathon";
        else if (data.category === "LECTURES" || data.category === "Seminar") cat = "Seminar";
        else if (data.category === "TECH_EVENTS" || data.category === "Tech Event") cat = "Tech Event";
        else if (data.category === "ALUMNI_MEETUPS" || data.category === "Alumni Meetup") cat = "Alumni Meetup";
        else if (data.category === "QUIZ" || data.category === "QUIZZES" || data.category === "Quiz") cat = "Quiz";
        setFormCategory(cat);

        setFormPrimaryTag(data.primaryTag || "");
        setFormDescription(data.description || "");
        setFormStartDate(data.startDate || "");
        setFormEndDate(data.endDate || "");
        setFormStartTime(data.startTime || "");
        setFormEndTime(data.endTime || "");
        setFormIsVirtual(data.isVirtual !== undefined ? data.isVirtual : true);
        setFormLocation(data.location || data.venue || "");
        setFormRegDeadline(data.regDeadline || data.registrationDeadline || "");
        setFormRegDeadlineTime(data.regDeadlineTime || data.registrationDeadlineTime || "");
        setFormMaxParticipants(data.maxReg ? String(data.maxReg) : "");
        setFormEnableWaitlist(data.enableWaitlist || false);
        const loadedPosters = (Array.isArray(data.posterImages) && data.posterImages.length > 0)
          ? data.posterImages
          : (data.posterPreview || (data.image && !data.image.startsWith("/assets/")) || data.imageUrl || data.coverImage)
            ? [{ filename: data.posterFilename || "poster.png", preview: data.posterPreview || data.image || data.imageUrl || data.coverImage }]
            : [];
        setFormPosterImages(loadedPosters);
        setFormVisibility(data.visibility || "Public");
        setFormIsFeatured(data.isFeatured || false);
        setFormSendEmail(data.sendEmail !== undefined ? data.sendEmail : true);
        setFormStatus(data.status || "Draft");
        setFormMinTeamSize(data.minTeamSize ? String(data.minTeamSize) : "1");
        setFormMaxTeamSize(data.maxTeamSize ? String(data.maxTeamSize) : "4");
        const loadedFee = data.registrationFee !== undefined ? String(data.registrationFee) : "0";
        setFormRegistrationFee(loadedFee);
        setFormIsPaidEvent(data.isPaidEvent !== undefined ? Boolean(data.isPaidEvent) : Number(loadedFee) > 0);
        setFormPricingType(data.pricingType === "per_team" || data.pricingModel === "per_team" ? "per_team" : "per_person");
        setFormPaymentQrImageFilename(data.paymentQrImageFilename || "");
        setFormPaymentQrImagePreview(data.paymentQrImagePreview || data.paymentQr || "");
        setFormUpiId(data.upiId || "");
        setFormWhatsGroupLink(data.whatsGroupLink || "");
        setFormFacultyCoordinator(data.facultyCoordinator || (data.coordinators?.find((c: any) => c.role?.includes("Faculty"))?.name) || "");
        setFormFacultyCoordinatorEmail(data.facultyCoordinatorEmail || (data.coordinators?.find((c: any) => c.role?.includes("Faculty"))?.email) || "");
        setFormFacultyCoordinatorPhone(data.facultyCoordinatorPhone || (data.coordinators?.find((c: any) => c.role?.includes("Faculty"))?.phone) || "");
        setFormStudentCoordinator(data.studentCoordinator || (data.coordinators?.find((c: any) => c.role?.includes("Student"))?.name) || "");
        setFormStudentCoordinatorEmail(data.studentCoordinatorEmail || (data.coordinators?.find((c: any) => c.role?.includes("Student"))?.email) || "");
        setFormStudentCoordinatorPhone(data.studentCoordinatorPhone || (data.coordinators?.find((c: any) => c.role?.includes("Student"))?.phone) || "");
        setFormJuryName(data.juryName || "");
        setFormJuryRole(data.juryRole || "");
        setFormJuryBio(data.juryBio || "");
        setFormJuryLinkedin(data.juryLinkedin || "");
        setFormJurySameAsSpeaker(Boolean(data.jurySameAsSpeaker));
        setFormJuryImageFilename(data.juryImageFilename || "");
        setFormJuryImagePreview(data.juryImagePreview || "");

        setFormSpeakerName(data.speakerName || "");
        setFormSpeakerRole(data.speakerRole || "");
        setFormSpeakerBio(data.speakerBio || "");
        setFormSpeakerLinkedin(data.speakerLinkedin || "");
        setFormSpeakerImageFilename(data.speakerImageFilename || "");
        setFormSpeakerImagePreview(data.speakerImagePreview || "");
        setFormCompany(data.company || "");
        setFormBatch(data.batch || "");
        setFormCustomRegLink(data.customRegLink || "");
        setFormRegType(data.regType || "Open");
        setFormPreRegisteredEmails(data.preRegisteredEmails || "");
        setBulkRegCsvFilename(data.bulkRegCsvFilename || "");
        setBulkRegCsvData(data.bulkRegCsvData || []);
        setFormIsPastEvent(data.isPastEvent || false);
        setFormHasAgenda(data.hasAgenda !== false);
        setFormAllowRegistrations(data.allowRegistrations !== undefined ? data.allowRegistrations : true);
        setFormAllowLoginAccess(data.allowLoginAccess !== undefined ? data.allowLoginAccess : true);
        setFormAllowSubmissions(data.allowSubmissions !== undefined ? data.allowSubmissions : true);
        setFormAllowQuizAccess(data.allowQuizAccess !== undefined ? data.allowQuizAccess : true);
        setFormAllowProblemStatements(data.allowProblemStatements !== undefined ? data.allowProblemStatements : true);
        setFormAllowCertificates(data.allowCertificates !== undefined ? data.allowCertificates : false);
        setFormAllowRoundManagement(data.allowRoundManagement !== undefined ? data.allowRoundManagement : true);
        setFormTotalRounds(data.totalRounds || (data.rounds ? data.rounds.length : 3));
        setFormCurrentRound(data.currentRound || 1);

        if (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0) {
          setFormRounds(data.rounds);
        } else {
          setFormRounds([
            { roundNumber: 1, name: "Round 1: Screening & Idea Submission", type: "Screening", description: "Initial abstract, problem track selection, and idea deck evaluation.", status: "Active" },
            { roundNumber: 2, name: "Round 2: Prototype & Online Assessment", type: "Assessment", description: "Working code submission, online MCQ screening, or MVP demonstration.", status: "Upcoming" },
            { roundNumber: 3, name: "Round 3: Grand Finale & Jury Pitch", type: "Finals", description: "Live onstage presentation, demo execution, and final jury evaluation.", status: "Upcoming" }
          ]);
        }

        if (data.agendaItems && Array.isArray(data.agendaItems)) {
          setFormAgendaItems(data.agendaItems);
        } else {
          setFormAgendaItems([
            { time: data.agendaTime1 || "09:00 AM - 10:30 AM", title: data.agendaTitle1 || "Morning Keynote: The Future of Compute", description: data.agendaDesc1 || "Opening session detailing next-gen silicon compute." },
            { time: data.agendaTime2 || "11:30 AM - 01:00 PM", title: data.agendaTitle2 || "Workshop: Transformer Efficiency", description: data.agendaDesc2 || "Hands-on FlashAttention, quantization, and sparse computation models." },
            { time: data.agendaTime3 || "03:00 PM - 04:30 PM", title: data.agendaTitle3 || "Panel: Ethical Scaling", description: data.agendaDesc3 || "A roundtable discussion with industry leaders on model deployment." }
          ]);
        }

        const td = data.ticketDesign || {};
        setFormTicketBgPreview(td.bgPreview || "");
        setFormTicketBgFilename(td.bgFilename || "");
        setFormTicketQrPosition(td.qrPosition || "bottom-right");
        setFormTicketQrX(td.qrX !== undefined ? td.qrX : 75);
        setFormTicketQrY(td.qrY !== undefined ? td.qrY : 75);
        setFormTicketQrWidthPercent(td.qrWidthPercent !== undefined ? td.qrWidthPercent : 22);
        setFormTicketQrBg(td.qrBg || "white");
        setFormTicketShowAttendeeText(td.showAttendeeText || false);
        setFormTicketTextX(td.textX !== undefined ? td.textX : 20);
        setFormTicketTextY(td.textY !== undefined ? td.textY : 80);
        setFormTicketTextColor(td.textColor || "#FFFFFF");

        setView("create");
      } else {
        alert("Could not load event data.");
      }
    } catch (err) {
      console.error("Error loading event for editing:", err);
      alert("Error fetching event details.");
    }
  };

  const handleStatusChange = async (id: string, newStatus: "Draft" | "Active" | "Opened" | "Completed") => {
    try {
      const docRef = doc(db, "events", id);
      await setDoc(docRef, { status: newStatus }, { merge: true });
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status.");
    }
  };



  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      <SEO
        title="Event Management - Faculty Portal"
        description="Control center for all faculty-led academic activities, workshop tracking and hackathon registrations."
      />

      {view === "list" && !isDetailsModalOpen && (
        <>
          {/* ================= HEADER ================= */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Event Management</h1>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl font-medium leading-relaxed">
                Control center for all faculty-led academic activities.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-center">
              <button
                onClick={() => alert("Exporting event records...")}
                className="flex items-center gap-2 justify-center px-4 py-2 border border-slate-200 text-slate-650 font-bold rounded-2xl hover:bg-slate-50 transition-all text-xs whitespace-nowrap bg-white"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={() => {
                  setEditingEventId(null);
                  setFormTitle("");
                  setFormCategory("Workshop");
                  setFormPrimaryTag("");
                  setFormDescription("");
                  setFormStartDate("");
                  setFormEndDate("");
                  setFormStartTime("");
                  setFormEndTime("");
                  setFormIsVirtual(true);
                  setFormLocation("");
                  setFormRegDeadline("");
                  setFormMaxParticipants("");
                  setFormEnableWaitlist(false);
                  setFormPosterImages([]);
                  setFormVisibility("Public");
                  setFormIsFeatured(false);
                  setFormSendEmail(true);
                  setFormStatus("Draft");
                  setFormMinTeamSize("1");
                  setFormMaxTeamSize("4");
                  setFormIsPaidEvent(false);
                  setFormPricingType("per_person");
                  setFormRegistrationFee("0");
                  setFormPaymentQrImageFilename("");
                  setFormPaymentQrImagePreview("");
                  setFormUpiId("");

                  setFormSpeakerName("");
                  setFormSpeakerRole("");
                  setFormSpeakerBio("");
                  setFormSpeakerLinkedin("");
                  setFormSpeakerImageFilename("");
                  setFormSpeakerImagePreview("");
                  setFormJuryName("");
                  setFormJuryRole("");
                  setFormJuryBio("");
                  setFormJuryLinkedin("");
                  setFormJurySameAsSpeaker(false);
                  setFormJuryImageFilename("");
                  setFormJuryImagePreview("");
                  setFormFacultyCoordinator("");
                  setFormFacultyCoordinatorEmail("");
                  setFormFacultyCoordinatorPhone("");
                  setFormStudentCoordinator("");
                  setFormStudentCoordinatorEmail("");
                  setFormStudentCoordinatorPhone("");
                  setFormCompany("");
                  setFormBatch("");
                  setFormIsPastEvent(false);
                  setFormAgendaItems([
                    { time: "09:00 AM - 10:30 AM", title: "Morning Keynote: The Future of Compute", description: "Opening session detailing next-gen silicon compute." },
                    { time: "11:30 AM - 01:00 PM", title: "Workshop: Transformer Efficiency", description: "Hands-on FlashAttention, quantization, and sparse computation models." },
                    { time: "03:00 PM - 04:30 PM", title: "Panel: Ethical Scaling", description: "A roundtable discussion with industry leaders on model deployment." }
                  ]);
                  setView("create");
                }}
                className="flex items-center gap-2 justify-center px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl shadow-md shadow-blue-600/10 hover:shadow-lg transition-all text-xs whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Create New Event
              </button>
            </div>
          </div>

          {/* ================= METRICS CARDS ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Events */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
              <div>
                <div className="flex justify-between items-start">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                    <Calendar className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-0.5">
                    +12.5%
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Events</span>
                  {loadingEvents && events.length === 0 ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Loader2 className="h-4 w-4 text-[#2563EB] animate-spin" />
                      <span className="text-xs font-bold text-slate-400">Loading...</span>
                    </div>
                  ) : (
                    <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">{events.length}</h3>
                  )}
                </div>
              </div>
              {/* Sparkline chart bar visual */}
              <div className="flex items-end gap-1 h-6 mt-4 opacity-80">
                <div className="bg-blue-100/50 w-full h-2 rounded-sm"></div>
                <div className="bg-blue-100/50 w-full h-3 rounded-sm"></div>
                <div className="bg-blue-100/50 w-full h-2.5 rounded-sm"></div>
                <div className="bg-blue-200/60 w-full h-4 rounded-sm"></div>
                <div className="bg-[#2563EB] w-full h-6 rounded-sm"></div>
              </div>
            </div>

            {/* Registrations */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
              <div>
                <div className="flex justify-between items-start">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                    <Users className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-0.5">
                    +8.2%
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Registrations</span>
                  {loadingEvents && events.length === 0 ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Loader2 className="h-4 w-4 text-[#2563EB] animate-spin" />
                      <span className="text-xs font-bold text-slate-400">Loading...</span>
                    </div>
                  ) : (
                    <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">
                      {events.reduce((sum, e) => sum + (e.currentReg || 0), 0).toLocaleString()}
                    </h3>
                  )}
                </div>
              </div>
              {/* Sparkline chart bar visual */}
              <div className="flex items-end gap-1 h-6 mt-4 opacity-80">
                <div className="bg-sky-100/50 w-full h-1.5 rounded-sm"></div>
                <div className="bg-sky-100/50 w-full h-2 rounded-sm"></div>
                <div className="bg-sky-200/50 w-full h-4 rounded-sm"></div>
                <div className="bg-sky-300/60 w-full h-3.5 rounded-sm"></div>
                <div className="bg-sky-400 w-full h-5.5 rounded-sm"></div>
              </div>
            </div>

            {/* Avg. Attendance */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
              <div>
                <div className="flex justify-between items-start">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                    <TrendingUp className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100/30">
                    High
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg. Attendance</span>
                  <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">94%</h3>
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "94%" }}></div>
                </div>
                <div className="text-[9px] text-slate-400 font-bold">Target reached: 90%</div>
              </div>
            </div>

            {/* Weekly Sessions */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
              <div>
                <div className="flex justify-between items-start">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706]">
                    Steady
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Weekly Sessions</span>
                  {loadingEvents && events.length === 0 ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                      <span className="text-xs font-bold text-slate-400">Loading...</span>
                    </div>
                  ) : (
                    <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">
                      {String(events.filter(e => e.status === "Opened" || e.status === "Active").length).padStart(2, '0')}
                    </h3>
                  )}
                </div>
              </div>
              <div className="mt-4 text-[9px] text-slate-500 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {events.filter(e => e.status === "Opened" || e.status === "Active").length} Scheduled for this week
              </div>
            </div>
          </div>

          {/* ================= CONTENT GRID ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT COLUMN: Event Directory (100% / 12 grid cols) */}
            <div className="lg:col-span-12 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden text-left">
                {/* Header / Filter row */}
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">Event Directory</h3>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-60">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-700 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <button className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition-colors">
                      <SlidersHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Table Container */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="px-6 py-4">Event Details</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Registrations</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingEvents && events.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-14 text-center">
                            <div className="flex flex-col items-center justify-center gap-2.5 py-4">
                              <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
                              <span className="text-sm font-bold text-slate-700">Loading event details...</span>
                              <span className="text-xs text-slate-400">Fetching events directory from database</span>
                            </div>
                          </td>
                        </tr>
                      ) : paginatedEvents.length > 0 ? (
                        paginatedEvents.map((event) => {
                          return (
                            <tr
                              key={event.id}
                              onClick={() => handleOpenEventDetails(event.id)}
                              className="border-b border-slate-150/40 hover:bg-blue-50/40 transition-colors group/row cursor-pointer"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-slate-55 overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center">
                                    <img
                                      src={event.posterPreview || (Array.isArray(event.posterImages) && event.posterImages[0]?.preview) || event.image || sparkImg}
                                      alt={event.title}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = sparkImg;
                                      }}
                                    />
                                  </div>
                                  <div className="leading-tight">
                                    <span className="font-extrabold text-slate-800 text-xs line-clamp-1 group-hover/row:text-[#2563EB] transition-colors">
                                      {event.title}
                                    </span>
                                    <div className="flex items-center gap-x-2 gap-y-0.5 mt-1.5 flex-wrap text-[9px] font-bold text-slate-450">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3 text-blue-500" />
                                        {event.date}
                                      </span>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3 text-sky-500" />
                                        {event.location}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border
                              ${event.category === "HACKATHONS"
                                    ? "bg-rose-50 text-rose-600 border-rose-100/50"
                                    : event.category === "LECTURES"
                                      ? "bg-amber-50 text-amber-600 border-amber-100/50"
                                      : event.category === "QUIZ" || event.category === "QUIZZES" || event.category === "Quiz"
                                        ? "bg-purple-50 text-purple-600 border-purple-100/50"
                                        : "bg-blue-50 text-[#2563EB] border-blue-100/50"
                                  }`}
                                >
                                  {event.category || "WORKSHOPS"}
                                </span>
                              </td>
                              <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-block">
                                  <select
                                    value={event.status}
                                    onChange={(e) => handleStatusChange(event.id, e.target.value as any)}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border appearance-none pr-7 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${event.status === "Opened"
                                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/80"
                                      : event.status === "Active"
                                        ? "text-[#2563EB] bg-blue-50 border-blue-200 hover:bg-blue-100/80"
                                        : event.status === "Completed"
                                          ? "text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100/80"
                                          : "text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200/60"
                                      }`}
                                  >
                                    <option value="Draft" className="bg-white text-slate-700 font-bold uppercase text-[10px]">DRAFT</option>
                                    <option value="Active" className="bg-white text-[#2563EB] font-bold uppercase text-[10px]">ACTIVE</option>
                                    <option value="Opened" className="bg-white text-emerald-700 font-bold uppercase text-[10px]">OPENED</option>
                                    <option value="Completed" className="bg-white text-purple-700 font-bold uppercase text-[10px]">COMPLETED</option>
                                  </select>
                                  <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 text-slate-600" />
                                </div>
                              </td>
                              <td className="px-6 py-4 w-48" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEventRoster(event)}
                                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-black text-xs rounded-full border border-blue-200/80 inline-flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer hover:border-blue-400 group/regBtn"
                                  title={`Click to view all registered teams and individual members for "${event.title}"`}
                                >
                                  <Users className="h-3.5 w-3.5 group-hover/regBtn:scale-110 transition-transform" />
                                  <span>
                                    {event.category === "HACKATHONS" || event.category === "Hackathon" || (event.maxTeamSize && event.maxTeamSize > 1) || (event.minTeamSize && event.minTeamSize > 1)
                                      ? `${event.currentReg || 0} ${(event.currentReg || 0) === 1 ? "Team" : "Teams"} Registered`
                                      : `${event.currentReg || 0} Registered`
                                    }
                                  </span>
                                </button>
                              </td>
                              <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleOpenEventDetails(event.id)}
                                  className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-xl transition-all mr-1"
                                  title="View Information Modal"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleStartEditEvent(event.id)}
                                  className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-xl transition-all mr-1"
                                  title="Edit Event Page"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEvent(event.id, event.title)}
                                  className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-xl transition-all"
                                  title="Delete Event"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-xs font-semibold text-slate-400">
                            No events found matching search query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-150/50 bg-slate-50/40 flex items-center justify-end gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-650 font-bold hover:bg-slate-50 transition-all disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-655 font-bold hover:bg-slate-50 transition-all disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </>
      )}
      {/* ================= CREATE EVENT FULL PAGE FORM ================= */}
      {view === "create" && (
        <div className="space-y-6 pb-12 text-left font-sans animate-in fade-in duration-200">
          <SEO
            title="Create New Event - Faculty Portal"
            description="Design and publish a new club activity, guest lecture, or student hackathon."
          />

          {/* BREADCRUMB & HEADER BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                <span>Dashboard</span>
                <span>&gt;</span>
                <span>Events</span>
                <span>&gt;</span>
                <span className="text-[#2563EB]">{editingEventId ? "Edit" : "Create"}</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{editingEventId ? "Edit Event" : "Create New Event"}</h1>
            </div>

            <div className="flex items-center gap-3 self-start md:self-center">
              <button
                type="button"
                onClick={() => {
                  setEditingEventId(null);
                  setView("list");
                }}
                className="px-5 py-2.5 border border-slate-200 text-slate-650 font-bold rounded-2xl hover:bg-slate-50 transition-all text-xs bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEvent}
                onClick={handleCreateEvent}
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md shadow-blue-600/10 hover:shadow-lg transition-all text-xs flex items-center gap-2 cursor-pointer"
              >
                {isSavingEvent && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSavingEvent ? "Saving Event..." : (editingEventId ? "Save Changes" : "Publish Event")}</span>
              </button>
            </div>
          </div>

          {/* TWO-COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Panel: Form Input Fields (span 2) */}
            <div className="lg:col-span-2 space-y-6">

              {/* 1. Basic Information */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                      <Info className="h-4 w-4" />
                    </div>
                    Basic Information
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Past Event</span>
                    <button
                      type="button"
                      onClick={() => setFormIsPastEvent(!formIsPastEvent)}
                      className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${formIsPastEvent ? "bg-[#2563EB]" : "bg-slate-200"}`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${formIsPastEvent ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Event Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AI Ethics & The Future Workshop"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as any)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/30 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="Workshop">Workshop</option>
                        <option value="Hackathon">Hackathon</option>
                        <option value="Seminar">Seminar</option>
                        <option value="Tech Event">Tech Event</option>
                        <option value="Alumni Meetup">Alumni Meetup</option>
                        <option value="Quiz">Quiz</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Primary Tag</label>
                      <input
                        type="text"
                        placeholder="e.g. Artificial Intelligence"
                        value={formPrimaryTag}
                        onChange={(e) => setFormPrimaryTag(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Short Description</label>
                    <textarea
                      rows={4}
                      placeholder="A brief summary that will appear on the event list..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  {formCategory === "Alumni Meetup" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company</label>
                        <input
                          type="text"
                          placeholder="e.g. Google, Microsoft"
                          value={formCompany}
                          onChange={(e) => setFormCompany(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Batch</label>
                        <input
                          type="text"
                          placeholder="e.g. 2020-2024"
                          value={formBatch}
                          onChange={(e) => setFormBatch(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Date & Time */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
                <h3 className="text-sm font-bold text-slate-800 tracking-tight border-b border-slate-50 pb-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                    <Calendar className="h-4 w-4" />
                  </div>
                  Date & Time
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
                    <DatePicker
                      value={formStartDate}
                      onChange={(val) => setFormStartDate(val)}
                      placeholder="Select start date"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
                    <DatePicker
                      value={formEndDate}
                      onChange={(val) => setFormEndDate(val)}
                      placeholder="Select end date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Time</label>
                    <TimePicker
                      value={formStartTime}
                      onChange={(val) => setFormStartTime(val)}
                      placeholder="Select start time"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Time</label>
                    <TimePicker
                      value={formEndTime}
                      onChange={(val) => setFormEndTime(val)}
                      placeholder="Select end time"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Location */}
              {formCategory !== "Quiz" && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                        <MapPin className="h-4 w-4" />
                      </div>
                      Location
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">Virtual Event</span>
                      <button
                        type="button"
                        onClick={() => setFormIsVirtual(!formIsVirtual)}
                        className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${formIsVirtual ? "bg-[#2563EB]" : "bg-slate-200"}`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${formIsVirtual ? "translate-x-4" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Venue / Platform Link</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Auditorium or Zoom Link"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {/* 4. Registration Details */}
              {!formIsPastEvent && formCategory !== "Quiz" && (
                <>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight border-b border-slate-50 pb-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                        <SlidersHorizontal className="h-4 w-4" />
                      </div>
                      Registration Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registration Deadline Date</label>
                        <DatePicker
                          value={formRegDeadline}
                          onChange={(val) => setFormRegDeadline(val)}
                          placeholder="Select deadline date"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registration End Time</label>
                        <TimePicker
                          value={formRegDeadlineTime}
                          onChange={(val) => setFormRegDeadlineTime(val)}
                          placeholder="e.g. 11:55 PM"
                        />
                      </div>
                    </div>

                    {formCategory === "Hackathon" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Min Team Size</label>
                          <input
                            type="number"
                            placeholder="e.g. 1"
                            value={formMinTeamSize}
                            onChange={(e) => setFormMinTeamSize(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/30 focus:bg-white transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max Team Size</label>
                          <input
                            type="number"
                            placeholder="e.g. 4"
                            value={formMaxTeamSize}
                            onChange={(e) => setFormMaxTeamSize(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/30 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Round Management Card */}
                  {formAllowRoundManagement && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Layers className="h-4 w-4" />
                          </div>
                          Round Management
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Round</span>
                          <select
                            value={formCurrentRound}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormCurrentRound(val);
                              setFormRounds(prev => prev.map((r, idx) => ({
                                ...r,
                                status: idx + 1 < val ? "Completed" : idx + 1 === val ? "Active" : "Upcoming"
                              })));
                            }}
                            className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
                          >
                            {formRounds.map((r, idx) => (
                              <option key={idx} value={idx + 1}>
                                Round {idx + 1}: {r.name.replace(/^Round \d+:\s*/, '')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Competition Rounds</label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={formRounds.length}
                            onChange={(e) => {
                              const count = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                              setFormTotalRounds(count);
                              if (count > formRounds.length) {
                                const diff = count - formRounds.length;
                                const newItems = Array.from({ length: diff }, (_, i) => {
                                  const num = formRounds.length + i + 1;
                                  return {
                                    roundNumber: num,
                                    name: `Round ${num}: Stage Evaluation`,
                                    type: "Evaluation",
                                    description: `Evaluation and judging criteria for Round ${num}.`,
                                    startDate: "",
                                    endDate: "",
                                    startTime: "",
                                    endTime: "",
                                    status: (num === formCurrentRound ? "Active" : num < formCurrentRound ? "Completed" : "Upcoming") as "Active" | "Upcoming" | "Completed"
                                  };
                                });
                                setFormRounds(prev => [...prev, ...newItems]);
                              } else if (count < formRounds.length) {
                                setFormRounds(prev => prev.slice(0, count));
                                if (formCurrentRound > count) setFormCurrentRound(count);
                              }
                            }}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500 font-medium text-sm text-slate-800 bg-slate-50/30 focus:bg-white transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Active Stage</label>
                          <div className="w-full px-4 py-2.5 border border-indigo-100 bg-indigo-50/40 rounded-2xl flex items-center justify-between text-xs font-bold text-indigo-900">
                            <span>Stage {formCurrentRound} of {formRounds.length}</span>
                            <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                              In Progress
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* List of Configurable Rounds */}
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Configure Round Stages</span>
                          <span className="text-[10px] font-bold text-indigo-600">{formRounds.length} Stage{formRounds.length > 1 ? "s" : ""} Defined</span>
                        </div>

                        <div className="space-y-3">
                          {formRounds.map((round, idx) => (
                            <div
                              key={idx}
                              className={`p-4 border rounded-2xl space-y-3 transition-all ${
                                idx + 1 === formCurrentRound
                                  ? "border-indigo-200 bg-indigo-50/25 ring-2 ring-indigo-500/10 shadow-xs"
                                  : "border-slate-100 bg-slate-50/20"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                    idx + 1 === formCurrentRound
                                      ? "bg-indigo-600 text-white shadow-sm"
                                      : idx + 1 < formCurrentRound
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-200 text-slate-600"
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs font-black text-slate-800">
                                    Round {idx + 1}
                                  </span>
                                  {idx + 1 === formCurrentRound && (
                                    <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      Current Active Round
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <select
                                    value={round.status}
                                    onChange={(e) => {
                                      const newStatus = e.target.value as "Active" | "Upcoming" | "Completed";
                                      setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, status: newStatus } : r));
                                      if (newStatus === "Active") setFormCurrentRound(idx + 1);
                                    }}
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border focus:outline-none cursor-pointer ${
                                      round.status === "Active"
                                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold"
                                        : round.status === "Completed"
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : "bg-slate-100 border-slate-200 text-slate-600"
                                    }`}
                                  >
                                    <option value="Active">Active</option>
                                    <option value="Upcoming">Upcoming</option>
                                    <option value="Completed">Completed</option>
                                  </select>

                                  {formRounds.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormRounds(prev => prev.filter((_, i) => i !== idx));
                                        if (formCurrentRound > formRounds.length - 1) {
                                          setFormCurrentRound(Math.max(1, formRounds.length - 1));
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-700 font-bold text-[10px] hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2">
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Round Title / Stage Name</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Round 1: Screening & Idea Submission"
                                    value={round.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, name: val } : r));
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-xs text-slate-800 bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stage Type</label>
                                  <select
                                    value={round.type || "Screening"}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, type: val } : r));
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-xs text-slate-800 bg-white"
                                  >
                                    {/* Default or existing custom value if it doesn't match the predefined list */}
                                    {!["Quiz", "Ideation & Video Submission", "Hackathon", "Screening", "Assessment", "Finals"].includes(round.type) && round.type && (
                                      <option value={round.type}>{round.type}</option>
                                    )}
                                    <option value="Screening">Screening</option>
                                    <option value="Quiz">Quiz</option>
                                    <option value="Ideation & Video Submission">Ideation & Video Submission</option>
                                    <option value="Hackathon">Hackathon</option>
                                    <option value="Assessment">Assessment</option>
                                    <option value="Finals">Finals</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Round Description & Deliverables</label>
                                <input
                                  type="text"
                                  placeholder="Explain what participants need to deliver or accomplish in this round..."
                                  value={round.description}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, description: val } : r));
                                  }}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-xs text-slate-800 bg-white"
                                />
                              </div>

                              {/* Round Schedule & Dates */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Round Start Date
                                  </label>
                                  <DatePicker
                                    value={round.startDate || ""}
                                    onChange={(val) => {
                                      setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, startDate: val } : r));
                                    }}
                                    placeholder="Start date"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Round End Date
                                  </label>
                                  <DatePicker
                                    value={round.endDate || ""}
                                    onChange={(val) => {
                                      setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, endDate: val } : r));
                                    }}
                                    placeholder="End date"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Start Time
                                  </label>
                                  <TimePicker
                                    value={round.startTime || ""}
                                    onChange={(val) => {
                                      setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, startTime: val } : r));
                                    }}
                                    placeholder="09:00 AM"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    End Time
                                  </label>
                                  <TimePicker
                                    value={round.endTime || ""}
                                    onChange={(val) => {
                                      setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, endTime: val } : r));
                                    }}
                                    placeholder="05:00 PM"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const newNum = formRounds.length + 1;
                            setFormRounds(prev => [
                              ...prev,
                              {
                                roundNumber: newNum,
                                name: `Round ${newNum}: Stage Evaluation`,
                                type: "Evaluation",
                                description: `Evaluation and judging criteria for Round ${newNum}.`,
                                startDate: "",
                                endDate: "",
                                startTime: "",
                                endTime: "",
                                status: "Upcoming"
                              }
                            ]);
                            setFormTotalRounds(newNum);
                          }}
                          className="w-full py-2.5 border-2 border-dashed border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-2xl text-indigo-600 font-bold text-xs flex items-center justify-center gap-2 mt-2 transition-all cursor-pointer"
                        >
                          <Plus className="h-4 w-4" /> Add Next Round
                        </button>
                      </div>
                    </div>
                  )}

                  {/* WhatsApp Integration Card */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight border-b border-slate-50 pb-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-emerald-600">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      WhatsApp Group Link
                    </h3>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp Group URL</label>
                      <input
                        type="url"
                        placeholder="https://chat.whatsapp.com/..."
                        value={formWhatsGroupLink}
                        onChange={(e) => setFormWhatsGroupLink(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-green-500 font-medium text-sm text-slate-800 bg-slate-50/30 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Faculty Coordinator Card */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                          <Users className="h-4 w-4" />
                        </div>
                        Faculty Coordinator
                      </h3>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                        Faculty Lead
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <MemberSelectCombobox
                          label="Coordinator Name"
                          value={formFacultyCoordinatorEmail || formFacultyCoordinator}
                          onChange={(val, user) => {
                            setFormFacultyCoordinator(user?.name || user?.displayName || val);
                            setFormFacultyCoordinatorEmail(user?.email || "");
                            if (user?.phone) setFormFacultyCoordinatorPhone(user.phone);
                          }}
                          users={allUsers}
                          placeholder="Search or select Faculty Coordinator..."
                          themeColor="purple"
                          strictFilter={false}
                          headerTitle="Faculty Coordinators"
                          recommendedRole={["Faculty Coordinator", "Faculty Lead", "Faculty Advisor", "Faculty"]}
                          roleFilter={(u) => {
                            const r = (u.role || "").toLowerCase().trim();
                            const p = (u.position || "").toLowerCase().trim();
                            const e = (u.email || "").toLowerCase().trim();
                            return (
                              r === "faculty coordinator" ||
                              r === "faculty" ||
                              p.includes("faculty coordinator") ||
                              p.includes("faculty lead") ||
                              p.includes("faculty advisor") ||
                              e.startsWith("facultycoordinator@") ||
                              (r.includes("faculty") && !r.includes("student"))
                            );
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Coordinator Email
                          </label>
                          <input
                            type="email"
                            placeholder="faculty@vishnu.edu.in"
                            value={formFacultyCoordinatorEmail}
                            onChange={(e) => setFormFacultyCoordinatorEmail(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-medium text-xs text-slate-800 bg-slate-50/30 focus:bg-white transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Coordinator Phone
                          </label>
                          <input
                            type="tel"
                            placeholder="+91 9876543210"
                            value={formFacultyCoordinatorPhone}
                            onChange={(e) => setFormFacultyCoordinatorPhone(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-medium text-xs text-slate-800 bg-slate-50/30 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Coordinator Card */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                          <Users className="h-4 w-4" />
                        </div>
                        Student Coordinator
                      </h3>
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
                        Student Lead
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <MemberSelectCombobox
                          label="Coordinator Name"
                          value={formStudentCoordinatorEmail || formStudentCoordinator}
                          onChange={(val, user) => {
                            setFormStudentCoordinator(user?.name || user?.displayName || val);
                            setFormStudentCoordinatorEmail(user?.email || "");
                            if (user?.phone) setFormStudentCoordinatorPhone(user.phone);
                          }}
                          users={allUsers}
                          placeholder="Search or select Student Coordinator..."
                          themeColor="orange"
                          strictFilter={false}
                          headerTitle="Student Coordinators & Organizers"
                          roleFilter={(u) => {
                            const r = (u.role || "").toLowerCase().trim();
                            const p = (u.position || "").toLowerCase().trim();
                            const e = (u.email || "").toLowerCase().trim();

                            const isFacultyOrAdmin =
                              r.includes("faculty") ||
                              p.includes("faculty") ||
                              r.includes("admin") ||
                              p.includes("admin") ||
                              e === "admin@aiverse.in" ||
                              e.startsWith("facultycoordinator@");

                            const isParticipantOrTeam =
                              r.includes("participant") ||
                              p.includes("participant") ||
                              r === "team" ||
                              p === "team" ||
                              !!u.teamName ||
                              !!u.team_name ||
                              !!u.registrationId ||
                              !!u.registration_id;

                            const isJury = r.includes("jury") || p.includes("jury") || e.startsWith("jury@");

                            return !isFacultyOrAdmin && !isParticipantOrTeam && !isJury;
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Coordinator Email
                          </label>
                          <input
                            type="email"
                            placeholder="student@aiverse.in"
                            value={formStudentCoordinatorEmail}
                            onChange={(e) => setFormStudentCoordinatorEmail(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 font-medium text-xs text-slate-800 bg-slate-50/30 focus:bg-white transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Coordinator Phone
                          </label>
                          <input
                            type="tel"
                            placeholder="+91 9876543210"
                            value={formStudentCoordinatorPhone}
                            onChange={(e) => setFormStudentCoordinatorPhone(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 font-medium text-xs text-slate-800 bg-slate-50/30 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 5. Media */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight border-b border-slate-50 pb-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                      <Upload className="h-4 w-4" />
                    </div>
                    Media
                  </h3>

                  <div className="space-y-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                    />

                    {formPosterImages.length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {formPosterImages.map((img, idx) => (
                            <div key={idx} className="relative w-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 flex flex-col group">
                              <div className="relative w-full flex justify-center items-center h-44 bg-slate-100/50">
                                <img
                                  src={img.preview}
                                  alt={`Poster Preview ${idx + 1}`}
                                  className="w-full h-full object-contain p-2"
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 border-t border-emerald-100/60">
                                <span className="flex items-center gap-1.5 truncate max-w-[150px]">
                                  <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                                  {img.filename}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormPosterImages(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="text-red-500 hover:text-red-700 font-black ml-2 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl text-slate-500 hover:text-blue-600 font-bold text-xs bg-slate-50/20 hover:bg-blue-50/10 flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                          Add More Images
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/40 hover:bg-blue-50/10 group min-h-[160px] overflow-hidden"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center transition-colors mb-3">
                          <Upload className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-black text-slate-700 block">Upload Event Poster</span>
                        <span className="text-[10px] text-slate-450 font-semibold mt-1">Drag and drop your image here, or click to browse</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 font-semibold">(Any size, Max 5MB)</span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="mt-4 px-4 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-650 hover:bg-slate-50 transition-all text-[11px] font-bold shadow-sm"
                        >
                          Browse Files
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              {/* Upload Ticket Design Card */}
              {!formIsPastEvent && formCategory !== "Quiz" && (
                <div id="section-ticket-design" className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-6 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center shadow-inner">
                        <Ticket className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-850 tracking-tight flex items-center gap-2">
                          Upload Ticket Design
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200/70">
                            JPG / PNG Template
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Upload your custom ticket design in JPG or PNG format. Position the <strong>QR</strong> placeholder box on your ticket to print dynamic attendee QR codes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hidden File Input for Ticket Template */}
                  <input
                    type="file"
                    ref={ticketBgFileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleTicketBgFileChange}
                  />

                  {/* 1. Upload Ticket Template Dropzone */}
                  {!formTicketBgPreview ? (
                    <div
                      onClick={() => ticketBgFileInputRef.current?.click()}
                      className="border-2 border-dashed border-blue-300/80 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/60 rounded-3xl p-7 text-center transition-all cursor-pointer group flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white text-blue-600 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform border border-blue-100">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm font-black text-slate-800 block">
                          Click to Upload Ticket Template
                        </span>
                        <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                          Upload your designed ticket in <strong className="text-slate-700">PNG</strong> or <strong className="text-slate-700">JPG</strong> format.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-500 shadow-2xs">
                        <span>📐 Portrait or Landscape</span>
                        <span>•</span>
                        <span>Max 10MB</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={formTicketBgPreview}
                          alt="Ticket Template Thumbnail"
                          className="w-14 h-14 object-cover rounded-xl border border-slate-300 shadow-sm"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-850 block truncate max-w-[220px]">
                            {formTicketBgFilename || "Custom_Ticket_Template.png"}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Ticket Template Linked & Ready
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => ticketBgFileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-all text-xs shadow-2xs cursor-pointer"
                        >
                          Replace Image
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormTicketBgPreview("");
                            setFormTicketBgFilename("");
                            if (ticketBgFileInputRef.current) ticketBgFileInputRef.current.value = "";
                          }}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Interactive Ticket Canvas & QR Code Placement */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-slate-850 flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-blue-600" />
                          QR Code Placeholder Placement on Ticket
                        </span>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Click anywhere on the ticket below to place the QR code, or use the position controls.
                        </p>
                      </div>
                      <span className="text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        X: {formTicketQrX}% • Y: {formTicketQrY}%
                      </span>
                    </div>

                    {/* Interactive Ticket Preview (Clean display with no outer dark box) */}
                    <div className="flex justify-center items-center py-2">
                      <div
                        onMouseDown={(e) => {
                          const container = e.currentTarget;
                          const updatePos = (clientX: number, clientY: number) => {
                            const rect = container.getBoundingClientRect();
                            if (rect.width === 0 || rect.height === 0) return;
                            const clickX = clientX - rect.left;
                            const clickY = clientY - rect.top;
                            const pctX = Math.round(Math.max(5, Math.min(95, (clickX / rect.width) * 100)));
                            const pctY = Math.round(Math.max(5, Math.min(95, (clickY / rect.height) * 100)));
                            setFormTicketQrX(pctX);
                            setFormTicketQrY(pctY);
                            setFormTicketQrPosition("custom");
                          };

                          updatePos(e.clientX, e.clientY);

                          const handleMouseMove = (moveEvt: MouseEvent) => {
                            updatePos(moveEvt.clientX, moveEvt.clientY);
                          };

                          const handleMouseUp = () => {
                            window.removeEventListener("mousemove", handleMouseMove);
                            window.removeEventListener("mouseup", handleMouseUp);
                          };

                          window.addEventListener("mousemove", handleMouseMove);
                          window.addEventListener("mouseup", handleMouseUp);
                        }}
                        onTouchStart={(e) => {
                          const container = e.currentTarget;
                          const updatePos = (clientX: number, clientY: number) => {
                            const rect = container.getBoundingClientRect();
                            if (rect.width === 0 || rect.height === 0) return;
                            const clickX = clientX - rect.left;
                            const clickY = clientY - rect.top;
                            const pctX = Math.round(Math.max(5, Math.min(95, (clickX / rect.width) * 100)));
                            const pctY = Math.round(Math.max(5, Math.min(95, (clickY / rect.height) * 100)));
                            setFormTicketQrX(pctX);
                            setFormTicketQrY(pctY);
                            setFormTicketQrPosition("custom");
                          };

                          if (e.touches.length > 0) {
                            updatePos(e.touches[0].clientX, e.touches[0].clientY);
                          }

                          const handleTouchMove = (moveEvt: TouchEvent) => {
                            if (moveEvt.touches.length > 0) {
                              updatePos(moveEvt.touches[0].clientX, moveEvt.touches[0].clientY);
                            }
                          };

                          const handleTouchEnd = () => {
                            window.removeEventListener("touchmove", handleTouchMove);
                            window.removeEventListener("touchend", handleTouchEnd);
                          };

                          window.addEventListener("touchmove", handleTouchMove);
                          window.addEventListener("touchend", handleTouchEnd);
                        }}
                        className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200 cursor-crosshair select-none w-fit max-w-full inline-block group"
                      >
                        {/* Background Template Image */}
                        {formTicketBgPreview && (
                          <img
                            src={formTicketBgPreview}
                            alt="Ticket Template"
                            className="w-full max-w-2xl h-auto object-contain block pointer-events-none rounded-2xl"
                          />
                        )}

                        {/* Drag/Click Dynamic QR Code Placeholder */}
                        <div
                          style={{
                            left: `${formTicketQrX}%`,
                            top: `${formTicketQrY}%`,
                            width: `${formTicketQrWidthPercent}%`,
                            transform: "translate(-50%, -50%)"
                          }}
                          className={`absolute z-20 aspect-square rounded-xl flex flex-col items-center justify-center p-1.5 transition-transform shadow-2xl pointer-events-none ${
                            formTicketQrBg === "white"
                              ? "bg-white border-2 border-blue-500 shadow-blue-500/30"
                              : formTicketQrBg === "glow"
                              ? "bg-slate-950 border-2 border-cyan-400 shadow-[0_0_20px_#22d3ee]"
                              : "bg-white/90 border-2 border-dashed border-blue-600 backdrop-blur-xs"
                          }`}
                          title={`QR Code Placeholder (X: ${formTicketQrX}%, Y: ${formTicketQrY}%)`}
                        >
                          <img
                            src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PARTICIPANT_PASS_QR"
                            alt="Dynamic QR Placeholder"
                            className="w-full h-full object-contain pointer-events-none"
                          />
                          <div className="absolute -top-3.5 px-2 py-0.5 rounded-full bg-blue-600 text-[8.5px] font-black text-white whitespace-nowrap shadow-md uppercase tracking-wider flex items-center gap-1">
                            <QrCode className="w-2.5 h-2.5" />
                            <span>QR</span>
                          </div>
                          <div className="absolute -bottom-3.5 px-1.5 py-0.5 rounded bg-slate-900/90 text-[7.5px] font-bold text-slate-200 whitespace-nowrap shadow-xs uppercase tracking-tight">
                            {formTicketQrX}%, {formTicketQrY}%
                          </div>
                        </div>

                        {/* Optional Attendee Text Overlay Preview */}
                        {formTicketShowAttendeeText && (
                          <div
                            style={{
                              left: `${formTicketTextX}%`,
                              top: `${formTicketTextY}%`,
                              color: formTicketTextColor,
                              transform: "translate(-50%, -50%)"
                            }}
                            className="absolute z-20 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-black border border-white/20 whitespace-nowrap pointer-events-none"
                          >
                            Attendee: Team Alpha (AV-PASS)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. QR Placement Fine-Tuning Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    {/* Left Column: Preset Position Buttons */}
                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Quick Position Presets
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "bottom-right", label: "Bottom Right", x: 78, y: 78 },
                          { id: "bottom-center", label: "Bottom Center", x: 50, y: 80 },
                          { id: "top-right", label: "Top Right", x: 80, y: 20 },
                          { id: "top-left", label: "Top Left", x: 20, y: 20 },
                          { id: "bottom-left", label: "Bottom Left", x: 20, y: 78 },
                          { id: "center", label: "Center", x: 50, y: 50 }
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setFormTicketQrPosition(p.id as any);
                              setFormTicketQrX(p.x);
                              setFormTicketQrY(p.y);
                            }}
                            className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                              formTicketQrX === p.x && formTicketQrY === p.y
                                ? "border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-2xs"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium"
                            }`}
                          >
                            <span className="text-[10px] block">{p.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Precision Sliders */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Horizontal Position (X)</span>
                          <span className="font-mono font-bold text-blue-600">{formTicketQrX}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="95"
                          value={formTicketQrX}
                          onChange={(e) => {
                            setFormTicketQrX(Number(e.target.value));
                            setFormTicketQrPosition("custom");
                          }}
                          className="w-full accent-blue-600 cursor-pointer"
                        />

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="font-bold text-slate-700">Vertical Position (Y)</span>
                          <span className="font-mono font-bold text-blue-600">{formTicketQrY}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="95"
                          value={formTicketQrY}
                          onChange={(e) => {
                            setFormTicketQrY(Number(e.target.value));
                            setFormTicketQrPosition("custom");
                          }}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Right Column: QR Code Sizing & Container Style */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-slate-700">QR Code Size (% of Ticket Width)</span>
                          <span className="font-mono font-bold text-blue-600">{formTicketQrWidthPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="40"
                          value={formTicketQrWidthPercent}
                          onChange={(e) => setFormTicketQrWidthPercent(Number(e.target.value))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                        <div className="grid grid-cols-4 gap-1.5 mt-2">
                          {[
                            { label: "Compact", val: 16 },
                            { label: "Standard", val: 22 },
                            { label: "Large", val: 28 },
                            { label: "Hero", val: 35 }
                          ].map((s) => (
                            <button
                              key={s.label}
                              type="button"
                              onClick={() => setFormTicketQrWidthPercent(s.val)}
                              className={`py-1 px-1.5 rounded-lg border text-[9.5px] font-bold transition-all cursor-pointer ${
                                formTicketQrWidthPercent === s.val
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          QR Container Background Box
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "white", label: "White Box", desc: "Clean & High Contrast" },
                            { id: "transparent", label: "Transparent", desc: "Direct on Image" },
                            { id: "glow", label: "Neon Glow", desc: "Dark Cyber Border" }
                          ].map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setFormTicketQrBg(b.id as any)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                formTicketQrBg === b.id
                                  ? "border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-2xs"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium"
                              }`}
                            >
                              <span className="text-[10.5px] block font-bold">{b.label}</span>
                              <span className="text-[8.5px] text-slate-400 block leading-tight">{b.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Attendee Name Overlay Toggle */}
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <label className="flex items-center justify-between cursor-pointer select-none">
                          <span className="text-xs font-bold text-slate-800">
                            Overlay Attendee / Team Name on Ticket
                          </span>
                          <input
                            type="checkbox"
                            checked={formTicketShowAttendeeText}
                            onChange={(e) => setFormTicketShowAttendeeText(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                        </label>

                        {formTicketShowAttendeeText && (
                          <div className="pt-2 border-t border-slate-200/60 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 block">Text X%</span>
                                <input
                                  type="number"
                                  min="5"
                                  max="95"
                                  value={formTicketTextX}
                                  onChange={(e) => setFormTicketTextX(Number(e.target.value))}
                                  className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 block">Text Y%</span>
                                <input
                                  type="number"
                                  min="5"
                                  max="95"
                                  value={formTicketTextY}
                                  onChange={(e) => setFormTicketTextY(Number(e.target.value))}
                                  className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9.5px] font-bold text-slate-500">Text Color:</span>
                              {["#FFFFFF", "#000000", "#2563EB", "#F59E0B"].map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setFormTicketTextColor(c)}
                                  style={{ backgroundColor: c }}
                                  className={`w-5 h-5 rounded-full border border-slate-300 ${
                                    formTicketTextColor === c ? "ring-2 ring-blue-500 scale-110" : ""
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {/* Add Bulk Registers Card (Shown for all categories EXCEPT Hackathon & Quiz) */}
              {!formIsPastEvent && formCategory !== "Hackathon" && formCategory !== "Quiz" && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5 text-left">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight border-b border-slate-50 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                        <UserPlus className="h-4 w-4" />
                      </div>
                      Add Bulk Registers
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadBulkRegTemplate}
                      className="text-[11px] font-bold text-[#2563EB] hover:text-[#1D4ED8] bg-blue-50 hover:bg-blue-100/70 px-3 py-1.5 rounded-xl border border-blue-100/80 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download CSV Template
                    </button>
                  </h3>

                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Upload a CSV file containing participant details to pre-register members for this {formCategory || "event"}.
                    </p>

                    {/* CSV File Upload Section */}
                    <input
                      type="file"
                      ref={bulkCsvFileInputRef}
                      className="hidden"
                      accept=".csv, text/csv, application/vnd.ms-excel"
                      onChange={handleBulkCsvFileChange}
                    />

                    {bulkRegCsvFilename ? (
                      <div className="p-4 border border-emerald-100 bg-emerald-50/40 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-inner">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block truncate max-w-[220px]">{bulkRegCsvFilename}</span>
                            <span className="text-[10px] font-semibold text-emerald-600 block mt-0.5">
                              {bulkRegCsvData.length} registrees loaded successfully
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => bulkCsvFileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBulkRegCsvFilename("");
                              setBulkRegCsvData([]);
                              if (bulkCsvFileInputRef.current) bulkCsvFileInputRef.current.value = "";
                            }}
                            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => bulkCsvFileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/40 hover:bg-blue-50/10 group text-center"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center transition-colors mb-2">
                          <Upload className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 block">Upload Registrations CSV File</span>
                        <span className="text-[10px] text-slate-450 font-semibold mt-1">Click to browse or drag & drop your CSV file here</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 font-semibold">(Headers: RollNumber, Name, CollegeEmailID, Branch, Section, Year, PhoneNumber)</span>
                      </div>
                    )}


                  </div>
                </div>
              )}

              {/* Event Agenda */}
              {!formIsPastEvent && formCategory !== "Quiz" && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight border-b border-slate-50 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                        <SlidersHorizontal className="h-4 w-4" />
                      </div>
                      Event Agenda
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={formHasAgenda} onChange={(e) => setFormHasAgenda(e.target.checked)} />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </h3>

                  {formHasAgenda && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                      {formAgendaItems.map((item, index) => (
                        <div key={index} className="p-4 border border-slate-100 bg-slate-50/20 rounded-2xl space-y-3 relative">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-blue-600 block">AGENDA ITEM {index + 1}</span>
                            {formAgendaItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormAgendaItems(prev => prev.filter((_, idx) => idx !== index));
                                }}
                                className="text-red-500 hover:text-red-700 font-bold text-[10px] hover:bg-red-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Time Block</label>
                              <input
                                type="text"
                                placeholder="e.g. 09:00 AM - 10:30 AM"
                                value={item.time}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormAgendaItems(prev => prev.map((it, idx) => idx === index ? { ...it, time: val } : it));
                                }}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-850 bg-white"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Session Title</label>
                              <input
                                type="text"
                                placeholder="e.g. Morning Keynote"
                                value={item.title}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormAgendaItems(prev => prev.map((it, idx) => idx === index ? { ...it, title: val } : it));
                                }}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-855 bg-white"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Short Outline</label>
                            <input
                              type="text"
                              placeholder="Brief session outline..."
                              value={item.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormAgendaItems(prev => prev.map((it, idx) => idx === index ? { ...it, description: val } : it));
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-850 bg-white"
                            />
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          setFormAgendaItems(prev => [
                            ...prev,
                            { time: "", title: "", description: "" }
                          ]);
                        }}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold text-xs hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        <Plus className="h-4 w-4" /> Add Agenda Item
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Right Panel: Live Preview & Status Configuration (span 1) */}
            {!formIsPastEvent && (
              <div className="space-y-6">

                {/* 1. Publishing Settings */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5 text-left">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight border-b border-slate-50 pb-3 flex items-center gap-2">
                    <Settings2 className="h-4.5 w-4.5 text-[#2563EB]" />
                    Publishing Settings
                  </h3>

                  <div className="space-y-4">
                    {/* Visibility Button Segments */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Visibility</label>
                      <div className="grid grid-cols-2 gap-2 border border-slate-100 bg-slate-50/50 p-1 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setFormVisibility("Public")}
                          className={`py-1.5 text-center text-[10px] font-bold rounded-xl transition-all ${formVisibility === "Public" ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Public
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormVisibility("Internal Only")}
                          className={`py-1.5 text-center text-[10px] font-bold rounded-xl transition-all ${formVisibility === "Internal Only" ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Internal Only
                        </button>
                      </div>
                    </div>

                    {/* Status configuration segments */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</label>
                      <div className="grid grid-cols-3 gap-1 border border-slate-100 bg-slate-50/50 p-1 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setFormStatus("Draft")}
                          className={`py-1.5 text-center text-[10px] font-bold rounded-xl transition-all ${formStatus === "Draft" ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormStatus("Active")}
                          className={`py-1.5 text-center text-[10px] font-bold rounded-xl transition-all ${formStatus === "Active" ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Active
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormStatus("Opened")}
                          className={`py-1.5 text-center text-[10px] font-bold rounded-xl transition-all ${formStatus === "Opened" ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Opened
                        </button>
                      </div>
                    </div>

                    {/* Featured Event toggle */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-700 block">Featured Event</span>
                        <span className="text-[9px] text-slate-450 font-semibold leading-none">Display at the top of the portal</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormIsFeatured(!formIsFeatured)}
                        className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${formIsFeatured ? "bg-[#2563EB]" : "bg-slate-200"}`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${formIsFeatured ? "translate-x-4" : "translate-x-0"}`}
                        />
                      </button>
                    </div>

                    {/* Send Email Notifications toggle */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-50/50">
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-700 block">Send Email Notifications</span>
                        <span className="text-[9px] text-slate-450 font-semibold leading-none">Notify all registered members</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormSendEmail(!formSendEmail)}
                        className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${formSendEmail ? "bg-[#2563EB]" : "bg-slate-200"}`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${formSendEmail ? "translate-x-4" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Event Preview */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 text-left">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight border-b border-slate-50 pb-3 flex justify-between items-center">
                    <span>Event Preview</span>
                    <span className="text-[9px] font-black text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">Live</span>
                  </h3>

                  {/* Event Card preview styling */}
                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-slate-50/20">
                    <div className="relative h-32 bg-slate-100/50">
                      {formPosterImages.length > 0 ? (
                        <img
                          src={formPosterImages[0].preview}
                          alt="Preview"
                          className="w-full h-full object-cover animate-in fade-in duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-b border-slate-100">
                          <span className="text-[10px] font-semibold">Update banner to preview</span>
                        </div>
                      )}
                      <div className="absolute top-2.5 right-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black tracking-wider uppercase text-white
                        ${formCategory === "Hackathon" ? "bg-[#2563EB]" : ""}
                        ${formCategory === "Seminar" ? "bg-sky-600" : ""}
                        ${formCategory === "Workshop" ? "bg-emerald-600" : ""}
                        ${formCategory === "Quiz" ? "bg-purple-600" : ""}
                        ${formCategory === "Tech Event" ? "bg-indigo-600" : ""}
                        ${formCategory === "Alumni Meetup" ? "bg-amber-600" : ""}
                      `}>
                          {formCategory.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-3.5">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs truncate">
                          {formTitle || "Event Title Preview..."}
                        </h4>
                        {formPrimaryTag && (
                          <span className="inline-block mt-1 text-[9px] font-semibold text-slate-400 bg-slate-100/60 px-2 py-0.5 rounded-full border border-slate-200/20">
                            #{formPrimaryTag}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 border-t border-slate-100 pt-3">
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3 inline text-slate-350" />
                          {formStartDate ? new Date(formStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "Oct 24, 2023"} {formStartTime && `• ${formStartTime}`}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3 inline text-slate-350" />
                          {formLocation || "Virtual Hub"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-slate-100/80">
                        {/* Registered Attendees Avatars Preview */}
                        <div className="flex -space-x-1.5 overflow-hidden">
                          <div className="w-5 h-5 rounded-full bg-slate-200 border border-white"></div>
                          <div className="w-5 h-5 rounded-full bg-slate-300 border border-white"></div>
                          <div className="w-5 h-5 rounded-full bg-slate-400 border border-white"></div>
                        </div>
                        <span className="text-[9px] font-black text-blue-600 border border-blue-100 px-2 py-0.5 rounded bg-blue-50/50 uppercase tracking-wider">
                          Register
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Give Event Access Card */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5 text-left">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
                        <Key className="h-4 w-4" />
                      </div>
                      Give Event Access
                    </h3>
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200/60 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Access
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Control participant dashboard login access, project submissions, quiz assessment rights, and results visibility for this event.
                  </p>

                  <div className="space-y-3 pt-1">
                    {/* Toggle: Allow Registrations */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 text-left pr-3">
                        <div className="flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">Allow Registrations</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                          Enable or disable public and team registrations for this event
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormAllowRegistrations(!formAllowRegistrations)}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 cursor-pointer ${
                          formAllowRegistrations ? "bg-[#2563EB]" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${
                            formAllowRegistrations ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle 1: Participant Portal Login Access */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 text-left pr-3">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">Participant Login Access</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                          Allow registered participants & teams to log in to the portal
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormAllowLoginAccess(!formAllowLoginAccess)}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 cursor-pointer ${
                          formAllowLoginAccess ? "bg-[#2563EB]" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${
                            formAllowLoginAccess ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle 2: Project Submissions Access */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 text-left pr-3">
                        <div className="flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">Project Submissions</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                          Permit teams to submit & update project files and code links
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormAllowSubmissions(!formAllowSubmissions)}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 cursor-pointer ${
                          formAllowSubmissions ? "bg-[#2563EB]" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${
                            formAllowSubmissions ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle 3: Online Quiz & Assessments Access */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 text-left pr-3">
                        <div className="flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">Quiz & Assessment Access</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                          Allow participants to enter exam lobby and take online tests
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormAllowQuizAccess(!formAllowQuizAccess)}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 cursor-pointer ${
                          formAllowQuizAccess ? "bg-[#2563EB]" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${
                            formAllowQuizAccess ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle 4: Problem Statements Access */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 text-left pr-3">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">Problem Statements</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                          Display published tracks & problem descriptions to teams
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormAllowProblemStatements(!formAllowProblemStatements)}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 cursor-pointer ${
                          formAllowProblemStatements ? "bg-[#2563EB]" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${
                            formAllowProblemStatements ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle: Round Management */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 text-left pr-3">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">Round Management</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                          Enable multi-round stages, qualifier tracking & stage progression
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormAllowRoundManagement(!formAllowRoundManagement)}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 cursor-pointer ${
                          formAllowRoundManagement ? "bg-[#2563EB]" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${
                            formAllowRoundManagement ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle 5: Certificates & Results */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 text-left pr-3">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">Certificates & Results</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                          Unlock final leaderboard scores and participation certificates
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormAllowCertificates(!formAllowCertificates)}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 cursor-pointer ${
                          formAllowCertificates ? "bg-[#2563EB]" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${
                            formAllowCertificates ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Direct Action Link to Manage Credentials */}
                  {editingEventId && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          const ev = events.find(e => e.id === editingEventId);
                          if (ev) handleOpenEventAccess(ev);
                        }}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Manage & Dispatch Team Credentials</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Set Pricing Card (Shown when Hackathon category is selected) */}
                {(formCategory === "Hackathon" || String(formCategory).toLowerCase().includes("hackathon")) && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5 text-left animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <IndianRupee className="h-4 w-4" />
                        </div>
                        Set Pricing
                      </h3>
                      <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                        formIsPaidEvent 
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200/60" 
                          : "text-slate-600 bg-slate-50 border-slate-200"
                      }`}>
                        {formIsPaidEvent ? "Paid Hackathon" : "Free Event"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Configure registration fees and price per person for teams participating in this hackathon.
                    </p>

                    {/* Paid Event ON/OFF Switch */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 text-left pr-3">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">Enable Paid Registration</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                          {formIsPaidEvent ? "Participants must pay registration fee" : "Registration is completely free"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !formIsPaidEvent;
                          setFormIsPaidEvent(nextState);
                          if (!nextState) {
                            setFormRegistrationFee("0");
                          }
                        }}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 cursor-pointer ${
                          formIsPaidEvent ? "bg-emerald-600" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-200 transform ${
                            formIsPaidEvent ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Pricing Input Section (When ON) */}
                    {formIsPaidEvent && (
                      <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100/70 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* 1. Pricing Type Selection: Per Person vs Per Team */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Pricing Option <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setFormPricingType("per_person")}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                formPricingType === "per_person"
                                  ? "bg-white text-emerald-700 shadow-sm border border-emerald-300 font-black"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <User className="w-3.5 h-3.5" />
                              <span>Per Person</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormPricingType("per_team")}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                formPricingType === "per_team"
                                  ? "bg-white text-emerald-700 shadow-sm border border-emerald-300 font-black"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>Per Team</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">
                            {formPricingType === "per_team"
                              ? "Flat fee per team regardless of how many members join."
                              : "Calculated per member: Total Fee = Price × Total Team Members."}
                          </p>
                        </div>

                        {/* 2. Fee Input */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            {formPricingType === "per_team" ? "Flat Price Per Team (₹)" : "Price Per Person (₹)"} <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 select-none">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder={formPricingType === "per_team" ? "e.g. 500" : "e.g. 250"}
                              value={formRegistrationFee === "0" ? "" : formRegistrationFee}
                              onChange={(e) => setFormRegistrationFee(e.target.value)}
                              className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-bold placeholder:text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                            />
                          </div>
                        </div>

                        {/* Quick preset chips */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Quick Presets</span>
                          <div className="flex flex-wrap gap-1.5">
                            {["99", "149", "199", "250", "499", "999"].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setFormRegistrationFee(preset)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                                  formRegistrationFee === preset
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
                                }`}
                              >
                                ₹{preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Payment QR Code Upload Section */}
                        <div className="space-y-2 pt-3 border-t border-emerald-100/70">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Upload Payment QR Code</span>
                              <span className="text-red-500">*</span>
                            </label>
                            {formPaymentQrImagePreview && (
                              <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Uploaded
                              </span>
                            )}
                          </div>

                          <input
                            type="file"
                            ref={paymentQrFileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handlePaymentQrFileChange}
                            onClick={(e) => e.stopPropagation()}
                          />

                          {formPaymentQrImagePreview ? (
                            <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/90 shadow-xs flex items-center gap-3.5">
                              <div 
                                onClick={() => setActiveImageLightbox(formPaymentQrImagePreview)}
                                className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer group shadow-inner"
                                title="Click to enlarge QR"
                              >
                                <img
                                  src={formPaymentQrImagePreview}
                                  alt="Payment QR Code"
                                  className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </div>

                              <div className="flex-1 min-w-0 text-left space-y-1">
                                <p className="text-xs font-bold text-slate-800 truncate" title={formPaymentQrImageFilename || "payment_qr.png"}>
                                  {formPaymentQrImageFilename || "Payment QR Image"}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium leading-tight">
                                  UPI scan-and-pay QR active for registered teams
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => paymentQrFileInputRef.current?.click()}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                                  >
                                    Change QR
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormPaymentQrImageFilename("");
                                      setFormPaymentQrImagePreview("");
                                    }}
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => paymentQrFileInputRef.current?.click()}
                              className="p-4 rounded-2xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/20 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group shadow-xs"
                            >
                              <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                                <QrCode className="h-5 w-5" />
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-800">
                                  Click to Upload Payment QR Code
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  GPay, PhonePe, Paytm, BHIM UPI (PNG, JPG, WebP)
                                </p>
                              </div>
                            </div>
                          )}

                          {/* UPI ID / VPA field */}
                          <div className="pt-2">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              UPI ID / VPA (Optional)
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="e.g. hackathon@upi or 9876543210@paytm"
                                value={formUpiId}
                                onChange={(e) => setFormUpiId(e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold placeholder:text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all font-mono"
                              />
                            </div>
                            <p className="text-[9px] text-slate-400 font-medium mt-1">
                              Participants can also copy this UPI ID to pay manually.
                            </p>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-medium leading-tight pt-1">
                          This fee and QR code will be presented to each participant when registering.
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* BOTTOM SAVE / CANCEL ACTION BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] mt-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{editingEventId ? "Ready to save changes and launch event" : "Ready to publish and launch new event"}</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingEventId(null);
                  setView("list");
                }}
                className="px-5 py-2.5 border border-slate-200 text-slate-650 font-bold rounded-2xl hover:bg-slate-50 transition-all text-xs bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEvent}
                onClick={handleCreateEvent}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md shadow-blue-600/10 hover:shadow-lg transition-all text-xs flex items-center gap-2 cursor-pointer"
              >
                {isSavingEvent && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSavingEvent ? "Saving Event..." : (editingEventId ? "Save Changes" : "Publish Event")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOTAL EVENT INFORMATION DETAILS FULL PAGE VIEW ================= */}
      {isDetailsModalOpen && (
        <div className="space-y-6 pb-12 text-left font-sans animate-in fade-in duration-200">
          <SEO
            title={`${selectedEventDetails?.title || "Event Details"} - Faculty Portal`}
            description="Control center for faculty-led event information, coordinator roster, and parameters."
          />

          {/* BREADCRUMB & TOP ACTION BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                <span>Dashboard</span>
                <span>&gt;</span>
                <span>Events</span>
                <span>&gt;</span>
                <span className="text-[#2563EB]">Event Details</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                {selectedEventDetails?.title || "Event Details"}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Full event configuration, venue location, speaker details, and coordinator assignments.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-650 font-bold rounded-2xl hover:bg-slate-50 transition-all text-xs bg-white flex items-center gap-1.5 shadow-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Events
              </button>
              {selectedEventDetails && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    if (selectedEventDetails?.id) {
                      handleStartEditEvent(selectedEventDetails.id);
                    }
                  }}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl shadow-md text-xs flex items-center gap-1.5 shadow-blue-600/10"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Event
                </button>
              )}
            </div>
          </div>

          {/* MAIN EVENT DETAILS FULL CONTAINER */}
          <div className="bg-slate-50 rounded-[32px] w-full shadow-sm border border-slate-200/80 overflow-hidden text-left relative flex flex-col">

            {/* 🌟 HERO BANNER HEADER */}
            <div className="relative bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#1D4ED8] text-white p-6 sm:p-8 shrink-0 overflow-hidden shadow-md">
              {/* Background Glow Blobs */}
              <div className="absolute top-0 right-1/4 w-96 h-96 bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,transparent_70%)] pointer-events-none transform-gpu" />
              <div className="absolute -bottom-10 left-10 w-72 h-72 bg-[radial-gradient(circle,rgba(129,140,248,0.2)_0%,transparent_70%)] pointer-events-none transform-gpu" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

                {/* Poster & Main Titles */}
                <div className="flex items-start sm:items-center gap-5 max-w-3xl">
                  {/* Event Thumbnail / Poster Preview */}
                  <div
                    onClick={() => {
                      const src = selectedEventDetails?.posterPreview || selectedEventDetails?.image || sparkImg;
                      if (src) setActiveImageLightbox(src);
                    }}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/15 border border-white/30 overflow-hidden shrink-0 shadow-2xl flex items-center justify-center p-1 backdrop-blur-sm cursor-pointer group relative hover:border-white/60 transition-all"
                    title="Click to view full poster"
                  >
                    <img
                      src={selectedEventDetails?.posterPreview || selectedEventDetails?.image || sparkImg}
                      alt={selectedEventDetails?.title || "Event Poster"}
                      className="w-full h-full object-contain rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = sparkImg;
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                      <Eye className="h-4 w-4 text-white drop-shadow-md" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Category & Status Pills */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-sm">
                        {selectedEventDetails?.category || "EVENT"}
                      </span>
                      {selectedEventDetails?.status && (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md flex items-center gap-1.5 ${selectedEventDetails.status === "Opened"
                          ? "bg-emerald-400/25 text-emerald-100 border-emerald-300/40"
                          : selectedEventDetails.status === "Active"
                            ? "bg-sky-400/25 text-sky-100 border-sky-300/40"
                            : "bg-slate-400/25 text-slate-100 border-slate-300/40"
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedEventDetails.status === "Opened" ? "bg-emerald-300 animate-ping" : "bg-sky-300"}`}></span>
                          {selectedEventDetails.status}
                        </span>
                      )}
                      {selectedEventDetails?.visibility && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold text-blue-100 bg-white/10 border border-white/20">
                          {selectedEventDetails.visibility}
                        </span>
                      )}
                      {selectedEventDetails?.primaryTag && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-blue-100 bg-white/15 border border-white/25">
                          #{selectedEventDetails.primaryTag}
                        </span>
                      )}
                    </div>

                    {/* Event Title */}
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                      {selectedEventDetails?.title || "Event Information"}
                    </h2>

                    {/* Sub-info bar */}
                    <div className="flex items-center gap-4 text-xs text-slate-300 font-medium flex-wrap pt-0.5">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blue-400" />
                        {selectedEventDetails?.startDate || selectedEventDetails?.date || "TBD"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-sky-400" />
                        {selectedEventDetails?.location || "Virtual Hub"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 📜 BODY DETAILS */}
            <div className="p-6 sm:p-8 bg-slate-100/60 flex-grow">
              {loadingDetails ? (
                <div className="py-20 text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#2563EB] mx-auto shadow-md"></div>
                  <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">Fetching Event Details...</p>
                </div>
              ) : selectedEventDetails ? (
                // 2-COLUMN GRID LAYOUT
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* LEFT MAIN CONTENT (2 COLUMNS) */}
                  <div className="lg:col-span-2 space-y-6">

                    {/* 1. Basic Overview & Description */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 relative overflow-hidden">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shadow-inner">
                            <Info className="h-4 w-4" />
                          </div>
                          1. Event Overview
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full uppercase">
                          ID: {selectedEventDetails?.id ? String(selectedEventDetails.id).substring(0, 8) : "N/A"}
                        </span>
                      </div>

                      {selectedEventDetails?.description && (
                        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-150/60">
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {selectedEventDetails.description}
                          </p>
                        </div>
                      )}

                      {(selectedEventDetails?.company || selectedEventDetails?.batch) && (
                        <div className="grid grid-cols-2 gap-4 pt-1">
                          {selectedEventDetails?.company && (
                            <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-100/50">
                              <span className="text-[10px] font-extrabold text-blue-600 uppercase block tracking-wider">Company</span>
                              <span className="text-xs font-bold text-slate-800">{selectedEventDetails.company}</span>
                            </div>
                          )}
                          {selectedEventDetails?.batch && (
                            <div className="bg-purple-50/40 p-3 rounded-2xl border border-purple-100/50">
                              <span className="text-[10px] font-extrabold text-purple-600 uppercase block tracking-wider">Batch</span>
                              <span className="text-xs font-bold text-slate-800">{selectedEventDetails.batch}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2 & 3. Date, Time & Location (Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Date & Time Mini Card */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Calendar className="h-4 w-4" />
                          </div>
                          2. Date & Time
                        </h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center py-1 border-b border-slate-50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Start Date</span>
                            <span className="font-extrabold text-slate-800">{selectedEventDetails?.startDate || selectedEventDetails?.date || "TBD"}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">End Date</span>
                            <span className="font-extrabold text-slate-800">{selectedEventDetails?.endDate || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Time Slot</span>
                            <span className="font-extrabold text-slate-800">
                              {selectedEventDetails?.startTime ? `${selectedEventDetails.startTime} - ${selectedEventDetails.endTime || ""}` : "TBD"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Location Mini Card */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
                          <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                            <MapPin className="h-4 w-4" />
                          </div>
                          3. Venue & Location
                        </h4>
                        <div className="space-y-2 text-xs">
                          <div className="py-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Venue / Link</span>
                            <span className="font-extrabold text-slate-800 line-clamp-2 mt-0.5">{selectedEventDetails?.location || "Virtual Hub"}</span>
                          </div>
                          <div className="pt-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${selectedEventDetails?.isVirtual ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
                              {selectedEventDetails?.isVirtual ? "🌐 Virtual Event" : "📍 In-Person Event"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Registration Details */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        4. Registration Status & Rules
                      </h3>

                      {/* Total Registered Seats Display */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div className="space-y-0.5 text-left">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registrations Count</span>
                          <span className="text-xs font-bold text-slate-700">Total Registered Seats</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedEventDetails) {
                              setIsDetailsModalOpen(false);
                              handleOpenEventRoster(selectedEventDetails);
                            }
                          }}
                          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#2563EB] rounded-2xl border border-blue-200 font-black text-sm shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                          title="Click to view all registered teams and individual members"
                        >
                          <Users className="h-4 w-4 text-[#2563EB]" />
                          <span>
                            {selectedEventDetails?.category === "HACKATHONS" || selectedEventDetails?.category === "Hackathon" || (selectedEventDetails?.maxTeamSize && selectedEventDetails.maxTeamSize > 1) || (selectedEventDetails?.minTeamSize && selectedEventDetails.minTeamSize > 1)
                              ? `${selectedEventDetails?.currentReg || 0} ${(selectedEventDetails?.currentReg || 0) === 1 ? "Registered Team" : "Registered Teams"} ➔`
                              : `${selectedEventDetails?.currentReg || 0} Registered ➔`
                            }
                          </span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-center">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Fee</span>
                          <span className="text-xs font-black text-emerald-600">
                            {selectedEventDetails?.registrationFee ? `₹${selectedEventDetails.registrationFee}` : "Free"}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Deadline</span>
                          <span className="text-xs font-bold text-slate-800 truncate block">{selectedEventDetails?.regDeadline || "N/A"}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Waitlist</span>
                          <span className="text-xs font-bold text-slate-800">{selectedEventDetails?.enableWaitlist ? "Enabled" : "Disabled"}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Team Size</span>
                          <span className="text-xs font-bold text-slate-800">
                            {selectedEventDetails?.minTeamSize || 1} - {selectedEventDetails?.maxTeamSize || 4}
                          </span>
                        </div>
                      </div>

                      {/* Payment QR in Event Details */}
                      {(selectedEventDetails?.paymentQrImagePreview || selectedEventDetails?.paymentQr || selectedEventDetails?.upiId) && (
                        <div className="mt-3 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col sm:flex-row items-center gap-4 text-left">
                          {(selectedEventDetails?.paymentQrImagePreview || selectedEventDetails?.paymentQr) && (
                            <div 
                              onClick={() => setActiveImageLightbox(selectedEventDetails?.paymentQrImagePreview || selectedEventDetails?.paymentQr)}
                              className="w-20 h-20 bg-white rounded-xl border border-emerald-200 p-1 flex items-center justify-center shrink-0 cursor-pointer shadow-xs group"
                              title="Click to zoom QR Code"
                            >
                              <img
                                src={selectedEventDetails?.paymentQrImagePreview || selectedEventDetails?.paymentQr}
                                alt="Payment QR"
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                              />
                            </div>
                          )}
                          <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block flex items-center gap-1.5 justify-center sm:justify-start">
                              <QrCode className="w-3.5 h-3.5" />
                              Official Payment QR & UPI
                            </span>
                            {selectedEventDetails?.upiId && (
                              <p className="text-xs font-mono font-bold text-slate-800 break-all">
                                UPI: <span className="text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">{selectedEventDetails.upiId}</span>
                              </p>
                            )}
                            <p className="text-[10px] text-slate-500 font-medium">
                              Fee: ₹{selectedEventDetails?.registrationFee || 0} per attendee
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 5. WhatsApp Group Link */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        5. WhatsApp Community Link
                      </h3>
                      {selectedEventDetails?.whatsGroupLink ? (
                        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 rounded-2xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="space-y-0.5 text-center sm:text-left">
                            <span className="text-[10px] font-bold uppercase text-emerald-200 tracking-wider">Official Group</span>
                            <p className="text-xs font-mono font-bold text-white truncate max-w-xs sm:max-w-md">
                              {selectedEventDetails.whatsGroupLink}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                if (selectedEventDetails?.whatsGroupLink) {
                                  navigator.clipboard.writeText(selectedEventDetails.whatsGroupLink);
                                  setCopiedWhatsLink(true);
                                  setTimeout(() => setCopiedWhatsLink(false), 2000);
                                }
                              }}
                              className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 backdrop-blur-md border border-white/20 active:scale-95"
                            >
                              {copiedWhatsLink ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedWhatsLink ? "Copied!" : "Copy"}
                            </button>
                            <a
                              href={selectedEventDetails.whatsGroupLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-white text-emerald-800 rounded-xl text-xs font-black hover:bg-emerald-50 transition-all shadow flex items-center gap-1.5 active:scale-95"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Join Group
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-100">
                          No WhatsApp group link configured for this event.
                        </p>
                      )}
                    </div>

                    {/* 8. Media & Posters */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Upload className="h-4 w-4" />
                          </div>
                          8. Event Posters & Media
                        </h3>
                        <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                          Full View Enabled
                        </span>
                      </div>

                      {Array.isArray(selectedEventDetails?.posterImages) && selectedEventDetails.posterImages.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedEventDetails.posterImages.map((img: any, idx: number) => {
                            const imgSrc = img.preview || img;
                            return (
                              <div
                                key={idx}
                                onClick={() => setActiveImageLightbox(imgSrc)}
                                className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 p-2 shadow-sm group relative flex items-center justify-center cursor-pointer hover:border-blue-300 transition-all"
                              >
                                <img
                                  src={imgSrc}
                                  alt={`Poster ${idx + 1}`}
                                  className="w-full max-h-[500px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
                                />
                                <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl backdrop-blur-[2px]">
                                  <span className="bg-white/95 text-slate-900 px-3.5 py-1.5 rounded-full text-xs font-black shadow-lg flex items-center gap-1.5">
                                    <Eye className="h-3.5 w-3.5 text-[#2563EB]" /> Click for Full Lightbox
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (selectedEventDetails?.posterPreview || selectedEventDetails?.image) ? (
                        <div
                          onClick={() => setActiveImageLightbox(selectedEventDetails?.posterPreview || selectedEventDetails?.image || sparkImg)}
                          className="w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 p-3 shadow-sm flex flex-col items-center justify-center cursor-pointer group relative hover:border-blue-300 transition-all"
                        >
                          <img
                            src={selectedEventDetails?.posterPreview || selectedEventDetails?.image || sparkImg}
                            alt="Full Event Poster"
                            className="w-full max-h-[550px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = sparkImg;
                            }}
                          />
                          <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl backdrop-blur-[2px]">
                            <span className="bg-white/95 text-slate-900 px-4 py-2 rounded-full text-xs font-black shadow-xl flex items-center gap-2 border border-white/40">
                              <Eye className="h-4 w-4 text-[#2563EB]" /> Click to Expand Full Poster
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-100">No media uploaded.</p>
                      )}
                    </div>

                    {/* 9. Speaker Information */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        9. Speaker & Guest Information
                      </h3>
                      {selectedEventDetails?.speakerName ? (
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/30 border border-slate-200/70">
                          {selectedEventDetails.speakerImagePreview ? (
                            <img src={selectedEventDetails.speakerImagePreview} alt={selectedEventDetails.speakerName} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md shrink-0" />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                              {String(selectedEventDetails.speakerName).substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="space-y-1 text-left">
                            <h4 className="text-sm font-black text-slate-900">{selectedEventDetails.speakerName}</h4>
                            {selectedEventDetails.speakerRole && (
                              <span className="text-xs font-bold text-blue-600 block">{selectedEventDetails.speakerRole}</span>
                            )}
                            {selectedEventDetails.speakerBio && (
                              <p className="text-xs text-slate-650 font-medium leading-relaxed pt-1">{selectedEventDetails.speakerBio}</p>
                            )}
                            {selectedEventDetails.speakerLinkedin && (
                              <a href={selectedEventDetails.speakerLinkedin} target="_blank" rel="noopener noreferrer" className="text-xs font-extrabold text-[#2563EB] hover:underline inline-flex items-center gap-1 pt-2">
                                <ExternalLink className="h-3 w-3" /> View LinkedIn Profile
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-100">No speaker details provided.</p>
                      )}
                    </div>

                    {/* 10. Event Agenda */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                          <Clock className="h-4 w-4" />
                        </div>
                        10. Event Agenda & Timeline
                      </h3>
                      {selectedEventDetails?.hasAgenda !== false && Array.isArray(selectedEventDetails?.agendaItems) && selectedEventDetails.agendaItems.length > 0 ? (
                        <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-150 pl-2">
                          {selectedEventDetails.agendaItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/60 relative z-10">
                              <span className="px-3 py-1 bg-white text-blue-700 font-mono font-black text-[10px] rounded-xl border border-slate-200 shrink-0 shadow-sm">
                                {item.time}
                              </span>
                              <div className="space-y-0.5 text-left">
                                <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                                {item.description && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{item.description}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-100">Event agenda is disabled or not configured.</p>
                      )}
                    </div>

                  </div>

                  {/* RIGHT SIDEBAR (1 COLUMN) */}
                  <div className="space-y-6">

                    {/* 6 & 7. Coordinators Widget */}
                    <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="w-7 h-7 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold">
                          <Users className="h-4 w-4" />
                        </div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                          Event Coordinators
                        </h3>
                      </div>

                      {/* 6. Faculty Coordinator */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50/60 p-4 rounded-2xl border border-purple-100 space-y-1">
                        <span className="text-[9px] font-black text-purple-600 uppercase tracking-wider block">
                          Faculty Coordinator
                        </span>
                        <span className="text-xs font-black text-slate-800 block">
                          {selectedEventDetails?.facultyCoordinator || "Not Assigned"}
                        </span>
                      </div>

                      {/* 7. Student Coordinator */}
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 rounded-2xl border border-amber-100 space-y-1">
                        <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block">
                          Student Coordinator
                        </span>
                        <span className="text-xs font-black text-slate-800 block">
                          {selectedEventDetails?.studentCoordinator || "Not Assigned"}
                        </span>
                      </div>
                    </div>

                    {/* Event Quick Settings Summary */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                        Event Metadata
                      </h3>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Visibility</span>
                          <span className="font-extrabold text-slate-800">{selectedEventDetails?.visibility || "Public"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Featured</span>
                          <span className="font-extrabold text-slate-800">{selectedEventDetails?.isFeatured ? "Yes ✨" : "No"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Email Notify</span>
                          <span className="font-extrabold text-slate-800">{selectedEventDetails?.sendEmail !== false ? "Enabled" : "Disabled"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Edit Action Banner */}
                    <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-6 rounded-3xl text-white space-y-3 shadow-xl">
                      <h4 className="text-xs font-black uppercase tracking-wider text-blue-200">Need to update this event?</h4>
                      <p className="text-xs text-slate-300 font-medium">Click below to open the complete Edit Form with live editing options.</p>
                      <button
                        onClick={() => {
                          setIsDetailsModalOpen(false);
                          if (selectedEventDetails?.id) {
                            handleStartEditEvent(selectedEventDetails.id);
                          }
                        }}
                        className="w-full py-3 bg-white text-slate-950 font-black rounded-2xl text-xs hover:bg-blue-50 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Pencil className="h-4 w-4 text-[#2563EB]" />
                        Open Edit Event Page
                      </button>
                    </div>

                    {/* Event Access Card */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold shadow-inner">
                          <Settings2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 tracking-tight">
                            Event Access
                          </h3>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Full Control Panel</p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Access live administrative tools, edit registration limits, manage coordinators, and configure event parameters.
                      </p>

                      <button
                        onClick={() => {
                          if (selectedEventDetails) {
                            handleOpenEventAccess(selectedEventDetails);
                          }
                        }}
                        className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black rounded-2xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Event Access
                      </button>
                    </div>

                  </div>

                </div>

              ) : (
                <div className="py-12 text-center text-slate-400 text-xs font-bold">
                  No details found for this event.
                </div>
              )}
            </div>

            {/* VIEW FOOTER */}
            <div className="p-4 sm:px-8 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span>AI Verse Event Portal • Read Only Details</span>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs transition-colors shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
                Back to Events List
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= SUPPORT MODAL ================= */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-left p-6 space-y-4 animate-in zoom-in-95 duration-200 font-sans">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto shadow-inner">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Support Ticket Opened</h3>
              <p className="text-xs text-slate-550 leading-relaxed font-semibold">
                Your concierge support request has been logged successfully. One of our event coordinators will contact you shortly via email.
              </p>
            </div>
            <button
              onClick={() => setIsSupportModalOpen(false)}
              className="w-full py-2.5 text-center text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl shadow-md transition-all select-none"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ================= LIGHTBOX FULL POSTER PREVIEW MODAL ================= */}
      {activeImageLightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setActiveImageLightbox(null)}
        >
          <img
            src={activeImageLightbox}
            alt="Full Resolution Event Poster"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/20 bg-slate-900 cursor-default select-none"
          />
        </div>
      )}

      {/* ================= EVENT ACCESS PARTICIPANTS FULL PAGE ================= */}
      {isEventAccessModalOpen && createPortal(
        <div className="fixed inset-0 z-[999999] bg-slate-50 w-full h-full flex flex-col overflow-hidden text-left font-sans animate-in fade-in duration-200">

          {/* Full Page Top Header */}
          <div className="w-full bg-[#1E3A8A] text-white py-3 px-6 sm:px-8 border-b border-blue-900/50 shadow-md flex items-center justify-between gap-4 shrink-0">
            {/* Left: Back Button */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleCloseEventAccess}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center gap-2 text-xs font-bold transition-all border border-white/20 backdrop-blur-md cursor-pointer shadow-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Events</span>
              </button>
            </div>

            {/* Center: Brand & Event Metadata */}
            <div className="flex items-center gap-3 min-w-0">
              <img src="/ai_verse.png" alt="AI Verse Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-100 border border-blue-400/30 shrink-0">
                  EVENT ACCESS
                </span>
                <span className="text-blue-200/50 font-bold text-xs hidden sm:inline">•</span>
                <span className="text-xs text-blue-200/90 font-bold truncate hidden md:inline">Event Control Center</span>
                <span className="text-blue-200/50 font-bold text-xs hidden md:inline">•</span>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate max-w-[250px] sm:max-w-md">
                  {eventAccessEvent?.title || "Event Access"}
                </h2>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={handleExportEventAccessCsv}
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold rounded-xl text-xs transition-all border border-white/20 backdrop-blur-md flex items-center gap-2 shadow-xs cursor-pointer"
                title="Export Participants CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                onClick={handleCloseEventAccess}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer shadow-xs"
                title="Close Full Screen"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Full Page Main Body with Hardware Accelerated Smooth Kinetic Scrolling */}
          <div className="w-full max-w-[1500px] mx-auto p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 transform-gpu will-change-scroll">

            {/* Feedback notification toast if login access is provisioned */}
            {loginAccessSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{loginAccessSuccessMsg}</span>
                </div>
                <button
                  onClick={() => setLoginAccessSuccessMsg(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-extrabold text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Feedback notification toast if problem statement is published */}
            {problemSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{problemSuccessMsg}</span>
                </div>
                <button
                  onClick={() => setProblemSuccessMsg(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-extrabold text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Feedback notification toast if round management is updated */}
            {roundsSuccessMsg && (
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-5 w-5 text-indigo-600 shrink-0" />
                  <span>{roundsSuccessMsg}</span>
                </div>
                <button
                  onClick={() => setRoundsSuccessMsg(null)}
                  className="text-indigo-700 hover:text-indigo-900 font-extrabold text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* TOP 5 ACTION CARDS GRID SECTION (Balanced 3 + 2 Grid Layout) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 items-stretch w-full">

              {/* CARD 1: Registrations (Row 1 - Span 2 of 6) */}
              <div
                onClick={() => {
                  setIsEventRosterModalOpen(true);
                }}
                className="lg:col-span-2 bg-white p-6 rounded-3xl text-slate-800 shadow-sm relative overflow-hidden border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-200 group flex flex-col justify-between h-full min-h-[280px] cursor-pointer hover:-translate-y-1 transform-gpu"
              >
                <div className="absolute right-0 top-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.06),transparent_70%)] pointer-events-none" />

                <div className="relative z-10 space-y-4 text-left">
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                      REGISTRATIONS
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {eventAccessRegistrations.length} REGISTERED
                    </span>
                  </div>

                  {/* Title & Icon */}
                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                        Registrations
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Participant Directory</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 font-medium leading-relaxed min-h-[36px]">
                    Manage enrollments, verify student credentials, and inspect registered team rosters.
                  </p>
                </div>

                {/* Bottom Section: Stat Pills + Full Width Button */}
                <div className="relative z-10 pt-5 space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Group: <span className="text-blue-600 font-black">{eventAccessRegistrations.filter(r => r.groupName && r.groupName !== "Individual RSVP").length}</span>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Individual: <span className="text-slate-900 font-black">{eventAccessRegistrations.filter(r => !r.groupName || r.groupName === "Individual RSVP").length}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEventRosterModalOpen(true);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer border border-blue-400/20"
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>View Registered Members</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: Quiz Management (Row 1 - Span 2 of 6) */}
              <div
                onClick={() => navigate(`/faculty/quizzes?eventId=${eventAccessEvent?.id || ""}`)}
                className="lg:col-span-2 bg-white p-6 rounded-3xl text-slate-800 shadow-sm relative overflow-hidden border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-200 group flex flex-col justify-between h-full min-h-[280px] cursor-pointer hover:-translate-y-1 transform-gpu"
              >
                <div className="absolute right-0 top-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.06),transparent_70%)] pointer-events-none" />

                <div className="relative z-10 space-y-4 text-left">
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                      QUIZ ENGINE
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE READY
                    </span>
                  </div>

                  {/* Title & Icon */}
                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                      <HelpCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                        Quiz Management
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Test & Screening Hub</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 font-medium leading-relaxed min-h-[36px]">
                    Start interactive tests, configure AI/custom questions, and view live leaderboards.
                  </p>
                </div>

                {/* Bottom Section: Stat Pills + Full Width Button */}
                <div className="relative z-10 pt-5 space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      <span className="text-blue-600 font-black">AI Questions</span>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      <span className="text-emerald-600 font-black">Live Monitor</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/faculty/quizzes?eventId=${eventAccessEvent?.id || ""}`);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer border border-blue-400/20"
                  >
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span>Start & Manage Quiz</span>
                  </button>
                </div>
              </div>

              {/* CARD 3: Round Promotion & Stages (Row 1 - Span 2 of 6) */}
              <div
                onClick={handleOpenEventRoundsModal}
                className="lg:col-span-2 bg-white p-6 rounded-3xl text-slate-800 shadow-sm relative overflow-hidden border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-200 group flex flex-col justify-between h-full min-h-[280px] cursor-pointer hover:-translate-y-1 transform-gpu"
              >
                <div className="absolute right-0 top-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.06),transparent_70%)] pointer-events-none" />

                <div className="relative z-10 space-y-4 text-left">
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                      ROUND PROMOTION
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      STAGE {eventAccessEvent?.currentRound || 1} ACTIVE
                    </span>
                  </div>

                  {/* Title & Icon */}
                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                        Round Promotion & Stages
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Advancement Pipeline</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 font-medium leading-relaxed min-h-[36px]">
                    Promote participants to next rounds via Quiz & Submission scores, and configure stage deadlines.
                  </p>
                </div>

                {/* Bottom Section: Stat Pills + Full Width Button */}
                <div className="relative z-10 pt-5 space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Stage <span className="text-blue-600 font-black">{eventAccessEvent?.currentRound || 1}</span> Active
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Promoted: <span className="text-emerald-600 font-black">{eventAccessRegistrations.filter(r => (r.currentRound || 1) > 1 || r.roundStatus === "Qualified").length}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEventRoundsModal();
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer border border-blue-400/20"
                  >
                    <Trophy className="w-4 h-4 shrink-0 text-amber-300" />
                    <span>Promote Participants & Stages</span>
                  </button>
                </div>
              </div>

              {/* CARD 4: Problem Statements (Row 2 - Span 2 of 6) */}
              <div
                onClick={handleOpenMultiProblemModal}
                className="lg:col-span-2 bg-white p-6 rounded-3xl text-slate-800 shadow-sm relative overflow-hidden border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-200 group flex flex-col justify-between h-full min-h-[280px] cursor-pointer hover:-translate-y-1 transform-gpu"
              >
                <div className="absolute right-0 top-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.06),transparent_70%)] pointer-events-none" />

                <div className="relative z-10 space-y-4 text-left">
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                      PROBLEM STATEMENTS
                    </span>
                    {(eventAccessEvent?.problemStatements?.length > 0 || eventAccessEvent?.problemStatementTitle) ? (
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {eventAccessEvent?.problemStatements?.length || 1} ACTIVE
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        READY TO ADD
                      </span>
                    )}
                  </div>

                  {/* Title & Icon */}
                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                        Problem Statements
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tracks & Challenge Statements</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 font-medium leading-relaxed min-h-[36px]">
                    {eventAccessEvent?.problemStatements?.length > 0
                      ? `Active: ${eventAccessEvent.problemStatements.map((p: any) => p.code || p.title).slice(0, 2).join(", ")}${eventAccessEvent.problemStatements.length > 2 ? "..." : ""}`
                      : eventAccessEvent?.problemStatementTitle
                        ? `Active: ${eventAccessEvent.problemStatementTitle}`
                        : "Create, manage, and broadcast challenge tracks & problem statements."}
                  </p>
                </div>

                {/* Bottom Section: Stat Pills + Full Width Button */}
                <div className="relative z-10 pt-5 space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Active: <span className="text-blue-600 font-black">{eventAccessEvent?.problemStatements?.length || (eventAccessEvent?.problemStatementTitle ? 1 : 0)}</span>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Track: <span className="text-slate-900 font-black truncate">{eventAccessEvent?.problemStatementTrack || "Multi-Track"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenMultiProblemModal();
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer border border-blue-400/20"
                  >
                    <FileCode className="w-4 h-4 shrink-0" />
                    <span>
                      {eventAccessEvent?.problemStatementTitle || eventAccessEvent?.problemStatements?.length
                        ? "Manage Statements"
                        : "+ Add Statements"}
                    </span>
                  </button>
                </div>
              </div>

              {/* CARD 5: Submissions (Row 2 - Span 2 of 6) */}
              <div
                onClick={handleOpenSubmissionsModal}
                className="lg:col-span-2 bg-white p-6 rounded-3xl text-slate-800 shadow-sm relative overflow-hidden border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-200 group flex flex-col justify-between h-full min-h-[280px] cursor-pointer hover:-translate-y-1 transform-gpu"
              >
                <div className="absolute right-0 top-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.06),transparent_70%)] pointer-events-none" />

                <div className="relative z-10 space-y-4 text-left">
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                      SUBMISSIONS
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {eventAccessRegistrations.filter(r => r.submissionStatus === "Submitted" || r.submittedAt).length} / {eventAccessRegistrations.length}
                    </span>
                  </div>

                  {/* Title & Icon */}
                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                        Submissions Monitor
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deliverables & Reviews</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 font-medium leading-relaxed min-h-[36px]">
                    Monitor team deliverables, SRS specifications, PPT pitch decks, and GitHub repos.
                  </p>
                </div>

                {/* Bottom Section: Stat Pills + Full Width Button */}
                <div className="relative z-10 pt-5 space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Submitted: <span className="text-emerald-600 font-black">{eventAccessRegistrations.filter(r => r.submissionStatus === "Submitted" || r.submittedAt).length}</span>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Drafts: <span className="text-amber-600 font-black">{eventAccessRegistrations.filter(r => r.submissionStatus === "Draft" || (r.problemStatement && r.submissionStatus !== "Submitted")).length}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSubmissionsModal();
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer border border-blue-400/20"
                  >
                    <Eye className="w-4 h-4 shrink-0" />
                    <span>Monitor Submissions</span>
                  </button>
                </div>
              </div>

              {/* CARD 6: Certificates & Distribution (Row 2 - Span 2 of 6) */}
              <div
                onClick={handleOpenCertificateModal}
                className="lg:col-span-2 bg-white p-6 rounded-3xl text-slate-800 shadow-sm relative overflow-hidden border border-slate-200/90 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-200 group flex flex-col justify-between h-full min-h-[280px] cursor-pointer hover:-translate-y-1 transform-gpu"
              >
                <div className="absolute right-0 top-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_70%)] pointer-events-none" />

                <div className="relative z-10 space-y-4 text-left">
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                      CERTIFICATE ENGINE
                    </span>
                    {flattenedCertRecipients.some(r => r.certificateIssued) ? (
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {flattenedCertRecipients.filter(r => r.certificateIssued).length} ISSUED
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        READY TO ISSUE
                      </span>
                    )}
                  </div>

                  {/* Title & Icon */}
                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                        Certificates & Distribution
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Awards & Email Delivery</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 font-medium leading-relaxed min-h-[36px]">
                    Generate verifiable digital certificates, customize templates, and bulk dispatch to participant emails.
                  </p>
                </div>

                {/* Bottom Section: Stat Pills + Full Width Button */}
                <div className="relative z-10 pt-5 space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Issued: <span className="text-emerald-600 font-black">{flattenedCertRecipients.filter(r => r.certificateIssued).length}</span>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Pending: <span className="text-amber-600 font-black">{flattenedCertRecipients.filter(r => !r.certificateIssued).length}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCertificateModal();
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer border border-amber-400/20"
                  >
                    <Award className="w-4 h-4 shrink-0 text-amber-200" />
                    <span>Manage & Distribute Certificates</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>,
        document.body
      )}

      {/* 👥 REGISTERED MEMBERS & LOGIN ACCESS MODAL */}
      {isEventRosterModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-slate-50 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200 text-left font-sans">
          <div
            className="bg-white w-full h-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="bg-[#1E3A8A] text-white px-6 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0 shadow-md border-b border-blue-900/50">
              {/* Left: Brand Logo & Title Metadata */}
              <div className="flex items-center gap-3.5 min-w-0">
                <img src="/ai_verse.png" alt="AI Verse Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
                <div className="h-6 w-px bg-white/20 hidden sm:block shrink-0"></div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-100 border border-blue-400/30 shrink-0">
                    EVENT REGISTRATIONS & ACCESS
                  </span>
                  <span className="text-blue-200/50 font-bold text-xs hidden sm:inline">•</span>
                  <span className="text-xs text-blue-200/90 font-bold shrink-0 hidden sm:inline">
                    {filteredEventAccessRegistrations.length} Participants Listed
                  </span>
                  <span className="text-blue-200/50 font-bold text-xs hidden sm:inline">•</span>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate max-w-[250px] sm:max-w-md">
                    {eventAccessEvent?.title || "Event Registrations"}
                  </h3>
                </div>
              </div>

              {/* Right: Export CSV & Close Button */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={handleExportEventAccessCsv}
                  className="px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold rounded-xl text-xs transition-all border border-white/20 backdrop-blur-md flex items-center gap-2 shadow-xs cursor-pointer"
                  title="Export Participants CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>

                <button
                  onClick={() => setIsEventRosterModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center gap-2 transition-all cursor-pointer font-bold text-xs border border-white/20 shadow-xs"
                >
                  <X className="h-4 w-4" />
                  <span>Close Full View</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Split 2 Columns with Toolbar */}
            <div className="p-6 sm:p-8 lg:p-10 overflow-y-auto flex-1 bg-slate-50/60 pb-24 space-y-6">
              
              {/* Feedback toast if provisioned */}
              {loginAccessSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>{loginAccessSuccessMsg}</span>
                  </div>
                  <button
                    onClick={() => setLoginAccessSuccessMsg(null)}
                    className="text-emerald-700 hover:text-emerald-900 font-extrabold text-xs cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Sub-Header Toolbar (Search, View Mode Tabs, Filter & Quick Stats) */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                  {/* Left: View Mode Tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl shrink-0 self-start">
                    <button
                      onClick={() => setEventRosterViewMode("teams")}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                        eventRosterViewMode === "teams"
                          ? "bg-white text-blue-700 shadow-sm border border-slate-200/60"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Layers className="w-4 h-4 text-[#2563EB]" />
                      <span>Teams & Registrations ({filteredEventAccessRegistrations.length})</span>
                    </button>
                    <button
                      onClick={() => setEventRosterViewMode("individuals")}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                        eventRosterViewMode === "individuals"
                          ? "bg-white text-blue-700 shadow-sm border border-slate-200/60"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Users className="w-4 h-4 text-[#2563EB]" />
                      <span>All Individual Members ({flattenedEventAttendees.length})</span>
                    </button>
                  </div>

                  {/* Right: Quick Stats Pills */}
                  <div className="flex items-center gap-3.5 flex-wrap justify-start lg:justify-end">
                    <div className="px-4 py-2 bg-blue-50/80 border border-blue-100/80 rounded-2xl flex items-center gap-2.5 shadow-2xs">
                      <div className="w-7 h-7 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase block leading-none tracking-wider">TOTAL MEMBERS</span>
                        <span className="text-xs font-black text-blue-700 mt-0.5 block">
                          {flattenedEventAttendees.length} Students
                        </span>
                      </div>
                    </div>

                    <div className="px-4 py-2 bg-purple-50/80 border border-purple-100/80 rounded-2xl flex items-center gap-2.5 shadow-2xs">
                      <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase block leading-none tracking-wider">TEAMS / REGISTRATIONS</span>
                        <span className="text-xs font-black text-purple-700 mt-0.5 block">
                          {eventAccessRegistrations.length} Groups
                        </span>
                      </div>
                    </div>

                    <div className="px-4 py-2 bg-emerald-50/80 border border-emerald-100/80 rounded-2xl flex items-center gap-2.5 shadow-2xs">
                      <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase block leading-none tracking-wider">CONFIRMED SEATS</span>
                        <span className="text-xs font-black text-emerald-700 mt-0.5 block">
                          {eventAccessRegistrations.filter(r => String(r.status || "").toLowerCase().trim() === "confirmed").length} Confirmed
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filters & Search Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={eventRosterViewMode === "teams" ? "Search teams by name, lead, roll no, member details..." : "Search individual members by name, roll no, email, branch..."}
                      value={eventAccessSearchQuery}
                      onChange={(e) => setEventAccessSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all"
                    />
                  </div>

                  {/* Filter Select */}
                  <div className="flex items-center gap-2 shrink-0">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={eventRosterFilter}
                      onChange={(e: any) => setEventRosterFilter(e.target.value)}
                      className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="all">Filter: All Records</option>
                      <option value="teams">Teams Only</option>
                      <option value="individuals">Individuals Only</option>
                      <option value="confirmed">Confirmed Status</option>
                      <option value="pending">Pending Status</option>
                    </select>

                    {/* Expand/Collapse All (Teams View Only) */}
                    {eventRosterViewMode === "teams" && (
                      <button
                        onClick={toggleExpandAllTeams}
                        className="px-3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                        title={expandedTeamIds.length >= filteredEventAccessRegistrations.length ? "Collapse all member lists" : "Expand all member lists"}
                      >
                        {expandedTeamIds.length >= filteredEventAccessRegistrations.length && filteredEventAccessRegistrations.length > 0 ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Collapse All</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Expand All Members</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* TWO COLUMN GRID: Left = Participants Roster (Span 8), Right = Login Access Card (Span 4) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN: Participants Table Roster (Span 8) */}
                <div className="lg:col-span-8 space-y-4">
                  {loadingEventAccessRegs ? (
                    <div className="py-24 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200/90 shadow-sm">
                      <Loader2 className="h-8 w-8 text-[#2563EB] animate-spin" />
                      <p className="text-xs font-bold text-slate-500">Fetching registered participants & team rosters from database...</p>
                    </div>
                  ) : eventRosterViewMode === "teams" ? (
                    /* ------------------------------------------------------------- */
                    /* MODE 1: TEAMS & REGISTRATIONS VIEW WITH EXPANDABLE MEMBERS     */
                    /* ------------------------------------------------------------- */
                    filteredEventAccessRegistrations.length > 0 ? (
                      <div className="space-y-4">
                        {filteredEventAccessRegistrations.map((reg, idx) => {
                          const isGroup = reg.groupName && reg.groupName !== "Individual RSVP";
                          const isConfirmed = String(reg.status || "").toLowerCase().trim() === "confirmed";
                          const isProvisioned = isConfirmed && provisionedTeamIds.includes(reg.id);
                          const displayTeamName = isGroup ? reg.groupName : (reg.teamLeadName || reg.name || "Individual Participant");
                          const isExpanded = expandedTeamIds.includes(reg.id);
                          const membersList = Array.isArray(reg.members) ? reg.members : [];
                          const totalMemberCount = isGroup ? 1 + membersList.length : 1;

                          return (
                            <div
                              key={reg.id || idx}
                              className={`bg-white rounded-3xl border transition-all duration-200 shadow-sm overflow-hidden ${
                                isExpanded ? "border-blue-300 ring-4 ring-blue-500/5 shadow-md" : "border-slate-200/90 hover:border-slate-300"
                              }`}
                            >
                              {/* Team Card Header */}
                              <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                                  {/* Team Number Badge */}
                                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] border border-blue-200/80 font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                                    {String(reg.teamNumber || reg.teamNo || (idx + 1)).padStart(2, "0")}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <h4 className="font-black text-slate-900 text-sm tracking-tight truncate max-w-sm">
                                        {displayTeamName}
                                      </h4>
                                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase inline-flex items-center gap-1 shadow-2xs ${
                                        isGroup ? "bg-purple-100 text-purple-800 border border-purple-200" : "bg-sky-100 text-sky-800 border border-sky-200"
                                      }`}>
                                        {isGroup ? `TEAM (${totalMemberCount} MEMBERS)` : "INDIVIDUAL RSVP"}
                                      </span>
                                      {isConfirmed ? (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                          <Check className="w-2.5 h-2.5" /> Confirmed
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                          <Clock className="w-2.5 h-2.5" /> Pending
                                        </span>
                                      )}
                                    </div>

                                    {/* Lead / Subtitle Info */}
                                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 font-semibold mt-1">
                                      <span className="inline-flex items-center gap-1 text-slate-800 font-bold">
                                        <User className="w-3.5 h-3.5 text-[#2563EB]" />
                                        {reg.teamLeadName || reg.name || "N/A"}
                                      </span>
                                      <span>•</span>
                                      <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-extrabold">
                                        {reg.teamLeadStudentId || reg.studentId || "N/A"}
                                      </span>
                                      <span>•</span>
                                      <span className="text-slate-600">
                                        {reg.branch || "CSE"} {reg.section ? `(${reg.section})` : ""}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Action Buttons */}
                                <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                                  {/* Login Access Action */}
                                  {!isConfirmed ? (
                                    <button
                                      onClick={() => navigate("/faculty/registrations")}
                                      className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                                      title="Confirm registration in Registration Directory"
                                    >
                                      <Lock className="w-3 h-3 text-amber-600" />
                                      <span>Confirm Reg</span>
                                    </button>
                                  ) : isProvisioned ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shadow-2xs">
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        Granted
                                      </span>
                                      <button
                                        onClick={() => handleRevokeSingleTeamAccess(reg.id, displayTeamName)}
                                        disabled={isProvisioningLoginAccess}
                                        className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                        title="Revoke portal access for this team"
                                      >
                                        Revoke
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleGrantSingleTeamAccess(reg.id, displayTeamName)}
                                      disabled={isProvisioningLoginAccess}
                                      className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                                      title="Allow login access for this team"
                                    >
                                      <Key className="w-3 h-3 text-[#2563EB]" />
                                      <span>Allow Access</span>
                                    </button>
                                  )}

                                  {/* Expand / Collapse Members Toggle */}
                                  {isGroup ? (
                                    <button
                                      onClick={() => toggleTeamExpand(reg.id)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs ${
                                        isExpanded
                                          ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/20"
                                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                                      }`}
                                    >
                                      <span>{isExpanded ? "Hide Members" : `Show ${totalMemberCount} Members`}</span>
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              {/* Expandable Individual Members List */}
                              {isGroup && isExpanded && (
                                <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-6 space-y-3 animate-in slide-in-from-top-2 duration-150">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                                    <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4 text-[#2563EB]" />
                                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        Team Members Roster ({totalMemberCount} Registered Students)
                                      </h5>
                                    </div>
                                    <span className="text-[10px] font-extrabold text-slate-400">
                                      1 Lead + {membersList.length} Teammate{membersList.length !== 1 ? "s" : ""}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* 1. Team Lead Card */}
                                    <div className="bg-white p-4 rounded-2xl border-2 border-blue-200/80 shadow-xs relative overflow-hidden">
                                      <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-600 to-indigo-600 text-white px-3 py-0.5 rounded-bl-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                        👑 TEAM LEAD
                                      </div>
                                      <div className="space-y-1.5 pt-1">
                                        <div className="font-black text-slate-900 text-xs">
                                          {reg.teamLeadName || reg.name || "N/A"}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-600">
                                          <span className="font-mono bg-blue-50 text-[#2563EB] px-2 py-0.5 rounded-md font-black border border-blue-100">
                                            {reg.teamLeadStudentId || reg.studentId || "N/A"}
                                          </span>
                                          <span>{reg.branch || "CSE"} {reg.section ? `• Sec ${reg.section}` : ""}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-semibold truncate pt-1" title={reg.teamLeadPersonalEmail || reg.email}>
                                          ✉️ {reg.teamLeadPersonalEmail || reg.personalEmail || reg.teamLeadEmail || reg.email || "N/A"}
                                        </div>
                                        {reg.phoneNumber && (
                                          <div className="text-[11px] text-slate-500 font-semibold">
                                            📞 {reg.phoneNumber}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* 2. Additional Team Members Cards */}
                                    {membersList.map((m: any, mIdx: number) => (
                                      <div key={mIdx} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-bl-xl text-[9px] font-black uppercase tracking-wider border-b border-l border-slate-200">
                                          👤 MEMBER #{mIdx + 2} {m.role ? `• ${m.role}` : ""}
                                        </div>
                                        <div className="space-y-1.5 pt-1">
                                          <div className="font-black text-slate-900 text-xs">
                                            {m.name || `Teammate #${mIdx + 2}`}
                                          </div>
                                          <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-600">
                                            <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-extrabold border border-slate-200">
                                              {m.studentId || m.rollNo || m.registrationNumber || "N/A"}
                                            </span>
                                            <span>{m.branch || reg.branch || "CSE"} {m.section ? `• Sec ${m.section}` : reg.section ? `• Sec ${reg.section}` : ""}</span>
                                          </div>
                                          <div className="text-[11px] text-slate-500 font-semibold truncate pt-1" title={m.email || m.personalEmail}>
                                            ✉️ {m.email || m.personalEmail || "N/A"}
                                          </div>
                                          {(m.phone || m.phoneNumber || reg.phoneNumber) && (
                                            <div className="text-[11px] text-slate-500 font-semibold">
                                              📞 {m.phone || m.phoneNumber || reg.phoneNumber}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3 shadow-xs">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto shadow-inner">
                          <Users className="h-7 w-7" />
                        </div>
                        <h4 className="text-base font-extrabold text-slate-800">No Registrations Found</h4>
                        <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                          {eventAccessSearchQuery
                            ? `No registered teams or members match your search "${eventAccessSearchQuery}".`
                            : `No registration records found in the database for "${eventAccessEvent?.title || "this event"}".`}
                        </p>
                      </div>
                    )
                  ) : (
                    /* ------------------------------------------------------------- */
                    /* MODE 2: ALL INDIVIDUAL MEMBERS FLAT TABLE ROSTER               */
                    /* ------------------------------------------------------------- */
                    filteredIndividualAttendees.length > 0 ? (
                      <div className="border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm bg-white">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                            <thead>
                              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="py-3.5 px-4 w-[6%] text-center">#</th>
                                <th className="py-3.5 px-3 w-[26%]">Student Name & Role</th>
                                <th className="py-3.5 px-3 w-[16%]">Roll No.</th>
                                <th className="py-3.5 px-3 w-[20%]">Team / Group</th>
                                <th className="py-3.5 px-3 w-[20%]">Contact Details</th>
                                <th className="py-3.5 px-3 w-[12%]">Branch</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredIndividualAttendees.map((attendee, idx) => (
                                <tr key={attendee.id || idx} className="hover:bg-blue-50/30 transition-colors">
                                  {/* # */}
                                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-400 text-[11px]">
                                    {String(idx + 1).padStart(2, "0")}
                                  </td>

                                  {/* Student Name & Role */}
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0 ${
                                        attendee.isLead
                                          ? "bg-blue-600 text-white shadow-xs"
                                          : attendee.isGroup
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-slate-100 text-slate-700"
                                      }`}>
                                        {attendee.name ? attendee.name.charAt(0).toUpperCase() : "?"}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="font-extrabold text-slate-900 text-xs block truncate max-w-[170px]">
                                          {attendee.name}
                                        </span>
                                        <span className={`text-[9px] font-black uppercase block mt-0.5 ${
                                          attendee.isLead ? "text-blue-700" : attendee.isGroup ? "text-purple-700" : "text-slate-500"
                                        }`}>
                                          {attendee.isLead ? "👑 Team Lead" : attendee.role || "Member"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Student Roll ID */}
                                  <td className="py-3 px-3">
                                    <span className="font-mono font-extrabold text-slate-800 bg-slate-100/90 px-2 py-0.5 rounded-lg text-[11px] border border-slate-200/80 inline-block">
                                      {attendee.studentId || "N/A"}
                                    </span>
                                  </td>

                                  {/* Team Name */}
                                  <td className="py-3 px-3">
                                    <div className="min-w-0">
                                      <span className="font-bold text-slate-800 text-xs block truncate max-w-[150px]">
                                        {attendee.isGroup ? attendee.groupName : "Individual RSVP"}
                                      </span>
                                      <span className={`text-[9px] font-extrabold block uppercase mt-0.5 ${attendee.isGroup ? "text-purple-600" : "text-sky-600"}`}>
                                        {attendee.isGroup ? "Team Entry" : "Solo RSVP"}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Contact Details */}
                                  <td className="py-3 px-3 space-y-0.5">
                                    <span className="font-bold text-slate-700 text-xs block truncate max-w-[160px]" title={attendee.email}>
                                      {attendee.email || "N/A"}
                                    </span>
                                    {attendee.phone && (
                                      <span className="text-[10px] text-slate-400 font-semibold block">
                                        {attendee.phone}
                                      </span>
                                    )}
                                  </td>

                                  {/* Branch & Sec */}
                                  <td className="py-3 px-3 font-bold text-slate-700">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-extrabold border border-slate-200/60 inline-block">
                                      {attendee.branch || "CSE"} {attendee.section ? `• ${attendee.section}` : ""}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3 shadow-xs">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto shadow-inner">
                          <Users className="h-7 w-7" />
                        </div>
                        <h4 className="text-base font-extrabold text-slate-800">No Members Match Filter</h4>
                        <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                          Try clearing or changing your search criteria or status filter.
                        </p>
                      </div>
                    )
                  )}
                </div>

                {/* RIGHT COLUMN: LOGIN ACCESS SIDEBAR CARD (Span 4) */}
                <div className="lg:col-span-4 space-y-6">

                  {/* 🔑 LOGIN ACCESS CARD */}
                  <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-5 text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-[#2563EB] border border-blue-100/80 flex items-center justify-center font-bold shadow-2xs">
                          <Key className="h-5.5 w-5.5 text-[#2563EB]" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 tracking-tight">
                            Login Access
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Authentication Control</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">
                        TEAM AUTH
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Grant team portal authentication credentials, generate passkeys, and send instant login access links to confirmed team leads and members.
                    </p>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Target Event</span>
                        <span className="font-extrabold text-slate-800 truncate max-w-[150px]">{eventAccessEvent?.title || "Active Event"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Registered</span>
                        <span className="font-extrabold text-blue-600">{eventAccessRegistrations.length} Teams</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Confirmed Teams</span>
                        <span className="font-extrabold text-indigo-600">
                          {eventAccessRegistrations.filter(r => String(r.status || "").toLowerCase().trim() === "confirmed").length} / {eventAccessRegistrations.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Access Granted</span>
                        <span className="font-extrabold text-emerald-600">
                          {provisionedTeamIds.length} / {eventAccessRegistrations.filter(r => String(r.status || "").toLowerCase().trim() === "confirmed").length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const confirmedCount = eventAccessRegistrations.filter(r => String(r.status || "").toLowerCase().trim() === "confirmed").length;
                        const pendingCount = Math.max(0, confirmedCount - provisionedTeamIds.length);
                        const isAllGranted = provisionedTeamIds.length >= confirmedCount && confirmedCount > 0;
                        return (
                          <button
                            onClick={handleEnableLoginAccess}
                            disabled={isProvisioningLoginAccess || confirmedCount === 0}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-300 disabled:to-slate-300 text-white font-black rounded-2xl text-xs sm:text-sm transition-all shadow-md shadow-blue-500/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-center leading-snug border border-blue-400/30"
                          >
                            {isProvisioningLoginAccess ? (
                              <>
                                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                                Granting Access...
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-5 w-5" />
                                {isAllGranted ? "Update / Re-grant Login Access" : pendingCount > 0 ? `Allow to Login (${pendingCount} Confirmed)` : "Allow to Login"}
                              </>
                            )}
                          </button>
                        );
                      })()}

                      {provisionedTeamIds.length > 0 && (
                        <button
                          onClick={handleRevokeAllTeamsLoginAccess}
                          disabled={isProvisioningLoginAccess}
                          className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 font-bold rounded-2xl text-xs transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-center"
                        >
                          <Lock className="h-4 w-4 text-red-500" />
                          Revoke All Teams Login Access
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Additional Info Card */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-6 rounded-3xl text-white space-y-3 shadow-md border border-indigo-900/50 text-left">
                    <div className="flex items-center gap-2 text-blue-300">
                      <Lock className="h-4 w-4 text-blue-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider">Secure Team SSO Access</h4>
                    </div>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      All generated team credentials are encrypted. Team leads will receive automated access emails with one-click magic links.
                    </p>
                  </div>

                </div>

              </div>

            </div>
          </div>
        </div>,
        document.body
      )}



      {/* 🚀 MULTI PROBLEM STATEMENTS MANAGEMENT FULL PAGE */}
      {isMultiProblemModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-slate-50 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200">
          <div
            className="bg-white w-full h-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="bg-[#1E3A8A] text-white px-6 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0 shadow-md border-b border-blue-900/50">
              {/* Left: Brand Logo & Title Metadata */}
              <div className="flex items-center gap-3.5 min-w-0">
                <img src="/ai_verse.png" alt="AI Verse Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
                <div className="h-6 w-px bg-white/20 hidden sm:block shrink-0"></div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-100 border border-blue-400/30 shrink-0">
                    PROBLEM STATEMENT SUITE
                  </span>
                  <span className="text-blue-200/50 font-bold text-xs hidden sm:inline">•</span>
                  <span className="text-xs text-blue-200/90 font-bold shrink-0 hidden sm:inline">{problemList.length} Statements Listed</span>
                  <span className="text-blue-200/50 font-bold text-xs hidden sm:inline">•</span>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate max-w-[250px] sm:max-w-md">
                    Manage Problem Statements — {eventAccessEvent?.title || "Hackathon"}
                  </h3>
                </div>
              </div>

              {/* Right: Close Button */}
              <button
                onClick={() => setIsMultiProblemModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center gap-2 transition-all cursor-pointer font-bold text-xs border border-white/20 shadow-xs shrink-0"
              >
                <X className="h-4 w-4" />
                <span>Close Full View</span>
              </button>
            </div>

            {/* Modal Body: Split 2 Columns */}
            <div className="p-6 sm:p-8 lg:p-10 overflow-y-auto flex-1 bg-slate-50/60 pb-24">
              <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left Column: Form to Add/Edit Item (Span 5) */}
                <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold shadow-2xs">
                        <Plus className="w-4.5 h-4.5" />
                      </div>
                      <h4 className="text-base font-black text-slate-900 tracking-tight">
                        {editingPsId ? "Edit Problem Statement" : "Add Problem Statement"}
                      </h4>
                    </div>
                    {editingPsId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPsId(null);
                          setPsCodeInput(`PS-0${problemList.length + 1}`);
                          setPsTitleInput("");
                          setPsTrackInput("");
                          setPsDescInput("");
                          setPsDeliverablesInput("");
                        }}
                        className="text-xs font-extrabold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-xl transition-all"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleAddOrUpdateProblemItem} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="col-span-1 space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Assign to Round</label>
                        <select
                          value={psRoundInput}
                          onChange={(e) => setPsRoundInput(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all cursor-pointer"
                        >
                          <option value="all">All Rounds (General)</option>
                          {(() => {
                            const rounds = eventAccessEvent?.rounds || liveRoundsList || [];
                            if (rounds.length > 0) {
                              return rounds.map((r: any, rIdx: number) => {
                                const rNum = Number(r.roundNumber) || rIdx + 1;
                                return (
                                  <option key={rNum} value={rNum}>
                                    Round {rNum} — {r.name || `Stage ${rNum}`}
                                  </option>
                                );
                              });
                            }
                            return [1, 2, 3].map(n => (
                              <option key={n} value={n}>Round {n}</option>
                            ));
                          })()}
                        </select>
                      </div>
                      <div className="col-span-1 space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">PS Code</label>
                        <input
                          type="text"
                          value={psCodeInput}
                          onChange={(e) => setPsCodeInput(e.target.value)}
                          placeholder="PS-01"
                          className="w-full px-3 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all"
                          required
                        />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Track / Category</label>
                        <input
                          type="text"
                          value={psTrackInput}
                          onChange={(e) => setPsTrackInput(e.target.value)}
                          placeholder="e.g. AI & ML / FinTech"
                          className="w-full px-3 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Problem Title</label>
                      <input
                        type="text"
                        value={psTitleInput}
                        onChange={(e) => setPsTitleInput(e.target.value)}
                        placeholder="e.g. Smart Campus Resource Optimizer"
                        className="w-full px-3 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Detailed Description & Requirements</label>
                      <textarea
                        rows={4}
                        value={psDescInput}
                        onChange={(e) => setPsDescInput(e.target.value)}
                        placeholder="Paste or type detailed description, problem statement background, constraints, requirements, and target users..."
                        className="w-full px-3 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all leading-relaxed whitespace-pre-wrap min-h-[95px] resize-y"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Expected Deliverables (Optional)</label>
                      <input
                        type="text"
                        value={psDeliverablesInput}
                        onChange={(e) => setPsDeliverablesInput(e.target.value)}
                        placeholder="e.g. Working Prototype + SRS Document + Demo Video"
                        className="w-full px-3 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-[#2563EB] to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-1 border border-blue-400/30"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{editingPsId ? "Update Problem Item" : "Add Problem Statement to List"}</span>
                    </button>
                  </form>
                </div>

                {/* Right Column: List of Problem Statements (Span 7) */}
                <div className="lg:col-span-7 space-y-4 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-base font-black text-slate-900 tracking-tight">
                        Listed Problem Statements ({problemList.length})
                      </h4>
                      <span className="px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 font-extrabold text-[10px] border border-blue-100/80 shadow-2xs">
                        Live Roster
                      </span>
                    </div>
                    
                    {/* Round Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setProblemRoundFilter("all")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          problemRoundFilter === "all" ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        All ({problemList.length})
                      </button>
                      {(() => {
                        const rounds = eventAccessEvent?.rounds || liveRoundsList || [];
                        const rList = rounds.length > 0 ? rounds.map((r: any, i: number) => Number(r.roundNumber) || i + 1) : [1, 2, 3];
                        return rList.map((rNum: number) => {
                          const count = problemList.filter(p => String(p.round) === String(rNum)).length;
                          return (
                            <button
                              key={rNum}
                              type="button"
                              onClick={() => setProblemRoundFilter(String(rNum))}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                problemRoundFilter === String(rNum) ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              Round {rNum} ({count})
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {(() => {
                    const filteredPsList = problemList.filter(p => {
                      if (problemRoundFilter === "all") return true;
                      return String(p.round) === String(problemRoundFilter);
                    });

                    if (filteredPsList.length === 0) {
                      return (
                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
                          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center shadow-inner">
                            <Sparkles className="w-7 h-7" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-base font-black text-slate-900">
                              {problemRoundFilter === "all" ? "No Problem Statements Added Yet" : `No Statements Added for Round ${problemRoundFilter}`}
                            </p>
                            <p className="text-xs text-slate-500 max-w-sm font-medium">Use the form on the left to create and assign new problem statements for Round {problemRoundFilter === "all" ? (eventAccessEvent?.currentRound || 1) : problemRoundFilter}.</p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {filteredPsList.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-400/80 transition-all space-y-4 relative group overflow-hidden border-l-4 border-l-[#2563EB]"
                          >
                            {/* Top Meta Bar */}
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="px-3.5 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs shadow-xs tracking-wider">
                                  {item.code || `PS-0${idx + 1}`}
                                </span>
                                <span className="px-3.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-xs border border-slate-200/80">
                                  {item.track || "General Track"}
                                </span>
                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
                                  item.round && item.round !== "all" 
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}>
                                  {item.round && item.round !== "all" ? `Round ${item.round}` : "All Rounds"}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditProblemItem(item)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all cursor-pointer"
                                  title="Edit Problem Statement"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProblemItem(item.id)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all cursor-pointer"
                                  title="Delete Problem Statement"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-lg font-black text-slate-900 tracking-tight">{item.title}</h5>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DETAILED DESCRIPTION</span>
                              </div>
                              <div className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 whitespace-pre-wrap break-words select-text shadow-2xs">
                                {item.description}
                              </div>
                            </div>

                            {/* Deliverables Section */}
                            {item.deliverables && (
                              <div className="px-4.5 py-3 rounded-2xl bg-blue-50/80 border border-blue-100/80 text-xs font-extrabold text-blue-950 flex items-center gap-2.5 shadow-2xs">
                                <span className="text-[#2563EB]">🎯 Deliverables:</span>
                                <span className="text-slate-800 font-semibold">{item.deliverables}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="px-6 sm:px-10 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4 shrink-0 shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-700 font-bold">
                  {problemList.length} statement(s) ready to broadcast to participant dashboards.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMultiProblemModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublishAllProblemStatements}
                  disabled={savingMultiProblems || problemList.length === 0}
                  className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-emerald-400/30"
                >
                  {savingMultiProblems ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <ShieldCheck className="w-4 h-4 text-white" />}
                  <span>Save & Publish All ({problemList.length}) Statements</span>
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* 🏆 LIVE ROUND MANAGEMENT & PARTICIPANT PROMOTION ENGINE (FULL SCREEN) */}
      {isEventRoundsModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-slate-100 text-slate-900 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200">
          
          {/* Sticky Full-Width Dark Blue Top Header Bar */}
          <div className="w-full bg-[#1E3A8A] text-white px-6 sm:px-10 py-4 flex items-center justify-between shadow-xl shrink-0 z-50">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsEventRoundsModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-white/15 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Event</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                  <Trophy className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-cyan-500/30 text-cyan-200 border border-cyan-400/30">
                      PARTICIPANT PROMOTION & ROUNDS
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                      STAGE {liveCurrentRound} OF {liveRoundsList.length} ACTIVE
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-0.5 tracking-tight">
                    Competition Rounds & Participant Promotion Engine
                  </h3>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <div className="text-xs font-black text-white truncate max-w-xs">{eventAccessEvent?.title || "Active Event"}</div>
                <div className="text-[11px] text-blue-200 font-semibold">{eventAccessRegistrations.length} Registered Team(s)</div>
              </div>

              <button
                type="button"
                onClick={() => setIsEventRoundsModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer active:scale-95"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Full-Width Modal Tab Switcher */}
          <div className="bg-white border-b border-slate-200 px-6 sm:px-10 py-3 flex items-center justify-between gap-4 shrink-0 flex-wrap shadow-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoundModalTab("promotion")}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  roundModalTab === "promotion"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>Participant Promotion Engine</span>
                {loadingPromotionMetrics ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    roundModalTab === "promotion" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {promotionRoster.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRoundModalTab("stages")}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  roundModalTab === "stages"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <Layers className="w-4 h-4 text-cyan-300" />
                <span>Round Stages & Schedule</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  roundModalTab === "stages" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {liveRoundsList.length} Stages
                </span>
              </button>
            </div>

            {roundsSuccessMsg && (
              <div className="px-4 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{roundsSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Full Screen Scrollable Body */}
          <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-slate-50">
            <div className="max-w-7xl mx-auto space-y-6">

              {/* ========================================================================= */}
              {/* TAB 1: 🏆 PARTICIPANT PROMOTION ENGINE */}
              {/* ========================================================================= */}
              {roundModalTab === "promotion" && (
                <div className="space-y-6">
                  
                  {/* STEP 1: Stage Transition Selector Card */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-indigo-500/30 shadow-lg space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">
                          STEP 1: SELECT ROUND ADVANCEMENT PATHWAY
                        </span>
                        <h4 className="text-lg font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
                          <span>Promote Qualified Teams</span>
                          <span className="text-indigo-400">Round {promoteFromRound} ➔ Round {promoteToRound}</span>
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 bg-white/10 p-2 rounded-2xl border border-white/15">
                        <div>
                          <label className="block text-[9px] font-black uppercase text-indigo-200 px-1 mb-0.5">From Round</label>
                          <select
                            value={promoteFromRound}
                            onChange={(e) => {
                              const fromNum = Number(e.target.value);
                              setPromoteFromRound(fromNum);
                              if (promoteToRound <= fromNum) {
                                setPromoteToRound(Math.min(liveRoundsList.length, fromNum + 1));
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-900 border border-indigo-400/40 rounded-xl text-xs font-black text-white focus:outline-none cursor-pointer"
                          >
                            {liveRoundsList.map((r) => (
                              <option key={r.roundNumber} value={r.roundNumber}>
                                Round {r.roundNumber}: {getCleanRoundTitle(r.name, r.roundNumber)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="text-indigo-300 font-black text-base pt-3">➔</div>

                        <div>
                          <label className="block text-[9px] font-black uppercase text-indigo-200 px-1 mb-0.5">Target Next Round</label>
                          <select
                            value={promoteToRound}
                            onChange={(e) => setPromoteToRound(Number(e.target.value))}
                            className="px-3 py-1.5 bg-slate-900 border border-emerald-400/40 rounded-xl text-xs font-black text-emerald-300 focus:outline-none cursor-pointer"
                          >
                            {liveRoundsList.map((r) => (
                              <option key={r.roundNumber} value={r.roundNumber} disabled={r.roundNumber <= promoteFromRound}>
                                Round {r.roundNumber}: {getCleanRoundTitle(r.name, r.roundNumber)} {r.roundNumber <= promoteFromRound ? "(Source)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Quick Counts Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-black text-xs">
                          {promotionRoster.filter(t => t.currentTeamRound === promoteFromRound && !t.isEliminated).length}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-300 uppercase block">Active In Round {promoteFromRound}</span>
                          <span className="font-extrabold text-white">Eligible for Assessment</span>
                        </div>
                      </div>

                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-black text-xs">
                          {selectedPromoteRegIds.length}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-300 uppercase block">Selected to Promote</span>
                          <span className="font-extrabold text-emerald-300">Ready for Round {promoteToRound}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-black text-xs">
                          {promotionRoster.filter(t => t.currentTeamRound >= promoteToRound && t.roundStatus === "Qualified").length}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-300 uppercase block">Already Qualified</span>
                          <span className="font-extrabold text-purple-300">In Round {promoteToRound}+</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: Promotion Criteria & Evaluation Source Selector */}
                  <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                        STEP 2: SELECT PROMOTION CRITERIA & SCORING SOURCE
                      </span>
                      <h4 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                        Choose How Participants are Shortlisted
                      </h4>
                    </div>

                    {/* Mode Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* Option 1: Quiz Score */}
                      <button
                        type="button"
                        onClick={() => setPromotionMode("quiz")}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          promotionMode === "quiz"
                            ? "bg-purple-50/80 border-purple-500 shadow-md ring-4 ring-purple-500/10"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                            <HelpCircle className="w-5 h-5" />
                          </div>
                          {promotionMode === "quiz" && (
                            <span className="px-2 py-0.5 bg-purple-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                              ACTIVE MODE
                            </span>
                          )}
                        </div>
                        <div>
                          <h5 className="font-black text-sm text-slate-900">1. Online Quiz Score</h5>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            Filter by test cutoff marks, percentage, or Top N quiz scorers.
                          </p>
                        </div>
                      </button>

                      {/* Option 2: Jury Score */}
                      <button
                        type="button"
                        onClick={() => setPromotionMode("jury")}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          promotionMode === "jury"
                            ? "bg-indigo-50/80 border-indigo-500 shadow-md ring-4 ring-indigo-500/10"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                            <Award className="w-5 h-5" />
                          </div>
                          {promotionMode === "jury" && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                              ACTIVE MODE
                            </span>
                          )}
                        </div>
                        <div>
                          <h5 className="font-black text-sm text-slate-900">2. Jury Submission Score</h5>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            Filter by evaluator scorecards out of 100 or Top N ranked projects.
                          </p>
                        </div>
                      </button>

                      {/* Option 3: Manual Selection */}
                      <button
                        type="button"
                        onClick={() => setPromotionMode("manual")}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          promotionMode === "manual"
                            ? "bg-blue-50/80 border-blue-500 shadow-md ring-4 ring-blue-500/10"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                            <CheckSquare className="w-5 h-5" />
                          </div>
                          {promotionMode === "manual" && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                              ACTIVE MODE
                            </span>
                          )}
                        </div>
                        <div>
                          <h5 className="font-black text-sm text-slate-900">3. Custom / Manual Check</h5>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            Select individual teams manually or use quick bulk filters.
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Mode Specific Controls Form */}
                    {promotionMode === "quiz" && (
                      <div className="bg-purple-50/60 p-4 sm:p-5 rounded-2xl border border-purple-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1 sm:w-1/3">
                            <label className="block text-[10px] font-black uppercase text-purple-900 tracking-wider">
                              Select Target Assessment Quiz
                            </label>
                            <select
                              value={selectedPromotionQuizId}
                              onChange={(e) => setSelectedPromotionQuizId(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            >
                              <option value="all">All Event Quizzes Combined</option>
                              {eventQuizzesList.map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.title} ({q.totalMarks || 50} Marks)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1 sm:w-1/3">
                            <label className="block text-[10px] font-black uppercase text-purple-900 tracking-wider">
                              Qualification Rule
                            </label>
                            <select
                              value={quizCutoffType}
                              onChange={(e) => setQuizCutoffType(e.target.value as any)}
                              className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            >
                              <option value="score">Minimum Cutoff Marks (≥ Score)</option>
                              <option value="percentage">Minimum Percentage (≥ %)</option>
                              <option value="topN">Top N Ranked Scorers</option>
                            </select>
                          </div>

                          <div className="space-y-1 sm:w-1/3">
                            <label className="block text-[10px] font-black uppercase text-purple-900 tracking-wider">
                              {quizCutoffType === "score" 
                                ? `Cutoff Marks (Score ≥ Out of ${eventQuizzesList.find(q => q.id === selectedPromotionQuizId)?.totalMarks || 100})` 
                                : quizCutoffType === "percentage" 
                                  ? "Cutoff Percentage (≥ %)" 
                                  : "Top N Count (Ranks 1 to N)"}
                            </label>
                            {quizCutoffType === "score" ? (
                              <input
                                type="number"
                                min={0}
                                max={eventQuizzesList.find(q => q.id === selectedPromotionQuizId)?.totalMarks || 100}
                                value={quizCutoffScore}
                                onChange={(e) => setQuizCutoffScore(e.target.value === "" ? 0 : Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-black text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g. 25"
                              />
                            ) : quizCutoffType === "percentage" ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={quizCutoffPercentage}
                                onChange={(e) => setQuizCutoffPercentage(e.target.value === "" ? 0 : Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-black text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g. 60"
                              />
                            ) : (
                              <input
                                type="number"
                                min={1}
                                max={promotionRoster.length || 100}
                                value={quizTopNCount}
                                onChange={(e) => setQuizTopNCount(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-black text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g. 15"
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-purple-200/60 text-xs font-bold text-purple-900">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <span>Auto-selected {eligibleTeamIds.length} team(s) meeting Quiz threshold.</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleApplyQuizAutoSelect}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-purple-500/20 flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Apply Quiz Auto-Select</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {promotionMode === "jury" && (
                      <div className="bg-indigo-50/60 p-4 sm:p-5 rounded-2xl border border-indigo-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1 sm:w-1/2">
                            <label className="block text-[10px] font-black uppercase text-indigo-900 tracking-wider">
                              Jury Scorecard Qualification Rule
                            </label>
                            <select
                              value={juryCutoffType}
                              onChange={(e) => setJuryCutoffType(e.target.value as any)}
                              className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="score">Minimum Evaluation Total Marks (Score ≥ X / 100)</option>
                              <option value="topN">Top N Ranked Evaluated Projects</option>
                            </select>
                          </div>

                          <div className="space-y-1 sm:w-1/2">
                            <label className="block text-[10px] font-black uppercase text-indigo-900 tracking-wider">
                              {juryCutoffType === "score" ? "Cutoff Score Out of 100 (≥)" : "Top N Finalists Count"}
                            </label>
                            {juryCutoffType === "score" ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={juryCutoffScore}
                                onChange={(e) => setJuryCutoffScore(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-black text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g. 70"
                              />
                            ) : (
                              <input
                                type="number"
                                min={1}
                                max={promotionRoster.length || 100}
                                value={juryTopNCount}
                                onChange={(e) => setJuryTopNCount(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-black text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g. 10"
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-indigo-200/60 text-xs font-bold text-indigo-900">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <span>Auto-selected {eligibleTeamIds.length} team(s) evaluated by Jury.</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleApplyJuryAutoSelect}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-95 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Apply Jury Auto-Select</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {promotionMode === "manual" && (
                      <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-blue-900">
                        <span className="flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                          <span>Custom selection: check or uncheck individual teams in the table below.</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedPromoteRegIds(promotionRoster.filter(t => t.currentTeamRound === promoteFromRound).map(t => t.id))}
                            className="px-3 py-1 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 cursor-pointer"
                          >
                            Select All In Round {promoteFromRound}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedPromoteRegIds([])}
                            className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-black hover:bg-slate-100 cursor-pointer"
                          >
                            Clear Selection
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* STEP 3: Roster Search & Filter Matrix */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-4 p-5 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Search */}
                      <div className="relative w-full lg:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search team, student ID, email..."
                          value={promotionSearchQuery}
                          onChange={(e) => setPromotionSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Filter Tabs */}
                      <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto">
                        {[
                          { id: "all", label: "All Teams", count: promotionRoster.length },
                          { id: "selected", label: "Selected", count: selectedPromoteRegIds.length },
                          { id: "qualified", label: `In Round ${promoteToRound}+`, count: promotionRoster.filter(t => t.currentTeamRound >= promoteToRound).length },
                          { id: "pending", label: `In Round ${promoteFromRound}`, count: promotionRoster.filter(t => t.currentTeamRound === promoteFromRound && !t.isEliminated).length },
                          { id: "eliminated", label: "Eliminated", count: promotionRoster.filter(t => t.isEliminated).length }
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setPromotionStatusFilter(tab.id as any)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                              promotionStatusFilter === tab.id
                                ? "bg-slate-900 text-white shadow-xs"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">
                              {tab.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Export Shortlist Button */}
                      <button
                        type="button"
                        onClick={handleExportShortlistCSV}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-slate-200 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Shortlist CSV</span>
                      </button>
                    </div>

                    {/* Matrix Table */}
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        {(() => {
                          const filteredRoster = promotionRoster.filter((team) => {
                            const q = promotionSearchQuery.toLowerCase().trim();
                            const matchQuery = !q ||
                              (team.groupName || "").toLowerCase().includes(q) ||
                              (team.teamLeadName || team.name || "").toLowerCase().includes(q) ||
                              (team.teamLeadStudentId || team.studentId || "").toLowerCase().includes(q) ||
                              (team.teamLeadEmail || team.email || "").toLowerCase().includes(q);

                            if (!matchQuery) return false;

                            if (promotionStatusFilter === "selected") return selectedPromoteRegIds.includes(team.id);
                            if (promotionStatusFilter === "qualified") return team.currentTeamRound >= promoteToRound;
                            if (promotionStatusFilter === "pending") return team.currentTeamRound === promoteFromRound && !team.isEliminated;
                            if (promotionStatusFilter === "eliminated") return team.isEliminated;
                            return true;
                          });

                          if (filteredRoster.length === 0) {
                            return (
                              <div className="py-16 text-center text-slate-400 space-y-2 bg-slate-50/50">
                                <Users className="w-8 h-8 mx-auto text-slate-300" />
                                <p className="text-xs font-bold text-slate-600">No teams match your filter or search query.</p>
                              </div>
                            );
                          }

                          const allFilteredSelected = filteredRoster.every((t) => selectedPromoteRegIds.includes(t.id));

                          return (
                            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                              <thead>
                                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                                  <th className="py-4 px-4 w-12 text-center">
                                    <input
                                      type="checkbox"
                                      checked={allFilteredSelected && filteredRoster.length > 0}
                                      onChange={() => {
                                        if (allFilteredSelected) {
                                          const filteredIds = new Set(filteredRoster.map(t => t.id));
                                          setSelectedPromoteRegIds(prev => prev.filter(id => !filteredIds.has(id)));
                                        } else {
                                          const qualifiedIds = filteredRoster
                                            .filter(t => {
                                              if (promotionMode === "quiz") {
                                                if (t.quizScore === null) return false;
                                                if (quizCutoffType === "score") return Number(t.quizScore) >= Number(quizCutoffScore);
                                                if (quizCutoffType === "percentage") return Number(t.quizPercentage ?? 0) >= Number(quizCutoffPercentage);
                                                if (quizCutoffType === "topN") return eligibleTeamIds.includes(t.id);
                                                return false;
                                              }
                                              if (promotionMode === "jury") {
                                                return eligibleTeamIds.includes(t.id);
                                              }
                                              return t.currentTeamRound === promoteFromRound && !t.isEliminated;
                                            })
                                            .map(t => t.id);
                                          setSelectedPromoteRegIds(Array.from(new Set([...selectedPromoteRegIds, ...qualifiedIds])));
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                    />
                                  </th>
                                  <th className="py-4 px-3 w-12 text-center">#</th>
                                  <th className="py-4 px-4">Team & Leader Details</th>
                                  <th className="py-4 px-3 text-center">Deliverables</th>
                                  <th className="py-4 px-3 text-center">Online Quiz</th>
                                  <th className="py-4 px-3 text-center">Jury Score</th>
                                  <th className="py-4 px-3 text-center">Stage & Status</th>
                                  <th className="py-4 px-4 text-right">Quick Action</th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-slate-100 font-sans">
                                {filteredRoster.map((team, idx) => {
                                  const isSelected = selectedPromoteRegIds.includes(team.id);
                                  const isGroup = team.groupName && team.groupName !== "Individual RSVP";
                                  const displayTeamName = isGroup ? team.groupName : (team.teamLeadName || team.name || "Participant");
                                  const isFinalSubmitted = team.submissionStatus === "Submitted" || !!team.submittedAt;

                                  const meetsQuizCutoff = (() => {
                                    if (team.quizScore === null) return false;
                                    if (quizCutoffType === "score") return Number(team.quizScore) >= Number(quizCutoffScore);
                                    if (quizCutoffType === "percentage") return Number(team.quizPercentage ?? 0) >= Number(quizCutoffPercentage);
                                    if (quizCutoffType === "topN") return eligibleTeamIds.includes(team.id);
                                    return false;
                                  })();

                                  return (
                                    <tr
                                      key={team.id || idx}
                                      className={`transition-colors ${
                                        isSelected
                                          ? "bg-indigo-50/50 hover:bg-indigo-50"
                                          : team.isEliminated
                                          ? "bg-slate-50/60 opacity-60 hover:opacity-100"
                                          : "hover:bg-slate-50"
                                      }`}
                                    >
                                      {/* Checkbox */}
                                      <td className="py-4 px-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={promotionMode === "quiz" && !meetsQuizCutoff}
                                          onChange={() => {
                                            if (isSelected) {
                                              setSelectedPromoteRegIds(prev => prev.filter(id => id !== team.id));
                                            } else {
                                              if (promotionMode === "quiz" && !meetsQuizCutoff) {
                                                showAlert({
                                                  title: "Cutoff Not Met",
                                                  message: `Team "${displayTeamName}" scored ${team.quizScore !== null ? `${team.quizScore}/${team.quizMaxScore} (${team.quizPercentage}%)` : "No Quiz"}, which is below the cutoff threshold of ${quizCutoffType === "score" ? `${quizCutoffScore} marks` : `${quizCutoffPercentage}%`}. Only participants with score equal or greater than the cutoff can be selected for promotion.`,
                                                  type: "warning",
                                                  icon: "alert"
                                                });
                                                return;
                                              }
                                              setSelectedPromoteRegIds(prev => [...prev, team.id]);
                                            }
                                          }}
                                          className={`w-4 h-4 rounded text-blue-600 ${
                                            promotionMode === "quiz" && !meetsQuizCutoff ? "cursor-not-allowed opacity-30" : "cursor-pointer"
                                          }`}
                                          title={promotionMode === "quiz" && !meetsQuizCutoff ? `Score below cutoff (${quizCutoffType === "score" ? `${quizCutoffScore} marks` : `${quizCutoffPercentage}%`})` : undefined}
                                        />
                                      </td>

                                      {/* Rank */}
                                      <td className="py-4 px-3 text-center font-mono font-bold text-slate-400 text-xs">
                                        {idx + 1}
                                      </td>

                                      {/* Team Info */}
                                      <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                          <div className={`w-9 h-9 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 shadow-xs border ${
                                            team.currentTeamRound >= promoteToRound
                                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                              : "bg-indigo-100 text-indigo-700 border-indigo-200"
                                          }`}>
                                            {displayTeamName.charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                            <span className="font-black text-slate-900 text-xs block truncate max-w-[200px]" title={displayTeamName}>
                                              {displayTeamName}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                                              Lead: {team.teamLeadName || team.name} • {team.teamLeadStudentId || team.studentId || "ID: N/A"}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-medium truncate block max-w-[200px]">
                                              {team.teamLeadEmail || team.email}
                                            </span>
                                          </div>
                                        </div>
                                      </td>

                                      {/* Deliverables Status */}
                                      <td className="py-4 px-3 text-center">
                                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                                          isFinalSubmitted
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                            : team.problemStatement || team.selectedProblemStatementId
                                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                                            : "bg-slate-100 text-slate-600 border border-slate-200"
                                        }`}>
                                          {isFinalSubmitted ? "✓ Submitted" : (team.problemStatement || team.selectedProblemStatementId) ? "• In Progress" : "Pending"}
                                        </span>
                                      </td>

                                      {/* Quiz Score */}
                                      <td className="py-4 px-3 text-center">
                                        {team.quizScore !== null ? (
                                          <div className="inline-flex flex-col items-center gap-1">
                                            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black inline-flex items-center gap-1.5 border shadow-2xs ${
                                              meetsQuizCutoff
                                                ? "bg-purple-50 text-purple-900 border-purple-200"
                                                : "bg-rose-50 text-rose-900 border-rose-200"
                                            }`}>
                                              <HelpCircle className="w-3 h-3 text-purple-600" />
                                              <span>{team.quizScore}/{team.quizMaxScore}</span>
                                              <span className="text-[9px] text-purple-700 font-extrabold">({team.quizPercentage}%)</span>
                                            </span>
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                              meetsQuizCutoff
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                                : "bg-rose-50 text-rose-700 border border-rose-200/60"
                                            }`}>
                                              {meetsQuizCutoff ? "✓ Qualified" : "Below Cutoff"}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-bold px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
                                            No Quiz
                                          </span>
                                        )}
                                      </td>

                                      {/* Jury Score */}
                                      <td className="py-4 px-3 text-center">
                                        {team.juryScore !== null ? (
                                          <span className="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-black">
                                            {team.juryScore} / 100
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-medium">Not Judged</span>
                                        )}
                                      </td>

                                      {/* Stage & Status */}
                                      <td className="py-4 px-3 text-center">
                                        <div className="space-y-1">
                                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider block ${
                                            team.isEliminated
                                              ? "bg-red-100 text-red-800 border border-red-200"
                                              : team.currentTeamRound >= promoteToRound
                                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                              : "bg-blue-100 text-blue-800 border border-blue-200"
                                          }`}>
                                            {team.isEliminated
                                              ? `Eliminated (R${team.eliminatedInRound || team.currentTeamRound})`
                                              : team.currentTeamRound >= promoteToRound
                                              ? `Qualified (R${team.currentTeamRound})`
                                              : `Round ${team.currentTeamRound}`}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Quick Action Button */}
                                      <td className="py-4 px-4 text-right">
                                        {promotionMode === "quiz" && !meetsQuizCutoff ? (
                                          <span
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed inline-block"
                                            title={`Score below required cutoff (${quizCutoffType === "score" ? `${quizCutoffScore} marks` : `${quizCutoffPercentage}%`})`}
                                          >
                                            Below Cutoff
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (isSelected) {
                                                setSelectedPromoteRegIds(prev => prev.filter(id => id !== team.id));
                                              } else {
                                                setSelectedPromoteRegIds(prev => [...prev, team.id]);
                                              }
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                              isSelected
                                                ? "bg-emerald-600 text-white shadow-xs"
                                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                            }`}
                                          >
                                            {isSelected ? "Selected ✓" : `Promote to R${promoteToRound}`}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR FOR PROMOTION */}
                  <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-2 text-left">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-black text-slate-900">
                          {selectedPromoteRegIds.length} Team(s) Selected for Promotion from Round {promoteFromRound} to Round {promoteToRound}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600 font-bold">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={advanceEventRoundOnPromote}
                            onChange={(e) => setAdvanceEventRoundOnPromote(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span>Advance Event Stage to Round {promoteToRound} automatically</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer select-none text-red-600">
                          <input
                            type="checkbox"
                            checked={markUnselectedAsEliminated}
                            onChange={(e) => setMarkUnselectedAsEliminated(e.target.checked)}
                            className="w-4 h-4 rounded text-red-600"
                          />
                          <span>Mark unselected teams in Round {promoteFromRound} as Eliminated</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEventRoundsModalOpen(false)}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={handleExecuteBatchPromotion}
                        disabled={isExecutingPromotion || selectedPromoteRegIds.length === 0}
                        className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-emerald-400/30"
                      >
                        {isExecutingPromotion ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Trophy className="w-4 h-4 text-amber-300" />
                        )}
                        <span>Promote Selected ({selectedPromoteRegIds.length}) to Round {promoteToRound}</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 2: ⚙️ STAGE DATES & SCHEDULE BREAKDOWN */}
              {/* ========================================================================= */}
              {roundModalTab === "stages" && (
                <div className="space-y-6">
                  
                  {/* Top Quick Controls Bar */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          Current Active Round
                        </label>
                        <select
                          value={liveCurrentRound}
                          onChange={(e) => {
                            const newRoundNum = Number(e.target.value);
                            setLiveCurrentRound(newRoundNum);
                            setLiveRoundsList((prev) =>
                              prev.map((r) => ({
                                ...r,
                                status: r.roundNumber === newRoundNum ? "Active" : r.roundNumber < newRoundNum ? "Completed" : "Upcoming"
                              }))
                            );
                          }}
                          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          {liveRoundsList.map((r) => (
                            <option key={r.roundNumber} value={r.roundNumber}>
                              Round {r.roundNumber}: {getCleanRoundTitle(r.name, r.roundNumber)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          Total Rounds
                        </label>
                        <span className="px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-700 inline-block">
                          {liveRoundsList.length} Stages Configured
                        </span>
                      </div>
                    </div>

                    {liveCurrentRound < liveRoundsList.length && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextRoundNum = liveCurrentRound + 1;
                          setLiveCurrentRound(nextRoundNum);
                          setLiveRoundsList((prev) =>
                            prev.map((r) => ({
                              ...r,
                              status: r.roundNumber === nextRoundNum ? "Active" : r.roundNumber < nextRoundNum ? "Completed" : "Upcoming"
                            }))
                          );
                        }}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <span>Advance to Round {liveCurrentRound + 1}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Rounds List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">
                        Configured Stage Breakdown & Deadlines
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const nextNum = liveRoundsList.length + 1;
                          setLiveRoundsList((prev) => [
                            ...prev,
                            {
                              roundNumber: nextNum,
                              name: `Round ${nextNum}: Stage Title`,
                              type: "Screening",
                              description: "Stage requirements and deliverables evaluation.",
                              startDate: "",
                              endDate: "",
                              startTime: "",
                              endTime: "",
                              status: "Upcoming"
                            }
                          ]);
                          setLiveTotalRounds(nextNum);
                        }}
                        className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Round</span>
                      </button>
                    </div>

                    {liveRoundsList.map((round, idx) => {
                      const isActive = round.roundNumber === liveCurrentRound;
                      return (
                        <div
                          key={round.roundNumber || idx}
                          className={`p-5 rounded-3xl border transition-all space-y-4 ${
                            isActive
                              ? "bg-white border-blue-500/80 shadow-md ring-4 ring-blue-500/10"
                              : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
                          }`}
                        >
                          {/* Top Round Bar */}
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 flex-wrap">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                                  isActive
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {round.roundNumber}
                              </span>
                              <span className="font-black text-sm text-slate-800">
                                Round {round.roundNumber}: {getCleanRoundTitle(round.name, round.roundNumber)}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  round.status === "Active"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : round.status === "Completed"
                                    ? "bg-slate-100 text-slate-600 border border-slate-200"
                                    : "bg-amber-100 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {round.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setLiveCurrentRound(round.roundNumber);
                                  setLiveRoundsList((prev) =>
                                    prev.map((r) => ({
                                      ...r,
                                      status: r.roundNumber === round.roundNumber ? "Active" : r.roundNumber < round.roundNumber ? "Completed" : "Upcoming"
                                    }))
                                  );
                                }}
                                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                  isActive
                                    ? "bg-blue-50 text-blue-600 border border-blue-200 pointer-events-none"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                }`}
                              >
                                {isActive ? "Currently Active" : "Set as Active Round"}
                              </button>

                              {liveRoundsList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLiveRoundsList((prev) => {
                                      const filtered = prev.filter((_, rIdx) => rIdx !== idx);
                                      return filtered.map((r, newIdx) => ({
                                        ...r,
                                        roundNumber: newIdx + 1
                                      }));
                                    });
                                    setLiveTotalRounds((prev) => Math.max(1, prev - 1));
                                    if (liveCurrentRound > liveRoundsList.length - 1) {
                                      setLiveCurrentRound(Math.max(1, liveRoundsList.length - 1));
                                    }
                                  }}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Delete Round"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inputs Row 1: Name, Type & Status */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-6 space-y-1">
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Round Title / Name
                              </label>
                              <input
                                type="text"
                                value={round.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLiveRoundsList((prev) =>
                                    prev.map((r, rIdx) => (rIdx === idx ? { ...r, name: val } : r))
                                  );
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. Round 1: Screening & Idea Submission"
                              />
                            </div>

                            <div className="sm:col-span-3 space-y-1">
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Stage Type
                              </label>
                              <input
                                type="text"
                                value={round.type}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLiveRoundsList((prev) =>
                                    prev.map((r, rIdx) => (rIdx === idx ? { ...r, type: val } : r))
                                  );
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. Screening / Quiz / Finals"
                              />
                            </div>

                            <div className="sm:col-span-3 space-y-1">
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Status
                              </label>
                              <select
                                value={round.status}
                                onChange={(e) => {
                                  const val = e.target.value as "Active" | "Upcoming" | "Completed";
                                  setLiveRoundsList((prev) =>
                                    prev.map((r, rIdx) => (rIdx === idx ? { ...r, status: val } : r))
                                  );
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="Active">Active</option>
                                <option value="Upcoming">Upcoming</option>
                                <option value="Completed">Completed</option>
                              </select>
                            </div>
                          </div>

                          {/* Inputs Row 2: Start Date, End Date, Start Time, End Time */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Start Date
                              </label>
                              <DatePicker
                                value={round.startDate || ""}
                                onChange={(val) => {
                                  setLiveRoundsList((prev) =>
                                    prev.map((r, rIdx) => (rIdx === idx ? { ...r, startDate: val } : r))
                                  );
                                }}
                                placeholder="Start date"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Start Time
                              </label>
                              <TimePicker
                                value={round.startTime || ""}
                                onChange={(val) => {
                                  setLiveRoundsList((prev) =>
                                    prev.map((r, rIdx) => (rIdx === idx ? { ...r, startTime: val } : r))
                                  );
                                }}
                                placeholder="Start time"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                End Date
                              </label>
                              <DatePicker
                                value={round.endDate || ""}
                                onChange={(val) => {
                                  setLiveRoundsList((prev) =>
                                    prev.map((r, rIdx) => (rIdx === idx ? { ...r, endDate: val } : r))
                                  );
                                }}
                                placeholder="End date"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                End Time
                              </label>
                              <TimePicker
                                value={round.endTime || ""}
                                onChange={(val) => {
                                  setLiveRoundsList((prev) =>
                                    prev.map((r, rIdx) => (rIdx === idx ? { ...r, endTime: val } : r))
                                  );
                                }}
                                placeholder="End time"
                              />
                            </div>
                          </div>

                          {/* Inputs Row 3: Description */}
                          <div className="space-y-1">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Stage Description & Deliverables Note
                            </label>
                            <textarea
                              rows={2}
                              value={round.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLiveRoundsList((prev) =>
                                  prev.map((r, rIdx) => (rIdx === idx ? { ...r, description: val } : r))
                                );
                              }}
                              placeholder="Provide details on submissions, judging rubrics, or expected milestones for this stage..."
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Modal Footer for Stages */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{liveRoundsList.length} Stages Configured • Stage {liveCurrentRound} Active</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsEventRoundsModalOpen(false)}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveLiveEventRounds}
                        disabled={savingLiveRounds}
                        className="px-7 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-cyan-400/30"
                      >
                        {savingLiveRounds ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <ShieldCheck className="w-4 h-4 text-white" />}
                        <span>Save & Update Event Rounds</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>
        </div>,
        document.body
      )}

      {/* 📄 TEAM SUBMISSIONS MONITOR FULL PAGE MODAL */}
      {isSubmissionsModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-slate-100 text-slate-900 overflow-y-auto flex flex-col w-screen h-screen animate-in fade-in duration-200">

          {/* Sticky Full-Width Dark Blue Top Header Bar */}
          <div className="w-full bg-[#1E3A8A] text-white px-6 sm:px-10 py-5 flex items-center justify-between shadow-xl sticky top-0 z-50 shrink-0">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsSubmissionsModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-white/15 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Event Access</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  SUBMISSIONS MATRIX MONITOR
                </span>
                <span className="text-white/40 text-sm hidden sm:inline">•</span>
                <span className="text-sm font-black text-blue-100 truncate max-w-xs sm:max-w-md">
                  {eventAccessEvent?.title || "Active Hackathon Event"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {(() => {
                const cR = eventAccessEvent?.currentRound || 1;
                const viewR = matrixViewRound > 0 ? matrixViewRound : cR;
                const viewRPrefix = `r${viewR}_`;
                const isSubForViewRound = (r: any) => (r as any)[`${viewRPrefix}submissionStatus`] === "Submitted" || !!(r as any)[`${viewRPrefix}submittedAt`] || (r.submissionRound === viewR && (r.submissionStatus === "Submitted" || !!r.submittedAt));
                const isDraftForViewRound = (r: any) => !isSubForViewRound(r) && !!((r as any)[`${viewRPrefix}problemStatement`] || (r.submissionRound === viewR && r.problemStatement));
                const countSubmitted = eventAccessRegistrations.filter(isSubForViewRound).length;
                const countDrafts = eventAccessRegistrations.filter(isDraftForViewRound).length;

                return (
                  <div className="hidden md:flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/15 text-xs font-black">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {countSubmitted} Final Submitted
                    </span>
                    <span className="text-white/30">|</span>
                    <span className="text-amber-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {countDrafts} Drafts
                    </span>
                    <span className="text-white/30">|</span>
                    <span className="text-slate-200">Total: {eventAccessRegistrations.length} Teams</span>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleExportSubmissionsCsv}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-white/20 shadow-xs"
                title="Export all submission records as CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSubmissionsModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer shadow-xs"
                title="Close Full Page"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Full Page Main Body Wrapper */}
          <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-8 flex-1 space-y-6 flex flex-col">

            {/* Filter Tabs & Search Header Toolbar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4 shrink-0">
              {/* Filter Tabs & Round Info */}
              <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setSubmissionsFilter("All")}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${submissionsFilter === "All"
                      ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                >
                  <span>All Teams</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${submissionsFilter === "All" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700 font-black"
                    }`}>
                    {eventAccessRegistrations.length}
                  </span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-4 h-4 rounded-full bg-indigo-200/50 flex items-center justify-center text-indigo-600 font-black text-[10px]">i</span>
                  <span className="opacity-70 font-semibold uppercase tracking-wider text-[10px] mr-1">View Round:</span>
                  <select
                    value={matrixViewRound}
                    onChange={(e) => setMatrixViewRound(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs font-black text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm min-w-[160px]"
                  >
                    <option value={0}>
                      {(() => {
                        const cR = eventAccessEvent?.currentRound || 1;
                        const activeR = (eventAccessEvent?.rounds || []).find((r: any) => r.roundNumber === cR);
                        const typeName = activeR?.type || eventAccessEvent?.stageType || "Hackathon";
                        return `Round ${cR} — ${typeName} (Current)`;
                      })()}
                    </option>
                    {(() => {
                      const cR = eventAccessEvent?.currentRound || 1;
                      const rounds = eventAccessEvent?.rounds || [];
                      const pastOptions: any[] = [];
                      for (let r = 1; r < cR; r++) {
                        const roundDef = rounds.find((rd: any) => rd.roundNumber === r);
                        const roundTypeName = roundDef?.type || `Round ${r}`;
                        pastOptions.push(
                          <option key={r} value={r}>
                            Round {r} — {roundTypeName} (Past)
                          </option>
                        );
                      }
                      return pastOptions;
                    })()}
                  </select>
                </div>
              </div>

              {/* Legend & Search */}
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-slate-700">
                  <span className="text-[10px] font-black uppercase text-slate-400">Legend:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black">✓</span>
                    <span className="text-emerald-700 font-extrabold text-xs">Green = Submitted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-black">•</span>
                    <span className="text-blue-700 font-extrabold text-xs">Blue = In-Progress</span>
                  </div>
                </div>

                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search team, student ID, problem statement..."
                    value={submissionsSearchQuery}
                    onChange={(e) => setSubmissionsSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
            </div>

            {/* Submissions Roster Matrix Table Container */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex-1 flex flex-col">
              {(() => {
                const cR = eventAccessEvent?.currentRound || 1;
                // If viewing a past round, use that round's type. Otherwise use current round's type.
                const viewRound = matrixViewRound > 0 ? matrixViewRound : cR;
                const activeR = (eventAccessEvent?.rounds || []).find((r: any) => r.roundNumber === viewRound);
                const currentMatrixStageType = activeR?.type || eventAccessEvent?.stageType;
                const isIdeationRound = currentMatrixStageType === "Ideation & Video Submission" || currentMatrixStageType === "Ideation" || currentMatrixStageType === "Video Submission";
                const viewRPrefix = `r${viewRound}_`;

                const isRegSubmittedForRound = (reg: any) => (reg as any)[`${viewRPrefix}submissionStatus`] === "Submitted" || !!(reg as any)[`${viewRPrefix}submittedAt`] || (reg.submissionRound === viewRound && (reg.submissionStatus === "Submitted" || !!reg.submittedAt));
                const isRegDraftForRound = (reg: any) => !isRegSubmittedForRound(reg) && !!((reg as any)[`${viewRPrefix}problemStatement`] || (reg.submissionRound === viewRound && reg.problemStatement));
                const isRegPendingForRound = (reg: any) => !isRegSubmittedForRound(reg) && !isRegDraftForRound(reg);

                const filteredList = eventAccessRegistrations.filter((reg) => {
                  const matchSearch = !submissionsSearchQuery ||
                    (reg.groupName || "").toLowerCase().includes(submissionsSearchQuery.toLowerCase()) ||
                    (reg.teamLeadName || reg.name || "").toLowerCase().includes(submissionsSearchQuery.toLowerCase()) ||
                    (reg.problemStatement || "").toLowerCase().includes(submissionsSearchQuery.toLowerCase()) ||
                    (reg.teamLeadStudentId || reg.studentId || "").toLowerCase().includes(submissionsSearchQuery.toLowerCase());

                  const isSubmitted = isRegSubmittedForRound(reg);
                  const isDraft = isRegDraftForRound(reg);
                  const isPending = isRegPendingForRound(reg);

                  if (submissionsFilter === "Submitted") return matchSearch && isSubmitted;
                  if (submissionsFilter === "Draft") return matchSearch && isDraft;
                  if (submissionsFilter === "Pending") return matchSearch && isPending;
                  return matchSearch;
                });

                if (filteredList.length === 0) {
                  return (
                    <div className="py-24 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 p-8 space-y-3 m-8">
                      <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                      <h4 className="text-sm font-extrabold text-slate-800">No Submissions Found</h4>
                      <p className="text-xs text-slate-400 font-medium">No team submissions match your filter or search query.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto w-full flex-1">
                    <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                      <thead>
                        {/* Upper Squares Column Headers */}
                        <tr className="bg-slate-900 text-white text-left">
                          <th className="py-5 px-6 font-black uppercase text-[11px] tracking-wider w-[260px] border-b border-slate-800 bg-slate-950">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-blue-400" />
                              <span>Team Name</span>
                            </div>
                          </th>

                          {/* Column 1 Square */}
                          <th className="py-4 px-3 border-b border-slate-800 text-center w-[12%]">
                            {(() => {
                              const isLocked = !!eventAccessEvent?.lockedSteps?.[1];
                              const stepName = isIdeationRound ? "Ideation Description" : "Problem Statement";
                              return (
                                <button
                                  type="button"
                                  onClick={() => setStepLockTarget({ stepId: 1, name: stepName })}
                                  className={`p-3 rounded-2xl border space-y-1 shadow-inner inline-block w-full text-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                    isLocked 
                                      ? "bg-amber-950/90 border-amber-500/90 ring-2 ring-amber-500/30" 
                                      : "bg-slate-800/90 border-slate-700/80 hover:border-slate-500"
                                  }`}
                                  title={isLocked ? "Step 1 is LOCKED. Click to Unlock for participants." : "Click to LOCK Step 1 for participants."}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">STEP 1</span>
                                    <Lock className={`w-3 h-3 ${isLocked ? "text-amber-400" : "text-slate-500 opacity-50"}`} />
                                  </div>
                                  <span className="text-xs font-black text-white block truncate">{stepName}</span>
                                  <span className={`text-[9px] font-extrabold uppercase tracking-widest block ${isLocked ? "text-amber-400" : "text-slate-400"}`}>
                                    {isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED"}
                                  </span>
                                </button>
                              );
                            })()}
                          </th>

                          {/* Column 2 Square */}
                          <th className="py-4 px-3 border-b border-slate-800 text-center w-[12%]">
                            {(() => {
                              const isLocked = !!eventAccessEvent?.lockedSteps?.[2];
                              const stepName = isIdeationRound ? "Video Submission" : "SRS Submission";
                              return (
                                <button
                                  type="button"
                                  onClick={() => setStepLockTarget({ stepId: 2, name: stepName })}
                                  className={`p-3 rounded-2xl border space-y-1 shadow-inner inline-block w-full text-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                    isLocked 
                                      ? "bg-amber-950/90 border-amber-500/90 ring-2 ring-amber-500/30" 
                                      : "bg-slate-800/90 border-slate-700/80 hover:border-slate-500"
                                  }`}
                                  title={isLocked ? "Step 2 is LOCKED. Click to Unlock for participants." : "Click to LOCK Step 2 for participants."}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">STEP 2</span>
                                    <Lock className={`w-3 h-3 ${isLocked ? "text-amber-400" : "text-slate-500 opacity-50"}`} />
                                  </div>
                                  <span className="text-xs font-black text-white block truncate">{stepName}</span>
                                  <span className={`text-[9px] font-extrabold uppercase tracking-widest block ${isLocked ? "text-amber-400" : "text-slate-400"}`}>
                                    {isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED"}
                                  </span>
                                </button>
                              );
                            })()}
                          </th>

                          {!isIdeationRound && (
                            <>
                              {/* Column 3 Square */}
                              <th className="py-4 px-3 border-b border-slate-800 text-center w-[12%]">
                                {(() => {
                                  const isLocked = !!eventAccessEvent?.lockedSteps?.[3];
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setStepLockTarget({ stepId: 3, name: "PPT Submission" })}
                                      className={`p-3 rounded-2xl border space-y-1 shadow-inner inline-block w-full text-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                        isLocked 
                                          ? "bg-amber-950/90 border-amber-500/90 ring-2 ring-amber-500/30" 
                                          : "bg-slate-800/90 border-slate-700/80 hover:border-slate-500"
                                      }`}
                                      title={isLocked ? "Step 3 is LOCKED. Click to Unlock for participants." : "Click to LOCK Step 3 for participants."}
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] font-black uppercase text-pink-400 tracking-wider">STEP 3</span>
                                        <Lock className={`w-3 h-3 ${isLocked ? "text-amber-400" : "text-slate-500 opacity-50"}`} />
                                      </div>
                                      <span className="text-xs font-black text-white block truncate">PPT Submission</span>
                                      <span className={`text-[9px] font-extrabold uppercase tracking-widest block ${isLocked ? "text-amber-400" : "text-slate-400"}`}>
                                        {isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED"}
                                      </span>
                                    </button>
                                  );
                                })()}
                              </th>

                              {/* Column 4 Square */}
                              <th className="py-4 px-3 border-b border-slate-800 text-center w-[12%]">
                                {(() => {
                                  const isLocked = !!eventAccessEvent?.lockedSteps?.[4];
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setStepLockTarget({ stepId: 4, name: "Key Features" })}
                                      className={`p-3 rounded-2xl border space-y-1 shadow-inner inline-block w-full text-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                        isLocked 
                                          ? "bg-amber-950/90 border-amber-500/90 ring-2 ring-amber-500/30" 
                                          : "bg-slate-800/90 border-slate-700/80 hover:border-slate-500"
                                      }`}
                                      title={isLocked ? "Step 4 is LOCKED. Click to Unlock for participants." : "Click to LOCK Step 4 for participants."}
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">STEP 4</span>
                                        <Lock className={`w-3 h-3 ${isLocked ? "text-amber-400" : "text-slate-500 opacity-50"}`} />
                                      </div>
                                      <span className="text-xs font-black text-white block truncate">Key Features</span>
                                      <span className={`text-[9px] font-extrabold uppercase tracking-widest block ${isLocked ? "text-amber-400" : "text-slate-400"}`}>
                                        {isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED"}
                                      </span>
                                    </button>
                                  );
                                })()}
                              </th>

                              {/* Column 5 Square */}
                              <th className="py-4 px-3 border-b border-slate-800 text-center w-[12%]">
                                {(() => {
                                  const isLocked = !!eventAccessEvent?.lockedSteps?.[5];
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setStepLockTarget({ stepId: 5, name: "Repo URL" })}
                                      className={`p-3 rounded-2xl border space-y-1 shadow-inner inline-block w-full text-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                        isLocked 
                                          ? "bg-amber-950/90 border-amber-500/90 ring-2 ring-amber-500/30" 
                                          : "bg-slate-800/90 border-slate-700/80 hover:border-slate-500"
                                      }`}
                                      title={isLocked ? "Step 5 is LOCKED. Click to Unlock for participants." : "Click to LOCK Step 5 for participants."}
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider">STEP 5</span>
                                        <Lock className={`w-3 h-3 ${isLocked ? "text-amber-400" : "text-slate-500 opacity-50"}`} />
                                      </div>
                                      <span className="text-xs font-black text-white block truncate">Repo URL</span>
                                      <span className={`text-[9px] font-extrabold uppercase tracking-widest block ${isLocked ? "text-amber-400" : "text-slate-400"}`}>
                                        {isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED"}
                                      </span>
                                    </button>
                                  );
                                })()}
                              </th>

                              {/* Column 6 Square */}
                              <th className="py-4 px-3 border-b border-slate-800 text-center w-[12%]">
                                {(() => {
                                  const isLocked = !!eventAccessEvent?.lockedSteps?.[6];
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setStepLockTarget({ stepId: 6, name: "Prototype & Video" })}
                                      className={`p-3 rounded-2xl border space-y-1 shadow-inner inline-block w-full text-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                        isLocked 
                                          ? "bg-amber-950/90 border-amber-500/90 ring-2 ring-amber-500/30" 
                                          : "bg-slate-800/90 border-slate-700/80 hover:border-slate-500"
                                      }`}
                                      title={isLocked ? "Step 6 is LOCKED. Click to Unlock for participants." : "Click to LOCK Step 6 for participants."}
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">STEP 6</span>
                                        <Lock className={`w-3 h-3 ${isLocked ? "text-amber-400" : "text-slate-500 opacity-50"}`} />
                                      </div>
                                      <span className="text-xs font-black text-white block truncate">Prototype & Video</span>
                                      <span className={`text-[9px] font-extrabold uppercase tracking-widest block ${isLocked ? "text-amber-400" : "text-slate-400"}`}>
                                        {isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED"}
                                      </span>
                                    </button>
                                  );
                                })()}
                              </th>
                            </>
                          )}

                          {/* Action Column */}
                          <th className="py-4 px-6 border-b border-slate-800 text-right w-[120px]">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Inspect</span>
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 font-sans">
                        {filteredList.map((reg, idx) => {
                          const isGroup = reg.groupName && reg.groupName !== "Individual RSVP";
                          const displayTeamName = isGroup ? reg.groupName : (reg.teamLeadName || reg.name || "Individual Participant");

                          // Determine which data fields to read based on matrixViewRound
                          const viewingPastRound = matrixViewRound > 0;
                          const targetMatrixRound = viewingPastRound ? matrixViewRound : (eventAccessEvent?.currentRound || 1);
                          const rPrefix = `r${targetMatrixRound}_`;

                          // Helper to get field value: isolated per round
                          const getField = (fieldName: string) => {
                            if (viewingPastRound || targetMatrixRound > 1) {
                              const roundVal = (reg as any)[`${rPrefix}${fieldName}`];
                              if (roundVal !== undefined && roundVal !== "") return roundVal;
                              if (reg.submissionRound === targetMatrixRound) {
                                return (reg as any)[fieldName] || "";
                              }
                              return "";
                            }
                            return (reg as any)[`${rPrefix}${fieldName}`] || (reg as any)[fieldName] || "";
                          };

                          const isSubmittedForThisRound = (reg as any)[`${rPrefix}submissionStatus`] === "Submitted" || 
                            !!(reg as any)[`${rPrefix}submittedAt`] || 
                            (reg.submissionRound === targetMatrixRound && (reg.submissionStatus === "Submitted" || !!reg.submittedAt));

                          // Step Completion Conditions (round-aware)
                          const step1Completed = !!getField("problemStatement") || !!getField("selectedProblemStatementId") || (targetMatrixRound === 1 && (reg.isPsSaved || reg.isPsLocked));
                          const step2Completed = isIdeationRound ? !!getField("demoVideoUrl") : (!!getField("srsFileName") || !!getField("srsFileUrl"));
                          const step3Completed = !!getField("presentationFileName") || !!getField("presentationUrl");
                          const step4Completed = !!getField("keyFeatures");
                          const step5Completed = !!getField("repoUrl") || !!getField("githubUrl");
                          const step6Completed = (!!getField("demoVideoUrl") && (!!getField("presentationUrl") || !isIdeationRound)) || isSubmittedForThisRound;

                          const psDisplayLabel = getField("selectedProblemStatementId") || (step1Completed ? (isIdeationRound ? "Description Done" : "PS Saved") : "Pending");

                          return (
                            <tr key={reg.id || idx} className="hover:bg-blue-50/40 transition-colors group">
                              {/* Left Side Rectangle: Team Name */}
                              <td className="py-5 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center shrink-0 shadow-xs border border-indigo-200">
                                    {displayTeamName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="text-left">
                                    <span className="font-extrabold text-slate-900 text-sm block truncate max-w-[190px]" title={displayTeamName}>
                                      {displayTeamName}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                                      {isGroup ? `Lead: ${reg.teamLeadName || reg.name}` : "Individual"} • {reg.teamLeadStudentId || reg.studentId || "N/A"}
                                    </span>
                                  </div>
                                </div>
                              </td>

                          {/* Step 1 Node */}
                              <td className="py-5 px-3 text-center relative overflow-visible">
                                <div className="flex items-center justify-center relative w-full">
                                  {/* Seamless Connecting Line right */}
                                  <div className={`absolute left-1/2 right-[-50%] top-1/2 -translate-y-1/2 h-1.5 z-0 ${step1Completed && step2Completed ? 'bg-emerald-500 shadow-xs' : 'bg-blue-300'}`} />

                                  {/* Node Circle 1 */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTeamSubmission(reg)}
                                    title={step1Completed ? (isIdeationRound ? "Step 1 Completed: Description Saved" : `Step 1 Completed: ${psDisplayLabel}`) : "Step 1 In Progress / Pending"}
                                    className={`w-11 h-11 rounded-full relative z-10 flex items-center justify-center font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border-2 ${step1Completed
                                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-100'
                                        : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40 ring-4 ring-blue-100'
                                      }`}
                                  >
                                    {step1Completed ? <Check className="w-6 h-6 stroke-[3]" /> : "1"}
                                  </button>
                                </div>
                                <span className="text-[10px] font-extrabold block mt-2 truncate max-w-[140px] mx-auto text-slate-700">
                                  {psDisplayLabel}
                                </span>
                              </td>

                              {/* Step 2 Node */}
                              <td className="py-5 px-3 text-center relative overflow-visible">
                                <div className="flex items-center justify-center relative w-full">
                                  {/* Seamless Connecting Line across left & right */}
                                  <div className={`absolute left-[-50%] ${isIdeationRound ? 'right-1/2' : 'right-[-50%]'} top-1/2 -translate-y-1/2 h-1.5 z-0 ${isIdeationRound ? (step2Completed ? 'bg-emerald-500 shadow-xs' : (step1Completed && step2Completed ? 'bg-emerald-500 shadow-xs' : 'bg-blue-300')) : (step2Completed && step3Completed ? 'bg-emerald-500 shadow-xs' : (step1Completed && step2Completed ? 'bg-emerald-500 shadow-xs' : 'bg-blue-300'))}`} />

                                  {/* Node Circle 2 */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTeamSubmission(reg)}
                                    title={step2Completed ? (isIdeationRound ? "Step 2 Completed: Video URL Saved" : "Step 2 Completed: SRS Uploaded") : "Step 2 In Progress / Pending"}
                                    className={`w-11 h-11 rounded-full relative z-10 flex items-center justify-center font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border-2 ${step2Completed
                                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-100'
                                        : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40 ring-4 ring-blue-100'
                                      }`}
                                  >
                                    {step2Completed ? <Check className="w-6 h-6 stroke-[3]" /> : "2"}
                                  </button>
                                </div>
                                <span className="text-[10px] font-extrabold block mt-2 truncate max-w-[140px] mx-auto text-slate-700">
                                  {isIdeationRound ? (step2Completed ? "Video Done" : "Video Pending") : (step2Completed ? "SRS Done" : "SRS Pending")}
                                </span>
                              </td>

                              {!isIdeationRound && (
                                <>
                                  {/* Step 3 Node */}
                                  <td className="py-5 px-3 text-center relative overflow-visible">
                                    <div className="flex items-center justify-center relative w-full">
                                      <div className={`absolute left-[-50%] right-[-50%] top-1/2 -translate-y-1/2 h-1.5 z-0 ${step3Completed && step4Completed ? 'bg-emerald-500 shadow-xs' : (step2Completed && step3Completed ? 'bg-emerald-500 shadow-xs' : 'bg-blue-300')}`} />

                                      <button
                                        type="button"
                                        onClick={() => setSelectedTeamSubmission(reg)}
                                        title={step3Completed ? "Step 3 Completed: PPT Uploaded" : "Step 3 In Progress / Pending"}
                                        className={`w-11 h-11 rounded-full relative z-10 flex items-center justify-center font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border-2 ${step3Completed
                                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-100'
                                            : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40 ring-4 ring-blue-100'
                                          }`}
                                      >
                                        {step3Completed ? <Check className="w-6 h-6 stroke-[3]" /> : "3"}
                                      </button>
                                    </div>
                                    <span className="text-[10px] font-extrabold block mt-2 truncate max-w-[140px] mx-auto text-slate-700">
                                      {step3Completed ? "PPT Done" : "PPT Pending"}
                                    </span>
                                  </td>

                                  {/* Step 4 Node */}
                                  <td className="py-5 px-3 text-center relative overflow-visible">
                                    <div className="flex items-center justify-center relative w-full">
                                      <div className={`absolute left-[-50%] right-[-50%] top-1/2 -translate-y-1/2 h-1.5 z-0 ${step4Completed && step5Completed ? 'bg-emerald-500 shadow-xs' : (step3Completed && step4Completed ? 'bg-emerald-500 shadow-xs' : 'bg-blue-300')}`} />

                                      <button
                                        type="button"
                                        onClick={() => setSelectedTeamSubmission(reg)}
                                        title={step4Completed ? "Step 4 Completed: Key Features Saved" : "Step 4 In Progress / Pending"}
                                        className={`w-11 h-11 rounded-full relative z-10 flex items-center justify-center font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border-2 ${step4Completed
                                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-100'
                                            : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40 ring-4 ring-blue-100'
                                          }`}
                                      >
                                        {step4Completed ? <Check className="w-6 h-6 stroke-[3]" /> : "4"}
                                      </button>
                                    </div>
                                    <span className="text-[10px] font-extrabold block mt-2 truncate max-w-[140px] mx-auto text-slate-700">
                                      {step4Completed ? "Features Saved" : "Features Pending"}
                                    </span>
                                  </td>

                                  {/* Step 5 Node */}
                                  <td className="py-5 px-3 text-center relative overflow-visible">
                                    <div className="flex items-center justify-center relative w-full">
                                      <div className={`absolute left-[-50%] right-[-50%] top-1/2 -translate-y-1/2 h-1.5 z-0 ${step5Completed && step6Completed ? 'bg-emerald-500 shadow-xs' : (step4Completed && step5Completed ? 'bg-emerald-500 shadow-xs' : 'bg-blue-300')}`} />

                                      <button
                                        type="button"
                                        onClick={() => setSelectedTeamSubmission(reg)}
                                        title={step5Completed ? "Step 5 Completed: GitHub Repo Link Saved" : "Step 5 In Progress / Pending"}
                                        className={`w-11 h-11 rounded-full relative z-10 flex items-center justify-center font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border-2 ${step5Completed
                                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-100'
                                            : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40 ring-4 ring-blue-100'
                                          }`}
                                      >
                                        {step5Completed ? <Check className="w-6 h-6 stroke-[3]" /> : "5"}
                                      </button>
                                    </div>
                                    <span className="text-[10px] font-extrabold block mt-2 truncate max-w-[140px] mx-auto text-slate-700">
                                      {step5Completed ? "Repo Saved" : "Repo Pending"}
                                    </span>
                                  </td>

                                  {/* Step 6 Node (Line extends left to center) */}
                                  <td className="py-5 px-3 text-center relative overflow-visible">
                                    <div className="flex items-center justify-center relative w-full">
                                      {/* Seamless Connecting Line left */}
                                      <div className={`absolute left-[-50%] right-1/2 top-1/2 -translate-y-1/2 h-1.5 z-0 ${step6Completed ? 'bg-emerald-500 shadow-xs' : (step5Completed && step6Completed ? 'bg-emerald-500 shadow-xs' : 'bg-blue-300')}`} />

                                      {/* Node Circle 6 */}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedTeamSubmission(reg)}
                                        title={step6Completed ? "Step 6 Completed: Prototype & Demo Video Submitted" : "Step 6 In Progress / Pending"}
                                        className={`w-11 h-11 rounded-full relative z-10 flex items-center justify-center font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border-2 ${step6Completed
                                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-100'
                                            : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40 ring-4 ring-blue-100'
                                          }`}
                                      >
                                        {step6Completed ? <Check className="w-6 h-6 stroke-[3]" /> : "6"}
                                      </button>
                                    </div>
                                    <span className="text-[10px] font-extrabold block mt-2 truncate max-w-[140px] mx-auto text-slate-700">
                                      {step6Completed ? "Final Submitted" : "Prototype/Video"}
                                    </span>
                                  </td>
                                </>
                              )}

                              {/* Action Column */}
                              <td className="py-5 px-6 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTeamSubmission(reg)}
                                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs border border-indigo-200/60"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Inspect</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Bottom Footer Bar */}
            <div className="p-4 sm:px-6 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-xs shrink-0">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                Showing matrix status for {eventAccessRegistrations.length} registered hackathon team(s)
              </span>
              <button
                type="button"
                onClick={() => setIsSubmissionsModalOpen(false)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                Close Full Page
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* 🔍 INDIVIDUAL TEAM SUBMISSION DETAIL DRAWER */}
      {selectedTeamSubmission && createPortal(
        <div className="fixed inset-0 z-[99999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-white max-w-2xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95 duration-200 text-left relative max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const cR = eventAccessEvent?.currentRound || 1;
              const effectiveRound = matrixViewRound > 0 ? matrixViewRound : cR;
              const rP = `r${effectiveRound}_`;
              const getDField = (k: string) => {
                if (effectiveRound > 1) {
                  return (selectedTeamSubmission as any)[`${rP}${k}`] || (selectedTeamSubmission.submissionRound === effectiveRound ? (selectedTeamSubmission as any)[k] : "") || "";
                }
                return (selectedTeamSubmission as any)[`${rP}${k}`] || (selectedTeamSubmission as any)[k] || "";
              };

              const dSelectedPsId = getDField("selectedProblemStatementId");
              const dSelectedPsObj = (selectedTeamSubmission as any)[`${rP}selectedProblemStatement`] || 
                (selectedTeamSubmission.submissionRound === effectiveRound ? selectedTeamSubmission.selectedProblemStatement : null) || 
                (effectiveRound === 1 ? selectedTeamSubmission.selectedProblemStatement : null);

              // If obj is not directly present, lookup from event's configured problem statements
              const eventPsMatch = (eventAccessEvent?.problemStatements || []).find((p: any) => p.id === dSelectedPsId || p.code === dSelectedPsId);
              const activePs = dSelectedPsObj || eventPsMatch;

              const dProblemStatement = getDField("problemStatement");
              const dKeyFeatures = getDField("keyFeatures");
              const dSrsFileName = getDField("srsFileName");
              const dPresentationFileName = getDField("presentationFileName");
              const dGithubUrl = getDField("repoUrl") || getDField("githubUrl");
              const dPrototypeUrl = getDField("prototypeUrl");
              const dDemoVideoUrl = getDField("demoVideoUrl");

              return (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 font-black text-lg flex items-center justify-center shrink-0 shadow-sm">
                        {(selectedTeamSubmission.groupName || selectedTeamSubmission.teamLeadName || selectedTeamSubmission.name || "T").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-black text-slate-900 tracking-tight">
                            {selectedTeamSubmission.groupName || selectedTeamSubmission.teamLeadName || selectedTeamSubmission.name || "Team Submission"}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                            Round {effectiveRound} Deliverables
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Lead: {selectedTeamSubmission.teamLeadName || selectedTeamSubmission.name} • Contact: {selectedTeamSubmission.teamLeadEmail || selectedTeamSubmission.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedTeamSubmission(null)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Round Switcher Tabs (for multi-round events) */}
                  {cR > 1 && (
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2 shrink-0">Inspect Stage:</span>
                      {Array.from({ length: cR }, (_, i) => i + 1).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setMatrixViewRound(r === cR ? 0 : r)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                            effectiveRound === r
                              ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Round {r} {r === cR ? "(Current)" : "(Past)"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Problem Statement Card */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Problem Statement & Requirements</span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Round {effectiveRound}
                        </span>
                      </div>
                      {activePs?.track && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                          {activePs.track}
                        </span>
                      )}
                    </div>
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed space-y-1.5">
                      {activePs?.title ? (
                        <>
                          <p className="font-extrabold text-slate-900 text-sm">
                            {activePs.code ? `[${activePs.code}] ` : ""}
                            {activePs.title}
                          </p>
                          <p className="text-slate-600 text-xs">
                            {activePs.description || dProblemStatement}
                          </p>
                        </>
                      ) : (
                        <p>{dProblemStatement || `No problem statement submitted for Round ${effectiveRound} yet.`}</p>
                      )}
                    </div>
                  </div>

                  {/* Key Features */}
                  {dKeyFeatures && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Key Features & Functionalities</span>
                      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-indigo-950 font-medium whitespace-pre-wrap leading-relaxed">
                        {dKeyFeatures}
                      </div>
                    </div>
                  )}

                  {/* Documents & Links Section */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Submission Artifacts & Links</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">1. SRS Document</span>
                        <span className="font-bold text-slate-900 truncate block">{dSrsFileName || "Not Uploaded"}</span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">2. Presentation Deck</span>
                        <span className="font-bold text-slate-900 truncate block">{dPresentationFileName || "Not Uploaded"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold pt-1">
                      {dGithubUrl ? (
                        <a href={dGithubUrl} target="_blank" rel="noreferrer" className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                          <ExternalLink className="w-4 h-4" /> Code Repo
                        </a>
                      ) : (
                        <div className="p-3 bg-slate-100 text-slate-400 rounded-xl text-center">No Repo Link</div>
                      )}

                      {dPrototypeUrl ? (
                        <a href={dPrototypeUrl} target="_blank" rel="noreferrer" className="p-3 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                          <ExternalLink className="w-4 h-4" /> Prototype Link
                        </a>
                      ) : (
                        <div className="p-3 bg-slate-100 text-slate-400 rounded-xl text-center">No Prototype</div>
                      )}

                      {dDemoVideoUrl ? (
                        <a href={dDemoVideoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">
                          <ExternalLink className="w-4 h-4" /> Demo Video
                        </a>
                      ) : (
                        <div className="p-3 bg-slate-100 text-slate-400 rounded-xl text-center">No Video Link</div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              {(selectedTeamSubmission.isPsLocked || selectedTeamSubmission.submissionStatus === "Submitted" || selectedTeamSubmission.submissionLocked) ? (
                <button
                  type="button"
                  onClick={() => handleUnlockSingleTeamSubmission(selectedTeamSubmission.id, selectedTeamSubmission.groupName || selectedTeamSubmission.teamLeadName || "Team")}
                  className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Unlock for Team</span>
                </button>
              ) : (
                <span className="text-[11px] font-bold text-slate-400">Team can edit deliverables</span>
              )}

              <button
                type="button"
                onClick={() => setSelectedTeamSubmission(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🎓 CERTIFICATE & EMAIL DISTRIBUTION FULL PAGE MODAL */}
      {isCertificateModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-slate-100 text-slate-900 overflow-y-auto flex flex-col w-screen h-screen animate-in fade-in duration-200">

          {/* Sticky Full-Width Dark Blue Top Header Bar */}
          <div className="w-full bg-[#1E3A8A] text-white px-6 sm:px-10 py-4 flex items-center justify-between shadow-xl sticky top-0 z-50 shrink-0">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsCertificateModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-white/15 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Event Access</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-200 border border-amber-300/30 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  CERTIFICATES & MAILING HUB
                </span>
                <span className="text-white/40 text-sm hidden sm:inline">•</span>
                <span className="text-sm font-black text-blue-100 truncate max-w-xs sm:max-w-md">
                  {eventAccessEvent?.title || "AI Verse Event"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/15 text-xs font-black">
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {flattenedCertRecipients.filter(r => r.certificateIssued).length} Issued & Sent
                </span>
                <span className="text-white/30">|</span>
                <span className="text-amber-300 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  {flattenedCertRecipients.filter(r => !r.certificateIssued).length} Pending
                </span>
                <span className="text-white/30">|</span>
                <span className="text-slate-200">Total: {flattenedCertRecipients.length} Recipients</span>
              </div>

              <button
                type="button"
                onClick={handleExportCertificateLogsCsv}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-white/20 shadow-xs"
                title="Export all certificate records as CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCertificateModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer shadow-xs"
                title="Close Full Page"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Full Page Main Body */}
          <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-8 flex-1 space-y-6 flex flex-col">

            {/* Success Feedback Toast */}
            {certSuccessToast && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{certSuccessToast}</span>
                </div>
                <button
                  onClick={() => setCertSuccessToast(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-extrabold text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Navigation Tabs Bar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCertTab("distribution")}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                    certTab === "distribution"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Email Distribution Engine</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    certTab === "distribution" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {selectedCertRecipients.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCertTab("studio")}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                    certTab === "studio"
                      ? "bg-gradient-to-r from-amber-600 to-indigo-600 text-white shadow-md shadow-amber-500/20"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Certificate Studio & Templates</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCertTab("logs")}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                    certTab === "logs"
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Issuance Logs</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
                    {flattenedCertRecipients.filter(r => r.certificateIssued).length}
                  </span>
                </button>
              </div>

              {/* Quick Preset Selector */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Award Type:</span>
                <select
                  value={certType}
                  onChange={(e) => setCertType(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="Certificate of Participation">Certificate of Participation</option>
                  <option value="Certificate of Merit">Certificate of Merit (Winners)</option>
                  <option value="Certificate of Excellence">Certificate of Excellence</option>
                  <option value="Certificate of Appreciation">Certificate of Appreciation</option>
                </select>
              </div>
            </div>

            {/* TAB 1: MAIL DISTRIBUTION ENGINE */}
            {certTab === "distribution" && (
              <div className="space-y-6 flex-1 flex flex-col">

                {/* Filter Toolbar & Actions */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
                  {/* Audience Filter Select Option Dropdown */}
                  <div className="flex items-center gap-2 w-full lg:w-auto">
                    <div className="relative w-full sm:w-80">
                      <select
                        value={certAudienceFilter}
                        onChange={(e) => setCertAudienceFilter(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer transition-all appearance-none"
                      >
                        <option value="all">
                          👥 All Round 1 Participants ({flattenedCertRecipients.length})
                        </option>
                        <option value="promoted_r2">
                          🏆 Promoted to Round 2 ({flattenedCertRecipients.filter(r => (r.currentRound || 1) >= 2 || r.isPromoted).length})
                        </option>
                        <option value="all_r2">
                          👥 All Round 2 Participants ({flattenedCertRecipients.filter(r => (r.currentRound || 1) >= 2).length})
                        </option>
                        <option value="promoted_r3">
                          🏆 Promoted to Round 3 ({flattenedCertRecipients.filter(r => (r.currentRound || 1) >= 3 || ((r.currentRound || 1) === 2 && r.roundStatus === "Qualified")).length})
                        </option>
                        <option value="all_r3">
                          👥 All Round 3 Participants ({flattenedCertRecipients.filter(r => (r.currentRound || 1) >= 3).length})
                        </option>
                        <option value="winners">
                          ✨ Winners / Finals ({flattenedCertRecipients.filter(r => r.isWinner).length})
                        </option>
                        <option value="attended">
                          👤 Attended ({flattenedCertRecipients.filter(r => r.attendanceMarked).length})
                        </option>
                        <option value="submitted">
                          📄 Submitted ({flattenedCertRecipients.filter(r => r.submissionStatus === "Submitted").length})
                        </option>
                        <option value="unsent">
                          ⏳ Unsent Only ({flattenedCertRecipients.filter(r => !r.certificateIssued).length})
                        </option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Search and Bulk Dispatch CTA */}
                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={certSearchQuery}
                        onChange={(e) => setCertSearchQuery(e.target.value)}
                        placeholder="Search student, roll, team..."
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSendCertificatesBatch}
                      disabled={selectedCertRecipients.length === 0 || isSendingCertificates}
                      className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/20 whitespace-nowrap shrink-0"
                    >
                      {isSendingCertificates ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>
                        {isSendingCertificates ? "Dispatching..." : `Send to Selected (${selectedCertRecipients.length})`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Live Dispatch Progress Banner */}
                {isSendingCertificates && certSendingProgress && (
                  <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-3xl shadow-xl border border-blue-700/50 space-y-3 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-blue-300 animate-spin" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">
                            Dispatching Certificate {certSendingProgress.current} of {certSendingProgress.total}...
                          </h4>
                          <p className="text-xs text-blue-200">
                            Recipient: <strong className="text-white">{certSendingProgress.currentName}</strong> ({certSendingProgress.currentEmail})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-black">
                        <span className="text-emerald-400">✓ {certSendingProgress.successCount} Success</span>
                        {certSendingProgress.failCount > 0 && (
                          <span className="text-red-400">✗ {certSendingProgress.failCount} Failed</span>
                        )}
                        <span className="text-blue-200">
                          {Math.round((certSendingProgress.current / certSendingProgress.total) * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/30 h-2.5 rounded-full overflow-hidden p-0.5">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-blue-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(certSendingProgress.current / certSendingProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Recipients Table */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex-1 flex flex-col">
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleToggleSelectAllCertRecipients}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                        <span>
                          {filteredCertRecipients.every(r => selectedCertRecipients.includes(r.key)) ? "Deselect Filtered" : "Select All Filtered"}
                        </span>
                      </button>
                      <span className="text-xs font-bold text-slate-500">
                        Showing {filteredCertRecipients.length} participants ({selectedCertRecipients.length} selected)
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-500 hidden sm:block">
                      Email template: <span className="text-blue-600 font-extrabold">{certType}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto flex-1 max-h-[600px]">
                    <table className="w-full text-left text-xs text-slate-600 border-collapse">
                      <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="py-3.5 px-4 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={filteredCertRecipients.length > 0 && filteredCertRecipients.every(r => selectedCertRecipients.includes(r.key))}
                              onChange={handleToggleSelectAllCertRecipients}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </th>
                          <th className="py-3.5 px-4">Participant & ID</th>
                          <th className="py-3.5 px-4">Team / Role</th>
                          <th className="py-3.5 px-4">Email Address</th>
                          <th className="py-3.5 px-4">Stage / Status</th>
                          <th className="py-3.5 px-4">Certificate Status</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredCertRecipients.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-12 text-slate-400">
                              <Award className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                              <p className="font-bold text-sm text-slate-600">No participants found</p>
                              <p className="text-xs text-slate-400 mt-0.5">Try clearing filters or search queries.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredCertRecipients.map((recipient) => {
                            const isSelected = selectedCertRecipients.includes(recipient.key);
                            return (
                              <tr
                                key={recipient.key}
                                onClick={() => handleToggleSelectCertRecipient(recipient.key)}
                                className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                                  isSelected ? "bg-blue-50/30" : ""
                                }`}
                              >
                                <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectCertRecipient(recipient.key)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>

                                <td className="py-4 px-4">
                                  <div className="font-bold text-slate-900 text-sm">{recipient.name}</div>
                                  <div className="text-[11px] font-mono text-slate-400">
                                    {recipient.studentId || "Student"}
                                  </div>
                                </td>

                                <td className="py-4 px-4">
                                  <div className="font-bold text-slate-800">
                                    {recipient.teamName || "Individual Entry"}
                                  </div>
                                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    recipient.isLead ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {recipient.isLead ? "Team Lead" : "Member"}
                                  </span>
                                </td>

                                <td className="py-4 px-4 font-mono text-slate-700 text-xs">
                                  {recipient.email}
                                </td>

                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                                      Round {recipient.currentRound}
                                    </span>
                                    {recipient.isPromoted && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">
                                        Qualified
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-4 px-4">
                                  {recipient.certificateIssued ? (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Issued & Sent
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 w-fit">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      Pending
                                    </span>
                                  )}
                                </td>

                                <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-2">
                                    <a
                                      href={`/certificate/${recipient.certificateId}?name=${encodeURIComponent(recipient.name)}&event=${encodeURIComponent(eventAccessEvent?.title || "Event")}&type=${encodeURIComponent(certType)}&college=${encodeURIComponent(certCollegeName)}&date=${encodeURIComponent(certIssueDate)}&studentId=${encodeURIComponent(recipient.studentId)}&team=${encodeURIComponent(recipient.teamName)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded-xl transition-all font-bold text-xs flex items-center gap-1"
                                      title="Open verified certificate preview in new tab"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Preview</span>
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: CERTIFICATE STUDIO & DESIGN CUSTOMIZER */}
            {certTab === "studio" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 text-left">

                {/* Left Form: Certificate Parameters & Custom Template Uploader */}
                <div className="lg:col-span-6 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 text-left overflow-y-auto max-h-[800px] relative">
                  
                  {/* Sticky Header & Save Action */}
                  <div className="sticky top-0 bg-white/95 backdrop-blur-md z-20 pb-4 border-b border-slate-100 space-y-3 pt-1 -mx-2 px-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                          <Award className="w-5 h-5 text-blue-600" />
                          <span>Certificate Studio & Templates</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Upload custom Canva/Photoshop certificate templates & customize text positioning.</p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveCertificateTemplateConfig}
                        disabled={isSavingCertTemplate}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                        title="Save template & text coordinates"
                      >
                        {isSavingCertTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                        <span>{isSavingCertTemplate ? "Saving..." : "Save Template"}</span>
                      </button>
                    </div>

                    {certTemplateSaveSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{certTemplateSaveSuccess}</span>
                      </div>
                    )}
                  </div>

                  {/* 🖼️ TEMPLATE UPLOAD DROPZONE */}
                  <div className="space-y-4 p-4 rounded-2xl bg-blue-50/40 border border-blue-100/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Upload className="w-4 h-4 text-blue-600" />
                        <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                          Upload Certificate Template Image
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadBlankTemplateGuide}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Download a 2000x1414 PNG canvas template guide"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download Canva Guide (PNG)</span>
                      </button>
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={certFileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleCertTemplateUpload}
                      className="hidden"
                    />

                    {certCustomTemplateUrl ? (
                      <div className="bg-white p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs flex items-center gap-4">
                        <img
                          src={certCustomTemplateUrl}
                          alt="Uploaded Template Preview"
                          className="w-20 h-14 object-cover rounded-xl border border-slate-200 shadow-inner shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 truncate">
                            {certCustomTemplateFilename || "custom_certificate_template.png"}
                          </p>
                          <span className="inline-block mt-0.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            ✓ Template Active
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => certFileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveCertTemplate}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer"
                            title="Remove uploaded template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => certFileInputRef.current?.click()}
                        className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-white hover:bg-blue-50/50 transition-all space-y-2 group shadow-2xs"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mx-auto text-blue-600 transition-transform group-hover:scale-110 shadow-inner">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-slate-800">
                            Click to select or drag & drop certificate background template
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Supports PNG, JPG, JPEG, WEBP • Recommended resolution: 2000 × 1414 px
                          </p>
                        </div>
                        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100/70 text-blue-700">
                          Browse Files
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 🎚️ 1. PARTICIPANT NAME PLACEHOLDER */}
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                      <span className="font-extrabold text-blue-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                        <span>1. Participant Name Placeholder</span>
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                        Required
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      {/* Name Position Y Slider */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-bold text-slate-700">
                            Vertical Position (Y-Axis)
                          </label>
                          <span className="font-mono font-black text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                            {certNamePosY}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={85}
                          value={certNamePosY}
                          onChange={(e) => setCertNamePosY(Number(e.target.value))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>

                      {/* Name Font Size Slider */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-bold text-slate-700">
                            Font Size
                          </label>
                          <span className="font-mono font-black text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                            {certNameFontSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={24}
                          max={96}
                          value={certNameFontSize}
                          onChange={(e) => setCertNameFontSize(Number(e.target.value))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>

                      {/* Name Color Swatches */}
                      <div>
                        <label className="font-bold text-slate-700 block mb-1.5">
                          Font Color
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {[
                            { label: "Navy Blue", value: "#1E3A8A" },
                            { label: "Deep Black", value: "#000000" },
                            { label: "Royal Gold", value: "#D97706" },
                            { label: "Charcoal", value: "#1E293B" },
                            { label: "Crimson", value: "#991B1B" },
                            { label: "White", value: "#FFFFFF" },
                          ].map((swatch) => (
                            <button
                              key={swatch.value}
                              type="button"
                              onClick={() => setCertNameColor(swatch.value)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                certNameColor === swatch.value
                                  ? "border-blue-600 bg-blue-100/70 text-blue-900 ring-1 ring-blue-500"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: swatch.value }}
                              />
                              <span>{swatch.label}</span>
                            </button>
                          ))}
                          <input
                            type="color"
                            value={certNameColor}
                            onChange={(e) => setCertNameColor(e.target.value)}
                            className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                            title="Custom Hex Color"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 🎚️ 2. TEAM NAME PLACEHOLDER */}
                  <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200/80 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                      <span className="font-extrabold text-indigo-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>2. Team Name Placeholder</span>
                      </span>
                      <label className="flex items-center gap-1.5 font-bold text-xs text-indigo-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={certShowTeamName}
                          onChange={(e) => setCertShowTeamName(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>Enable</span>
                      </label>
                    </div>

                    {certShowTeamName && (
                      <div className="space-y-3 text-xs">
                        {/* Team Position Y Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-700">
                              Vertical Position (Y-Axis)
                            </label>
                            <span className="font-mono font-black text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                              {certTeamPosY}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={15}
                            max={85}
                            value={certTeamPosY}
                            onChange={(e) => setCertTeamPosY(Number(e.target.value))}
                            className="w-full accent-indigo-600 cursor-pointer"
                          />
                        </div>

                        {/* Team Font Size Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-700">
                              Font Size
                            </label>
                            <span className="font-mono font-black text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                              {certTeamFontSize}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={16}
                            max={64}
                            value={certTeamFontSize}
                            onChange={(e) => setCertTeamFontSize(Number(e.target.value))}
                            className="w-full accent-indigo-600 cursor-pointer"
                          />
                        </div>

                        {/* Team Color Swatches */}
                        <div>
                          <label className="font-bold text-slate-700 block mb-1.5">
                            Font Color
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {[
                              { label: "Navy Blue", value: "#1E3A8A" },
                              { label: "Deep Black", value: "#000000" },
                              { label: "Royal Gold", value: "#D97706" },
                              { label: "Charcoal", value: "#1E293B" },
                              { label: "Crimson", value: "#991B1B" },
                              { label: "White", value: "#FFFFFF" },
                            ].map((swatch) => (
                              <button
                                key={swatch.value}
                                type="button"
                                onClick={() => setCertTeamColor(swatch.value)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  certTeamColor === swatch.value
                                    ? "border-indigo-600 bg-indigo-100 text-indigo-900 ring-1 ring-indigo-500"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                  style={{ backgroundColor: swatch.value }}
                                />
                                <span>{swatch.label}</span>
                              </button>
                            ))}
                            <input
                              type="color"
                              value={certTeamColor}
                              onChange={(e) => setCertTeamColor(e.target.value)}
                              className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                              title="Custom Hex Color"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 🎚️ 3. ROLL NO / STUDENT ID PLACEHOLDER */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                        <span>3. Roll No / Student ID Placeholder</span>
                      </span>
                      <label className="flex items-center gap-1.5 font-bold text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={certShowRollNo}
                          onChange={(e) => setCertShowRollNo(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Enable</span>
                      </label>
                    </div>

                    {certShowRollNo && (
                      <div className="space-y-3 text-xs">
                        {/* Roll Position Y Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-700">
                              Vertical Position (Y-Axis)
                            </label>
                            <span className="font-mono font-black text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {certRollPosY}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={15}
                            max={85}
                            value={certRollPosY}
                            onChange={(e) => setCertRollPosY(Number(e.target.value))}
                            className="w-full accent-slate-600 cursor-pointer"
                          />
                        </div>

                        {/* Roll Font Size Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-700">
                              Font Size
                            </label>
                            <span className="font-mono font-black text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {certRollFontSize}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={12}
                            max={48}
                            value={certRollFontSize}
                            onChange={(e) => setCertRollFontSize(Number(e.target.value))}
                            className="w-full accent-slate-600 cursor-pointer"
                          />
                        </div>

                        {/* Roll Color Swatches */}
                        <div>
                          <label className="font-bold text-slate-700 block mb-1.5">
                            Font Color
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {[
                              { label: "Slate Gray", value: "#475569" },
                              { label: "Deep Black", value: "#000000" },
                              { label: "Navy Blue", value: "#1E3A8A" },
                              { label: "Charcoal", value: "#1E293B" },
                              { label: "White", value: "#FFFFFF" },
                            ].map((swatch) => (
                              <button
                                key={swatch.value}
                                type="button"
                                onClick={() => setCertRollColor(swatch.value)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  certRollColor === swatch.value
                                    ? "border-slate-700 bg-slate-200/70 text-slate-900 ring-1 ring-slate-600"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                  style={{ backgroundColor: swatch.value }}
                                />
                                <span>{swatch.label}</span>
                              </button>
                            ))}
                            <input
                              type="color"
                              value={certRollColor}
                              onChange={(e) => setCertRollColor(e.target.value)}
                              className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                              title="Custom Hex Color"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Certificate Information & Footer Option */}
                  <div className="space-y-4 text-xs">
                    {/* Award Title & Issue Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] block mb-1.5">
                          Award Title
                        </label>
                        <input
                          type="text"
                          value={certType}
                          onChange={(e) => setCertType(e.target.value)}
                          placeholder="Certificate of Participation"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] block mb-1.5">
                          Issue Date
                        </label>
                        <input
                          type="text"
                          value={certIssueDate}
                          onChange={(e) => setCertIssueDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs text-xs"
                        />
                      </div>
                    </div>

                    {/* Footer Verification Toggle */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={certShowQrCode}
                          onChange={(e) => setCertShowQrCode(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-slate-800">Render Bottom Verification ID Bar</span>
                      </label>
                    </div>
                  </div>

                  {/* 💾 PRIMARY SAVE TEMPLATE ACTION CARD */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50/40 to-slate-50 border-2 border-blue-200/90 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Save Certificate Template & Layout</span>
                      </div>
                      <span className="text-[10px] font-black tracking-wider uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        Permanent Sync
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveCertificateTemplateConfig}
                      disabled={isSavingCertTemplate}
                      className="w-full py-3 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
                    >
                      {isSavingCertTemplate ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Template Configuration...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Save Template & Position Settings</span>
                        </>
                      )}
                    </button>

                    {certTemplateSaveSuccess && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{certTemplateSaveSuccess}</span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 text-center">
                      Saves template image and all participant & team coordinates permanently for this event.
                    </p>
                  </div>

                  {/* Test Email Dispatch Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>Send Test Certificate Email</span>
                    </div>

                    {testEmailFeedback && (
                      <div className={`p-2.5 rounded-xl text-xs font-bold ${
                        testEmailFeedback.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}>
                        {testEmailFeedback.message}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={testCertEmail}
                        onChange={(e) => setTestCertEmail(e.target.value)}
                        placeholder="your-email@vishnu.edu.in"
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSendTestCertificate}
                        disabled={isSendingTestEmail}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {isSendingTestEmail ? "Sending..." : "Send Test"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Certificate Canvas Preview */}
                <div className="lg:col-span-6 flex flex-col space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Live Certificate Preview</h3>
                      <p className="text-xs text-slate-500">
                        {certCustomTemplateUrl ? "Live text overlays rendered on your uploaded template" : "Upload a template image on the left to view preview"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveCertificateTemplateConfig}
                        disabled={isSavingCertTemplate}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                      >
                        {isSavingCertTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                        <span>{isSavingCertTemplate ? "Saving..." : "Save Template"}</span>
                      </button>

                      {certCustomTemplateUrl && (
                        <button
                          type="button"
                          onClick={handleDownloadSampleCertificatePng}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Sample PNG</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Empty State when no custom template is uploaded */}
                  {!certCustomTemplateUrl ? (
                    <div 
                      onClick={() => certFileInputRef.current?.click()}
                      className="w-full bg-slate-50/80 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-8 sm:p-14 text-center min-h-[460px] flex flex-col items-center justify-center space-y-4 transition-all cursor-pointer group shadow-2xs"
                    >
                      <div className="w-16 h-16 rounded-3xl bg-blue-100/80 group-hover:bg-blue-200 text-blue-700 flex items-center justify-center transition-all group-hover:scale-110 shadow-sm">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5 max-w-md">
                        <h4 className="text-base font-black text-slate-800 group-hover:text-blue-700 transition-colors">
                          No Certificate Template Uploaded
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Upload your event's Canva, Photoshop, or college template image on the left. The live participant name and team details will appear directly on top of your background.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <span className="px-5 py-2.5 bg-blue-600 group-hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-blue-500/20">
                          Select Template Image
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadBlankTemplateGuide();
                          }}
                          className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs shadow-2xs cursor-pointer"
                        >
                          Download Canva Guide
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Real-Time Live Preview over Custom Template Background */
                    <div 
                      className="w-full bg-white text-slate-900 rounded-3xl shadow-xl relative overflow-hidden select-none border-2 border-slate-200/90 aspect-[2000/1414] min-h-[440px]"
                      style={{
                        backgroundImage: `url(${certCustomTemplateUrl})`,
                        backgroundSize: "100% 100%",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat"
                      }}
                    >
                      {/* Dynamic Participant Name Positioned by Slider */}
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 text-center w-full px-6 pointer-events-none transition-all duration-75"
                        style={{
                          top: `${certNamePosY}%`,
                          transform: "translate(-50%, -50%)"
                        }}
                      >
                        <h3 
                          className="font-black font-serif underline decoration-blue-600/60 underline-offset-6 transition-all inline-block"
                          style={{
                            color: certNameColor || "#0F172A",
                            fontSize: `${Math.max(18, Math.min(42, certNameFontSize * 0.52))}px`
                          }}
                        >
                          Sample Participant Name
                        </h3>
                      </div>

                      {/* Optional Roll No / Student ID Positioned by Slider */}
                      {certShowRollNo && (
                        <div 
                          className="absolute left-1/2 -translate-x-1/2 text-center w-full px-6 pointer-events-none transition-all duration-75"
                          style={{
                            top: `${certRollPosY}%`,
                            transform: "translate(-50%, -50%)"
                          }}
                        >
                          <p 
                            className="font-mono font-bold transition-all inline-block tracking-wider"
                            style={{
                              color: certRollColor || "#475569",
                              fontSize: `${Math.max(10, Math.min(22, certRollFontSize * 0.52))}px`
                            }}
                          >
                            Roll: 23PA1A0501
                          </p>
                        </div>
                      )}

                      {/* Optional Team Name Positioned by Slider */}
                      {certShowTeamName && (
                        <div 
                          className="absolute left-1/2 -translate-x-1/2 text-center w-full px-6 pointer-events-none transition-all duration-75"
                          style={{
                            top: `${certTeamPosY}%`,
                            transform: "translate(-50%, -50%)"
                          }}
                        >
                          <h4 
                            className="font-black font-sans tracking-wide transition-all inline-block"
                            style={{
                              color: certTeamColor || "#1E3A8A",
                              fontSize: `${Math.max(12, Math.min(32, certTeamFontSize * 0.52))}px`
                            }}
                          >
                            CodeCrafters
                          </h4>
                        </div>
                      )}

                      {/* Optional Verification Bar */}
                      {certShowQrCode && (
                        <div className="absolute bottom-2 left-0 right-0 text-center text-[8px] text-slate-400 font-mono pointer-events-none">
                          Certificate ID: AIV-SAMPLE-2026 • Issue Date: {certIssueDate} • Verify at: aiversevitb.in/certificate
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: ISSUED LOGS & VERIFICATION HISTORY */}
            {certTab === "logs" && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Certificate Issuance & Verification Logs</h3>
                    <p className="text-xs text-slate-500">Live directory of all certificates dispatched for this event.</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCertificateLogsCsv}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto flex-1 max-h-[550px] border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs text-slate-600 border-collapse">
                    <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Certificate ID</th>
                        <th className="py-3 px-4">Participant Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Award Title</th>
                        <th className="py-3 px-4">Issued Timestamp</th>
                        <th className="py-3 px-4 text-right">Verification Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {flattenedCertRecipients.filter(r => r.certificateIssued).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400">
                            <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                            <p className="font-bold text-sm text-slate-600">No certificates issued yet</p>
                            <p className="text-xs text-slate-400 mt-0.5">Switch to "Email Distribution Engine" to dispatch certificates.</p>
                          </td>
                        </tr>
                      ) : (
                        flattenedCertRecipients.filter(r => r.certificateIssued).map((r, idx) => (
                          <tr key={r.key} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 px-4 text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{r.certificateId}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">{r.name}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">{r.email}</td>
                            <td className="py-3.5 px-4 font-bold text-indigo-700">{r.certificateType || certType}</td>
                            <td className="py-3.5 px-4 text-slate-500">
                              {r.certificateSentAt ? new Date(r.certificateSentAt).toLocaleString() : "Issued"}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <a
                                href={`/certificate/${r.certificateId}?name=${encodeURIComponent(r.name)}&event=${encodeURIComponent(eventAccessEvent?.title || "Event")}&type=${encodeURIComponent(certType)}&college=${encodeURIComponent(certCollegeName)}&date=${encodeURIComponent(certIssueDate)}&studentId=${encodeURIComponent(r.studentId)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg text-xs transition-all inline-flex items-center gap-1"
                              >
                                <span>Verify Online</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}

      {/* Step Lock Modal */}
      {stepLockTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                eventAccessEvent?.lockedSteps?.[stepLockTarget.stepId] 
                  ? "bg-emerald-50 text-emerald-600" 
                  : "bg-amber-50 text-amber-600"
              }`}>
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {eventAccessEvent?.lockedSteps?.[stepLockTarget.stepId] ? "Unlock Step Block" : "Lock Step Block"}
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  Step {stepLockTarget.stepId}: {stepLockTarget.name}
                </p>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              {eventAccessEvent?.lockedSteps?.[stepLockTarget.stepId] ? (
                <>
                  Are you sure you want to <strong className="text-emerald-600 font-extrabold">UNLOCK Step {stepLockTarget.stepId} ({stepLockTarget.name})</strong> for all participants? Teams will be allowed to upload and update submissions for this step again.
                </>
              ) : (
                <>
                  Are you sure you want to <strong className="text-amber-600 font-extrabold">LOCK Step {stepLockTarget.stepId} ({stepLockTarget.name})</strong> for all participants? Teams will be prevented from uploading or changing their submissions for this step.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStepLockTarget(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStepLockToggle}
                disabled={isLockingStep}
                className={`px-6 py-2.5 font-black text-xs rounded-xl shadow-md text-white transition-all flex items-center gap-2 cursor-pointer ${
                  eventAccessEvent?.lockedSteps?.[stepLockTarget.stepId]
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20"
                }`}
              >
                {isLockingStep ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>
                  {eventAccessEvent?.lockedSteps?.[stepLockTarget.stepId] ? "Confirm Unlock" : "Confirm Lock"}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ LAUNCH CELEBRATION SPLASH WHEN SAVING / LAUNCHING AN EVENT ═══ */}
      <EventLaunchSplash
        isOpen={isLaunchSplashOpen}
        event={launchedEventData}
        onClose={handleCloseLaunchSplash}
        onViewEvent={handleViewLaunchedEvent}
      />
    </div>
  );
};

export default EventManagementPage;
