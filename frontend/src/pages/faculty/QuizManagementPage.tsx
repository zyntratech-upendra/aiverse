import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useModal } from "../../context/ModalContext";
import * as api from "../../services/apiClient";
import type { Quiz, QuizQuestion, QuizSubmission, QuizSession } from "../../types/quiz";
import { resetParticipantQuizSession, resetAllQuizSubmissions, deleteQuizCascading, evaluateQuizAnswers } from "../../services/quizService";
import { extractTextFromPdf, parseQuestionsFromText } from "../../utils/pdfExtractor";
import { extractQuizQuestionsWithGemini } from "../../utils/geminiQuizExtractor";
import { userService } from "../../services/userService";
import SEO from "../../components/layout/SEO";
import DatePicker from "../../components/ui/DatePicker";
import TimePicker from "../../components/ui/TimePicker";
import {
  HelpCircle,
  Plus,
  Edit3,
  Trash2,
  Award,
  CheckCircle2,
  Users,
  FileText,
  Download,
  ExternalLink,
  X,
  Loader2,
  ArrowLeft,
  Calendar,
  Save,
  Check,
  ArrowRight,
  AlertCircle,
  Play,
  Square,
  RotateCcw,
  Upload,
  FileUp,
  Sparkles,
  AlertTriangle,
  Eye,
  BarChart3,
  TrendingUp,
  CheckCircle,
  XCircle,
  Trophy,
  Medal,
  Search,
  Clock,
  RefreshCw,
  Building2,
  MapPin,
  FileSpreadsheet
} from "lucide-react";

interface EventOption {
  id: string;
  title: string;
  category?: string;
}

export const QuizManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showConfirm, showAlert } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const eventIdParam = searchParams.get("eventId") || searchParams.get("accessEventId");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [activeSessions, setActiveSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>(eventIdParam || "");

  // Registrant & User Profile lookup maps for Team Name, College Name, Place & Details
  const [registrantMap, setRegistrantMap] = useState<Map<string, { name: string; rollNo?: string; phone?: string; teamName?: string; collegeName?: string; collegePlace?: string }>>(new Map());
  const [userProfileMap, setUserProfileMap] = useState<Map<string, { name: string; rollNo?: string; collegeName?: string; collegePlace?: string }>>(new Map());

  // Search & Filter for Submissions Table
  const [subSearchQuery, setSubSearchQuery] = useState<string>("");
  const [subFilterState, setSubFilterState] = useState<"all" | "top3" | "passed" | "failed" | "violations">("all");

  // Sync selectedEventId if URL eventIdParam changes
  useEffect(() => {
    if (eventIdParam) {
      setSelectedEventId(eventIdParam);
    }
  }, [eventIdParam]);

  // When events load, initialize selectedEventId if URL param present, or default to "all"
  useEffect(() => {
    if (events.length > 0) {
      if (eventIdParam && events.some((e) => e.id === eventIdParam)) {
        setSelectedEventId(eventIdParam);
      } else if (!selectedEventId) {
        setSelectedEventId("all");
      }
    }
  }, [events, eventIdParam, selectedEventId]);

  // Compute currently active scoped event
  const activeEvent = React.useMemo(() => {
    if (!events.length || !selectedEventId || selectedEventId === "all") return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Filter quizzes by active scoped event or show all if "all" is selected
  const filteredQuizzes = React.useMemo(() => {
    if (!selectedEventId || selectedEventId === "all") {
      return quizzes;
    }
    return quizzes.filter((q) => {
      if (q.eventId && (q.eventId === selectedEventId || (activeEvent && q.eventId === activeEvent.id))) return true;
      if (activeEvent && q.eventTitle && activeEvent.title && q.eventTitle.toLowerCase().trim() === activeEvent.title.toLowerCase().trim()) return true;
      return false;
    });
  }, [quizzes, activeEvent, selectedEventId]);

  // Automatically update selectedQuizId when filteredQuizzes or quizzes change
  useEffect(() => {
    if (filteredQuizzes.length > 0) {
      if (!selectedQuizId || !filteredQuizzes.some((q) => q.id === selectedQuizId)) {
        setSelectedQuizId(filteredQuizzes[0].id);
      }
    } else {
      setSelectedQuizId("");
    }
  }, [filteredQuizzes, selectedQuizId]);

  // View state: "list" or "editor" (Full-page editor mode)
  const [isEditorMode, setIsEditorMode] = useState<boolean>(false);
  const [editingQuiz, setEditingQuiz] = useState<Partial<Quiz> | null>(null);
  const [startingQuiz, setStartingQuiz] = useState<Quiz | null>(null);
  const [startDuration, setStartDuration] = useState<number>(30);
  const [isStarting, setIsStarting] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [selectedCategoryView, setSelectedCategoryView] = useState<string>("");

  // Bulk PDF Import States
  const [showPdfBulkModal, setShowPdfBulkModal] = useState<boolean>(false);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pdfRawText, setPdfRawText] = useState<string>("");
  const [pdfTargetCategory, setPdfTargetCategory] = useState<string>("");
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [isAiScanning, setIsAiScanning] = useState<boolean>(false);
  const [aiScanSuccess, setAiScanSuccess] = useState<boolean>(false);
  const [parsedBulkQuestions, setParsedBulkQuestions] = useState<QuizQuestion[]>([]);

interface ExcelScoreRow {
  id: string;
  userId: string;
  quizId: string;
  rank: number;
  rankLabel: string;
  teamName: string;
  collegeName: string;
  collegePlace: string;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  pointsPerQuestion: number;
  passed: boolean;
  remarks: string;
  isModified: boolean;
  originalScore: number;
  originalMaxScore: number;
  originalPassed: boolean;
  originalRemarks: string;
  originalCorrectCount: number;
  originalIncorrectCount: number;
  timeSpentSeconds: number;
  submittedAt: number;
  violationsCount: number;
}

  // Active Tab for list mode
  const [activeTab, setActiveTab] = useState<"quizzes" | "live_monitor" | "submissions">("quizzes");

  // Inspect Participant Submission Modal
  const [inspectingSubmission, setInspectingSubmission] = useState<(QuizSubmission & { rank?: number; rankLabel?: string; resolvedName?: string; rollNo?: string; resolvedTeamName?: string; resolvedCollegeName?: string; resolvedCollegePlace?: string }) | null>(null);
  const [inspectFilter, setInspectFilter] = useState<"all" | "correct" | "incorrect" | "unanswered">("all");

  // Excel Spreadsheet Score Editor Modal State (Alt + Shift + E)
  const [isExcelEditorOpen, setIsExcelEditorOpen] = useState<boolean>(false);
  const [excelRows, setExcelRows] = useState<ExcelScoreRow[]>([]);
  const [excelSearchQuery, setExcelSearchQuery] = useState<string>("");
  const [excelFilter, setExcelFilter] = useState<"all" | "modified" | "passed" | "failed">("all");
  const [isSavingExcel, setIsSavingExcel] = useState<boolean>(false);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  // Helper to resolve team name, college name, and place details
  const resolveParticipantInfo = React.useCallback(
    (sub: { userName?: string; userEmail?: string; userId?: string; teamName?: string }) => {
      const cleanEmail = (sub.userEmail || "").toLowerCase().trim();
      const emailPrefix = cleanEmail.split("@")[0] || "";

      let resolvedTeam = (sub.teamName || "").trim();
      let resolvedCollege = "";
      let resolvedPlace = "";
      let rollNo = "";
      let displayName = "";

      // 1. Check registrations collection by email or userId
      if (cleanEmail && registrantMap.has(cleanEmail)) {
        const reg = registrantMap.get(cleanEmail)!;
        if (reg.teamName && (!resolvedTeam || resolvedTeam.toLowerCase() === "solo" || resolvedTeam.toLowerCase() === "general")) {
          resolvedTeam = reg.teamName.trim();
        }
        if (reg.collegeName) resolvedCollege = reg.collegeName.trim();
        if (reg.collegePlace) resolvedPlace = reg.collegePlace.trim();
        if (reg.rollNo) rollNo = reg.rollNo.trim();
        if (reg.name) displayName = reg.name.trim();
      } else if (sub.userId && registrantMap.has(sub.userId)) {
        const reg = registrantMap.get(sub.userId)!;
        if (reg.teamName && (!resolvedTeam || resolvedTeam.toLowerCase() === "solo" || resolvedTeam.toLowerCase() === "general")) {
          resolvedTeam = reg.teamName.trim();
        }
        if (reg.collegeName) resolvedCollege = reg.collegeName.trim();
        if (reg.collegePlace) resolvedPlace = reg.collegePlace.trim();
        if (reg.rollNo) rollNo = reg.rollNo.trim();
        if (reg.name) displayName = reg.name.trim();
      }

      // 2. Check users collection
      if (sub.userId && userProfileMap.has(sub.userId)) {
        const u = userProfileMap.get(sub.userId)!;
        if (!resolvedCollege && u.collegeName) resolvedCollege = u.collegeName.trim();
        if (!resolvedPlace && u.collegePlace) resolvedPlace = u.collegePlace.trim();
        if (!rollNo && u.rollNo) rollNo = u.rollNo.trim();
        if (!displayName && u.name) displayName = u.name.trim();
      }
      if (cleanEmail && userProfileMap.has(cleanEmail)) {
        const u = userProfileMap.get(cleanEmail)!;
        if (!resolvedCollege && u.collegeName) resolvedCollege = u.collegeName.trim();
        if (!resolvedPlace && u.collegePlace) resolvedPlace = u.collegePlace.trim();
        if (!rollNo && u.rollNo) rollNo = u.rollNo.trim();
        if (!displayName && u.name) displayName = u.name.trim();
      }

      // 3. Fallbacks for Vishnu domain or general defaults
      if (cleanEmail.endsWith("@vishnu.edu.in")) {
        if (!resolvedCollege) resolvedCollege = "Vishnu Institute of Technology";
        if (!resolvedPlace) resolvedPlace = "Bhimavaram";
      }

      // 4. Fallback formatting
      if (!resolvedTeam || resolvedTeam.toLowerCase() === "solo" || resolvedTeam.toLowerCase() === "participant" || resolvedTeam.toLowerCase() === "user") {
        resolvedTeam = displayName ? `Team ${displayName}` : (emailPrefix ? `Team ${emailPrefix.toUpperCase()}` : "Team Alpha");
      }

      if (!resolvedCollege) {
        resolvedCollege = "Vishnu Institute of Technology";
      }

      if (!resolvedPlace) {
        resolvedPlace = "Bhimavaram";
      }

      return {
        displayName: displayName || (emailPrefix ? emailPrefix.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Participant"),
        teamName: resolvedTeam,
        collegeName: resolvedCollege,
        collegePlace: resolvedPlace,
        rollNo
      };
    },
    [registrantMap, userProfileMap]
  );

  // Load Quizzes, Events, Registrations, and User Profiles
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Quizzes
        const qList = await api.fetchAllQuizzes();
        setQuizzes(qList || []);

        // 2. Fetch Events for dropdown selection
        const evData = await api.fetchEvents();
        const evList: EventOption[] = (evData || []).map((e: any) => ({
          id: e.id || e._id,
          title: e.title || "Untitled Event",
          category: e.category || "General"
        }));
        setEvents(evList);

        // 3. Fetch Registrations to map Team Names, College Names & Places
        try {
          const regData = await api.fetchRegistrations();
          const regMap = new Map<string, { name: string; rollNo?: string; phone?: string; teamName?: string; collegeName?: string; collegePlace?: string }>();
          (regData || []).forEach((data: any) => {
            const primaryName = (data.fullName || data.teamLeadName || data.name || "").trim();
            const roll = data.rollNo || data.studentId || data.teamLeadStudentId || "";
            const phone = data.phone || data.phoneNumber || data.teamLeadPhone || "";
            const collegeEm = (data.collegeEmail || data.teamLeadCollegeEmail || "").toLowerCase().trim();
            const personalEm = (data.personalEmail || data.teamLeadPersonalEmail || "").toLowerCase().trim();
            const teamEm = (data.teamEmail || data.teamLeadEmail || data.email || "").toLowerCase().trim();
            const group = (data.groupName || data.teamName || "").trim();
            const college = (data.collegeName || data.college || data.institute || data.institution || "").trim();
            const place = (data.collegePlace || data.place || data.city || data.location || "").trim();

            const regInfo = {
              name: primaryName,
              rollNo: roll,
              phone,
              teamName: group,
              collegeName: college,
              collegePlace: place
            };

            if (teamEm) regMap.set(teamEm, regInfo);
            if (personalEm) regMap.set(personalEm, regInfo);
            if (collegeEm) regMap.set(collegeEm, regInfo);
            if (data.email) regMap.set(data.email.toLowerCase().trim(), regInfo);
            if (data.userId) regMap.set(data.userId, regInfo);

            // Map team members if any
            if (Array.isArray(data.members)) {
              data.members.forEach((m: any) => {
                const mName = (m.name || m.fullName || "").trim();
                const mEmail = (m.email || m.personalEmail || m.collegeEmail || "").toLowerCase().trim();
                const mRoll = m.rollNo || m.studentId || "";
                const mCollege = (m.college || m.collegeName || college).trim();
                const mPlace = (m.collegePlace || m.place || place).trim();
                if (mEmail) {
                  regMap.set(mEmail, {
                    name: mName || primaryName,
                    rollNo: mRoll || roll,
                    phone: m.phone || phone,
                    teamName: group,
                    collegeName: mCollege,
                    collegePlace: mPlace
                  });
                }
              });
            }
          });
          setRegistrantMap(regMap);
        } catch (regErr) {
          console.warn("Notice fetching registrations:", regErr);
        }

        // 4. Fetch Users
        try {
          const uMap = new Map<string, { name: string; rollNo?: string; collegeName?: string; collegePlace?: string }>();
          const usersData = await api.fetchUsers();
          (usersData || []).forEach((data: any) => {
            const rawName = (data.displayName || data.name || data.teamLeadName || "").trim();
            const cleanEmail = (data.email || "").toLowerCase().trim();
            const pEmail = (data.personalEmail || data.personal_email || "").toLowerCase().trim();
            const roll = data.rollNo || data.studentId || "";
            const col = (data.college || data.collegeName || "").trim();
            const plc = (data.collegePlace || data.place || data.city || data.location || "").trim();
            const uid = data.id || data._id;
            const uInfo = { name: rawName, rollNo: roll, collegeName: col, collegePlace: plc };
            if (uid) uMap.set(uid, uInfo);
            if (cleanEmail) uMap.set(cleanEmail, uInfo);
            if (pEmail) uMap.set(pEmail, uInfo);
          });

          // Supabase fallback
          try {
            const supaUsers = await userService.getUsers();
            supaUsers.forEach((su) => {
              const suName = (su.display_name || su.name || "").trim();
              const suEmail = (su.email || "").toLowerCase().trim();
              const suPEmail = (su.personal_email || "").toLowerCase().trim();
              const suInfo = { name: suName, rollNo: su.year || "", collegeName: "", collegePlace: "" };
              if (su.id) uMap.set(su.id, suInfo);
              if (su.auth_id) uMap.set(su.auth_id, suInfo);
              if (suEmail) uMap.set(suEmail, suInfo);
              if (suPEmail) uMap.set(suPEmail, suInfo);
            });
          } catch {}

          setUserProfileMap(uMap);
        } catch (uErr) {
          console.warn("Notice fetching users:", uErr);
        }

      } catch (err) {
        console.error("Error fetching quizzes or events:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch sessions & submissions on-demand when quiz is selected
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshingResults, setIsRefreshingResults] = useState(false);
  
  const handleRefreshResults = async () => {
    setIsRefreshingResults(true);
    try {
      // 1. Refresh quizzes list
      const freshQuizzes = await api.fetchAllQuizzes();
      if (freshQuizzes) {
        setQuizzes(freshQuizzes);
      }
      // 2. Trigger fetch of submissions & sessions for selected quiz
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.warn("Error refreshing quiz results:", err);
    } finally {
      setTimeout(() => {
        setIsRefreshingResults(false);
      }, 500);
    }
  };

  useEffect(() => {
    if (!selectedQuizId) {
      setSubmissions([]);
      setActiveSessions([]);
      return;
    }

    let isMounted = true;
    const fetchData = async () => {
      try {
        const [subsData, sessData] = await Promise.all([
          api.fetchQuizSubmissions(selectedQuizId),
          api.fetchQuizSessions(selectedQuizId),
        ]);

        const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
        
        const overridden = (targetQuiz as any)?.overriddenScores;

        const subs: QuizSubmission[] = (subsData || []).map((raw: any) => {
          let updatedRaw = raw;
          if (overridden && overridden[raw.id]) {
            updatedRaw = { ...raw, ...overridden[raw.id] };
          }
          
          if ((updatedRaw.score === undefined || updatedRaw.score === null) && targetQuiz && targetQuiz.questions && targetQuiz.questions.length > 0) {
            const evalData = evaluateQuizAnswers(targetQuiz, updatedRaw.answers || {});
            return {
              ...updatedRaw, ...evalData, evaluatedAt: Date.now() };
          }
          return updatedRaw;
        });

        if (isMounted) {
          setSubmissions(subs);
          setActiveSessions(sessData || []);
        }
      } catch (err) {
        console.warn("Error fetching submissions/sessions:", err);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [selectedQuizId, quizzes, refreshKey]);

  // Open Full-Page Create Mode
  const handleOpenCreateModal = () => {
    setCustomCategories([]);
    setSelectedCategoryView("");
    setCurrentQuestionIndex(-1);
    const targetEvent = activeEvent || (events.length > 0 ? events[0] : null);
    setEditingQuiz({
      title: "",
      description: "",
      eventId: targetEvent ? targetEvent.id : "",
      eventTitle: targetEvent ? targetEvent.title : "",
      track: targetEvent?.category ? `${targetEvent.category} Track` : "General Track",
      durationMinutes: 30,
      pointsPerQuestion: 2,
      totalMarks: 0,
      passingMarks: 0,
      scheduledStartTime: undefined,
      scheduledEndTime: undefined,
      resultsPublished: false,
      status: "active",
      instructions: [
        "Each question has 4 options with single correct answer.",
        "Your answers are automatically saved periodically in the background.",
        "You can navigate freely between questions using the Question Palette.",
        "Once submitted or when the timer expires, no further modifications are allowed."
      ],
      questions: []
    });
    setIsEditorMode(true);
  };

  const handleOpenEditModal = (quiz: Quiz) => {
    const derivedPoints = Number(quiz.pointsPerQuestion) || (quiz.questions?.[0]?.points) || 2;
    const qCount = quiz.questions?.length || quiz.questionsCount || 0;
    const calcTotal = Number(quiz.totalMarks) || (qCount * derivedPoints);
    setEditingQuiz({
      ...JSON.parse(JSON.stringify(quiz)),
      pointsPerQuestion: derivedPoints,
      totalMarks: calcTotal
    });
    const cats = Array.from(new Set(quiz.questions?.map(q => q.category).filter(Boolean) as string[]));
    setCustomCategories(cats);
    
    const initialCat = cats.length > 0 ? cats[0] : "";
    setSelectedCategoryView(initialCat);
    if (initialCat && quiz.questions && quiz.questions.length > 0) {
      const firstIdx = quiz.questions.findIndex(q => q.category === initialCat);
      setCurrentQuestionIndex(firstIdx !== -1 ? firstIdx : -1);
    } else {
      setCurrentQuestionIndex(-1);
    }
    
    setIsEditorMode(true);
  };

  // Save Quiz to Firestore
  const handleSaveQuiz = async () => {
    if (!editingQuiz || !editingQuiz.title?.trim() || saving) return;

    const incompleteQuestions = editingQuiz.questions?.filter(q => {
      const hasValidAnswer = !!q.correctOptionId && q.options.some(opt => opt.id === q.correctOptionId && opt.text.trim().length > 0);
      const hasText = q.text.trim().length > 0;
      const hasCategory = !!q.category && q.category.trim().length > 0;
      return !(hasValidAnswer && hasText && hasCategory);
    });

    if (incompleteQuestions && incompleteQuestions.length > 0) {
      await showAlert({
        title: "Incomplete Questions",
        message: `Please complete all questions before saving.\n\nMissing fields in Question(s): ${incompleteQuestions.map(q => q.questionNumber).join(', ')}\n(Ensure Category, Question Text, and Correct Answer are selected).`,
        type: "warning",
        icon: "alert"
      });
      return;
    }

    try {
      setSaving(true);
      const quizId = editingQuiz.id || `quiz_${Date.now()}`;
      const targetEvent = events.find(e => e.id === editingQuiz.eventId) || activeEvent || (events.length > 0 ? events[0] : null);

      const ptsPerQ = Number(editingQuiz.pointsPerQuestion) || 2;
      const qCount = editingQuiz.questions?.length || 0;
      const calcTotalMarks = qCount * ptsPerQ;

      const payload: Quiz = {
        id: quizId,
        title: editingQuiz.title.trim(),
        description: editingQuiz.description || "",
        eventId: targetEvent ? targetEvent.id : (editingQuiz.eventId || ""),
        eventTitle: targetEvent ? targetEvent.title : (editingQuiz.eventTitle || ""),
        track: editingQuiz.track || (targetEvent?.category ? `${targetEvent.category} Track` : "General Track"),
        durationMinutes: (Number(editingQuiz.durationMinutes) || 30),
        pointsPerQuestion: ptsPerQ,
        totalMarks: calcTotalMarks,
        passingMarks: Number(editingQuiz.passingMarks) || Math.round(calcTotalMarks * 0.4),
        instructions: editingQuiz.instructions || [],
        status: editingQuiz.status || "active",
        scheduledStartTime: editingQuiz.scheduledStartTime || null,
        scheduledEndTime: editingQuiz.scheduledEndTime || null,
        resultsPublished: editingQuiz.resultsPublished ?? false,
        questionsCount: qCount,
        questions: (editingQuiz.questions || []).map((q) => ({
          ...q,
          points: ptsPerQ
        })),
        createdAt: editingQuiz.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      if (editingQuiz.id) {
        await api.updateQuiz(quizId, payload);
      } else {
        await api.createQuiz(payload);
      }

      setQuizzes((prev) => {
        const existingIdx = prev.findIndex((q) => q.id === quizId);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = payload;
          return next;
        }
        return [payload, ...prev];
      });

      setSelectedQuizId(quizId);
      setIsEditorMode(false);
      setEditingQuiz(null);
    } catch (err: any) {
      console.error("Error saving quiz:", err);
      await showAlert({
        title: "Save Error",
        message: "Failed to save quiz: " + err.message,
        type: "danger"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    const target = quizzes.find(q => q.id === quizId);
    const confirmed = await showConfirm({
      title: "Delete Quiz?",
      message: `Are you sure you want to delete "${target?.title || 'this quiz'}"?\n\nAll related questions, submissions, and session records will be permanently deleted.`,
      confirmText: "Delete Quiz",
      cancelText: "Cancel",
      type: "danger",
      icon: "trash"
    });
    if (!confirmed) return;

    try {
      await deleteQuizCascading(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      if (selectedQuizId === quizId) {
        const remaining = filteredQuizzes.filter((q) => q.id !== quizId);
        setSelectedQuizId(remaining[0]?.id || "");
      }
    } catch (err: any) {
      console.error("Error deleting quiz:", err);
      await showAlert({
        title: "Delete Error",
        message: "Error deleting quiz: " + err.message,
        type: "danger"
      });
    }
  };


  const handleStartQuiz = (quiz: Quiz) => {
    setStartingQuiz(quiz);
    setStartDuration(quiz.durationMinutes || 30);
  };

  const handleStopQuiz = async (quiz: Quiz) => {
    const confirmed = await showConfirm({
      title: `Stop "${quiz.title}"?`,
      message: `Are you sure you want to STOP "${quiz.title}" right now?\n\nAll active participants will be immediately forced to submit their current progress.`,
      confirmText: "Stop Exam",
      cancelText: "Keep Running",
      type: "danger",
      icon: "stop"
    });
    if (!confirmed) return;

    try {
      const now = Date.now();
      await api.updateQuiz(quiz.id, {
        status: "completed",
        scheduledEndTime: now, // Force immediate stop
        updatedAt: now
      });

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`quiz_cache_${quiz.id}`);
      }

      setQuizzes(prev => prev.map(q => 
        q.id === quiz.id ? { ...q, status: "completed", scheduledEndTime: now, updatedAt: now } : q
      ));
    } catch (err: any) {
      console.error("Failed to stop quiz:", err);
      await showAlert({
        title: "Error Stopping Quiz",
        message: "Failed to stop quiz: " + err.message,
        type: "danger"
      });
    }
  };

  // Toggle Publish / Hide Quiz Results
  const handleTogglePublishResults = async (quiz: Quiz) => {
    const nextState = !quiz.resultsPublished;
    const confirmed = await showConfirm({
      title: nextState ? "Publish Quiz Results?" : "Hide Quiz Results?",
      message: nextState
        ? `Publish results for "${quiz.title}"?\n\nParticipants will now be able to view their final scores, accuracy, and answer sheets.`
        : `Hide results for "${quiz.title}"?\n\nParticipants will see "Results will be announced soon" on their completion receipts and dashboards.`,
      confirmText: nextState ? "Publish Results" : "Hide Results",
      cancelText: "Cancel",
      type: nextState ? "info" : "warning",
      icon: nextState ? "sparkles" : "alert"
    });
    if (!confirmed) return;

    try {
      const now = Date.now();
      const updatedQuiz: Quiz = {
        ...quiz,
        resultsPublished: nextState,
        updatedAt: now
      };
      await api.updateQuiz(quiz.id, updatedQuiz);
      setQuizzes(prev => prev.map(q => q.id === quiz.id ? updatedQuiz : q));
      await showAlert({
        title: nextState ? "Results Published" : "Results Hidden",
        message: nextState
          ? `Quiz results for "${quiz.title}" are now live and visible to participants!`
          : `Quiz results for "${quiz.title}" have been hidden from participants.`,
        type: "success"
      });
    } catch (err: any) {
      console.error("Failed to update results publication:", err);
      await showAlert({
        title: "Update Failed",
        message: "Failed to update results publication status: " + err.message,
        type: "danger"
      });
    }
  };

  // Reset a specific participant's attempt
  const handleResetParticipant = async (sub: QuizSubmission) => {
    const confirmed = await showConfirm({
      title: "Unlock & Reset Attempt?",
      message: `Unlock and reset quiz attempt for ${sub.userName || sub.userEmail}?\n\nThis will remove their locked submission and allow them to retake the quiz from scratch.`,
      confirmText: "Unlock & Reset",
      cancelText: "Cancel",
      type: "warning",
      icon: "rotate"
    });
    if (!confirmed) return;

    try {
      await resetParticipantQuizSession(sub.quizId, sub.userId);
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      setActiveSessions(prev => prev.filter(s => s.userId !== sub.userId));
      await showAlert({
        title: "Attempt Reset",
        message: `Quiz attempt for ${sub.userName || "participant"} has been reset successfully.`,
        type: "success",
        icon: "check"
      });
    } catch (err: any) {
      console.error("Failed to reset participant session:", err);
      await showAlert({
        title: "Reset Error",
        message: "Error resetting participant: " + err.message,
        type: "danger"
      });
    }
  };

  const handleDeleteParticipant = async (sub: QuizSubmission) => {
    const confirmed = await showConfirm({
      title: "Delete Submission?",
      message: `Are you sure you want to completely delete the submission for ${sub.userName || sub.userEmail}?\n\nThis will remove their record from the leaderboard. They will be able to retake the quiz if it is still active.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      icon: "trash"
    });
    if (!confirmed) return;

    try {
      await resetParticipantQuizSession(sub.quizId, sub.userId);
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      setActiveSessions(prev => prev.filter(s => s.userId !== sub.userId));
      await showAlert({
        title: "Submission Deleted",
        message: `Quiz submission for ${sub.userName || "participant"} has been deleted successfully.`,
        type: "success",
        icon: "check"
      });
    } catch (err: any) {
      console.error("Failed to delete participant session:", err);
      await showAlert({
        title: "Delete Error",
        message: "Error deleting submission: " + err.message,
        type: "danger"
      });
    }
  };

  // Reset all submissions for selected quiz
  const handleResetAllSubmissions = async () => {
    if (!selectedQuizId) return;
    const targetQuiz = quizzes.find(q => q.id === selectedQuizId);
    const confirmed = await showConfirm({
      title: "Reset All Submissions?",
      message: `WARNING: Are you sure you want to RESET ALL ${submissions.length} submissions for "${targetQuiz?.title || 'this quiz'}"?\n\nAll submission records and locks will be permanently cleared so participants can retake the quiz.`,
      confirmText: "Reset All Submissions",
      cancelText: "Cancel",
      type: "danger",
      icon: "trash"
    });
    if (!confirmed) return;

    try {
      await resetAllQuizSubmissions(selectedQuizId);
      setSubmissions([]);
      setActiveSessions([]);
      await showAlert({
        title: "All Submissions Cleared",
        message: "All submissions for this quiz have been cleared successfully.",
        type: "success",
        icon: "check"
      });
    } catch (err: any) {
      console.error("Failed to reset all submissions:", err);
      await showAlert({
        title: "Reset Error",
        message: "Error resetting submissions: " + err.message,
        type: "danger"
      });
    }
  };

  // Ranked Submissions with deterministic leadership place (1st, 2nd, 3rd, ...)
  const rankedSubmissions = React.useMemo(() => {
    const sorted = [...submissions].sort((a, b) => {
      // 1. Primary: Highest score first
      const scoreA = Number(a.score ?? -1);
      const scoreB = Number(b.score ?? -1);
      if (scoreB !== scoreA) return scoreB - scoreA;

      // 2. Secondary: Highest percentage / accuracy
      const pctA = Number(a.percentage ?? 0);
      const pctB = Number(b.percentage ?? 0);
      if (pctB !== pctA) return pctB - pctA;

      // 3. Tertiary: Most correct answers
      const corA = Number(a.correctCount ?? 0);
      const corB = Number(b.correctCount ?? 0);
      if (corB !== corA) return corB - corA;

      // 4. Quaternary: Lowest time spent (faster completion wins)
      const timeA = Number(a.timeSpentSeconds ?? 999999);
      const timeB = Number(b.timeSpentSeconds ?? 999999);
      if (timeA !== timeB) return timeA - timeB;

      // 5. Quinary: Earliest submission timestamp
      const subA = Number(a.submittedAt ?? 0);
      const subB = Number(b.submittedAt ?? 0);
      if (subA !== subB) return subA - subB;

      // 6. Senary: Cleanest proctoring record (fewer violations)
      const violA = Number(a.violationsCount ?? 0);
      const violB = Number(b.violationsCount ?? 0);
      return violA - violB;
    });

    return sorted.map((sub, index) => {
      const rank = index + 1;
      let placeSuffix = "th";
      if (rank % 10 === 1 && rank % 100 !== 11) placeSuffix = "st";
      else if (rank % 10 === 2 && rank % 100 !== 12) placeSuffix = "nd";
      else if (rank % 10 === 3 && rank % 100 !== 13) placeSuffix = "rd";

      const info = resolveParticipantInfo(sub);

      return {
        ...sub,
        rank,
        rankLabel: `${rank}${placeSuffix}`,
        resolvedName: info.displayName,
        rollNo: info.rollNo,
        resolvedTeamName: info.teamName || sub.teamName || "Team Alpha",
        resolvedCollegeName: info.collegeName,
        resolvedCollegePlace: info.collegePlace
      };
    });
  }, [submissions, resolveParticipantInfo]);

  // Filtered Submissions for Table view
  const filteredSubmissions = React.useMemo(() => {
    return rankedSubmissions.filter((sub) => {
      if (subSearchQuery.trim()) {
        const q = subSearchQuery.toLowerCase().trim();
        const matchTeam = (sub.resolvedTeamName || "").toLowerCase().includes(q);
        const matchCollege = (sub.resolvedCollegeName || "").toLowerCase().includes(q);
        const matchPlace = (sub.resolvedCollegePlace || "").toLowerCase().includes(q);
        const matchEmail = (sub.userEmail || "").toLowerCase().includes(q);
        const matchRoll = sub.rollNo ? sub.rollNo.toLowerCase().includes(q) : false;
        const matchRank = sub.rankLabel.toLowerCase() === q || `rank ${sub.rank}` === q || `#${sub.rank}` === q;
        if (!matchTeam && !matchCollege && !matchPlace && !matchEmail && !matchRoll && !matchRank) return false;
      }

      if (subFilterState === "top3") return sub.rank <= 3;
      if (subFilterState === "passed") return sub.passed;
      if (subFilterState === "failed") return !sub.passed && sub.score !== undefined;
      if (subFilterState === "violations") return sub.violationsCount && sub.violationsCount > 0;

      return true;
    });
  }, [rankedSubmissions, subSearchQuery, subFilterState]);

  // Export Results to CSV with Rank, Team Name, College & Place
  const handleExportCSV = async () => {
    if (rankedSubmissions.length === 0) {
      await showAlert({
        title: "Export Notice",
        message: "No submissions are currently available to export.",
        type: "info"
      });
      return;
    }

    const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
    const headers = [
      "Rank / Place",
      "Team Name",
      "College Name",
      "Place / Location",
      "Roll No / Student ID",
      "Score",
      "Max Score",
      "Percentage (%)",
      "Status",
      "Correct Answers",
      "Incorrect Answers",
      "Unanswered",
      "Total Questions",
      "Time Spent (s)",
      "Time Spent (Formatted)",
      "Violations",
      "Submitted At"
    ];

    const rows = rankedSubmissions.map((s) => {
      const scoreVal = s.score ?? "N/A";
      const maxScoreVal = s.maxScore ?? (targetQuiz?.totalMarks || 50);
      const pctVal = s.percentage !== undefined ? `${s.percentage}%` : "N/A";
      const statusVal = s.passed ? "Passed" : (s.score !== undefined ? "Below Cutoff" : "Submitted");
      const formattedTime = `${Math.floor(s.timeSpentSeconds / 60)}m ${s.timeSpentSeconds % 60}s`;

      return [
        `"${s.rankLabel}"`,
        `"${(s.resolvedTeamName || "Solo").replace(/"/g, '""')}"`,
        `"${(s.resolvedCollegeName || "N/A").replace(/"/g, '""')}"`,
        `"${(s.resolvedCollegePlace || "N/A").replace(/"/g, '""')}"`,
        `"${(s.rollNo || "N/A").replace(/"/g, '""')}"`,
        scoreVal,
        maxScoreVal,
        `"${pctVal}"`,
        `"${statusVal}"`,
        s.correctCount ?? "N/A",
        s.incorrectCount ?? "N/A",
        s.unansweredCount ?? 0,
        s.totalQuestions ?? 0,
        s.timeSpentSeconds,
        `"${formattedTime}"`,
        s.violationsCount || 0,
        new Date(s.submittedAt).toISOString()
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `quiz_${selectedQuizId}_team_scorecard.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Excel Sheet Score Editor Modal (Alt + Shift + E)
  const handleOpenExcelScoreEditor = (focusSubmissionId?: string) => {
    if (rankedSubmissions.length === 0) {
      showAlert({
        title: "No Submissions Found",
        message: "There are no team submissions available to edit scores for this quiz.",
        type: "info"
      });
      return;
    }

    const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
    const ptsPerQ = targetQuiz?.pointsPerQuestion || 2;
    const totalQCount = targetQuiz?.questions?.length || targetQuiz?.questionsCount || (targetQuiz?.totalMarks ? Math.round(targetQuiz.totalMarks / ptsPerQ) : 10);
    const defaultMax = targetQuiz?.totalMarks || (totalQCount * ptsPerQ);
    const passThreshold = targetQuiz?.passingMarks || Math.round(defaultMax * 0.4);

    const rows: ExcelScoreRow[] = rankedSubmissions.map((s) => {
      const curScore = s.score !== undefined && s.score !== null ? Number(s.score) : 0;
      const curMax = s.maxScore || defaultMax;
      const subTotalQ = s.totalQuestions || totalQCount;
      const curCorrect = s.correctCount !== undefined ? s.correctCount : Math.min(subTotalQ, Math.round(curScore / ptsPerQ));
      const curIncorrect = s.incorrectCount !== undefined ? s.incorrectCount : Math.max(0, subTotalQ - curCorrect);
      const curPct = curMax > 0 ? Math.min(100, Math.max(0, Math.round((curScore / curMax) * 100))) : 0;
      const curPassed = s.passed ?? (curScore >= passThreshold);
      const curRemarks = (s as any).remarks || "";

      return {
        id: s.id,
        userId: s.userId,
        quizId: s.quizId || selectedQuizId,
        rank: s.rank,
        rankLabel: s.rankLabel,
        teamName: s.resolvedTeamName || "Team Alpha",
        collegeName: s.resolvedCollegeName || "Vishnu Institute of Technology",
        collegePlace: s.resolvedCollegePlace || "Bhimavaram",
        score: curScore,
        maxScore: curMax,
        percentage: curPct,
        correctCount: curCorrect,
        incorrectCount: curIncorrect,
        unansweredCount: s.unansweredCount ?? 0,
        totalQuestions: subTotalQ,
        pointsPerQuestion: ptsPerQ,
        passed: curPassed,
        remarks: curRemarks,
        isModified: false,
        originalScore: curScore,
        originalMaxScore: curMax,
        originalPassed: curPassed,
        originalRemarks: curRemarks,
        originalCorrectCount: curCorrect,
        originalIncorrectCount: curIncorrect,
        timeSpentSeconds: s.timeSpentSeconds,
        submittedAt: s.submittedAt,
        violationsCount: s.violationsCount || 0
      };
    });

    setExcelRows(rows);
    setExcelSearchQuery("");
    setExcelFilter("all");
    setFocusedRowId(focusSubmissionId || null);
    setIsExcelEditorOpen(true);
  };

  // Cell change handlers with strict upper bounds and points-per-question step syncing
  const handleExcelCellScoreChange = (rowId: string, value: string) => {
    const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
    const ptsPerQ = targetQuiz?.pointsPerQuestion || 2;

    setExcelRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const totalQ = row.totalQuestions || (row.maxScore > 0 ? Math.round(row.maxScore / ptsPerQ) : 10);
        const rawNum = value === "" ? 0 : Number(value);
        // Strict boundary: Score cannot exceed row.maxScore and cannot be negative
        // Score must step by ptsPerQ
        let validScore = isNaN(rawNum) ? 0 : Math.max(0, Math.min(row.maxScore, rawNum));
        validScore = Math.round(validScore / ptsPerQ) * ptsPerQ;
        
        const maxSc = row.maxScore > 0 ? row.maxScore : 50;
        const passMarks = targetQuiz?.passingMarks || Math.round(maxSc * 0.4);
        
        // Auto-calculate correct answers and incorrect answers based on points per question
        const newCorrect = Math.min(totalQ, Math.round(validScore / ptsPerQ));
        const newIncorrect = Math.max(0, totalQ - newCorrect);
        const newPct = maxSc > 0 ? Math.min(100, Math.max(0, Math.round((validScore / maxSc) * 100))) : 0;
        const newPassed = validScore >= passMarks;

        const isModified =
          validScore !== row.originalScore ||
          row.maxScore !== row.originalMaxScore ||
          newPassed !== row.originalPassed ||
          row.remarks !== row.originalRemarks ||
          newCorrect !== row.originalCorrectCount ||
          newIncorrect !== row.originalIncorrectCount;

        return {
          ...row,
          score: validScore,
          correctCount: newCorrect,
          incorrectCount: newIncorrect,
          percentage: newPct,
          passed: newPassed,
          isModified
        };
      })
    );
  };

  const handleExcelCellMaxScoreChange = (rowId: string, value: string) => {
    const num = value === "" ? 50 : Number(value);
    const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);

    setExcelRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const validMax = isNaN(num) || num <= 0 ? 50 : num;
        // Clamp existing score so it never exceeds new max marks
        const validScore = Math.min(validMax, row.score);
        const passMarks = targetQuiz?.passingMarks || Math.round(validMax * 0.4);
        const newPct = validMax > 0 ? Math.min(100, Math.max(0, Math.round((validScore / validMax) * 100))) : 0;
        const newPassed = validScore >= passMarks;
        const isModified =
          validScore !== row.originalScore ||
          validMax !== row.originalMaxScore ||
          newPassed !== row.originalPassed ||
          row.remarks !== row.originalRemarks ||
          row.correctCount !== row.originalCorrectCount ||
          row.incorrectCount !== row.originalIncorrectCount;

        return {
          ...row,
          maxScore: validMax,
          score: validScore,
          percentage: newPct,
          passed: newPassed,
          isModified
        };
      })
    );
  };

  const handleExcelCellCorrectChange = (rowId: string, value: string) => {
    const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
    const ptsPerQ = targetQuiz?.pointsPerQuestion || 2;

    setExcelRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const totalQ = row.totalQuestions || (row.maxScore > 0 ? Math.round(row.maxScore / ptsPerQ) : 10);
        const rawNum = value === "" ? 0 : Number(value);
        // Strict boundary: Correct count cannot exceed total questions and cannot be negative
        const validCorrect = isNaN(rawNum) ? 0 : Math.max(0, Math.min(totalQ, rawNum));
        
        // Auto-calculate score in steps of points per question (e.g. 2, 4, 6... or 5, 10, 15...)
        const newScore = Math.min(row.maxScore, validCorrect * ptsPerQ);
        const newIncorrect = Math.max(0, totalQ - validCorrect);
        const maxSc = row.maxScore > 0 ? row.maxScore : 50;
        const passMarks = targetQuiz?.passingMarks || Math.round(maxSc * 0.4);
        const newPct = maxSc > 0 ? Math.min(100, Math.max(0, Math.round((newScore / maxSc) * 100))) : 0;
        const newPassed = newScore >= passMarks;

        const isModified =
          newScore !== row.originalScore ||
          row.maxScore !== row.originalMaxScore ||
          newPassed !== row.originalPassed ||
          row.remarks !== row.originalRemarks ||
          validCorrect !== row.originalCorrectCount ||
          newIncorrect !== row.originalIncorrectCount;

        return {
          ...row,
          correctCount: validCorrect,
          incorrectCount: newIncorrect,
          score: newScore,
          percentage: newPct,
          passed: newPassed,
          isModified
        };
      })
    );
  };

  const handleExcelCellIncorrectChange = (rowId: string, value: string) => {
    const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
    const ptsPerQ = targetQuiz?.pointsPerQuestion || 2;

    setExcelRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const totalQ = row.totalQuestions || (row.maxScore > 0 ? Math.round(row.maxScore / ptsPerQ) : 10);
        const rawNum = value === "" ? 0 : Number(value);
        // Strict boundary: Incorrect count cannot exceed total questions and cannot be negative
        const validIncorrect = isNaN(rawNum) ? 0 : Math.max(0, Math.min(totalQ, rawNum));
        
        const newCorrect = Math.max(0, totalQ - validIncorrect);
        const newScore = Math.min(row.maxScore, newCorrect * ptsPerQ);
        const maxSc = row.maxScore > 0 ? row.maxScore : 50;
        const passMarks = targetQuiz?.passingMarks || Math.round(maxSc * 0.4);
        const newPct = maxSc > 0 ? Math.min(100, Math.max(0, Math.round((newScore / maxSc) * 100))) : 0;
        const newPassed = newScore >= passMarks;

        const isModified =
          newScore !== row.originalScore ||
          row.maxScore !== row.originalMaxScore ||
          newPassed !== row.originalPassed ||
          row.remarks !== row.originalRemarks ||
          newCorrect !== row.originalCorrectCount ||
          validIncorrect !== row.originalIncorrectCount;

        return {
          ...row,
          correctCount: newCorrect,
          incorrectCount: validIncorrect,
          score: newScore,
          percentage: newPct,
          passed: newPassed,
          isModified
        };
      })
    );
  };

  const handleExcelCellRemarksChange = (rowId: string, value: string) => {
    setExcelRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const isModified =
          row.score !== row.originalScore ||
          row.maxScore !== row.originalMaxScore ||
          row.passed !== row.originalPassed ||
          value !== row.originalRemarks ||
          row.correctCount !== row.originalCorrectCount ||
          row.incorrectCount !== row.originalIncorrectCount;

        return {
          ...row,
          remarks: value,
          isModified
        };
      })
    );
  };

  const handleExcelCellPassedToggle = (rowId: string) => {
    setExcelRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const newPassed = !row.passed;
        const isModified =
          row.score !== row.originalScore ||
          row.maxScore !== row.originalMaxScore ||
          newPassed !== row.originalPassed ||
          row.remarks !== row.originalRemarks ||
          row.correctCount !== row.originalCorrectCount ||
          row.incorrectCount !== row.originalIncorrectCount;

        return {
          ...row,
          passed: newPassed,
          isModified
        };
      })
    );
  };

  const handleExcelRevertRow = (rowId: string) => {
    setExcelRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          score: row.originalScore,
          maxScore: row.originalMaxScore,
          percentage: row.originalMaxScore > 0 ? Math.min(100, Math.max(0, Math.round((row.originalScore / row.originalMaxScore) * 100))) : 0,
          correctCount: row.originalCorrectCount,
          incorrectCount: row.originalIncorrectCount,
          passed: row.originalPassed,
          remarks: row.originalRemarks,
          isModified: false
        };
      })
    );
  };

  const handleExcelApplyBonus = (bonus: number) => {
    const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
    const ptsPerQ = targetQuiz?.pointsPerQuestion || 2;

    setExcelRows((prev) =>
      prev.map((row) => {
        const totalQ = row.totalQuestions || (row.maxScore > 0 ? Math.round(row.maxScore / ptsPerQ) : 10);
        const newScore = Math.max(0, Math.min(row.maxScore, row.score + bonus));
        const newCorrect = Math.min(totalQ, Math.round(newScore / ptsPerQ));
        const newIncorrect = Math.max(0, totalQ - newCorrect);
        const maxSc = row.maxScore > 0 ? row.maxScore : 50;
        const passMarks = targetQuiz?.passingMarks || Math.round(maxSc * 0.4);
        const newPct = maxSc > 0 ? Math.min(100, Math.max(0, Math.round((newScore / maxSc) * 100))) : 0;
        const newPassed = newScore >= passMarks;
        const isModified =
          newScore !== row.originalScore ||
          row.maxScore !== row.originalMaxScore ||
          newPassed !== row.originalPassed ||
          row.remarks !== row.originalRemarks ||
          newCorrect !== row.originalCorrectCount ||
          newIncorrect !== row.originalIncorrectCount;

        return {
          ...row,
          score: newScore,
          correctCount: newCorrect,
          incorrectCount: newIncorrect,
          percentage: newPct,
          passed: newPassed,
          isModified
        };
      })
    );
  };

  const handleExcelDiscardChanges = async () => {
    const modifiedCount = excelRows.filter((r) => r.isModified).length;
    if (modifiedCount > 0) {
      const confirmed = await showConfirm({
        title: "Discard All Changes?",
        message: `You have ${modifiedCount} modified team score${modifiedCount === 1 ? "" : "s"}. Are you sure you want to revert all changes?`,
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
        type: "warning",
        icon: "rotate"
      });
      if (!confirmed) return;
    }

    setExcelRows((prev) =>
      prev.map((r) => ({
        ...r,
        score: r.originalScore,
        maxScore: r.originalMaxScore,
        percentage: r.originalMaxScore > 0 ? Math.min(100, Math.max(0, Math.round((r.originalScore / r.originalMaxScore) * 100))) : 0,
        correctCount: r.originalCorrectCount,
        incorrectCount: r.originalIncorrectCount,
        passed: r.originalPassed,
        remarks: r.originalRemarks,
        isModified: false
      }))
    );
  };

  const handleSaveAllExcelChanges = async () => {
    const modifiedRows = excelRows.filter((r) => r.isModified);
    if (modifiedRows.length === 0) {
      await showAlert({
        title: "No Changes Detected",
        message: "No team scores have been modified in the spreadsheet.",
        type: "info"
      });
      return;
    }

    try {
      setIsSavingExcel(true);
      const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
      const currentOverridden = (targetQuiz as any)?.overriddenScores || {};
      const newOverridden = { ...currentOverridden };

      modifiedRows.forEach((r) => {
        newOverridden[r.id] = {
          score: r.score,
          maxScore: r.maxScore,
          percentage: r.percentage,
          correctCount: r.correctCount,
          incorrectCount: r.incorrectCount,
          passed: r.passed,
          remarks: r.remarks,
          isScoreOverridden: true,
          originalScore: r.originalScore,
          scoreOverriddenAt: Date.now(),
          evaluatedAt: Date.now()
        };
      });

      // Save overriding scores into the quiz object directly to bypass backend endpoint issues
      await api.updateQuiz(selectedQuizId, { overriddenScores: newOverridden });

      // Update local state to reflect changes immediately
      setQuizzes(prev => prev.map(q => q.id === selectedQuizId ? { ...q, overriddenScores: newOverridden } : q));
      
      setSubmissions(prev => prev.map(sub => {
        if (newOverridden[sub.id]) {
          return { ...sub, ...newOverridden[sub.id] };
        }
        return sub;
      }));

      // Mark excel rows as saved
      setExcelRows((prev) =>
        prev.map((r) => ({
          ...r,
          originalScore: r.score,
          originalMaxScore: r.maxScore,
          originalPassed: r.passed,
          originalRemarks: r.remarks,
          originalCorrectCount: r.correctCount,
          originalIncorrectCount: r.incorrectCount,
          isModified: false
        }))
      );

      await showAlert({
        title: "Scores Saved Successfully",
        message: `Updated ${modifiedRows.length} team score${modifiedRows.length === 1 ? "" : "s"} locally via Quiz configuration.`,
        type: "success"
      });
    } catch (err: any) {
      console.error("Failed to batch save spreadsheet changes:", err);
      await showAlert({
        title: "Save Failed",
        message: "Failed to save scores: " + err.message,
        type: "danger"
      });
    } finally {
      setIsSavingExcel(false);
    }
  };

  const handleCloseExcelEditor = async () => {
    const modifiedCount = excelRows.filter((r) => r.isModified).length;
    if (modifiedCount > 0) {
      const confirmed = await showConfirm({
        title: "Unsaved Changes",
        message: `You have ${modifiedCount} unsaved score changes in the spreadsheet. Do you want to discard them and close?`,
        confirmText: "Discard & Close",
        cancelText: "Keep Editing",
        type: "warning",
        icon: "alert"
      });
      if (!confirmed) return;
    }
    setIsExcelEditorOpen(false);
  };

  const handleExportExcelSheetCSV = () => {
    const headers = [
      "Rank / Place",
      "Team Name",
      "College Name",
      "Place / Location",
      "Score",
      "Max Score",
      "Percentage (%)",
      "Status",
      "Correct Count",
      "Incorrect Count",
      "Remarks / Notes"
    ];

    const rows = excelRows.map((r) => [
      `"${r.rankLabel}"`,
      `"${r.teamName.replace(/"/g, '""')}"`,
      `"${r.collegeName.replace(/"/g, '""')}"`,
      `"${r.collegePlace.replace(/"/g, '""')}"`,
      r.score,
      r.maxScore,
      `"${r.percentage}%"`,
      `"${r.passed ? "Passed" : "Below Cutoff"}"`,
      r.correctCount,
      r.incorrectCount,
      `"${(r.remarks || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `quiz_${selectedQuizId}_scores_spreadsheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredExcelRows = React.useMemo(() => {
    return excelRows.filter((r) => {
      if (excelSearchQuery.trim()) {
        const q = excelSearchQuery.toLowerCase().trim();
        const matchTeam = r.teamName.toLowerCase().includes(q);
        const matchCollege = r.collegeName.toLowerCase().includes(q);
        const matchPlace = r.collegePlace.toLowerCase().includes(q);
        const matchRemarks = r.remarks.toLowerCase().includes(q);
        const matchRank = r.rankLabel.toLowerCase() === q || `rank ${r.rank}` === q || `#${r.rank}` === q;
        if (!matchTeam && !matchCollege && !matchPlace && !matchRemarks && !matchRank) return false;
      }

      if (excelFilter === "modified") return r.isModified;
      if (excelFilter === "passed") return r.passed;
      if (excelFilter === "failed") return !r.passed;

      return true;
    });
  }, [excelRows, excelSearchQuery, excelFilter]);

  // Keyboard shortcut listener: Alt + Shift + E
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isAltShiftE = e.altKey && e.shiftKey && (e.key === "e" || e.key === "E" || e.code === "KeyE" || e.key === "€");
      if (isAltShiftE) {
        e.preventDefault();
        
        if (isExcelEditorOpen) return;

        if (inspectingSubmission) {
          handleOpenExcelScoreEditor(inspectingSubmission.id);
          return;
        }

        if (filteredSubmissions.length > 0) {
          handleOpenExcelScoreEditor(filteredSubmissions[0].id);
          return;
        }

        if (rankedSubmissions.length > 0) {
          setActiveTab("submissions");
          handleOpenExcelScoreEditor(rankedSubmissions[0].id);
          return;
        }

        showAlert({
          title: "No Submissions Available",
          message: "There are no team submissions available to edit for this quiz yet.",
          type: "info"
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExcelEditorOpen, inspectingSubmission, filteredSubmissions, rankedSubmissions, activeTab, showAlert]);

  const inProgressSessions = activeSessions.filter((s) => s.status === "in_progress");

  const handleBackToEventAccess = () => {
    const targetEventId = eventIdParam || (quizzes.find(q => q.id === selectedQuizId)?.eventId) || "";
    const basePath = user?.role === "organizer" ? "/organizer/attendance" : "/faculty/events";
    if (targetEventId && user?.role !== "organizer") {
      navigate(`${basePath}?accessEventId=${targetEventId}`);
    } else {
      navigate(basePath);
    }
  };

  // =========================================================================
  // RENDER FULL-PAGE QUIZ BUILDER / EDITOR VIEW (REDESIGNED)
  // =========================================================================
  if (isEditorMode && editingQuiz) {
    const questionsList = editingQuiz.questions || [];
    const currentQuestion = questionsList[currentQuestionIndex] || null;
    const totalQuestions = questionsList.length;

    // Helper functions for editor
    const handleAddCategory = () => {
      setShowCategoryModal(true);
      setNewCategoryName("");
    };

    const handleSaveCategory = () => {
      const trimmed = newCategoryName.trim();
      if (!trimmed) return;
      if (!customCategories.includes(trimmed)) {
        setCustomCategories([...customCategories, trimmed]);
      }
      setSelectedCategoryView(trimmed);
      setCurrentQuestionIndex(-1); // Switch to the empty category view
      setShowCategoryModal(false);
      setNewCategoryName("");
    };

    const updateCurrentQuestion = (updates: Partial<QuizQuestion>) => {
      if (!currentQuestion) return;
      const newQuestions = [...questionsList];
      newQuestions[currentQuestionIndex] = { ...currentQuestion, ...updates };
      setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };

    const updateOption = (optionId: string, text: string) => {
      if (!currentQuestion) return;
      const nextOptions = currentQuestion.options.map(opt => 
        opt.id === optionId ? { ...opt, text } : opt
      );
      updateCurrentQuestion({ options: nextOptions });
    };

    const addQuestion = async () => {
      if (!selectedCategoryView || selectedCategoryView.trim() === "") {
        await showAlert({
          title: "Select Category",
          message: "Please create and select a Category from the right panel before adding a new question.",
          type: "warning",
          icon: "alert"
        });
        return;
      }

      const nextNum = totalQuestions + 1;
      const pts = Number(editingQuiz.pointsPerQuestion) || 2;
      const newQ: QuizQuestion = {
        id: `q_${Date.now()}_${nextNum}`,
        questionNumber: nextNum,
        text: "",
        points: pts,
        category: selectedCategoryView,
        options: [
          { id: "opt_a", text: "" },
          { id: "opt_b", text: "" },
          { id: "opt_c", text: "" },
          { id: "opt_d", text: "" }
        ],
        correctOptionId: ""
      };
      const newQuestions = [...questionsList, newQ];
      setEditingQuiz({
        ...editingQuiz,
        questions: newQuestions,
        totalMarks: newQuestions.length * pts
      });
      setCurrentQuestionIndex(newQuestions.length - 1);
    };

    const deleteQuestion = async (idx: number) => {
      const confirmed = await showConfirm({
        title: "Delete Question?",
        message: "Are you sure you want to delete this question?",
        confirmText: "Delete",
        cancelText: "Cancel",
        type: "danger",
        icon: "trash"
      });
      if (!confirmed) return;

      const next = questionsList.filter((_, i) => i !== idx);
      const pts = Number(editingQuiz.pointsPerQuestion) || 2;
      setEditingQuiz({
        ...editingQuiz,
        questions: next,
        totalMarks: next.length * pts
      });
      if (currentQuestionIndex >= next.length) {
        setCurrentQuestionIndex(Math.max(0, next.length - 1));
      }
    };

    const handleBulkParseAndPreview = (text: string, category: string) => {
      const parsed = parseQuestionsFromText(text, category || selectedCategoryView || "General");
      setParsedBulkQuestions(parsed);
    };

    const handleTriggerAiScan = async (textToScan?: string, targetCat?: string) => {
      const content = (textToScan ?? pdfRawText).trim();
      if (!content) return;
      setIsAiScanning(true);
      setAiScanSuccess(false);

      try {
        const cat = (targetCat ?? pdfTargetCategory ?? selectedCategoryView ?? "General").trim();
        const { questions: aiQuestions, usedAI } = await extractQuizQuestionsWithGemini(content, cat);
        if (aiQuestions && aiQuestions.length > 0) {
          setParsedBulkQuestions(aiQuestions);
          setAiScanSuccess(usedAI);
        } else {
          handleBulkParseAndPreview(content, cat);
        }
      } catch (err) {
        console.error("AI Scan failed, falling back:", err);
        handleBulkParseAndPreview(content, targetCat || pdfTargetCategory || selectedCategoryView || "General");
      } finally {
        setIsAiScanning(false);
      }
    };

    const handleTogglePreviewAnswer = (qIdx: number, optId: string) => {
      const updated = [...parsedBulkQuestions];
      if (updated[qIdx]) {
        updated[qIdx] = {
          ...updated[qIdx],
          correctOptionId: optId
        };
        setParsedBulkQuestions(updated);
      }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPdfFileName(file.name);
      setIsParsingPdf(true);
      setAiScanSuccess(false);

      try {
        let cleanText = "";
        if (file.name.toLowerCase().endsWith(".pdf")) {
          cleanText = await extractTextFromPdf(file);
        } else {
          cleanText = await file.text();
        }

        setPdfRawText(cleanText);
        
        // Immediate AI-enhanced scanning & answer marking
        await handleTriggerAiScan(cleanText, pdfTargetCategory || selectedCategoryView || "General");
      } catch (err) {
        console.error("Failed to read file:", err);
        await showAlert({
          title: "Extraction Notice",
          message: "Could not extract text from this file. You can paste the questions text directly.",
          type: "warning"
        });
      } finally {
        setIsParsingPdf(false);
      }
    };

    const handleApplyBulkImport = async () => {
      if (parsedBulkQuestions.length === 0) {
        await showAlert({
          title: "No Questions Detected",
          message: "No valid questions detected. Please verify your questions format or paste valid questions text.",
          type: "warning"
        });
        return;
      }

      const targetCat = (pdfTargetCategory || selectedCategoryView || "General").trim();
      const existingCats = [...customCategories];
      if (targetCat && !existingCats.includes(targetCat)) {
        setCustomCategories([...existingCats, targetCat]);
      }

      const startNum = questionsList.length + 1;
      const pts = Number(editingQuiz.pointsPerQuestion) || 2;
      const formattedImported = parsedBulkQuestions.map((q, idx) => ({
        ...q,
        questionNumber: startNum + idx,
        category: q.category || targetCat,
        points: pts
      }));

      const merged = [...questionsList, ...formattedImported];
      setEditingQuiz({
        ...editingQuiz,
        questions: merged,
        totalMarks: merged.length * pts
      });

      setSelectedCategoryView(targetCat);
      setCurrentQuestionIndex(questionsList.length);
      setShowPdfBulkModal(false);
      setPdfFileName("");
      setPdfRawText("");
      setParsedBulkQuestions([]);
      await showAlert({
        title: "Import Successful",
        message: `Successfully added ${formattedImported.length} question(s) into category "${targetCat}"!`,
        type: "success",
        icon: "check"
      });
    };

    const loadSampleQuestions = () => {
      const sample = `1. What is the core mechanism behind Transformer models in AI?
A) Self-Attention mechanism
B) Convolutional pooling
C) Recurrent memory cell
D) Decision tree splitting
Answer: A

2. Which metric is commonly used to evaluate classification models with imbalanced datasets?
A) F1-Score
B) Mean Squared Error (MSE)
C) R-Squared
D) Latency
Answer: A

3. In React 19, which hook is used for asynchronous state transitions?
A) useTransition
B) useEffect
C) useReducer
D) useLayoutEffect
Answer: A`;
      setPdfRawText(sample);
      handleBulkParseAndPreview(sample, pdfTargetCategory || selectedCategoryView || "General");
    };

    return (
      <div className="min-h-screen bg-[#F4F7FC] flex flex-col font-sans text-slate-800 antialiased select-none pb-24">
        <SEO
          title={editingQuiz.id ? `Edit: ${editingQuiz.title || "Quiz"} - AI Verse` : "Create Assessment - AI Verse"}
            description="Full-page high-concurrency quiz builder and question manager."
          />

          {/* ================= TOP NAV BAR ================= */}
          <header className="h-16 px-4 sm:px-8 border-b border-slate-200/90 bg-white flex items-center justify-between sticky top-0 z-30 shadow-xs">
            {/* Left Brand & Quiz Info */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={async () => {
                  const confirmed = await showConfirm({
                    title: "Discard Changes?",
                    message: "Discard unsaved changes and return to quiz list?",
                    confirmText: "Discard Changes",
                    cancelText: "Continue Editing",
                    type: "warning",
                    icon: "alert"
                  });
                  if (confirmed) {
                    setIsEditorMode(false);
                    setEditingQuiz(null);
                    setCurrentQuestionIndex(0);
                  }
                }}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer mr-2"
                title="Back to Quiz List"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0 hidden md:block">
                <h1 className="text-sm font-black text-[#0F172A] truncate tracking-tight">{editingQuiz.title || "Untitled Assessment"}</h1>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                  Admin Editor Mode
                </p>
              </div>
            </div>

            {/* Right: Save Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveQuiz}
                disabled={saving || !editingQuiz.title?.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save & Publish</span>
              </button>
            </div>
          </header>

          {/* ================= MAIN EDITOR GRID ================= */}
          <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ================= LEFT COLUMN: QUESTION EDITOR (8 COLS) ================= */}
            <div className="lg:col-span-8 space-y-5">
              
              {/* Question Card */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                
                {/* Question Top Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-blue-700 font-extrabold text-xs px-3 py-1 rounded-full border border-blue-200/70">
                      {currentQuestionIndex >= 0 ? `Question ${currentQuestionIndex + 1} of ${totalQuestions}` : "Question Editor"}
                    </span>
                  </div>

                  {currentQuestion && (
                    <button
                      onClick={() => deleteQuestion(currentQuestionIndex)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Question</span>
                    </button>
                  )}
                </div>

                {!currentQuestion ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                     <div className="w-16 h-16 bg-slate-50 border border-dashed border-slate-200 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-slate-400" />
                     </div>
                     <div>
                       <h3 className="text-base font-extrabold text-[#0F172A]">No Question Selected</h3>
                       <p className="text-xs text-slate-500 font-medium mt-1">Please select a category from the right panel and click Add New Question.</p>
                     </div>
                  </div>
                ) : (
                  <>
                    {/* Question Text */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Question Text</label>
                      <textarea
                        value={currentQuestion.text}
                        onChange={(e) => updateCurrentQuestion({ text: e.target.value })}
                        rows={2}
                        className="w-full text-base sm:text-lg font-bold text-[#0F172A] leading-relaxed p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your question here..."
                      />
                    </div>

                    {/* Options List */}
                    <div className="pt-4 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                        OPTIONS & CORRECT ANSWER:
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentQuestion.options.map((option, idx) => {
                        const isCorrect = currentQuestion.correctOptionId === option.id;
                        const optionLetters = ["A", "B", "C", "D", "E", "F"];
                        const letter = optionLetters[idx] || `${idx + 1}`;

                        return (
                          <div
                            key={option.id}
                            className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-4 ${
                              isCorrect
                                ? "bg-emerald-50/70 border-emerald-600 shadow-sm ring-1 ring-emerald-500/20"
                                : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {/* Correct Radio Button */}
                            <button
                              type="button"
                              onClick={() => updateCurrentQuestion({ correctOptionId: option.id })}
                              className={`w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center border-2 transition-colors cursor-pointer ${
                                isCorrect 
                                  ? "bg-emerald-500 border-emerald-600 text-white" 
                                  : "bg-white border-slate-300 text-transparent hover:border-emerald-400"
                              }`}
                              title="Mark as correct answer"
                            >
                              <Check className="w-5 h-5" />
                            </button>

                            {/* Option Letter Circle */}
                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex flex-shrink-0 items-center justify-center">
                              {letter}
                            </div>

                            {/* Option Text Input */}
                            <input
                              type="text"
                              value={option.text}
                              onChange={(e) => updateOption(option.id, e.target.value)}
                              className={`flex-1 text-sm font-medium leading-relaxed bg-transparent outline-none ${
                                isCorrect ? "text-emerald-950 font-bold" : "text-slate-700"
                              }`}
                              placeholder={`Option ${letter} text...`}
                            />
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </>
                )}

                {/* Question Navigation Controls */}
                {selectedCategoryView && (() => {
                  const categoryItems = questionsList.map((q, idx) => ({ q, idx })).filter(item => item.q.category === selectedCategoryView);
                  const currentLocalIdx = categoryItems.findIndex(item => item.idx === currentQuestionIndex);
                  const hasPrev = currentLocalIdx > 0;
                  const hasNext = currentLocalIdx >= 0 && currentLocalIdx < categoryItems.length - 1;

                  return (
                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 gap-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => hasPrev && setCurrentQuestionIndex(categoryItems[currentLocalIdx - 1].idx)}
                          disabled={!hasPrev}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Previous</span>
                        </button>

                        <button
                          onClick={() => hasNext && setCurrentQuestionIndex(categoryItems[currentLocalIdx + 1].idx)}
                          disabled={!hasNext}
                          className="bg-[#0F172A] hover:bg-slate-800 text-white disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>Next</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={addQuestion}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-blue-200"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

          {/* ================= RIGHT COLUMN: PALETTE & SETTINGS (4 COLS) ================= */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Question Palette Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="space-y-1.5 pb-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category View</label>
                    <button
                      onClick={handleAddCategory}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Add new category"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <select
                    value={selectedCategoryView}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setSelectedCategoryView(newCat);
                      if (newCat) {
                        const firstIdx = questionsList.findIndex(q => q.category === newCat);
                        setCurrentQuestionIndex(firstIdx !== -1 ? firstIdx : -1);
                      } else {
                        setCurrentQuestionIndex(-1);
                      }
                    }}
                    className="w-full text-xs font-bold text-[#0F172A] p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="">Select Category</option>
                    {customCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <h3 className="text-sm font-extrabold text-[#0F172A] uppercase tracking-wider">
                  Question Grid
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {totalQuestions} Total
                </span>
              </div>

              {/* Question Buttons Matrix Grouped by Category */}
              <div className="max-h-[320px] overflow-y-auto p-1 space-y-4">
                {!selectedCategoryView ? (
                  <div className="text-center p-4 text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Select a category to view questions.
                  </div>
                ) : (() => {
                  const items = questionsList.map((q, idx) => ({ q, idx })).filter(item => item.q.category === selectedCategoryView);
                  if (items.length === 0) {
                     return <div className="text-center p-4 text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">No questions in this category yet.</div>;
                  }

                  return (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>{selectedCategoryView}</span>
                        <span className="text-slate-300">{items.length}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {items.map((item, localIdx) => {
                          const { q, idx } = item;
                          const isCurrent = currentQuestionIndex === idx;
                          const hasValidAnswer = !!q.correctOptionId && q.options.some(opt => opt.id === q.correctOptionId && opt.text.trim().length > 0);
                          const hasText = q.text.trim().length > 0;
                          const hasCategory = !!q.category && q.category.trim().length > 0;
                          const isComplete = hasValidAnswer && hasText && hasCategory;

                          let btnStyle = isComplete ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-red-50 text-red-500 border border-red-200 border-dashed";
                          
                          if (isCurrent) {
                            btnStyle = "bg-blue-600 text-white font-black shadow-xs ring-3 ring-blue-500 ring-offset-2";
                          }

                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => setCurrentQuestionIndex(idx)}
                              className={`h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center relative cursor-pointer ${btnStyle}`}
                              title={!isComplete ? "Missing question text or correct answer" : ""}
                            >
                              <span>{localIdx + 1}</span>
                              {!isComplete && !isCurrent && (
                                <AlertCircle className="absolute -top-1.5 -right-1.5 w-3 h-3 text-red-500 bg-white rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {selectedCategoryView && (
                  <div className="space-y-2 mt-4">
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="w-full h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 active:scale-[0.99]"
                      title="Add Question"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      <span>Add New Question</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPdfTargetCategory(selectedCategoryView || customCategories[0] || "General");
                        setShowPdfBulkModal(true);
                      }}
                      className="w-full h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 border border-blue-200/90 shadow-2xs active:scale-[0.99]"
                      title="Add Bulk using PDF"
                    >
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span>Add Bulk using PDF</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Settings & Save Actions */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                >
                  <FileText className="w-4 h-4" />
                  <span>Edit Quiz Settings</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleSaveQuiz}
                  disabled={saving || !editingQuiz.title?.trim()}
                  className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-black text-sm py-3.5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Assessment</span>
                </button>
                <p className="text-[11px] text-center text-slate-400 font-medium">
                  {editingQuiz.status === "draft" ? "Currently saved as Draft" : "Currently Active & Published"}
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* ================= GLOBAL SETTINGS MODAL ================= */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden text-left max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Assessment Settings</span>
                </h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-left overflow-y-auto flex-1 min-h-0 pr-1">
                {/* Quiz Title */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Quiz Title</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingQuiz.title || ""}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                    placeholder="e.g. AI Verse 2026 Core Technical Assessment"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-2xs"
                  />
                </div>

                {/* Associated Event */}
                <div className="space-y-1 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <label className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Associated Event</span>
                    <span className="text-[10px] text-blue-500 font-medium">(Links quiz to active event)</span>
                  </label>
                  <select
                    value={editingQuiz.eventId || ""}
                    onChange={(e) => {
                      const evId = e.target.value;
                      const selectedEv = events.find((ev) => ev.id === evId);
                      setEditingQuiz({
                        ...editingQuiz,
                        eventId: evId,
                        eventTitle: selectedEv ? selectedEv.title : "",
                        track: selectedEv?.category ? `${selectedEv.category} Track` : editingQuiz.track
                      });
                    }}
                    className="w-full px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-slate-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer mt-1"
                  >
                    <option value="">-- Select Associated Event --</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} {ev.category ? `(${ev.category})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Points & Total Marks Configuration (Below Associated Event) */}
                <div className="bg-gradient-to-r from-amber-50/70 via-amber-50/40 to-blue-50/60 p-3.5 rounded-2xl border border-amber-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600" />
                      <span>Scoring & Question Weightage</span>
                    </label>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      {editingQuiz.questions?.length || 0} Question{(editingQuiz.questions?.length || 0) === 1 ? "" : "s"} Configured
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Points per Question
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={editingQuiz.pointsPerQuestion || 2}
                        onChange={(e) => {
                          const pts = Math.max(1, Number(e.target.value) || 1);
                          const qCount = editingQuiz.questions?.length || 0;
                          const calcTotal = qCount * pts;
                          const updatedQuestions = editingQuiz.questions?.map((q) => ({
                            ...q,
                            points: pts
                          })) || [];
                          setEditingQuiz({
                            ...editingQuiz,
                            pointsPerQuestion: pts,
                            totalMarks: calcTotal,
                            questions: updatedQuestions
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. 2"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Calculated Total Marks
                      </label>
                      <div className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-black flex items-center justify-between shadow-2xs">
                        <span>{((editingQuiz.questions?.length || 0) * (editingQuiz.pointsPerQuestion || 2))} Marks</span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          ({editingQuiz.questions?.length || 0} Qs × {editingQuiz.pointsPerQuestion || 2} pts)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Description</label>
                  <textarea
                    value={editingQuiz.description || ""}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })}
                    rows={2}
                    placeholder="Brief description or instructions for participants..."
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                {/* Schedule: Start & End Date/Time */}
                <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-blue-50/60 p-3.5 rounded-2xl border border-indigo-200/70 space-y-2.5">
                  <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Quiz Schedule (Auto Start & End)</span>
                  </label>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Set when the quiz automatically opens and closes. Participants can only attempt the quiz within this window.
                  </p>

                  <div className="space-y-1 mt-2 mb-3">
                    <label className="text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Participant Time Limit (Minutes)</span>
                    </label>
                    <p className="text-[9px] text-indigo-500 mb-1">Once started, participants must complete the quiz within this duration.</p>
                    <input
                      type="number"
                      min={1}
                      value={editingQuiz.durationMinutes || 30}
                      onChange={(e) => setEditingQuiz({ ...editingQuiz, durationMinutes: Math.max(1, parseInt(e.target.value) || 30) })}
                      className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
                      placeholder="e.g. 60"
                    />
                  </div>

                  {/* Start Date & Time */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-indigo-700 block">Start Date & Time</label>
                    <div className="grid grid-cols-2 gap-2">
                      <DatePicker
                        value={editingQuiz.scheduledStartTime ? (() => {
                          const d = new Date(editingQuiz.scheduledStartTime);
                          const year = d.getFullYear();
                          const month = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          return `${year}-${month}-${day}`;
                        })() : ""}
                        onChange={(dateVal) => {
                          if (dateVal) {
                            const [y, m, d] = dateVal.split("-").map(Number);
                            const existing = editingQuiz.scheduledStartTime ? new Date(editingQuiz.scheduledStartTime) : new Date();
                            existing.setFullYear(y, m - 1, d);
                            if (!editingQuiz.scheduledStartTime) {
                              existing.setHours(9, 0, 0, 0);
                            }
                            setEditingQuiz({ ...editingQuiz, scheduledStartTime: existing.getTime() });
                          } else {
                            setEditingQuiz({ ...editingQuiz, scheduledStartTime: undefined });
                          }
                        }}
                        placeholder="Select start date"
                        className="bg-white border-indigo-200 hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500 text-xs font-bold"
                      />
                      <TimePicker
                        value={editingQuiz.scheduledStartTime ? (() => {
                          const d = new Date(editingQuiz.scheduledStartTime);
                          let h = d.getHours();
                          const m = String(d.getMinutes()).padStart(2, "0");
                          const p = h >= 12 ? "PM" : "AM";
                          if (h > 12) h -= 12;
                          if (h === 0) h = 12;
                          return `${String(h).padStart(2, "0")}:${m} ${p}`;
                        })() : ""}
                        onChange={(timeVal) => {
                          if (timeVal) {
                            let h = 9, m = 0;
                            if (timeVal.includes("AM") || timeVal.includes("PM")) {
                              const parts = timeVal.trim().split(" ");
                              const p = parts[1]?.toUpperCase();
                              const [rawH, rawM] = (parts[0] || "09:00").split(":").map(Number);
                              h = rawH;
                              if (p === "PM" && h < 12) h += 12;
                              if (p === "AM" && h === 12) h = 0;
                              m = rawM || 0;
                            } else if (timeVal.includes(":")) {
                              const [rawH, rawM] = timeVal.split(":").map(Number);
                              h = rawH;
                              m = rawM || 0;
                            }
                            const existing = editingQuiz.scheduledStartTime ? new Date(editingQuiz.scheduledStartTime) : new Date();
                            existing.setHours(h, m, 0, 0);
                            setEditingQuiz({ ...editingQuiz, scheduledStartTime: existing.getTime() });
                          }
                        }}
                        placeholder="Select start time"
                        align="right"
                        className="bg-white border-indigo-200 hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* End Date & Time */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-indigo-700 block">End Date & Time</label>
                    <div className="grid grid-cols-2 gap-2">
                      <DatePicker
                        value={editingQuiz.scheduledEndTime ? (() => {
                          const d = new Date(editingQuiz.scheduledEndTime);
                          const year = d.getFullYear();
                          const month = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          return `${year}-${month}-${day}`;
                        })() : ""}
                        minDate={editingQuiz.scheduledStartTime ? (() => {
                          const d = new Date(editingQuiz.scheduledStartTime);
                          const year = d.getFullYear();
                          const month = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          return `${year}-${month}-${day}`;
                        })() : undefined}
                        onChange={(dateVal) => {
                          if (dateVal) {
                            const [y, m, d] = dateVal.split("-").map(Number);
                            const existing = editingQuiz.scheduledEndTime ? new Date(editingQuiz.scheduledEndTime) : new Date();
                            existing.setFullYear(y, m - 1, d);
                            if (!editingQuiz.scheduledEndTime) {
                              if (editingQuiz.scheduledStartTime) {
                                const start = new Date(editingQuiz.scheduledStartTime);
                                existing.setHours(start.getHours() + 1, start.getMinutes(), 0, 0);
                              } else {
                                existing.setHours(existing.getHours() + 1, 0, 0, 0);
                              }
                            }
                            setEditingQuiz({ ...editingQuiz, scheduledEndTime: existing.getTime() });
                          } else {
                            setEditingQuiz({ ...editingQuiz, scheduledEndTime: undefined });
                          }
                        }}
                        placeholder="Select end date"
                        className="bg-white border-indigo-200 hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500 text-xs font-bold"
                      />
                      <TimePicker
                        value={editingQuiz.scheduledEndTime ? (() => {
                          const d = new Date(editingQuiz.scheduledEndTime);
                          let h = d.getHours();
                          const m = String(d.getMinutes()).padStart(2, "0");
                          const p = h >= 12 ? "PM" : "AM";
                          if (h > 12) h -= 12;
                          if (h === 0) h = 12;
                          return `${String(h).padStart(2, "0")}:${m} ${p}`;
                        })() : ""}
                        onChange={(timeVal) => {
                          if (timeVal) {
                            let h = 10, m = 0;
                            if (timeVal.includes("AM") || timeVal.includes("PM")) {
                              const parts = timeVal.trim().split(" ");
                              const p = parts[1]?.toUpperCase();
                              let defaultEndStr = "10:00";
                              if (editingQuiz.scheduledStartTime) {
                                const endD = new Date(editingQuiz.scheduledStartTime + (editingQuiz.durationMinutes || 30) * 60000);
                                let eh = endD.getHours();
                                const em = String(endD.getMinutes()).padStart(2, '0');
                                if (eh > 12) eh -= 12;
                                if (eh === 0) eh = 12;
                                defaultEndStr = `${String(eh).padStart(2, '0')}:${em}`;
                              }
                              const [rawH, rawM] = (parts[0] || defaultEndStr).split(":").map(Number);
                              h = rawH;
                              if (p === "PM" && h < 12) h += 12;
                              if (p === "AM" && h === 12) h = 0;
                              m = rawM || 0;
                            } else if (timeVal.includes(":")) {
                              const [rawH, rawM] = timeVal.split(":").map(Number);
                              h = rawH;
                              m = rawM || 0;
                            }
                            const existing = editingQuiz.scheduledEndTime ? new Date(editingQuiz.scheduledEndTime) : new Date();
                            existing.setHours(h, m, 0, 0);
                            setEditingQuiz({ ...editingQuiz, scheduledEndTime: existing.getTime() });
                          }
                        }}
                        placeholder="Select end time"
                        align="right"
                        className="bg-white border-indigo-200 hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {editingQuiz.scheduledStartTime && editingQuiz.scheduledEndTime && (
                    <div className="flex items-center gap-2 mt-1 bg-indigo-100/80 border border-indigo-200/80 rounded-xl px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="text-[10px] font-bold text-indigo-800">
                        Quiz window: {new Date(editingQuiz.scheduledStartTime).toLocaleString()} → {new Date(editingQuiz.scheduledEndTime).toLocaleString()}
                        {" "}({Math.round((editingQuiz.scheduledEndTime - editingQuiz.scheduledStartTime) / 60000)} min)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-bold text-slate-400">
                  Total Marks: <strong className="text-slate-800 font-black">{((editingQuiz.questions?.length || 0) * (editingQuiz.pointsPerQuestion || 2))}</strong>
                </span>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-6 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden border border-slate-100">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="font-extrabold text-[#0F172A] uppercase tracking-wider text-sm">Add Category</h3>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category Name</label>
                  <input
                    type="text"
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveCategory();
                    }}
                    className="w-full text-xs font-bold text-[#0F172A] p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Frontend Development"
                  />
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ADD BULK USING PDF MODAL ================= */}
        {showPdfBulkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200 text-left font-sans">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#0F172A] text-base tracking-tight">
                      Add Bulk Questions using PDF / Document
                    </h3>
                    <p className="text-[11px] text-slate-500 font-semibold">
                      Upload a question paper PDF, text document, or paste multiple MCQs.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPdfBulkModal(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                
                {/* Target Category Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      Target Category
                    </label>
                    <input
                      type="text"
                      value={pdfTargetCategory}
                      onChange={(e) => {
                        setPdfTargetCategory(e.target.value);
                        if (pdfRawText) handleBulkParseAndPreview(pdfRawText, e.target.value);
                      }}
                      placeholder="e.g. q1, Core AI, Frontend"
                      className="w-full text-xs font-bold text-slate-800 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      Existing Categories
                    </label>
                    <select
                      value={pdfTargetCategory}
                      onChange={(e) => {
                        setPdfTargetCategory(e.target.value);
                        if (pdfRawText) handleBulkParseAndPreview(pdfRawText, e.target.value);
                      }}
                      className="w-full text-xs font-bold text-slate-800 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">-- Choose or type custom above --</option>
                      {customCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Upload Box */}
                <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 rounded-2xl p-5 text-center transition-colors relative group">
                  <input
                    type="file"
                    accept=".pdf,.txt,.json,.csv,.md"
                    onChange={handleFileUpload}
                    disabled={isParsingPdf || isAiScanning}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {isParsingPdf || isAiScanning ? <Loader2 className="w-5 h-5 animate-spin text-purple-600" /> : <FileUp className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-blue-900">
                        {isAiScanning ? (
                          <span className="text-purple-700 font-black animate-pulse">✨ Google Gemini AI Scanning & Marking Answers...</span>
                        ) : isParsingPdf ? (
                          "Extracting PDF text streams..."
                        ) : pdfFileName ? (
                          <span className="text-emerald-700 font-black">✓ Loaded: {pdfFileName}</span>
                        ) : (
                          "Click to upload or drag & drop PDF / Text File"
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Supports .pdf, .txt, .json, .csv with Gemini AI auto-detection & answer marking
                      </p>
                    </div>
                  </div>
                </div>

                {/* Textarea for pasting questions / editing */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      Or Paste / Review Questions Text
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTriggerAiScan()}
                        disabled={isAiScanning || isParsingPdf || !pdfRawText.trim()}
                        className="flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-2xs transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                        title="Scan text and mark answers with Google AI Studio (Gemini)"
                      >
                        {isAiScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        <span>AI Scan & Mark Answers</span>
                      </button>

                      <button
                        type="button"
                        onClick={loadSampleQuestions}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        Load Sample
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={pdfRawText}
                    onChange={(e) => {
                      setPdfRawText(e.target.value);
                      handleBulkParseAndPreview(e.target.value, pdfTargetCategory);
                    }}
                    placeholder={`1. What is the primary purpose of...\nA) Option 1\nB) Option 2\nC) Option 3\nD) Option 4\nAnswer: A\n\n2. Next Question...`}
                    className="w-full text-xs font-mono font-medium p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-y leading-relaxed"
                  />
                </div>

                {/* Live Detection Summary & Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Detected Questions ({parsedBulkQuestions.length})
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isAiScanning && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Gemini AI Processing...</span>
                        </span>
                      )}
                      {!isAiScanning && aiScanSuccess && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>Gemini AI Verified ✓</span>
                        </span>
                      )}
                      {parsedBulkQuestions.length > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {parsedBulkQuestions.length} Questions Ready ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {parsedBulkQuestions.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 font-medium">
                      No questions detected yet. Upload a file, paste questions, or click "Load Sample Format".
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {parsedBulkQuestions.map((q, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900">
                              Q{idx + 1}. {q.text}
                            </span>
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              Ans: {(q.correctOptionId || "").replace("opt_", "").toUpperCase() || "A"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 font-medium">
                            {q.options.map((opt) => {
                              const isCorrect = opt.id === q.correctOptionId;
                              return (
                                <button
                                  type="button"
                                  key={opt.id}
                                  onClick={() => handleTogglePreviewAnswer(idx, opt.id)}
                                  className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                                    isCorrect
                                      ? "bg-emerald-100/90 text-emerald-950 font-bold border border-emerald-300 ring-2 ring-emerald-400/40 shadow-2xs"
                                      : "bg-white border border-slate-200/80 hover:bg-slate-100 text-slate-700"
                                  }`}
                                  title={`Click to set option ${opt.id.replace("opt_", "").toUpperCase()} as correct`}
                                >
                                  <span className="truncate">
                                    <span className="font-extrabold mr-1">{opt.id.replace("opt_", "").toUpperCase()})</span>
                                    {opt.text || "(empty)"}
                                  </span>
                                  {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:px-6 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50">
                <div className="text-[11px] font-bold text-slate-500">
                  {parsedBulkQuestions.length} questions will be added to "{pdfTargetCategory || selectedCategoryView || "General"}"
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPdfBulkModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyBulkImport}
                    disabled={parsedBulkQuestions.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-black text-xs px-6 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Import All ({parsedBulkQuestions.length}) Questions</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER MAIN DASHBOARD QUIZ LIST / LIVE CONCURRENCY MONITOR VIEW
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-24">
      <SEO
        title="Quiz & Assessment Management - AI Verse"
        description="Faculty and organizer management portal for creating, editing, and monitoring high-concurrency quizzes."
      />

      {/* Top Standalone Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={user?.role === "organizer" ? "/organizer/attendance" : "/faculty/events"}
              className="flex items-center gap-2.5 group"
            >
              <img src="/ai_verse.png" alt="AI Verse Logo" className="w-8 h-8 rounded-xl object-contain shrink-0 shadow-2xs" />
              <div className="leading-tight text-left">
                <span className="tracking-tight font-sans font-black block text-sm text-slate-900 group-hover:text-blue-600 transition-colors">AI Verse</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Assessment Infrastructure</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Engine Online</span>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-800 shadow-2xs">
              <div className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "SA"}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-black text-slate-800 leading-none">{user?.name || "Super Admin"}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{user?.displayRole || "Admin"}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header Area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              Quiz & Assessment Infrastructure
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              High-concurrency quiz engine supporting 200–500 simultaneous participants on Vercel + Firebase.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackToEventAccess}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Back to Event Access</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Quiz</span>
            </button>
          </div>
        </div>

        {/* Event Scoping Indicator Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs bg-purple-100 text-purple-700 shadow-2xs shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 mb-0.5">
                SELECT EVENT WORKSPACE
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <select
                  value={selectedEventId || "all"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedEventId(val);
                    if (val === "all") {
                      setSearchParams({}, { replace: true });
                    } else {
                      setSearchParams({ eventId: val }, { replace: true });
                    }
                  }}
                  className="w-full text-xs sm:text-sm font-black text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer transition-all truncate"
                >
                  <option value="all">🌐 All Events ({quizzes.length} Total Quizzes across portal)</option>
                  {events.map((ev) => {
                    const count = quizzes.filter(
                      (q) =>
                        q.eventId === ev.id ||
                        (q.eventTitle && ev.title && q.eventTitle.toLowerCase().trim() === ev.title.toLowerCase().trim())
                    ).length;
                    return (
                      <option key={ev.id} value={ev.id}>
                        📅 {ev.title} ({count} {count === 1 ? "Quiz" : "Quizzes"})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3.5 py-2 rounded-xl text-xs font-black bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{filteredQuizzes.length} {filteredQuizzes.length === 1 ? "Quiz" : "Quizzes"} Visible</span>
            </span>
          </div>
        </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto">
        {[
          { id: "quizzes" as const, label: "Quiz Library", icon: FileText, count: filteredQuizzes.length },
          { id: "live_monitor" as const, label: "Live Concurrency Monitor", icon: Users, count: inProgressSessions.length },
          { id: "submissions" as const, label: "Submissions & Results", icon: Award, count: submissions.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === tab.id
                ? "bg-[#0F172A] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
              }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"
              }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ================= TAB 1: QUIZ LIBRARY ================= */}
      {activeTab === "quizzes" && (
        <div className="space-y-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold">Loading quiz database...</p>
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  {activeEvent ? `No Quizzes Found for "${activeEvent.title}"` : "No Quizzes Created Yet"}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {activeEvent 
                    ? `Create an assessment specifically for ${activeEvent.title}.`
                    : "Create your first high-concurrency quiz to publish to participants."
                  }
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                {selectedEventId !== "all" && quizzes.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedEventId("all");
                      setSearchParams({}, { replace: true });
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all"
                  >
                    View All Quizzes ({quizzes.length})
                  </button>
                )}
                <button
                  onClick={handleOpenCreateModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-sm"
                >
                  Create Quiz for {activeEvent ? activeEvent.title : "Event"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredQuizzes.map((q) => (
                <div
                  key={q.id}
                  className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${q.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                        }`}>
                        {q.status}
                      </span>
                      <span className="text-xs font-bold text-blue-600">{q.track || "General Track"}</span>
                    </div>

                    <h3 className="text-lg font-extrabold text-[#0F172A] leading-tight">{q.title}</h3>
                    {q.eventTitle && (
                      <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" /> {q.eventTitle}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">{q.description || "No description provided."}</p>
                  </div>

                  {/* Schedule: Start & End Date and Time */}
                  {(q.scheduledStartTime || q.scheduledEndTime) && (
                    <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-blue-50/60 rounded-2xl p-3 border border-indigo-100/90 space-y-1.5 text-xs">
                      {q.scheduledStartTime && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-indigo-700 font-bold flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            Start:
                          </span>
                          <span className="font-extrabold text-slate-800">
                            {new Date(q.scheduledStartTime).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })},{" "}
                            {new Date(q.scheduledStartTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                          </span>
                        </div>
                      )}
                      {q.scheduledEndTime && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-indigo-700 font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            End:
                          </span>
                          <span className="font-extrabold text-slate-800">
                            {new Date(q.scheduledEndTime).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })},{" "}
                            {new Date(q.scheduledEndTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl text-center text-xs border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Duration</span>
                      <span className="font-extrabold text-[#0F172A]">{q.durationMinutes}m</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Questions</span>
                      <span className="font-extrabold text-[#0F172A]">{q.questions?.length || q.questionsCount || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(q)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        title="Edit Quiz"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(q.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Start / Stop / Restart Quiz Button */}
                    <div className="flex items-center">
                      {(q.status === "active" || q.status === "draft" || q.status === "scheduled") && (!q.scheduledStartTime || q.scheduledEndTime! <= Date.now()) ? (
                        <button
                          onClick={() => handleStartQuiz(q)}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Start Quiz
                        </button>
                      ) : q.status === "active" && q.scheduledStartTime && q.scheduledEndTime && q.scheduledEndTime > Date.now() ? (
                        <button
                          onClick={() => handleStopQuiz(q)}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                        >
                          <Square className="w-3.5 h-3.5" />
                          Stop Quiz
                        </button>
                      ) : q.status === "completed" ? (
                        <button
                          onClick={() => handleStartQuiz(q)}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restart Quiz
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                          Unavailable
                        </span>
                      )}
                    </div>

                    <a
                      href={`/participant/quiz/${q.id}/lobby`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/60"
                    >
                      <span>Preview Lobby</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: LIVE CONCURRENCY MONITOR ================= */}
      {activeTab === "live_monitor" && (
        <div className="space-y-6">

          {/* Quiz Selector Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Monitoring Quiz:</span>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-[#0F172A] px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs sm:max-w-md truncate cursor-pointer"
                  disabled={filteredQuizzes.length === 0}
                >
                  {filteredQuizzes.length > 0 ? (
                    filteredQuizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({q.questions?.length || q.questionsCount || 0} Qs){q.eventTitle ? ` • ${q.eventTitle}` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">No quizzes available</option>
                  )}
                </select>
              </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-extrabold text-[#0F172A]">{inProgressSessions.length} Active Writers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="font-extrabold text-[#0F172A]">{submissions.length} Submitted</span>
              </div>
            </div>
          </div>

          {/* Active Participants Table */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-[#0F172A]">Real-Time Active Sessions</h3>

            {inProgressSessions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">No participants currently writing this quiz.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Participant</th>
                      <th className="py-3 px-4">Team</th>
                      <th className="py-3 px-4">Started At</th>
                      <th className="py-3 px-4">Last Autosave</th>
                      <th className="py-3 px-4">Violations</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {inProgressSessions.map((s) => {
                      const sInfo = resolveParticipantInfo(s);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-bold text-[#0F172A]">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-[#0F172A]">{sInfo.displayName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">{s.userEmail}</div>
                          </td>
                          <td className="py-3.5 px-4">{s.teamName || sInfo.teamName || "Solo"}</td>
                          <td className="py-3.5 px-4">{new Date(s.startTime).toLocaleTimeString()}</td>
                          <td className="py-3.5 px-4">
                            <span className="text-emerald-600 font-bold">
                              {Math.max(0, Math.floor((Date.now() - s.lastAutosavedAt) / 1000))}s ago
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {s.violationsCount && s.violationsCount > 0 ? (
                              <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full font-black text-[10px] flex items-center gap-1 w-max animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                                {s.violationsCount} Detected
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[11px]">0 (Clean)</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Writing
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: SUBMISSIONS & RESULTS ================= */}
      {activeTab === "submissions" && (() => {
        const currentQuizObj = quizzes.find((q) => q.id === selectedQuizId);
        const totalSubs = submissions.length;
        const scoredSubs = submissions.filter((s) => s.score !== undefined && s.score !== null);
        const maxScoreAvailable = currentQuizObj?.totalMarks || (currentQuizObj?.questions?.length ? currentQuizObj.questions.length * 2 : 50);
        const avgScore = scoredSubs.length > 0 ? (scoredSubs.reduce((acc, s) => acc + (s.score || 0), 0) / scoredSubs.length).toFixed(1) : "0";
        const avgPct = scoredSubs.length > 0 ? Math.round(scoredSubs.reduce((acc, s) => acc + (s.percentage || 0), 0) / scoredSubs.length) : 0;
        const passedCount = scoredSubs.filter((s) => s.passed).length;
        const passRatePct = totalSubs > 0 ? Math.round((passedCount / totalSubs) * 100) : 0;
        const highestScore = scoredSubs.length > 0 ? Math.max(...scoredSubs.map((s) => s.score || 0)) : 0;
        const cleanProctorCount = submissions.filter((s) => !s.violationsCount || s.violationsCount === 0).length;

        return (
          <div className="space-y-6">
            {/* Header Control Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Quiz Submissions:</span>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-[#0F172A] px-3 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 max-w-xs sm:max-w-md truncate cursor-pointer"
                  disabled={filteredQuizzes.length === 0}
                >
                  {filteredQuizzes.length > 0 ? (
                    filteredQuizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({q.questions?.length || q.questionsCount || 0} Qs){q.eventTitle ? ` • ${q.eventTitle}` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">No quizzes available</option>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={handleRefreshResults}
                  disabled={isRefreshingResults || !selectedQuizId}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Refresh submissions and live scorecard rankings"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshingResults ? "animate-spin text-blue-600" : ""}`} />
                  <span>{isRefreshingResults ? "Refreshing..." : "Refresh"}</span>
                </button>

                {currentQuizObj && (
                  <button
                    onClick={() => handleTogglePublishResults(currentQuizObj)}
                    className={`font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                      currentQuizObj.resultsPublished
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-blue-600"
                    }`}
                    title={currentQuizObj.resultsPublished ? "Results are currently visible to participants. Click to hide." : "Publish results so participants can view their scorecards."}
                  >
                    {currentQuizObj.resultsPublished ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-white" />
                        <span>Results Published</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-white" />
                        <span>Publish Results</span>
                      </>
                    )}
                  </button>
                )}

                {submissions.length > 0 && (
                  <button
                    onClick={handleResetAllSubmissions}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Clear all submissions for this quiz"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Submissions</span>
                  </button>
                )}

                <button
                  onClick={handleExportCSV}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Scorecard CSV</span>
                </button>
              </div>
            </div>

            {/* Performance Metric Summary Cards */}
            {totalSubs > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Submissions</span>
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-black text-[#0F172A]">{totalSubs}</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">Finalized attempts</div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Average Score</span>
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-black text-[#0F172A]">
                    {avgScore} <span className="text-xs text-slate-400 font-bold">/ {maxScoreAvailable}</span>
                  </div>
                  <div className="text-[10px] text-indigo-600 font-bold mt-0.5">{avgPct}% overall avg</div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Pass Rate</span>
                    <Award className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-black text-emerald-600">
                    {passedCount} <span className="text-xs text-slate-400 font-bold">/ {totalSubs}</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">{passRatePct}% qualified</div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Highest Score</span>
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-black text-[#0F172A]">
                    {highestScore} <span className="text-xs text-slate-400 font-bold">/ {maxScoreAvailable}</span>
                  </div>
                  <div className="text-[10px] text-amber-600 font-bold mt-0.5">Top benchmark</div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Proctored Clean</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-black text-emerald-600">
                    {cleanProctorCount} <span className="text-xs text-slate-400 font-bold">/ {totalSubs}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">0 violations detected</div>
                </div>
              </div>
            )}

            {/* Submissions Table & Search / Filter Controls */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                    <span>Finalized Submissions & Leaderboard ({rankedSubmissions.length})</span>
                    {rankedSubmissions.length > 0 && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                        Ranked by Performance
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">Rankings calculated deterministically by score, accuracy, completion speed & integrity</span>
                </div>
              </div>

              {/* Submissions Search & Filter Bar */}
              {rankedSubmissions.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by team name, college, place..."
                      value={subSearchQuery}
                      onChange={(e) => setSubSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-[#0F172A] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    {subSearchQuery && (
                      <button
                        onClick={() => setSubSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      onClick={() => setSubFilterState("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        subFilterState === "all"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All ({rankedSubmissions.length})
                    </button>
                    <button
                      onClick={() => setSubFilterState("top3")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                        subFilterState === "top3"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
                      }`}
                    >
                      <Trophy className="w-3 h-3" />
                      <span>Podium (Top 3)</span>
                    </button>
                    <button
                      onClick={() => setSubFilterState("passed")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        subFilterState === "passed"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                      }`}
                    >
                      Passed ({rankedSubmissions.filter((s) => s.passed).length})
                    </button>
                    <button
                      onClick={() => setSubFilterState("failed")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        subFilterState === "failed"
                          ? "bg-red-600 text-white shadow-xs"
                          : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60"
                      }`}
                    >
                      Below Cutoff ({rankedSubmissions.filter((s) => !s.passed && s.score !== undefined).length})
                    </button>
                    <button
                      onClick={() => setSubFilterState("violations")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        subFilterState === "violations"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60"
                      }`}
                    >
                      Violations ({rankedSubmissions.filter((s) => s.violationsCount && s.violationsCount > 0).length})
                    </button>
                  </div>
                </div>
              )}

              {rankedSubmissions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Award className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">No submissions recorded yet.</p>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Search className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">No teams match your search query or filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4 text-center">Rank / Place</th>
                        <th className="py-3 px-4">Team Name</th>
                        <th className="py-3 px-4">College & Place</th>
                        <th className="py-3 px-4">Score & Performance</th>
                        <th className="py-3 px-4">Accuracy</th>
                        <th className="py-3 px-4">Time Spent</th>
                        <th className="py-3 px-4">Proctoring</th>
                        <th className="py-3 px-4">Submitted At</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredSubmissions.map((sub) => {
                        const hasScore = sub.score !== undefined && sub.score !== null;
                        const scoreDisplay = hasScore ? sub.score : "-";
                        const maxDisplay = sub.maxScore || maxScoreAvailable;
                        const pctDisplay = sub.percentage !== undefined ? sub.percentage : (hasScore ? Math.round(((sub.score || 0) / maxDisplay) * 100) : 0);
                        const isPassed = sub.passed ?? (hasScore && (sub.score || 0) >= (currentQuizObj?.passingMarks || Math.round(maxDisplay * 0.4)));

                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                            {/* Leadership / Rank / Place Column */}
                            <td className="py-3.5 px-4 text-center">
                              {sub.rank === 1 ? (
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-400/20 via-yellow-400/25 to-amber-500/20 text-amber-900 border border-amber-400/60 rounded-xl font-black text-xs shadow-xs" title="1st Place (Leaderboard Benchmark)">
                                  <Trophy className="w-3.5 h-3.5 text-amber-600 fill-amber-500 shrink-0" />
                                  <span className="bg-gradient-to-r from-amber-700 to-yellow-800 bg-clip-text text-transparent font-black tracking-wide">1st</span>
                                </div>
                              ) : sub.rank === 2 ? (
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-slate-200/60 via-slate-100 to-slate-200/60 text-slate-800 border border-slate-300 rounded-xl font-black text-xs shadow-2xs" title="2nd Place">
                                  <Medal className="w-3.5 h-3.5 text-slate-600 fill-slate-400 shrink-0" />
                                  <span className="text-slate-800 font-black tracking-wide">2nd</span>
                                </div>
                              ) : sub.rank === 3 ? (
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-700/15 via-orange-600/15 to-amber-800/15 text-amber-900 border border-amber-600/40 rounded-xl font-black text-xs shadow-2xs" title="3rd Place">
                                  <Medal className="w-3.5 h-3.5 text-amber-700 fill-amber-600 shrink-0" />
                                  <span className="text-amber-800 font-black tracking-wide">3rd</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center min-w-[34px] px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200/90 rounded-lg font-extrabold text-xs">
                                  <span>#{sub.rank}</span>
                                </div>
                              )}
                            </td>

                            {/* Team Name Column */}
                            <td className="py-3.5 px-4 font-bold text-[#0F172A]">
                              <span className="text-sm font-black text-[#0F172A] tracking-tight">{sub.resolvedTeamName}</span>
                            </td>

                            {/* College & Place Column */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="font-extrabold text-xs text-[#0F172A] flex items-center gap-1.5 leading-snug">
                                  <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>{sub.resolvedCollegeName}</span>
                                </div>
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold text-[10px]">
                                  <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                                  <span>{sub.resolvedCollegePlace}</span>
                                </div>
                              </div>
                            </td>

                            {/* Score & Performance */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-black text-sm text-[#0F172A]">
                                    {scoreDisplay} <span className="text-slate-400 font-bold text-xs">/ {maxDisplay}</span>
                                  </span>
                                  {hasScore && (
                                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200/60">
                                      {pctDisplay}%
                                    </span>
                                  )}

                                </div>
                                <div>
                                  {hasScore ? (
                                    isPassed ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle className="w-2.5 h-2.5" /> Passed
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                        <XCircle className="w-2.5 h-2.5" /> Below Cutoff
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-semibold">Evaluating...</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Accuracy */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="font-bold text-[#0F172A]">
                                  {sub.answeredCount} / {sub.totalQuestions} Answered
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium">
                                  {sub.correctCount !== undefined ? (
                                    <span>
                                      <strong className="text-emerald-600">{sub.correctCount} Correct</strong>
                                      {" • "}
                                      <strong className="text-red-500">{sub.incorrectCount ?? (sub.answeredCount - sub.correctCount)} Wrong</strong>
                                    </span>
                                  ) : (
                                    <span>{sub.unansweredCount} Unanswered</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Time Spent */}
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                              {Math.floor(sub.timeSpentSeconds / 60)}m {sub.timeSpentSeconds % 60}s
                            </td>

                            {/* Proctoring Record */}
                            <td className="py-3.5 px-4">
                              {sub.violationsCount && sub.violationsCount > 0 ? (
                                <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 w-max">
                                  <AlertTriangle className="w-3 h-3 text-red-600" />
                                  {sub.violationsCount} Violations
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 w-max">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Clean
                                </span>
                              )}
                            </td>

                            {/* Submitted At */}
                            <td className="py-3.5 px-4 text-slate-500">
                              <div>{new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="text-[10px] text-slate-400">{new Date(sub.submittedAt).toLocaleDateString()}</div>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setInspectingSubmission(sub)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                                  title="Inspect full participant answer sheet & score details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Sheet</span>
                                </button>

                                <button
                                  onClick={() => handleResetParticipant(sub)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                                  title="Reset locked submission to allow re-entry"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Reset</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteParticipant(sub)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                                  title="Permanently delete this submission"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Inspect Participant Submission & Score Breakdown Modal */}
            {inspectingSubmission && (() => {
              const quizForInspection = quizzes.find((q) => q.id === inspectingSubmission.quizId) || currentQuizObj;
              const questions = quizForInspection?.questions || [];
              const participantAnswers = inspectingSubmission.answers || {};

              const filteredQuestions = questions.filter((q) => {
                const selected = participantAnswers[q.id];
                const isCorrect = selected && q.correctOptionId && selected.trim().toLowerCase() === q.correctOptionId.trim().toLowerCase();
                if (inspectFilter === "correct") return isCorrect;
                if (inspectFilter === "incorrect") return selected && !isCorrect;
                if (inspectFilter === "unanswered") return !selected;
                return true;
              });

              return (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                    
                    {/* Modal Header */}
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                            PARTICIPANT SCORECARD & AUDIT
                          </span>
                          {inspectingSubmission.rankLabel && (
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                              inspectingSubmission.rank === 1
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : inspectingSubmission.rank === 2
                                  ? "bg-slate-100 text-slate-800 border-slate-300"
                                  : inspectingSubmission.rank === 3
                                    ? "bg-amber-100/60 text-amber-900 border-amber-300"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}>
                              {inspectingSubmission.rank === 1 ? "🥇" : inspectingSubmission.rank === 2 ? "🥈" : inspectingSubmission.rank === 3 ? "🥉" : "#"} {inspectingSubmission.rankLabel} Place (Rank #{inspectingSubmission.rank})
                            </span>
                          )}
                          <span className="font-mono text-xs text-slate-400">
                            {inspectingSubmission.id.substring(0, 12)}
                          </span>
                        </div>
                        <h2 className="text-lg font-black text-[#0F172A]">
                          {inspectingSubmission.resolvedTeamName || inspectingSubmission.teamName || "Team Alpha"}
                        </h2>
                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-slate-700">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            {inspectingSubmission.resolvedCollegeName || "Vishnu Institute of Technology"}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-semibold text-slate-600">
                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                            {inspectingSubmission.resolvedCollegePlace || "Bhimavaram"}
                          </span>
                          <span>•</span>
                          <span>Quiz: <strong>{inspectingSubmission.quizTitle || quizForInspection?.title}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setInspectingSubmission(null)}
                          className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Modal Hero Metric Bar */}
                    <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Final Score</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xl font-black text-blue-600">{inspectingSubmission.score ?? 0}</span>
                          <span className="text-xs text-slate-400 font-bold">/ {inspectingSubmission.maxScore ?? maxScoreAvailable}</span>
                          <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                            {inspectingSubmission.percentage ?? 0}%
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Accuracy</span>
                        <div className="text-sm font-black text-[#0F172A] mt-1">
                          <span className="text-emerald-600">{inspectingSubmission.correctCount ?? 0} Correct</span>
                          {" / "}
                          <span className="text-red-500">{inspectingSubmission.incorrectCount ?? 0} Wrong</span>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Time Spent</span>
                        <div className="text-sm font-black text-[#0F172A] mt-1 font-mono">
                          {Math.floor(inspectingSubmission.timeSpentSeconds / 60)}m {inspectingSubmission.timeSpentSeconds % 60}s
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Proctoring</span>
                        <div className="text-sm font-black mt-1">
                          {inspectingSubmission.violationsCount && inspectingSubmission.violationsCount > 0 ? (
                            <span className="text-red-600 flex items-center gap-1 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5" /> {inspectingSubmission.violationsCount} Flags
                            </span>
                          ) : (
                            <span className="text-emerald-600 flex items-center gap-1 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Clean
                            </span>
                          )}
                        </div>
                      </div>
                    </div>



                    {/* Filter Tabs */}
                    <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-white">
                      <button
                        onClick={() => setInspectFilter("all")}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          inspectFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        All Questions ({questions.length})
                      </button>
                      <button
                        onClick={() => setInspectFilter("correct")}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          inspectFilter === "correct" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                        }`}
                      >
                        Correct ({inspectingSubmission.correctCount ?? 0})
                      </button>
                      <button
                        onClick={() => setInspectFilter("incorrect")}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          inspectFilter === "incorrect" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60"
                        }`}
                      >
                        Incorrect ({inspectingSubmission.incorrectCount ?? 0})
                      </button>
                      <button
                        onClick={() => setInspectFilter("unanswered")}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          inspectFilter === "unanswered" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60"
                        }`}
                      >
                        Unanswered ({inspectingSubmission.unansweredCount ?? 0})
                      </button>
                    </div>

                    {/* Questions & Proctoring Audit Body */}
                    <div className="p-6 overflow-y-auto space-y-6">
                      
                      {/* Proctoring Incident Audit details if violations present */}
                      {inspectingSubmission.violationsCount && inspectingSubmission.violationsCount > 0 && inspectingSubmission.violationLogs && inspectingSubmission.violationLogs.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span>Proctoring Security Violation Incident Log ({inspectingSubmission.violationsCount})</span>
                          </div>
                          <div className="space-y-1.5 pt-1">
                            {inspectingSubmission.violationLogs.map((log, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs bg-white/80 px-3 py-1.5 rounded-lg border border-red-100">
                                <span className="font-medium text-slate-700">{log.message}</span>
                                <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Question by Question Answer Sheet */}
                      {filteredQuestions.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No questions matching the selected filter.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredQuestions.map((q, idx) => {
                            const selectedOptId = participantAnswers[q.id];
                            const isCorrect = selectedOptId && q.correctOptionId && selectedOptId.trim().toLowerCase() === q.correctOptionId.trim().toLowerCase();
                            const isUnanswered = !selectedOptId;

                            return (
                              <div
                                key={q.id || idx}
                                className={`p-4 rounded-2xl border transition-all ${
                                  isCorrect 
                                    ? "bg-emerald-50/30 border-emerald-200/80" 
                                    : isUnanswered 
                                      ? "bg-slate-50/80 border-slate-200" 
                                      : "bg-red-50/30 border-red-200/80"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                      Q{q.questionNumber || idx + 1}
                                    </span>
                                    {q.category && (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                        {q.category}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                                      {q.points || currentQuizObj?.pointsPerQuestion || 2} pts
                                    </span>
                                  </div>

                                  <div>
                                    {isCorrect ? (
                                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> +{q.points || currentQuizObj?.pointsPerQuestion || 2} pts
                                      </span>
                                    ) : isUnanswered ? (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                                        Unanswered (0 pts)
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                                        <X className="w-3 h-3" /> 0 pts
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs font-extrabold text-[#0F172A] leading-relaxed mb-3">
                                  {q.text}
                                </p>

                                {q.codeSnippet && (
                                  <pre className="bg-slate-900 text-slate-100 font-mono text-[11px] p-3 rounded-xl mb-3 overflow-x-auto">
                                    <code>{q.codeSnippet}</code>
                                  </pre>
                                )}

                                {/* Options Breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {q.options.map((opt) => {
                                    const isSelectedByUser = selectedOptId === opt.id;
                                    const isCorrectAnswer = q.correctOptionId === opt.id;

                                    let optionStyle = "bg-white border-slate-200 text-slate-700";
                                    let badgeText = null;

                                    if (isSelectedByUser && isCorrectAnswer) {
                                      optionStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-1 ring-emerald-500/20";
                                      badgeText = "✓ Participant Selected (Correct)";
                                    } else if (isSelectedByUser && !isCorrectAnswer) {
                                      optionStyle = "bg-red-50 border-red-500 text-red-900 font-bold ring-1 ring-red-500/20";
                                      badgeText = "✗ Participant Selected (Wrong)";
                                    } else if (isCorrectAnswer) {
                                      optionStyle = "bg-emerald-50/50 border-emerald-400 border-dashed text-emerald-800 font-bold";
                                      badgeText = "✓ Official Correct Answer";
                                    }

                                    return (
                                      <div
                                        key={opt.id}
                                        className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between gap-1 transition-all ${optionStyle}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-black text-[11px] uppercase opacity-70">
                                            {opt.id.replace("opt_", "")})
                                          </span>
                                          <span className="leading-snug">{opt.text}</span>
                                        </div>
                                        {badgeText && (
                                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded self-start ${
                                            isSelectedByUser && isCorrectAnswer
                                              ? "bg-emerald-600 text-white"
                                              : isSelectedByUser && !isCorrectAnswer
                                                ? "bg-red-600 text-white"
                                                : "bg-emerald-200 text-emerald-900"
                                          }`}>
                                            {badgeText}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {q.explanation && (
                                  <div className="mt-2.5 p-2 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px] text-blue-900">
                                    <strong className="font-bold">Explanation:</strong> {q.explanation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex items-center justify-between shrink-0">
                      <span className="text-xs text-slate-500 font-medium">
                        Submission recorded on {new Date(inspectingSubmission.submittedAt).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setInspectingSubmission(null)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all cursor-pointer"
                        >
                          Close Scorecard
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* Excel Sheet Team Scorecard & Moderation Spreadsheet Modal */}
            {isExcelEditorOpen && (() => {
              const targetQuiz = quizzes.find((q) => q.id === selectedQuizId) || currentQuizObj;
              const ptsPerQ = targetQuiz?.pointsPerQuestion || 2;
              const modifiedCount = excelRows.filter((r) => r.isModified).length;
              const quizMax = targetQuiz?.totalMarks || (targetQuiz?.questions?.length ? targetQuiz.questions.length * ptsPerQ : 50);
              const passMarks = targetQuiz?.passingMarks || Math.round(quizMax * 0.4);

              // Live Stats for the spreadsheet
              const currentAvgScore = excelRows.length > 0 ? (excelRows.reduce((a, b) => a + b.score, 0) / excelRows.length).toFixed(1) : "0";
              const currentPassedCount = excelRows.filter((r) => r.passed).length;
              const currentPassRate = excelRows.length > 0 ? Math.round((currentPassedCount / excelRows.length) * 100) : 0;

              return (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
                  <div className="bg-white rounded-3xl max-w-7xl w-full h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                    
                    {/* Excel Sheet Header Bar */}
                    <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                            <FileSpreadsheet className="w-3 h-3" />
                            <span>Excel Scoreboard Grid</span>
                          </span>
                          {modifiedCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                              {modifiedCount} Unsaved {modifiedCount === 1 ? "Change" : "Changes"}
                            </span>
                        )}
                        </div>
                        <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                          <span>Team Scores & Marks Moderation Spreadsheet</span>
                        </h2>
                        <p className="text-xs text-slate-300 font-medium flex items-center gap-2 flex-wrap">
                          <span>Quiz: <strong className="text-white">{targetQuiz?.title || "Quiz"}</strong></span>
                          <span>•</span>
                          <span>Points/Question: <strong className="text-purple-300">{ptsPerQ} marks</strong></span>
                          <span>•</span>
                          <span>Total Teams: <strong className="text-white">{excelRows.length}</strong></span>
                          <span>•</span>
                          <span>Pass Cutoff: <strong className="text-white">{passMarks} marks</strong></span>
                        </p>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Quick Bonus Tool with dynamic ptsPerQ stepping */}
                        <div className="hidden lg:flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15 text-xs">
                          <span className="text-[10px] font-bold text-slate-300 px-1.5">Quick Bonus:</span>
                          <button
                            type="button"
                            onClick={() => handleExcelApplyBonus(ptsPerQ)}
                            className="px-2 py-0.5 bg-white/15 hover:bg-white/25 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                            title={`Add +${ptsPerQ} bonus marks (1 question worth) to all teams`}
                          >
                            +{ptsPerQ}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcelApplyBonus(ptsPerQ * 2)}
                            className="px-2 py-0.5 bg-white/15 hover:bg-white/25 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                            title={`Add +${ptsPerQ * 2} bonus marks (2 questions worth) to all teams`}
                          >
                            +{ptsPerQ * 2}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcelApplyBonus(-ptsPerQ)}
                            className="px-2 py-0.5 bg-white/15 hover:bg-white/25 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                            title={`Deduct -${ptsPerQ} marks (1 question worth) from all teams`}
                          >
                            -{ptsPerQ}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleExportExcelSheetCSV}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/15 cursor-pointer"
                          title="Download current spreadsheet as CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export CSV</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCloseExcelEditor}
                          className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                          title="Close spreadsheet editor"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Toolbar / Search & Filter Controls */}
                    <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                      <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search spreadsheet by team name, college, place..."
                          value={excelSearchQuery}
                          onChange={(e) => setExcelSearchQuery(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-7 py-1.5 text-xs font-bold text-[#0F172A] placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                        {excelSearchQuery && (
                          <button
                            onClick={() => setExcelSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <button
                          type="button"
                          onClick={() => setExcelFilter("all")}
                          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                            excelFilter === "all"
                              ? "bg-slate-900 text-white shadow-2xs"
                              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                          }`}
                        >
                          All ({excelRows.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setExcelFilter("modified")}
                          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                            excelFilter === "modified"
                              ? "bg-amber-500 text-white shadow-2xs"
                              : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
                          }`}
                        >
                          <span>Modified</span>
                          <span className="px-1.5 py-0.2 bg-amber-200/70 text-amber-900 rounded-full text-[10px] font-black">
                            {modifiedCount}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExcelFilter("passed")}
                          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                            excelFilter === "passed"
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                          }`}
                        >
                          Passed ({excelRows.filter((r) => r.passed).length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setExcelFilter("failed")}
                          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                            excelFilter === "failed"
                              ? "bg-red-600 text-white shadow-2xs"
                              : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60"
                          }`}
                        >
                          Below Cutoff ({excelRows.filter((r) => !r.passed).length})
                        </button>
                      </div>
                    </div>

                    {/* Spreadsheet Matrix Grid */}
                    <div className="flex-1 overflow-auto bg-slate-50/50">
                      {filteredExcelRows.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 space-y-2">
                          <Search className="w-10 h-10 mx-auto text-slate-300" />
                          <p className="text-xs font-bold text-slate-500">No teams match your search query or filter.</p>
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none shadow-2xs">
                            <tr>
                              <th className="py-3 px-3 text-center w-14 bg-slate-100 border-r border-slate-200"># Rank</th>
                              <th className="py-3 px-4 min-w-[200px] border-r border-slate-200">Team Name</th>
                              <th className="py-3 px-4 min-w-[220px] border-r border-slate-200">College Name</th>
                              <th className="py-3 px-3 min-w-[130px] border-r border-slate-200">Place</th>
                              <th className="py-3 px-3 min-w-[140px] bg-purple-50 text-purple-900 border-r border-purple-200">
                                <div className="flex items-center gap-1 font-black">
                                  <Edit3 className="w-3 h-3 text-purple-600" />
                                  <span>Marks Awarded *</span>
                                </div>
                              </th>
                              <th className="py-3 px-3 min-w-[100px] border-r border-slate-200">Max Marks</th>
                              <th className="py-3 px-3 min-w-[90px] text-center border-r border-slate-200">Percentage</th>
                              <th className="py-3 px-3 min-w-[130px] text-center border-r border-slate-200">Result Status</th>
                              <th className="py-3 px-3 min-w-[85px] border-r border-slate-200">Correct</th>
                              <th className="py-3 px-3 min-w-[85px] border-r border-slate-200">Wrong</th>
                              <th className="py-3 px-3 min-w-[90px] text-center border-r border-slate-200">Time</th>
                              <th className="py-3 px-4 min-w-[220px] border-r border-slate-200">Evaluator Remarks</th>
                              <th className="py-3 px-3 text-center w-24">State</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/90 font-medium bg-white">
                            {filteredExcelRows.map((row) => {
                              const isTargetFocused = focusedRowId === row.id;

                              return (
                                <tr
                                  key={row.id}
                                  className={`transition-colors ${
                                    row.isModified
                                      ? "bg-amber-50/60 hover:bg-amber-50"
                                      : isTargetFocused
                                        ? "bg-purple-50/40 hover:bg-purple-50/60"
                                        : "hover:bg-slate-50/70"
                                  }`}
                                >
                                  {/* Rank */}
                                  <td className="py-2.5 px-3 text-center font-black text-slate-700 border-r border-slate-100 bg-slate-50/40">
                                    <span className="text-xs">{row.rankLabel}</span>
                                  </td>

                                  {/* Team Name */}
                                  <td className="py-2.5 px-4 font-black text-slate-900 border-r border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-black tracking-tight">{row.teamName}</span>
                                    </div>
                                  </td>

                                  {/* College Name */}
                                  <td className="py-2.5 px-4 text-slate-700 border-r border-slate-100">
                                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span className="truncate max-w-[200px]" title={row.collegeName}>{row.collegeName}</span>
                                    </div>
                                  </td>

                                  {/* Place */}
                                  <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                                      <span>{row.collegePlace}</span>
                                    </div>
                                  </td>

                                  {/* Marks Awarded (Directly Editable Cell with ptsPerQ step and max limit) */}
                                  <td className="py-2 px-3 border-r border-purple-100 bg-purple-50/30">
                                    <input
                                      type="number"
                                      min="0"
                                      step={ptsPerQ}
                                      max={row.maxScore}
                                      value={row.score}
                                      onChange={(e) => handleExcelCellScoreChange(row.id, e.target.value)}
                                      className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1 text-xs font-black text-purple-900 outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-600 shadow-2xs"
                                      title={`Marks change in increments of ${ptsPerQ} (max: ${row.maxScore})`}
                                    />
                                  </td>

                                  {/* Max Marks (Directly Editable Cell) */}
                                  <td className="py-2 px-3 border-r border-slate-100">
                                    <input
                                      type="number"
                                      step={ptsPerQ}
                                      min="1"
                                      value={row.maxScore}
                                      onChange={(e) => handleExcelCellMaxScoreChange(row.id, e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                  </td>

                                  {/* Percentage (Auto-computed Live) */}
                                  <td className="py-2.5 px-3 text-center border-r border-slate-100">
                                    <span className={`inline-block px-2 py-0.5 rounded-md font-black text-[11px] border ${
                                      row.percentage >= 60
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : row.percentage >= 40
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-red-50 text-red-700 border-red-200"
                                    }`}>
                                      {row.percentage}%
                                    </span>
                                  </td>

                                  {/* Result Status (Interactive Toggle) */}
                                  <td className="py-2 px-3 text-center border-r border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => handleExcelCellPassedToggle(row.id)}
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase flex items-center justify-center gap-1 mx-auto cursor-pointer border transition-all ${
                                        row.passed
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                          : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                      }`}
                                      title="Click to toggle qualification status"
                                    >
                                      {row.passed ? (
                                        <>
                                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                                          <span>Passed</span>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-3 h-3 text-red-600" />
                                          <span>Below Cutoff</span>
                                        </>
                                      )}
                                    </button>
                                  </td>

                                  {/* Correct Count (Bounded to totalQuestions) */}
                                  <td className="py-2 px-3 border-r border-slate-100">
                                    <input
                                      type="number"
                                      step="1"
                                      min="0"
                                      max={row.totalQuestions}
                                      value={row.correctCount}
                                      onChange={(e) => handleExcelCellCorrectChange(row.id, e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                      title={`Correct answers (0 to ${row.totalQuestions})`}
                                    />
                                  </td>

                                  {/* Incorrect Count (Bounded to totalQuestions) */}
                                  <td className="py-2 px-3 border-r border-slate-100">
                                    <input
                                      type="number"
                                      step="1"
                                      min="0"
                                      max={row.totalQuestions}
                                      value={row.incorrectCount}
                                      onChange={(e) => handleExcelCellIncorrectChange(row.id, e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                      title={`Incorrect answers (0 to ${row.totalQuestions})`}
                                    />
                                  </td>

                                  {/* Time Spent */}
                                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500 border-r border-slate-100">
                                    {Math.floor(row.timeSpentSeconds / 60)}m {row.timeSpentSeconds % 60}s
                                  </td>

                                  {/* Remarks / Notes (Editable Text) */}
                                  <td className="py-2 px-3 border-r border-slate-100">
                                    <input
                                      type="text"
                                      value={row.remarks}
                                      onChange={(e) => handleExcelCellRemarksChange(row.id, e.target.value)}
                                      placeholder="Remarks / bonus note..."
                                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                  </td>

                                  {/* Row State / Revert */}
                                  <td className="py-2 px-3 text-center">
                                    {row.isModified ? (
                                      <button
                                        type="button"
                                        onClick={() => handleExcelRevertRow(row.id)}
                                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black flex items-center gap-1 mx-auto cursor-pointer transition-colors"
                                        title="Revert this row to original saved score"
                                      >
                                        <RotateCcw className="w-2.5 h-2.5" />
                                        <span>Revert</span>
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-300 uppercase">
                                        Saved
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Excel Sheet Footer Summary Bar */}
                    <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-xs">
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-600 flex-wrap">
                        <div>
                          <span>Showing: </span>
                          <strong className="text-slate-900">{filteredExcelRows.length} of {excelRows.length} Teams</strong>
                        </div>
                        <span>•</span>
                        <div>
                          <span>Avg Score: </span>
                          <strong className="text-indigo-600">{currentAvgScore} / {quizMax}</strong>
                        </div>
                        <span>•</span>
                        <div>
                          <span>Pass Rate: </span>
                          <strong className="text-emerald-600">{currentPassRate}% ({currentPassedCount}/{excelRows.length})</strong>
                        </div>
                        {modifiedCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700 font-extrabold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              {modifiedCount} pending change{modifiedCount === 1 ? "" : "s"}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {modifiedCount > 0 && (
                          <button
                            type="button"
                            onClick={handleExcelDiscardChanges}
                            disabled={isSavingExcel}
                            className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors cursor-pointer"
                          >
                            Discard Changes
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleCloseExcelEditor}
                          disabled={isSavingExcel}
                          className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        >
                          Close
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveAllExcelChanges}
                          disabled={isSavingExcel || modifiedCount === 0}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSavingExcel ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Saving Spreadsheet...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 text-white" />
                              <span>Save All Scores {modifiedCount > 0 ? `(${modifiedCount})` : ""}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}

          </div>
        );
      })()}

      </main>

      {startingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">Start "{startingQuiz.title}"?</h3>
              <p className="text-sm text-slate-600 mb-4">
                This will open testing access to all registered participants.
              </p>
              
              <div className="mb-6 space-y-1">
                <label className="text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Quiz Duration (Minutes)</span>
                </label>
                <p className="text-[10px] text-slate-500 mb-1">Participants must complete the quiz within this time limit once they begin.</p>
                <input
                  type="number"
                  min={1}
                  value={startDuration}
                  onChange={(e) => setStartDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setStartingQuiz(null)}
                  disabled={isStarting}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsStarting(true);
                    try {
                      const now = Date.now();
                      const startTime = (startingQuiz.scheduledStartTime && startingQuiz.scheduledStartTime > now) ? startingQuiz.scheduledStartTime : now;
                      // Clear scheduledEndTime if it's less than duration to prevent bug
                      let endTime = (startingQuiz.scheduledEndTime && startingQuiz.scheduledEndTime > startTime) ? startingQuiz.scheduledEndTime : null;
                      
                      // If they specify a time limit but the scheduled end time restricts it too much, remove the restriction.
                      if (endTime && endTime < startTime + startDuration * 60000) {
                          endTime = null; 
                      }

                      await api.updateQuiz(startingQuiz.id, {
                        status: "active",
                        durationMinutes: startDuration,
                        scheduledStartTime: startTime,
                        scheduledEndTime: endTime,
                        updatedAt: now
                      });

                      if (typeof window !== "undefined") {
                        sessionStorage.removeItem(`quiz_cache_${startingQuiz.id}`);
                      }

                      setQuizzes(prev => prev.map(q => 
                        q.id === startingQuiz.id ? { 
                          ...q, 
                          status: "active", 
                          durationMinutes: startDuration,
                          scheduledStartTime: startTime, 
                          scheduledEndTime: endTime, 
                          updatedAt: now 
                        } : q
                      ));
                      
                      setStartingQuiz(null);
                    } catch (err: any) {
                      console.error("Failed to start quiz:", err);
                      showAlert({
                        title: "Error",
                        message: "Failed to start quiz: " + err.message,
                        type: "danger"
                      });
                    } finally {
                      setIsStarting(false);
                    }
                  }}
                  disabled={isStarting}
                  className="px-5 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Start Exam Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizManagementPage;
