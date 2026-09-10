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
  updateDoc, 
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
  createRegistration 
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
  Ticket
} from "lucide-react";
import DatePicker from "../../components/ui/DatePicker";
import TimePicker from "../../components/ui/TimePicker";
import MemberSelectCombobox from "../../components/ui/MemberSelectCombobox";
import { sendResendEmail } from "../../utils/resendEmailService";
import { buildRoundPromotionEmail } from "../../utils/emailTemplates";
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
      try {
        setLoadingEvents(true);
        const rawList = await fetchEvents().catch(() => []);
        const list = Array.isArray(rawList) ? rawList : (rawList?.events || rawList?.data || []);
        const mapped = list.map((data: any) => {
          let image = sparkImg;
          if (data.posterPreview) image = data.posterPreview;
          else if (data.imageName === "hackathonImg" || data.category === "HACKATHONS") image = hackathonImg;
          else if (data.imageName === "seminarImg" || data.category === "LECTURES") image = seminarImg;
          return {
            ...data,
            id: data._id || data.id,
            title: data.title || "",
            date: data.date || data.startDate || "",
            location: data.location || data.venue || "",
            category: data.category || "WORKSHOPS",
            status: data.status || "Draft",
            currentReg: Math.max(0, Number(data.currentReg) || 0),
            maxReg: data.maxReg || 100,
            image
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
            if (data.accessGranted || data.loginAccessGranted) {
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
      const evRef = doc(db, "events", eventAccessEvent.id);
      await updateDoc(evRef, {
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

  const handleOpenSubmissionsModal = () => {
    setSubmissionsFilter("All");
    setSubmissionsSearchQuery("");
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
      const regRef = doc(db, "registrations", regId);
      await updateDoc(regRef, {
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

  // Multi-Problem Statements State
  const [isMultiProblemModalOpen, setIsMultiProblemModalOpen] = useState(false);
  const [problemList, setProblemList] = useState<any[]>([]);
  const [editingPsId, setEditingPsId] = useState<string | null>(null);
  const [psCodeInput, setPsCodeInput] = useState("");
  const [psTitleInput, setPsTitleInput] = useState("");
  const [psTrackInput, setPsTrackInput] = useState("");
  const [psDescInput, setPsDescInput] = useState("");
  const [psDeliverablesInput, setPsDeliverablesInput] = useState("");
  const [savingMultiProblems, setSavingMultiProblems] = useState(false);
  const [problemSuccessMsg, setProblemSuccessMsg] = useState<string | null>(null);

  const handleOpenMultiProblemModal = () => {
    const existing = eventAccessEvent?.problemStatements || [];
    if (existing.length > 0) {
      setProblemList(existing);
    } else if (eventAccessEvent?.problemStatementTitle) {
      setProblemList([{
        id: "ps_1",
        code: "PS-01",
        title: eventAccessEvent.problemStatementTitle,
        track: eventAccessEvent.problemStatementTrack || "General Track",
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
    setPsDescInput("");
    setPsDeliverablesInput("");
    setIsMultiProblemModalOpen(true);
  };

  const handleAddOrUpdateProblemItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!psTitleInput.trim()) return;

    if (editingPsId) {
      setProblemList(prev => prev.map(item => item.id === editingPsId ? {
        ...item,
        code: psCodeInput || item.code,
        title: psTitleInput,
        track: psTrackInput,
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
      const evRef = doc(db, "events", eventAccessEvent.id);
      const primaryPs = problemList[0] || null;

      await updateDoc(evRef, {
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
      const quizSnap = await getDocs(collection(db, "quizzes"));
      const qList: any[] = [];
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
      setEventQuizzesList(qList);
      if (qList.length > 0) {
        setSelectedPromotionQuizId(qList[0].id);
      } else {
        setSelectedPromotionQuizId("all");
      }

      // 2. Fetch Quiz Submissions & auto-evaluate scores if missing
      const subSnap = await getDocs(collection(db, "quizSubmissions"));
      const subs: any[] = [];
      subSnap.forEach((d) => {
        const sData = { id: d.id, ...d.data() } as any;
        if ((sData.score === undefined || sData.score === null) && sData.answers && qList.length > 0) {
          const qDef = qList.find((q) => q.id === sData.quizId) || qList[0];
          if (qDef) {
            const evaluated = evaluateQuizAnswers(qDef, sData.answers);
            sData.score = evaluated.score;
            sData.maxScore = evaluated.maxScore;
            sData.percentage = evaluated.percentage;
            sData.passed = evaluated.passed;
          }
        }
        subs.push(sData);
      });
      setAllQuizSubmissions(subs);

      // 3. Fetch Jury Evaluations
      const jurySnap = await getDocs(collection(db, "jury_evaluations"));
      const jList: any[] = [];
      jurySnap.forEach((d) => jList.push({ id: d.id, ...d.data() }));
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

        const regRef = doc(db, "registrations", regId);
        await updateDoc(regRef, {
          currentRound: promoteToRound,
          roundStatus: "Qualified",
          promotedToRound: promoteToRound,
          promotionMethod: promotionMode,
          promotionScore: scoreUsed,
          promotedAt: now,
          updatedAt: now
        });
      });

      // Handle unselected elimination if checked
      let eliminatePromises: Promise<any>[] = [];
      if (markUnselectedAsEliminated) {
        const unselectedTeams = promotionRoster.filter(
          (t) => t.currentTeamRound === promoteFromRound && !selectedPromoteRegIds.includes(t.id)
        );
        eliminatePromises = unselectedTeams.map(async (t) => {
          const regRef = doc(db, "registrations", t.id);
          await updateDoc(regRef, {
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
      const siteBaseUrl = isLocal ? "https://aiversevitb.dpdns.org" : window.location.origin;
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
        const evRef = doc(db, "events", eventAccessEvent.id);
        await updateDoc(evRef, {
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
      const evRef = doc(db, "events", eventAccessEvent.id);
      await updateDoc(evRef, {
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

    const confirmGrant = await showConfirm({
      title: "Allow Login Access?",
      message: "Are you sure you want to allow login access for all registered teams? Their credentials were created during registration.",
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

      // 1. Prepare all records synchronously in memory (0ms)
      for (const reg of eventAccessRegistrations) {
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
        commitBatches("registrations", firestoreRegUpdates)
      ]);

      if (eventAccessEvent?.id) {
        try {
          await updateDoc(doc(db, "events", eventAccessEvent.id), { allowLoginAccess: true });
        } catch (evErr) {
          console.warn("Notice updating allowLoginAccess on event:", evErr);
        }
      }

      setProvisionedTeamIds((prev) => Array.from(new Set([...prev, ...allIds])));

      setLoginAccessSuccessMsg(`✅ Successfully granted login access for ${allIds.length} participant(s)!`);
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
        commitBatches("registrations", firestoreRegUpdates)
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
          await updateDoc(doc(db, "events", eventAccessEvent.id), { allowLoginAccess: false });
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
      await updateDoc(doc(db, "registrations", regId), {
        accessGranted: false,
        loginAccessGranted: false,
        accessRevokedAt: Date.now(),
      });
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
      const querySnapshot = await getDocs(collection(db, "registrations"));
      const list: any[] = [];
      const grantedIds: string[] = [];
      const curEid = (eventObj?.id ? String(eventObj.id) : "").trim();
      const curTitle = (eventObj?.title || "").toLowerCase().trim();
      const cleanCurEid = curEid.replace(/[Il]/g, "i").toLowerCase();

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const regId = docSnap.id;
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
          if (data.accessGranted || data.loginAccessGranted) {
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

  const filteredEventAccessRegistrations = useMemo(() => {
    if (!eventAccessSearchQuery.trim()) return eventAccessRegistrations;
    const q = eventAccessSearchQuery.toLowerCase().trim();
    return eventAccessRegistrations.filter((r) => {
      const name = (r.teamLeadName || r.name || "").toLowerCase();
      const email = (r.teamLeadEmail || r.email || "").toLowerCase();
      const studentId = (r.teamLeadStudentId || r.studentId || "").toLowerCase();
      const groupName = (r.groupName || "").toLowerCase();
      return name.includes(q) || email.includes(q) || studentId.includes(q) || groupName.includes(q);
    });
  }, [eventAccessRegistrations, eventAccessSearchQuery]);

  const handleExportEventAccessCsv = () => {
    if (!eventAccessRegistrations || eventAccessRegistrations.length === 0) {
      alert("No registered participants found to export.");
      return;
    }
    const headers = [
      "Participant / Lead Name",
      "Student ID / Roll No",
      "Email Address",
      "Phone Number",
      "Branch",
      "Section",
      "Year",
      "Registration Type",
      "Team Size",
      "Status",
      "Registered Date"
    ];

    const rows: string[] = [];
    eventAccessRegistrations.forEach((reg) => {
      const regType = reg.groupName && reg.groupName !== "Individual RSVP" ? "Group" : "Individual";
      const regDate = reg.createdAt ? new Date(reg.createdAt).toLocaleDateString("en-US") : "N/A";
      const status = reg.status || "Confirmed";

      if (reg.members && reg.members.length > 0) {
        reg.members.forEach((m: any) => {
          const row = [
            `"${(m.name || reg.teamLeadName || "").replace(/"/g, '""')}"`,
            `"${(m.studentId || reg.teamLeadStudentId || "").replace(/"/g, '""')}"`,
            `"${(m.email || reg.teamLeadEmail || "").replace(/"/g, '""')}"`,
            `"${(reg.phoneNumber || "").replace(/"/g, '""')}"`,
            `"${(reg.branch || "").replace(/"/g, '""')}"`,
            `"${(reg.section || "").replace(/"/g, '""')}"`,
            `"${(reg.year || "").replace(/"/g, '""')}"`,
            `"${regType}"`,
            `"${reg.teamSize || 1}"`,
            `"${status}"`,
            `"${regDate}"`
          ];
          rows.push(row.join(","));
        });
      } else {
        const row = [
          `"${(reg.teamLeadName || reg.name || "").replace(/"/g, '""')}"`,
          `"${(reg.teamLeadStudentId || reg.studentId || "").replace(/"/g, '""')}"`,
          `"${(reg.teamLeadEmail || reg.email || "").replace(/"/g, '""')}"`,
          `"${(reg.phoneNumber || "").replace(/"/g, '""')}"`,
          `"${(reg.branch || "").replace(/"/g, '""')}"`,
          `"${(reg.section || "").replace(/"/g, '""')}"`,
          `"${(reg.year || "").replace(/"/g, '""')}"`,
          `"${regType}"`,
          `"${reg.teamSize || 1}"`,
          `"${status}"`,
          `"${regDate}"`
        ];
        rows.push(row.join(","));
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const eventNameSlug = (eventAccessEvent?.title || "event").toLowerCase().replace(/[^a-z0-9]/g, "_");
    link.setAttribute("download", `${eventNameSlug}_participants_access.csv`);
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
        category: mappedCategory,
        currentReg: 0,
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
        agendaTime1: formAgendaItems[0]?.time || "",
        agendaTitle1: formAgendaItems[0]?.title || "",
        agendaDesc1: formAgendaItems[0]?.description || "",
        agendaTime2: formAgendaItems[1]?.time || "",
        agendaTitle2: formAgendaItems[1]?.title || "",
        agendaDesc2: formAgendaItems[1]?.description || "",
        agendaTime3: formAgendaItems[2]?.time || "",
        agendaTitle3: formAgendaItems[2]?.title || "",
        agendaDesc3: formAgendaItems[2]?.description || "",
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
        createdAt: Date.now()
      };

      let targetEventId = editingEventId;
      if (editingEventId) {
        // 1. Update backend MongoDB
        await updateEvent(editingEventId, payload);

        const existingReg = events.find(e => e.id === editingEventId)?.currentReg || 0;
        const updatedEvent: EventItem = {
          id: editingEventId,
          title: formTitle,
          date: displayDate,
          location: formLocation || "Virtual Hub",
          category: mappedCategory,
          status: formStatus || "Opened",
          currentReg: existingReg,
          maxReg: formMaxParticipants ? Number(formMaxParticipants) : 100,
          image: formPosterImages[0]?.preview || imageFile
        };
        setEvents(prev => prev.map(e => e.id === editingEventId ? { ...e, ...updatedEvent } : e));
        setEditingEventId(null);
      } else {
        // 1. Create in backend MongoDB
        const res = await createEvent(payload);
        const createdId = res?.id || res?.event?.id || res?.event?._id;
        targetEventId = createdId;

        const newEvent: EventItem = {
          id: targetEventId || `event_${Date.now()}`,
          title: formTitle,
          date: displayDate,
          location: formLocation || "Virtual Hub",
          category: mappedCategory,
          status: formStatus || "Opened",
          currentReg: 0,
          maxReg: formMaxParticipants ? Number(formMaxParticipants) : 100,
          image: formPosterImages[0]?.preview || imageFile
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
        const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000/api';
        const res = await fetch(`${API_BASE}/events/${id}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (e) {}

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
        setFormLocation(data.location || "");
        setFormRegDeadline(data.regDeadline || "");
        setFormMaxParticipants(data.maxReg ? String(data.maxReg) : "");
        setFormEnableWaitlist(data.enableWaitlist || false);
        setFormPosterImages(data.posterImages || (data.posterPreview ? [{ filename: data.posterFilename || "poster.png", preview: data.posterPreview }] : []));
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
                                      src={event.image || sparkImg}
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
                              <td className="px-6 py-4 w-44">
                                <span className="px-3 py-1 bg-blue-50 text-[#2563EB] font-black text-xs rounded-full border border-blue-100/60 inline-flex items-center gap-1.5 shadow-xs">
                                  <Users className="h-3.5 w-3.5" />
                                  {event.currentReg || 0} Registered
                                </span>
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

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registration Deadline</label>
                      <DatePicker
                        value={formRegDeadline}
                        onChange={(val) => setFormRegDeadline(val)}
                        placeholder="Select deadline"
                      />
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
                                  <input
                                    type="text"
                                    placeholder="e.g. Screening, Quiz, Hackathon, Finals"
                                    value={round.type}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormRounds(prev => prev.map((r, i) => i === idx ? { ...r, type: val } : r));
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-xs text-slate-800 bg-white"
                                  />
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
                        <div className="px-4 py-2 bg-blue-50 text-[#2563EB] rounded-2xl border border-blue-100/60 font-black text-sm shadow-xs flex items-center gap-2">
                          <Users className="h-4 w-4 text-[#2563EB]" />
                          <span>{selectedEventDetails?.currentReg || 0} Registered Seats</span>
                        </div>
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
                      {Array.isArray(selectedEventDetails?.agendaItems) && selectedEventDetails.agendaItems.length > 0 ? (
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
                        <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-100">No agenda configured.</p>
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

              {/* CARD 4: Problem Statements (Row 2 - Span 3 of 6) */}
              <div
                onClick={handleOpenMultiProblemModal}
                className="lg:col-span-3 bg-white p-6 rounded-3xl text-slate-800 shadow-sm relative overflow-hidden border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-200 group flex flex-col justify-between h-full min-h-[280px] cursor-pointer hover:-translate-y-1 transform-gpu"
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
                      Active Statements: <span className="text-blue-600 font-black">{eventAccessEvent?.problemStatements?.length || (eventAccessEvent?.problemStatementTitle ? 1 : 0)}</span>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/70 text-xs font-bold text-center shadow-2xs">
                      Track: <span className="text-slate-900 font-black">{eventAccessEvent?.problemStatementTrack || "Multi-Track"}</span>
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
                        ? "Manage Problem Statements"
                        : "+ Give Problem Statements"}
                    </span>
                  </button>
                </div>
              </div>

              {/* CARD 5: Submissions (Row 2 - Span 3 of 6) */}
              <div
                onClick={handleOpenSubmissionsModal}
                className="lg:col-span-3 bg-white p-6 rounded-3xl text-slate-800 shadow-sm relative overflow-hidden border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-200 group flex flex-col justify-between h-full min-h-[280px] cursor-pointer hover:-translate-y-1 transform-gpu"
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

              {/* Sub-Header Toolbar (Search & Quick Stats) */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Quick Search Input */}
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search participants by name, student ID, email..."
                    value={eventAccessSearchQuery}
                    onChange={(e) => setEventAccessSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] transition-all"
                  />
                </div>

                {/* Stat Pills */}
                <div className="flex items-center gap-3.5 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="px-4 py-2.5 bg-blue-50/80 border border-blue-100/80 rounded-2xl flex items-center gap-3 shadow-2xs">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <div className="text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase block leading-none tracking-wider">REGISTERED PARTICIPANTS</span>
                      <span className="text-xs font-black text-blue-700 mt-0.5 block">
                        {eventAccessRegistrations.length} Seats
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 bg-emerald-50/80 border border-emerald-100/80 rounded-2xl flex items-center gap-3 shadow-2xs">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </div>
                    <div className="text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase block leading-none tracking-wider">ACCESS STATUS</span>
                      <span className="text-xs font-black text-emerald-700 mt-0.5 block">Live Access</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TWO COLUMN GRID: Left = Participants Roster (Span 8), Right = Login Access Card (Span 4) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN: Participants Table Roster (Span 8) */}
                <div className="lg:col-span-8 space-y-6">
                  {loadingEventAccessRegs ? (
                    <div className="py-24 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200/90 shadow-sm">
                      <Loader2 className="h-8 w-8 text-[#2563EB] animate-spin" />
                      <p className="text-xs font-bold text-slate-500">Fetching registered participants from database...</p>
                    </div>
                  ) : filteredEventAccessRegistrations.length > 0 ? (
                    <div className="border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              <th className="py-3.5 px-4 w-[28%]">Team / Lead</th>
                              <th className="py-3.5 px-3 w-[16%]">Roll No.</th>
                              <th className="py-3.5 px-3 w-[22%]">Contact Details</th>
                              <th className="py-3.5 px-3 w-[12%]">Branch</th>
                              <th className="py-3.5 px-3 w-[10%]">Type</th>
                              <th className="py-3.5 px-4 w-[12%] text-right">Login Access</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredEventAccessRegistrations.map((reg, idx) => {
                              const isGroup = reg.groupName && reg.groupName !== "Individual RSVP";
                              const isProvisioned = provisionedTeamIds.includes(reg.id);
                              const displayTeamName = isGroup ? reg.groupName : (reg.teamLeadName || reg.name || "Individual Participant");

                              return (
                                <tr key={reg.id || idx} className="hover:bg-blue-50/30 transition-colors">
                                  {/* Team Name / Lead */}
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8.5 h-8.5 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-200/80 font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                        {String(reg.teamNumber || reg.teamNo || (idx + 1)).padStart(2, "0")}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="font-extrabold text-slate-900 text-xs block truncate max-w-[150px]">
                                          {displayTeamName}
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-400 block mt-0.5 truncate max-w-[150px]">
                                          {isGroup ? `Lead: ${reg.teamLeadName || reg.name}` : "Individual"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Student Roll ID */}
                                  <td className="py-3.5 px-3">
                                    <span className="font-mono font-extrabold text-slate-800 bg-slate-100/90 px-2.5 py-0.5 rounded-lg text-[11px] border border-slate-200/80 inline-block shadow-2xs">
                                      {reg.teamLeadStudentId || reg.studentId || "N/A"}
                                    </span>
                                  </td>

                                  {/* Contact Email & Phone */}
                                  <td className="py-3.5 px-3 space-y-0.5">
                                    <span className="font-bold text-slate-800 text-xs block truncate max-w-[170px]" title={reg.teamLeadPersonalEmail || reg.personalEmail || reg.teamLeadEmail || reg.email}>
                                      {reg.teamLeadPersonalEmail || reg.personalEmail || reg.teamLeadEmail || reg.email || "N/A"}
                                    </span>
                                    {reg.teamLeadCollegeEmail && reg.teamLeadCollegeEmail !== (reg.teamLeadPersonalEmail || reg.personalEmail) && (
                                      <span className="text-[10px] text-slate-400 font-medium block truncate max-w-[170px]" title={`College: ${reg.teamLeadCollegeEmail}`}>
                                        🏛️ {reg.teamLeadCollegeEmail}
                                      </span>
                                    )}
                                    {reg.phoneNumber && (
                                      <span className="text-[10px] text-slate-400 font-semibold block">
                                        {reg.phoneNumber}
                                      </span>
                                    )}
                                  </td>

                                  {/* Branch & Sec */}
                                  <td className="py-3.5 px-3 font-bold text-slate-700">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-extrabold border border-slate-200/60 inline-block">
                                      {reg.branch || "CSE"} {reg.section ? `• ${reg.section}` : ""}
                                    </span>
                                  </td>

                                  {/* Registration Type / Members */}
                                  <td className="py-3.5 px-3">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1 shadow-2xs ${isGroup ? "bg-purple-100 text-purple-800 border border-purple-200" : "bg-sky-100 text-sky-800 border border-sky-200"}`}>
                                      {isGroup ? `GROUP (${reg.teamSize || (reg.members?.length || 1)})` : "INDIVIDUAL"}
                                    </span>
                                  </td>

                                  {/* Login Access Status */}
                                  <td className="py-3.5 px-4 text-right">
                                    {isProvisioned ? (
                                      <div className="inline-flex items-center gap-1.5 justify-end">
                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shadow-2xs">
                                          <Check className="h-3 w-3 text-emerald-600" />
                                          GRANTED
                                        </span>
                                        <button
                                          onClick={() => handleRevokeSingleTeamAccess(reg.id, displayTeamName)}
                                          disabled={isProvisioningLoginAccess}
                                          className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                          title="Revoke portal access for this team"
                                        >
                                          Revoke
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shadow-2xs">
                                        <Lock className="h-3 w-3 text-amber-600" />
                                        PENDING
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
                  ) : (
                    <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3 shadow-xs">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto shadow-inner">
                        <Users className="h-7 w-7" />
                      </div>
                      <h4 className="text-base font-extrabold text-slate-800">No Participants Registered Yet</h4>
                      <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                        {eventAccessSearchQuery
                          ? `No registered participants match your search "${eventAccessSearchQuery}".`
                          : `No participant records found in the database for "${eventAccessEvent?.title || "this event"}".`}
                      </p>
                    </div>
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
                      Grant team portal authentication credentials, generate passkeys, and send instant login access links to all registered team leads and members.
                    </p>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Target Event</span>
                        <span className="font-extrabold text-slate-800 truncate max-w-[150px]">{eventAccessEvent?.title || "Active Event"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Teams / Seats</span>
                        <span className="font-extrabold text-blue-600">{eventAccessRegistrations.length} Teams</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Access Granted</span>
                        <span className="font-extrabold text-emerald-600">{provisionedTeamIds.length} / {eventAccessRegistrations.length}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={handleEnableLoginAccess}
                        disabled={isProvisioningLoginAccess || eventAccessRegistrations.length === 0}
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
                            {provisionedTeamIds.length > 0 ? "Update / Re-grant Login Access" : "Allow to Login"}
                          </>
                        )}
                      </button>

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
                    <div className="grid grid-cols-3 gap-3">
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
                      <div className="col-span-2 space-y-1">
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-base font-black text-slate-900 tracking-tight">
                        Listed Problem Statements ({problemList.length})
                      </h4>
                      <span className="px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 font-extrabold text-[10px] border border-blue-100/80 shadow-2xs">
                        Live Roster
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      Teams will select from these options
                    </span>
                  </div>

                  {problemList.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center shadow-inner">
                        <Sparkles className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-black text-slate-900">No Problem Statements Added Yet</p>
                        <p className="text-xs text-slate-500 max-w-sm font-medium">Use the form on the left to create and add problem statements for participating teams.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {problemList.map((item, idx) => (
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
                  )}
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
              <div className="hidden md:flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/15 text-xs font-black">
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {eventAccessRegistrations.filter(r => r.submissionStatus === "Submitted" || r.submittedAt).length} Final Submitted
                </span>
                <span className="text-white/30">|</span>
                <span className="text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {eventAccessRegistrations.filter(r => r.submissionStatus === "Draft" || (r.problemStatement && r.submissionStatus !== "Submitted")).length} Drafts
                </span>
                <span className="text-white/30">|</span>
                <span className="text-slate-200">Total: {eventAccessRegistrations.length} Teams</span>
              </div>

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
              {/* Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto">
                {(["All", "Submitted", "Draft", "Pending"] as const).map((filter) => {
                  const count = filter === "All"
                    ? eventAccessRegistrations.length
                    : filter === "Submitted"
                      ? eventAccessRegistrations.filter(r => r.submissionStatus === "Submitted" || r.submittedAt).length
                      : filter === "Draft"
                        ? eventAccessRegistrations.filter(r => r.submissionStatus === "Draft" || (r.problemStatement && r.submissionStatus !== "Submitted")).length
                        : eventAccessRegistrations.filter(r => !r.problemStatement && !r.submittedAt).length;

                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setSubmissionsFilter(filter)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${submissionsFilter === filter
                          ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                    >
                      <span>{filter} Teams</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${submissionsFilter === filter ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700 font-black"
                        }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
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
                const filteredList = eventAccessRegistrations.filter((reg) => {
                  const matchSearch = !submissionsSearchQuery ||
                    (reg.groupName || "").toLowerCase().includes(submissionsSearchQuery.toLowerCase()) ||
                    (reg.teamLeadName || reg.name || "").toLowerCase().includes(submissionsSearchQuery.toLowerCase()) ||
                    (reg.problemStatement || "").toLowerCase().includes(submissionsSearchQuery.toLowerCase()) ||
                    (reg.teamLeadStudentId || reg.studentId || "").toLowerCase().includes(submissionsSearchQuery.toLowerCase());

                  const isSubmitted = reg.submissionStatus === "Submitted" || !!reg.submittedAt;
                  const isDraft = reg.submissionStatus === "Draft" || (!!reg.problemStatement && !isSubmitted);
                  const isPending = !reg.problemStatement && !isSubmitted;

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
                              return (
                                <button
                                  type="button"
                                  onClick={() => setStepLockTarget({ stepId: 1, name: "Problem Statement" })}
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
                                  <span className="text-xs font-black text-white block truncate">Problem Statement</span>
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
                              return (
                                <button
                                  type="button"
                                  onClick={() => setStepLockTarget({ stepId: 2, name: "SRS Submission" })}
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
                                  <span className="text-xs font-black text-white block truncate">SRS Submission</span>
                                  <span className={`text-[9px] font-extrabold uppercase tracking-widest block ${isLocked ? "text-amber-400" : "text-slate-400"}`}>
                                    {isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED"}
                                  </span>
                                </button>
                              );
                            })()}
                          </th>

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

                          // Step Completion Conditions
                          const step1Completed = reg.isPsSaved || reg.isPsLocked || !!reg.problemStatement || !!reg.selectedProblemStatementId;
                          const step2Completed = !!reg.srsFileName || !!reg.srsFileUrl;
                          const step3Completed = !!reg.presentationFileName || !!reg.presentationUrl;
                          const step4Completed = !!reg.keyFeatures;
                          const step5Completed = !!reg.githubUrl;
                          const step6Completed = (!!reg.prototypeUrl && !!reg.demoVideoUrl) || reg.submissionStatus === "Submitted" || !!reg.submittedAt;

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
                                    title={step1Completed ? `Step 1 Completed: ${reg.selectedProblemStatementId || "PS Saved"}` : "Step 1 In Progress / Pending"}
                                    className={`w-11 h-11 rounded-full relative z-10 flex items-center justify-center font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border-2 ${step1Completed
                                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-100'
                                        : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40 ring-4 ring-blue-100'
                                      }`}
                                  >
                                    {step1Completed ? <Check className="w-6 h-6 stroke-[3]" /> : "1"}
                                  </button>
                                </div>
                                <span className="text-[10px] font-extrabold block mt-2 truncate max-w-[140px] mx-auto text-slate-700">
                                  {step1Completed ? (reg.selectedProblemStatementId || "PS Saved") : "Pending"}
                                </span>
                              </td>

                              {/* Step 2 Node */}
                              <td className="py-5 px-3 text-center relative overflow-visible">
                                <div className="flex items-center justify-center relative w-full">
                                  {/* Seamless Connecting Line across left & right */}
                                  <div className={`absolute left-[-50%] right-[-50%] top-1/2 -translate-y-1/2 h-1.5 z-0 ${step2Completed && step3Completed ? 'bg-emerald-500 shadow-xs' : (step1Completed && step2Completed ? 'bg-emerald-500 shadow-xs' : 'bg-blue-300')}`} />

                                  {/* Node Circle 2 */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTeamSubmission(reg)}
                                    title={step2Completed ? "Step 2 Completed: SRS Uploaded" : "Step 2 In Progress / Pending"}
                                    className={`w-11 h-11 rounded-full relative z-10 flex items-center justify-center font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer border-2 ${step2Completed
                                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-100'
                                        : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40 ring-4 ring-blue-100'
                                      }`}
                                  >
                                    {step2Completed ? <Check className="w-6 h-6 stroke-[3]" /> : "2"}
                                  </button>
                                </div>
                                <span className="text-[10px] font-extrabold block mt-2 truncate max-w-[140px] mx-auto text-slate-700">
                                  {step2Completed ? "SRS Done" : "SRS Pending"}
                                </span>
                              </td>

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
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 font-black text-lg flex items-center justify-center shrink-0 shadow-sm">
                  {(selectedTeamSubmission.groupName || selectedTeamSubmission.teamLeadName || selectedTeamSubmission.name || "T").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {selectedTeamSubmission.groupName || selectedTeamSubmission.teamLeadName || selectedTeamSubmission.name || "Team Submission"}
                  </h3>
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

            {/* Problem Statement Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Problem Statement & Requirements</span>
                {selectedTeamSubmission.selectedProblemStatement?.track && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedTeamSubmission.selectedProblemStatement.track}
                  </span>
                )}
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed space-y-1.5">
                {selectedTeamSubmission.selectedProblemStatement?.title ? (
                  <>
                    <p className="font-extrabold text-slate-900 text-sm">
                      {selectedTeamSubmission.selectedProblemStatement.code ? `[${selectedTeamSubmission.selectedProblemStatement.code}] ` : ""}
                      {selectedTeamSubmission.selectedProblemStatement.title}
                    </p>
                    <p className="text-slate-600 text-xs">
                      {selectedTeamSubmission.selectedProblemStatement.description || selectedTeamSubmission.problemStatement}
                    </p>
                  </>
                ) : (
                  <p>{selectedTeamSubmission.problemStatement || "No problem statement submitted yet."}</p>
                )}
              </div>
            </div>

            {/* Key Features */}
            {selectedTeamSubmission.keyFeatures && (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Key Features & Functionalities</span>
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-indigo-950 font-medium whitespace-pre-wrap leading-relaxed">
                  {selectedTeamSubmission.keyFeatures}
                </div>
              </div>
            )}

            {/* Documents & Links Section */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Submission Artifacts & Links</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">1. SRS Document</span>
                  <span className="font-bold text-slate-900 truncate block">{selectedTeamSubmission.srsFileName || "Not Uploaded"}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">2. Presentation Deck</span>
                  <span className="font-bold text-slate-900 truncate block">{selectedTeamSubmission.presentationFileName || "Not Uploaded"}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold pt-1">
                {selectedTeamSubmission.githubUrl ? (
                  <a href={selectedTeamSubmission.githubUrl} target="_blank" rel="noreferrer" className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                    <ExternalLink className="w-4 h-4" /> Code Repo
                  </a>
                ) : (
                  <div className="p-3 bg-slate-100 text-slate-400 rounded-xl text-center">No Repo Link</div>
                )}

                {selectedTeamSubmission.prototypeUrl ? (
                  <a href={selectedTeamSubmission.prototypeUrl} target="_blank" rel="noreferrer" className="p-3 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                    <ExternalLink className="w-4 h-4" /> Prototype Link
                  </a>
                ) : (
                  <div className="p-3 bg-slate-100 text-slate-400 rounded-xl text-center">No Prototype</div>
                )}

                {selectedTeamSubmission.demoVideoUrl ? (
                  <a href={selectedTeamSubmission.demoVideoUrl} target="_blank" rel="noreferrer" className="p-3 bg-red-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">
                    <ExternalLink className="w-4 h-4" /> Demo Video
                  </a>
                ) : (
                  <div className="p-3 bg-slate-100 text-slate-400 rounded-xl text-center">No Video Link</div>
                )}
              </div>
            </div>

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
