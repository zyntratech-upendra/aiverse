import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
  MapPin,
  Calendar,
  PieChart,
  BarChart3,
  TrendingUp,
  Sparkles,
  Award,
  UserPlus,
  Plus,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Layers,
  Tag
} from "lucide-react";
import SEO from "../../components/layout/SEO";
import { 
  fetchRegistrations as apiFetchRegistrations, 
  fetchEvents as apiFetchEvents,
  createRegistration,
  updateRegistration,
  deleteParticipantCascade 
} from "../../services/apiClient";
import { sendResendEmail } from "../../utils/resendEmailService";
import { buildRegistrationConfirmationEmail } from "../../utils/emailTemplates";

export interface CollegeStatItem {
  college: string;
  displayName: string;
  shortName: string;
  place?: string;
  memberCount: number;
  teamCount: number;
  percentage: number;
  color: string;
}

const COLLEGE_PALETTE = [
  "#2563EB", // Blue-600
  "#8B5CF6", // Violet-500
  "#10B981", // Emerald-500
  "#F59E0B", // Amber-500
  "#EC4899", // Pink-500
  "#06B6D4", // Cyan-500
  "#6366F1", // Indigo-500
  "#F97316", // Orange-500
  "#14B8A6", // Teal-500
  "#84CC16", // Lime-500
  "#A855F7", // Purple-500
  "#64748B", // Slate-500
];

export interface NormalizedCollege {
  canonicalName: string;
  shortName: string;
  defaultPlace: string;
}

export const normalizeCollegeInfo = (rawName?: string, rawPlace?: string): NormalizedCollege => {
  const cleaned = (rawName || "").trim();
  if (!cleaned) {
    return {
      canonicalName: "Vishnu Institute of Technology",
      shortName: "VITB",
      defaultPlace: (rawPlace || "").trim() || "Bhimavaram"
    };
  }

  // Create a lower-cased alphanumeric string for robust matching
  const simplified = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Shri Vishnu Engineering College for Women
  if (
    simplified.includes("shri vishnu engineering college for women") ||
    simplified.includes("sri vishnu engineering college for women") ||
    simplified.includes("svecw") ||
    (simplified.includes("vishnu") && simplified.includes("women"))
  ) {
    return {
      canonicalName: "Shri Vishnu Engineering College for Women",
      shortName: "SVECW",
      defaultPlace: (rawPlace || "").trim() || "Bhimavaram"
    };
  }

  // 2. BVRIT (Narsapur / Hyderabad)
  if (
    simplified.includes("bvrit") ||
    simplified.includes("b v raju institute of technology") ||
    simplified.includes("bv raju institute of technology")
  ) {
    const isHyd = simplified.includes("hyderabad") || simplified.includes("hyd") || (rawPlace || "").toLowerCase().includes("hyderabad");
    return {
      canonicalName: isHyd ? "BVRIT Hyderabad College of Engineering for Women" : "B V Raju Institute of Technology",
      shortName: isHyd ? "BVRITH" : "BVRIT",
      defaultPlace: isHyd ? "Hyderabad" : "Narsapur"
    };
  }

  // 3. Vishnu Dental College
  if (simplified.includes("vishnu dental") || simplified === "vdc") {
    return {
      canonicalName: "Vishnu Dental College",
      shortName: "VDC",
      defaultPlace: (rawPlace || "").trim() || "Bhimavaram"
    };
  }

  // 4. Shri Vishnu College of Pharmacy
  if (
    simplified.includes("vishnu college of pharmacy") ||
    simplified.includes("vishnu institute of pharmaceutical") ||
    simplified === "svcp" ||
    simplified === "viper"
  ) {
    return {
      canonicalName: "Shri Vishnu College of Pharmacy",
      shortName: "SVCP",
      defaultPlace: (rawPlace || "").trim() || "Bhimavaram"
    };
  }

  // 5. Vishnu Institute of Technology (VITB / VIT Bhimavaram)
  if (
    simplified.includes("vishnu institute of technology") ||
    simplified === "vitb" ||
    simplified === "vit b" ||
    simplified === "vit bhimavaram" ||
    simplified.includes("vishnu inst of tech") ||
    simplified.includes("vishnu institute of tech") ||
    simplified.includes("vishnu inst") ||
    (simplified.includes("vishnu") && !simplified.includes("women") && !simplified.includes("dental") && !simplified.includes("pharmacy") && !simplified.includes("bvrit"))
  ) {
    return {
      canonicalName: "Vishnu Institute of Technology",
      shortName: "VITB",
      defaultPlace: (rawPlace || "").trim() || "Bhimavaram"
    };
  }

  // 6. SRKR Engineering College
  if (
    simplified.includes("s r k r") ||
    simplified.includes("srkr") ||
    simplified.includes("sagi rama") ||
    simplified.includes("sagagi rama")
  ) {
    return {
      canonicalName: "S.R.K.R. Engineering College",
      shortName: "SRKR",
      defaultPlace: (rawPlace || "").trim() || "Bhimavaram"
    };
  }

  // 7. BIET (Bhimavaram)
  if (
    simplified.includes("bhimavaram institute of engineering") ||
    simplified.includes("biet")
  ) {
    return {
      canonicalName: "Bhimavaram Institute of Engineering & Technology",
      shortName: "BIET",
      defaultPlace: (rawPlace || "").trim() || "Pennada, Bhimavaram"
    };
  }

  // 8. DNR College
  if (
    simplified.includes("d n r") ||
    simplified.includes("dnr") ||
    simplified.includes("dantuluri narayana raju")
  ) {
    return {
      canonicalName: "D.N.R. College of Engineering & Technology",
      shortName: "DNR",
      defaultPlace: (rawPlace || "").trim() || "Bhimavaram"
    };
  }

  // 9. Swarnandhra
  if (simplified.includes("swarnandhra")) {
    return {
      canonicalName: "Swarnandhra College of Engineering & Technology",
      shortName: "SCET",
      defaultPlace: (rawPlace || "").trim() || "Seetharampuram, Narsapur"
    };
  }

  // 10. GIET (Rajahmundry)
  if (simplified.includes("giet") || simplified.includes("godavari institute")) {
    return {
      canonicalName: "Godavari Institute of Engineering & Technology",
      shortName: "GIET",
      defaultPlace: (rawPlace || "").trim() || "Rajahmundry"
    };
  }

  // 11. GRIET (Hyderabad)
  if (
    simplified.includes("gokaraju") ||
    simplified.includes("griet")
  ) {
    return {
      canonicalName: "Gokaraju Rangaraju Institute of Engineering and Technology",
      shortName: "GRIET",
      defaultPlace: (rawPlace || "").trim() || "Hyderabad"
    };
  }

  // 12. VVIT / Vignan
  if (
    simplified.includes("vvit") ||
    simplified.includes("vasireddy venkatadri")
  ) {
    return {
      canonicalName: "Vasireddy Venkatadri Institute of Technology",
      shortName: "VVIT",
      defaultPlace: (rawPlace || "").trim() || "Guntur"
    };
  }
  if (simplified.includes("vignan")) {
    return {
      canonicalName: "Vignan's Foundation for Science, Technology & Research",
      shortName: "Vignan",
      defaultPlace: (rawPlace || "").trim() || "Vadlamudi, Guntur"
    };
  }

  // 13. KL University
  if (
    simplified.includes("k l university") ||
    simplified.includes("kl university") ||
    simplified.includes("klu") ||
    simplified.includes("klef") ||
    simplified.includes("koneru lakshmaiah")
  ) {
    return {
      canonicalName: "Koneru Lakshmaiah Education Foundation (KL University)",
      shortName: "KLU",
      defaultPlace: (rawPlace || "").trim() || "Vaddeswaram, Guntur"
    };
  }

  // 14. Aditya
  if (
    simplified.includes("aditya") ||
    simplified.includes("aec") ||
    simplified.includes("acet")
  ) {
    return {
      canonicalName: "Aditya Engineering College",
      shortName: "Aditya",
      defaultPlace: (rawPlace || "").trim() || "Surampalem"
    };
  }

  // 15. Raghu
  if (simplified.includes("raghu")) {
    return {
      canonicalName: "Raghu Engineering College",
      shortName: "REC",
      defaultPlace: (rawPlace || "").trim() || "Visakhapatnam"
    };
  }

  // 16. GVP
  if (simplified.includes("gayatri") || simplified.includes("gvp")) {
    return {
      canonicalName: "Gayatri Vidya Parishad College of Engineering",
      shortName: "GVPCE",
      defaultPlace: (rawPlace || "").trim() || "Visakhapatnam"
    };
  }

  // 17. JNTUK / JNTUH / JNTU
  if (simplified.includes("jntu")) {
    if (simplified.includes("kakinada") || simplified.includes("jntuk")) {
      return { canonicalName: "JNTU Kakinada", shortName: "JNTUK", defaultPlace: "Kakinada" };
    }
    if (simplified.includes("hyderabad") || simplified.includes("jntuh")) {
      return { canonicalName: "JNTU Hyderabad", shortName: "JNTUH", defaultPlace: "Hyderabad" };
    }
    return { canonicalName: "Jawaharlal Nehru Technological University", shortName: "JNTU", defaultPlace: "Andhra Pradesh" };
  }

  // 18. Andhra University
  if (simplified.includes("andhra university") || simplified === "au") {
    return {
      canonicalName: "Andhra University",
      shortName: "AU",
      defaultPlace: (rawPlace || "").trim() || "Visakhapatnam"
    };
  }

  // Generic Normalization: Clean Title Case
  const toTitleCase = (str: string) => {
    return str
      .toLowerCase()
      .split(" ")
      .map(word => {
        if (word === "of" || word === "and" || word === "for" || word === "in" || word === "&") return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  };

  const titleCased = toTitleCase(simplified);
  const short = titleCased.length > 18 ? titleCased.slice(0, 16) + "..." : titleCased;

  return {
    canonicalName: titleCased,
    shortName: short,
    defaultPlace: (rawPlace || "").trim() || "Andhra Pradesh"
  };
};

const CollegeDonutChart: React.FC<{
  items: CollegeStatItem[];
  totalTeams: number;
  size?: number;
  donutWidth?: number;
  interactive?: boolean;
  onSliceClick?: (item: CollegeStatItem) => void;
}> = ({ items, totalTeams, size = 80, donutWidth = 12, interactive = true, onSliceClick }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!items || items.length === 0 || totalTeams === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="rotate-[-90deg]">
        <circle cx="50" cy="50" r="36" fill="transparent" stroke="#E2E8F0" strokeWidth={donutWidth} />
      </svg>
    );
  }

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className="relative inline-flex items-center justify-center group/donut" title={`${item.college}: ${item.teamCount} teams (100%)`}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="rotate-[-90deg] overflow-visible">
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="transparent"
            stroke={item.color}
            strokeWidth={donutWidth}
            className="transition-all duration-300"
          />
        </svg>
      </div>
    );
  }

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        className="rotate-[-90deg] overflow-visible"
      >
        <circle 
          cx="50" 
          cy="50" 
          r={radius} 
          fill="transparent" 
          stroke="#F1F5F9" 
          strokeWidth={donutWidth} 
        />
        {items.map((item, index) => {
          const strokeLength = Math.max(0.6, (item.percentage / 100) * circumference);
          const strokeOffset = -(accumulatedPercent / 100) * circumference;
          accumulatedPercent += item.percentage;

          const isHovered = hoveredIdx === index;

          return (
            <circle
              key={index}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={item.color}
              strokeWidth={isHovered ? donutWidth + 3 : donutWidth}
              strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
              strokeDashoffset={strokeOffset}
              strokeLinecap="butt"
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={() => interactive && setHoveredIdx(index)}
              onMouseLeave={() => interactive && setHoveredIdx(null)}
              onClick={(e) => {
                if (onSliceClick) {
                  e.stopPropagation();
                  onSliceClick(item);
                }
              }}
            >
              <title>{`${item.college}: ${item.teamCount} teams (${item.percentage.toFixed(1)}%) • ${item.memberCount} members`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

interface RegistrationItem {
  id: string;
  eventId: string;
  eventTitle: string;
  groupName: string;
  teamName?: string;
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
  whatsGroupLink?: string;
  createdAt: number;
}

const RegistrationsManagementPage: React.FC = () => {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [eventsList, setEventsList] = useState<any[]>([]);
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

  // College Analytics Modal State
  const [isCollegeModalOpen, setIsCollegeModalOpen] = useState(false);

  // Add Registration Modal State & Handlers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [selectedAddEventId, setSelectedAddEventId] = useState<string>("");
  const [addEventSearch, setAddEventSearch] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);

  const [addForm, setAddForm] = useState<{
    registrationType: "Group" | "Individual";
    teamName: string;
    fullName: string;
    email: string;
    phone: string;
    studentId: string;
    collegeName: string;
    customCollegeName: string;
    collegePlace: string;
    branch: string;
    customBranch: string;
    year: string;
    section: string;
    status: "Confirmed" | "Not Confirmed" | "Waitlisted";
    paymentStatus: "Free" | "Paid";
    transactionId: string;
    foodPreference: "Veg" | "Non-Veg" | "None";
    sendConfirmationEmail: boolean;
    members: Array<{
      name: string;
      email: string;
      phone: string;
      studentId: string;
      college: string;
      role: string;
    }>;
  }>({
    registrationType: "Group",
    teamName: "",
    fullName: "",
    email: "",
    phone: "",
    studentId: "",
    collegeName: "Vishnu Institute of Technology",
    customCollegeName: "",
    collegePlace: "Bhimavaram",
    branch: "CSE",
    customBranch: "",
    year: "3rd Year",
    section: "A",
    status: "Confirmed",
    paymentStatus: "Free",
    transactionId: "",
    foodPreference: "Veg",
    sendConfirmationEmail: true,
    members: []
  });

  const resetAddForm = (preselectedEventId?: string) => {
    let targetEvId = preselectedEventId || "";
    if (!targetEvId && selectedEvent !== "All") {
      const found = eventsList.find(e => (e.title || "").trim().toLowerCase() === selectedEvent.trim().toLowerCase());
      if (found) targetEvId = found.id || found._id;
    }
    setSelectedAddEventId(targetEvId);
    setAddStep(targetEvId ? 2 : 1);
    setAddEventSearch("");
    setAddFormError(null);

    const targetEv = eventsList.find(e => (e.id === targetEvId || e._id === targetEvId));
    const isIndivOnly = targetEv && (targetEv.registrationType === "Individual" || targetEv.maxTeamSize === 1);

    setAddForm({
      registrationType: isIndivOnly ? "Individual" : "Group",
      teamName: "",
      fullName: "",
      email: "",
      phone: "",
      studentId: "",
      collegeName: "Vishnu Institute of Technology",
      customCollegeName: "",
      collegePlace: "Bhimavaram",
      branch: "CSE",
      customBranch: "",
      year: "3rd Year",
      section: "A",
      status: "Confirmed",
      paymentStatus: "Free",
      transactionId: "",
      foodPreference: "Veg",
      sendConfirmationEmail: true,
      members: []
    });
    setIsAddModalOpen(true);
  };

  const handleSelectEventForAdd = (eventId: string) => {
    setSelectedAddEventId(eventId);
    const targetEv = eventsList.find(e => (e.id === eventId || e._id === eventId));
    const isIndivOnly = targetEv && (targetEv.registrationType === "Individual" || targetEv.maxTeamSize === 1);
    setAddForm(prev => ({
      ...prev,
      registrationType: isIndivOnly ? "Individual" : prev.registrationType
    }));
    setAddFormError(null);
    setAddStep(2);
  };

  const handleAddMember = () => {
    const targetEv = eventsList.find(e => (e.id === selectedAddEventId || e._id === selectedAddEventId));
    const maxMembers = targetEv?.maxTeamSize ? targetEv.maxTeamSize - 1 : 5;
    if (addForm.members.length >= maxMembers) {
      alert(`Maximum team size for this event is ${targetEv?.maxTeamSize || 6} participants.`);
      return;
    }
    const currentCollege = addForm.collegeName === "Other" ? addForm.customCollegeName : addForm.collegeName;
    setAddForm(prev => ({
      ...prev,
      members: [
        ...prev.members,
        {
          name: "",
          email: "",
          phone: "",
          studentId: "",
          college: currentCollege || "Vishnu Institute of Technology",
          role: "Member"
        }
      ]
    }));
  };

  const handleRemoveMember = (idx: number) => {
    setAddForm(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== idx)
    }));
  };

  const handleMemberChange = (idx: number, field: string, val: string) => {
    setAddForm(prev => {
      const nextMembers = [...prev.members];
      nextMembers[idx] = { ...nextMembers[idx], [field]: val };
      return { ...prev, members: nextMembers };
    });
  };

  const handleCreateRegistration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAddFormError(null);

    const targetEv = eventsList.find(e => (e.id === selectedAddEventId || e._id === selectedAddEventId));
    if (!targetEv) {
      setAddFormError("Please select an event for registration.");
      setAddStep(1);
      return;
    }

    const isGroup = addForm.registrationType === "Group";
    const cleanLeadName = addForm.fullName.trim();
    const cleanLeadEmail = addForm.email.trim().toLowerCase();
    const cleanLeadPhone = addForm.phone.trim();
    const cleanLeadId = addForm.studentId.trim().toUpperCase();

    if (!cleanLeadName) {
      setAddFormError("Participant / Team Lead name is required.");
      return;
    }
    if (!cleanLeadEmail || !cleanLeadEmail.includes("@")) {
      setAddFormError("Please provide a valid participant email address.");
      return;
    }
    if (!cleanLeadPhone) {
      setAddFormError("Contact phone number is required.");
      return;
    }
    if (!cleanLeadId) {
      setAddFormError("Roll number or Student ID is required.");
      return;
    }
    if (isGroup && !addForm.teamName.trim()) {
      setAddFormError("Team name is required for group registrations.");
      return;
    }

    // Validate members
    if (isGroup && addForm.members.length > 0) {
      const seenEmails = new Set<string>([cleanLeadEmail]);
      for (let i = 0; i < addForm.members.length; i++) {
        const m = addForm.members[i];
        const mName = m.name.trim();
        const mEmail = m.email.trim().toLowerCase();
        if (!mName) {
          setAddFormError(`Member #${i + 2}'s full name is required.`);
          return;
        }
        if (!mEmail || !mEmail.includes("@")) {
          setAddFormError(`Member #${i + 2} (${mName || "Member"}) requires a valid email address.`);
          return;
        }
        if (seenEmails.has(mEmail)) {
          setAddFormError(`Duplicate email detected for member #${i + 2} (${mEmail}). All participants must have unique emails.`);
          return;
        }
        seenEmails.add(mEmail);
      }
    }

    const finalCollege = addForm.collegeName === "Other" 
      ? (addForm.customCollegeName.trim() || "Other College") 
      : addForm.collegeName;
    const finalBranch = addForm.branch === "Other" 
      ? (addForm.customBranch.trim() || "Engineering") 
      : addForm.branch;
    const finalTeamName = isGroup ? addForm.teamName.trim() : "Individual RSVP";
    const teamSize = isGroup ? addForm.members.length + 1 : 1;
    const isVishnu = finalCollege.toLowerCase().includes("vishnu") || 
      finalCollege.toLowerCase().includes("vitb") || 
      finalCollege.toLowerCase().includes("svecw");

    const payload: any = {
      eventId: targetEv.id || targetEv._id,
      eventTitle: targetEv.title || "AI Verse Event",
      category: targetEv.category || "General",
      isQuiz: Boolean(targetEv.isQuiz || targetEv.category === "QUIZ" || targetEv.category === "Quiz"),
      groupName: finalTeamName,
      teamName: finalTeamName,
      fullName: cleanLeadName,
      teamLeadName: cleanLeadName,
      email: cleanLeadEmail,
      teamLeadEmail: cleanLeadEmail,
      userEmail: cleanLeadEmail,
      phoneNumber: cleanLeadPhone,
      teamLeadPhone: cleanLeadPhone,
      phone: cleanLeadPhone,
      studentId: cleanLeadId,
      teamLeadStudentId: cleanLeadId,
      rollNo: cleanLeadId,
      collegeName: finalCollege,
      college: finalCollege,
      collegePlace: addForm.collegePlace.trim() || "Bhimavaram",
      branch: finalBranch,
      year: addForm.year,
      section: addForm.section.trim(),
      teamSize,
      members: isGroup ? addForm.members.map(m => ({
        name: m.name.trim(),
        email: m.email.trim().toLowerCase(),
        phone: m.phone.trim(),
        studentId: m.studentId.trim().toUpperCase(),
        college: m.college.trim() || finalCollege,
        role: m.role || "Member"
      })) : [],
      status: addForm.status,
      paymentStatus: addForm.paymentStatus,
      transactionId: addForm.transactionId.trim(),
      foodPreference: addForm.foodPreference,
      needsFood: Boolean(addForm.foodPreference && addForm.foodPreference !== "None"),
      isVishnuStudent: isVishnu,
      confirmedAt: addForm.status === "Confirmed" ? Date.now() : undefined,
      createdAt: Date.now()
    };

    try {
      setIsSubmittingAdd(true);
      const res = await createRegistration(payload);
      const newRegId = res.id || res.registration?.id || res.registration?._id || `reg_${Date.now()}`;
      
      const newRegistrationItem: RegistrationItem = {
        id: newRegId,
        eventId: payload.eventId,
        eventTitle: payload.eventTitle,
        groupName: finalTeamName,
        teamName: finalTeamName,
        teamEmail: "",
        teamLeadName: cleanLeadName,
        teamLeadEmail: cleanLeadEmail,
        teamLeadStudentId: cleanLeadId,
        phoneNumber: cleanLeadPhone,
        teamLeadPhone: cleanLeadPhone,
        collegeName: finalCollege,
        college: finalCollege,
        collegePlace: payload.collegePlace,
        branch: finalBranch,
        section: addForm.section.trim(),
        year: addForm.year,
        teamSize,
        members: payload.members,
        status: addForm.status,
        paymentStatus: addForm.paymentStatus,
        transactionId: addForm.transactionId.trim(),
        foodPreference: addForm.foodPreference,
        createdAt: Date.now()
      };

      setRegistrations(prev => [newRegistrationItem, ...prev]);

      // If email confirmation is enabled and status is Confirmed, deliver confirmation receipt
      if (addForm.sendConfirmationEmail && addForm.status === "Confirmed") {
        try {
          const ticketUrl = `https://aiversevitb.in/ticket/${newRegId}`;
          const emailContent = buildRegistrationConfirmationEmail({
            teamLeadName: cleanLeadName,
            eventTitle: payload.eventTitle,
            groupName: finalTeamName,
            teamLeadStudentId: cleanLeadId,
            teamSize,
            transactionId: payload.transactionId,
            members: payload.members,
            ticketUrl,
            whatsGroupLink: targetEv.whatsGroupLink || targetEv.whatsappGroupLink || targetEv.whatsappGroupUrl || "",
          });
          await sendResendEmail({
            to: cleanLeadEmail,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });
        } catch (emailErr) {
          console.warn("Could not send confirmation email:", emailErr);
        }
      }

      setConfirmSuccessMsg(`Successfully registered ${isGroup ? `team "${finalTeamName}"` : cleanLeadName} for ${payload.eventTitle}!`);
      setTimeout(() => setConfirmSuccessMsg(null), 6000);
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error creating registration:", err);
      setAddFormError(err.message || "Failed to create registration. Please check inputs and try again.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleExport = (format: "csv" | "excel" = "csv") => {
    const targetRegs = exportSelectedEvent === "All"
      ? registrations
      : registrations.filter(r => {
          const matchesTitle = (r.eventTitle || "").trim().toLowerCase() === exportSelectedEvent.trim().toLowerCase();
          const matchesId = eventsList.some(e => 
            (e.id === r.eventId || e._id === r.eventId) && 
            (e.title || "").trim().toLowerCase() === exportSelectedEvent.trim().toLowerCase()
          );
          return matchesTitle || matchesId;
        });

    if (targetRegs.length === 0) {
      alert(`No registrations available for ${exportSelectedEvent === "All" ? "any event" : exportSelectedEvent}.`);
      return;
    }

    const headers = [
      "Team Name",
      "Event Title",
      "Registration Type",
      "Participant Role",
      "Participant Name",
      "Roll Number / Student ID",
      "Email Address",
      "Personal Email",
      "College Email",
      "Phone Number",
      "College Name",
      "College City/Place",
      "Branch / Department",
      "Section",
      "Year",
      "Team Size",
      "Payment Status",
      "Total Fee Paid",
      "UTR / Transaction ID",
      "Food Preference",
      "Registration Status",
      "Registration Date & Time"
    ];

    const rows: string[] = [];

    targetRegs.forEach((reg) => {
      const rawTeamName = (
        reg.groupName ||
        (reg as any).teamName ||
        (reg as any).team_name ||
        ""
      ).trim();

      const isGroup = Boolean(
        (rawTeamName && rawTeamName !== "Individual RSVP" && rawTeamName !== "Individual Registration" && rawTeamName !== "Individual") ||
        reg.teamSize > 1 ||
        (Array.isArray(reg.members) && reg.members.length > 0)
      );

      // 1. Team Lead / Solo Registrant
      const leadName = reg.teamLeadName || "Student Registrant";
      const teamName = isGroup
        ? (rawTeamName && rawTeamName !== "Individual RSVP" ? rawTeamName : `${leadName}'s Team`)
        : (rawTeamName || "Individual RSVP");

      const regType = isGroup ? "Group / Team" : "Individual";
      const regDate = reg.createdAt ? new Date(reg.createdAt).toLocaleString("en-US") : "N/A";
      const status = reg.status || "Confirmed";
      const paymentStatus = reg.paymentStatus || "Confirmed";
      const totalFee = reg.totalFeePaid || 0;
      const utr = reg.utrNumber || reg.transactionId || "N/A";
      const foodPref = reg.foodPreference || (reg.needsFood === false ? "No Food (Free)" : "Standard Entry");
      const college = reg.collegeName || reg.college || "";
      const collegePlace = reg.collegePlace || "";
      const branch = reg.branch || "";
      const section = reg.section || "";
      const year = reg.year || "";
      const teamSize = reg.teamSize || (reg.members ? reg.members.length + 1 : 1);

      const leadStudentId = reg.teamLeadStudentId || "";
      const leadEmail = reg.teamLeadEmail || reg.teamLeadPersonalEmail || reg.teamLeadCollegeEmail || "";
      const leadPersonalEmail = reg.teamLeadPersonalEmail || "";
      const leadCollegeEmail = reg.teamLeadCollegeEmail || "";
      const leadPhone = reg.phoneNumber || reg.teamLeadPhone || "";
      const leadRole = isGroup ? "Team Lead" : "Solo Participant";

      rows.push([
        `"${teamName.replace(/"/g, '""')}"`,
        `"${(reg.eventTitle || "").replace(/"/g, '""')}"`,
        `"${regType}"`,
        `"${leadRole}"`,
        `"${leadName.replace(/"/g, '""')}"`,
        `"${leadStudentId.replace(/"/g, '""')}"`,
        `"${leadEmail.replace(/"/g, '""')}"`,
        `"${leadPersonalEmail.replace(/"/g, '""')}"`,
        `"${leadCollegeEmail.replace(/"/g, '""')}"`,
        `"${leadPhone.replace(/"/g, '""')}"`,
        `"${college.replace(/"/g, '""')}"`,
        `"${collegePlace.replace(/"/g, '""')}"`,
        `"${branch.replace(/"/g, '""')}"`,
        `"${section.replace(/"/g, '""')}"`,
        `"${year.replace(/"/g, '""')}"`,
        teamSize,
        `"${paymentStatus}"`,
        `"₹${totalFee}"`,
        `"${utr.replace(/"/g, '""')}"`,
        `"${foodPref.replace(/"/g, '""')}"`,
        `"${status}"`,
        `"${regDate}"`
      ].join(","));

      // 2. Team Members
      if (Array.isArray(reg.members) && reg.members.length > 0) {
        reg.members.forEach((m, mIdx) => {
          const mEmail = (m.email || "").trim().toLowerCase();
          const mStudentId = (m.studentId || "").trim().toLowerCase();
          if (
            (mEmail && mEmail === leadEmail.trim().toLowerCase()) ||
            (mStudentId && mStudentId === leadStudentId.trim().toLowerCase())
          ) {
            return;
          }

          const mName = m.name || `Member #${mIdx + 2}`;
          const mRole = m.role || `Member #${mIdx + 2}`;
          const mPhone = m.phone || m.phoneNumber || leadPhone;
          const mBranch = (m as any).branch || branch;
          const mSection = (m as any).section || section;
          const mYear = (m as any).year || year;
          const mCollege = (m as any).college || college;

          rows.push([
            `"${teamName.replace(/"/g, '""')}"`,
            `"${(reg.eventTitle || "").replace(/"/g, '""')}"`,
            `"${regType}"`,
            `"${mRole}"`,
            `"${mName.replace(/"/g, '""')}"`,
            `"${(m.studentId || "").replace(/"/g, '""')}"`,
            `"${(m.email || "").replace(/"/g, '""')}"`,
            `"${(m.email || "").replace(/"/g, '""')}"`,
            `""`,
            `"${mPhone.replace(/"/g, '""')}"`,
            `"${mCollege.replace(/"/g, '""')}"`,
            `"${collegePlace.replace(/"/g, '""')}"`,
            `"${mBranch.replace(/"/g, '""')}"`,
            `"${mSection.replace(/"/g, '""')}"`,
            `"${mYear.replace(/"/g, '""')}"`,
            teamSize,
            `"${paymentStatus}"`,
            `"₹${totalFee}"`,
            `"${utr.replace(/"/g, '""')}"`,
            `"${foodPref.replace(/"/g, '""')}"`,
            `"${status}"`,
            `"${regDate}"`
          ].join(","));
        });
      }
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const mimeType = format === "excel" ? "application/vnd.ms-excel;charset=utf-8;" : "text/csv;charset=utf-8;";
    const blob = new Blob([csvContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const sanitizedEventName = exportSelectedEvent === "All"
      ? "all_events"
      : exportSelectedEvent.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const filenamePrefix = `${sanitizedEventName}_team_registrations`;
    const extension = format === "excel" ? "xls" : "csv";

    link.setAttribute("href", url);
    link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().split("T")[0]}.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

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
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedRegIds.length} selected registration(s)?\n\nThis will remove all participant accounts, quiz submissions, and records from the database.`)) return;

    try {
      setLoading(true);
      const selectedRegs = registrations.filter(r => selectedRegIds.includes(r.id));
      
      for (const reg of selectedRegs) {
        await deleteParticipantCascade(reg.id, (reg.members || []).map((m: any) => m.email).filter(Boolean), reg.teamSize, reg.eventId);
      }

      setRegistrations(prev => prev.filter(r => !selectedRegIds.includes(r.id)));
      setSelectedRegIds([]);
      setIsDeleteSelectionMode(false);
      alert(`Successfully deleted ${selectedRegs.length} registration(s) and all participant records.`);
    } catch (err) {
      console.error("Error bulk deleting registrations:", err);
      alert("Failed to delete selected registrations.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroupRegistrations = async (groupName: string) => {
    if (!groupName || groupName === "Individual RSVP") return;
    if (!window.confirm(`Are you sure you want to delete team "${groupName}"?\n\nThis will purge all participant accounts and submissions.`)) return;
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
    if (!window.confirm("Are you sure you want to delete all registrations for this event?\n\nAll participant records and logins will be deleted.")) return;
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
      const [docs, evs] = await Promise.all([
        apiFetchRegistrations().catch(() => []),
        apiFetchEvents().catch(() => []),
      ]);

      if (Array.isArray(evs)) {
        setEventsList(evs);
      }
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

        const leadName = data.teamLeadName || data.fullName || data.name || data.userName || (data.members && data.members[0]?.name) || "Student Registrant";
        const rawTeamName = (data.groupName || data.teamName || data.team_name || "").trim();
        const isGroup = Boolean(
          (rawTeamName && rawTeamName !== "Individual RSVP" && rawTeamName !== "Individual Registration" && rawTeamName !== "Individual") ||
          Number(data.teamSize) > 1 ||
          (Array.isArray(data.members) && data.members.length > 0)
        );
        const resolvedTeamName = isGroup 
          ? (rawTeamName && rawTeamName !== "Individual RSVP" ? rawTeamName : `${leadName}'s Team`)
          : (rawTeamName || "Individual RSVP");

        const studentId = data.teamLeadStudentId || data.studentId || data.rollNo || data.registrationNumber || (data.members && data.members[0]?.registrationNumber) || "";

        const matchedEvent = Array.isArray(evs) ? evs.find((e: any) => 
          (e.id && e.id === data.eventId) || 
          (e._id && e._id === data.eventId) || 
          (e.title && e.title.trim().toLowerCase() === (data.eventTitle || "").trim().toLowerCase())
        ) : null;

        const resolvedWhatsLink = 
          data.whatsGroupLink || 
          data.whatsappGroupLink || 
          data.whatsappGroupUrl || 
          data.whatsappLink || 
          matchedEvent?.whatsGroupLink || 
          matchedEvent?.whatsappGroupLink || 
          matchedEvent?.whatsappGroupUrl || 
          matchedEvent?.whatsappLink || 
          "";

        list.push({
          id: docSnap.id || docSnap._id || (docSnap._doc && docSnap._doc._id) || "",
          eventId: data.eventId || "",
          eventTitle: data.eventTitle || "Event",
          groupName: resolvedTeamName,
          teamName: resolvedTeamName,
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
          whatsGroupLink: resolvedWhatsLink,
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
    if (confirm("Are you sure you want to cancel and delete this registration?\n\nThis will permanently delete the participant/team account, quiz submissions, and records.")) {
      try {
        const targetReg = registrations.find(r => r.id === regId);
        await deleteParticipantCascade(targetReg?.id || regId, (targetReg?.members || []).map((m: any) => m.email).filter(Boolean), teamSize, eventId);

        setRegistrations(prev => prev.filter(r => r.id !== regId));
        alert("Registration and participant account successfully deleted.");
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
        const regIdentifier = reg.id || (reg as any)._id || (reg as any).backendId;
        const ticketUrl = `https://aiversevitb.in/ticket/${regIdentifier}`;

        const matchedEvent = eventsList.find((e: any) => 
          (e.id && e.id === reg.eventId) || 
          (e._id && e._id === reg.eventId) || 
          (e.title && e.title.trim().toLowerCase() === (reg.eventTitle || "").trim().toLowerCase())
        );

        const resolvedWhatsLink = 
          reg.whatsGroupLink || 
          (reg as any).whatsappGroupLink || 
          (reg as any).whatsappGroupUrl || 
          (reg as any).whatsappLink || 
          matchedEvent?.whatsGroupLink || 
          matchedEvent?.whatsappGroupLink || 
          matchedEvent?.whatsappGroupUrl || 
          matchedEvent?.whatsappLink || 
          "";

        const emailContent = buildRegistrationConfirmationEmail({
          teamLeadName: reg.teamLeadName || (reg as any).name || "Participant",
          eventTitle: reg.eventTitle || "AI Verse Event",
          groupName: reg.groupName,
          teamLeadStudentId: reg.teamLeadStudentId || (reg as any).studentId,
          teamSize: reg.teamSize,
          transactionId: reg.transactionId,
          members: reg.members,
          ticketUrl,
          whatsGroupLink: resolvedWhatsLink,
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

  // Get unique events list for filter dropdown and export modal
  const uniqueEvents = useMemo(() => {
    const eventsSet = new Set<string>();
    (eventsList || []).forEach(e => {
      const title = (e.title || "").trim();
      if (title) eventsSet.add(title);
    });
    (registrations || []).forEach(r => {
      const title = (r.eventTitle || "").trim();
      if (title) eventsSet.add(title);
    });
    return ["All", ...Array.from(eventsSet).filter(Boolean).sort((a, b) => a.localeCompare(b))];
  }, [registrations, eventsList]);

  // Filtered registrations list
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const rawCol = (r.collegeName || r.college || "").trim();
      const normalizedCol = normalizeCollegeInfo(rawCol, r.collegePlace);

      const matchesSearch = 
        !q ||
        (r.teamLeadName || "").toLowerCase().includes(q) ||
        (r.groupName || "").toLowerCase().includes(q) ||
        (r.teamLeadStudentId || "").toLowerCase().includes(q) ||
        (r.eventTitle || "").toLowerCase().includes(q) ||
        rawCol.toLowerCase().includes(q) ||
        normalizedCol.canonicalName.toLowerCase().includes(q) ||
        normalizedCol.shortName.toLowerCase().includes(q) ||
        (r.collegePlace || "").toLowerCase().includes(q) ||
        normalizedCol.defaultPlace.toLowerCase().includes(q) ||
        (r.members || []).some(m => 
          (m.name || "").toLowerCase().includes(q) ||
          (m.studentId || "").toLowerCase().includes(q)
        );
      
      const matchesEvent = selectedEvent === "All" || 
        (r.eventTitle && r.eventTitle.trim().toLowerCase() === selectedEvent.trim().toLowerCase()) ||
        (r.eventId && eventsList.some(e => (e.id === r.eventId || e._id === r.eventId) && (e.title || "").trim().toLowerCase() === selectedEvent.trim().toLowerCase()));
      
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
  }, [registrations, eventsList, searchQuery, selectedEvent, selectedType, selectedStatus]);

  // College-wise registration breakdown (Normalized and Team-Based Pie Chart data)
  const collegeStats = useMemo(() => {
    const targetRegs = selectedEvent === "All" 
      ? registrations 
      : registrations.filter(r => {
          const matchesTitle = (r.eventTitle || "").trim().toLowerCase() === selectedEvent.trim().toLowerCase();
          const matchesId = eventsList.some(e => 
            (e.id === r.eventId || e._id === r.eventId) && 
            (e.title || "").trim().toLowerCase() === selectedEvent.trim().toLowerCase()
          );
          return matchesTitle || matchesId;
        });

    const collegeMap = new Map<string, { college: string; shortName: string; place?: string; memberCount: number; teamCount: number }>();
    let totalTeams = 0;
    let totalMembers = 0;

    targetRegs.forEach(reg => {
      const rawCol = (reg.collegeName || reg.college || "").trim();
      const rawPlace = (reg.collegePlace || "").trim();
      const normalized = normalizeCollegeInfo(rawCol, rawPlace);
      const colKey = normalized.canonicalName;
      const membersInTeam = Math.max(1, reg.teamSize || ((reg.members && reg.members.length > 0) ? reg.members.length + 1 : 1));

      totalTeams += 1;
      totalMembers += membersInTeam;

      if (!collegeMap.has(colKey)) {
        collegeMap.set(colKey, {
          college: colKey,
          shortName: normalized.shortName,
          place: rawPlace || normalized.defaultPlace,
          memberCount: 0,
          teamCount: 0,
        });
      }

      const item = collegeMap.get(colKey)!;
      item.memberCount += membersInTeam;
      item.teamCount += 1;
      if (!item.place && (rawPlace || normalized.defaultPlace)) {
        item.place = rawPlace || normalized.defaultPlace;
      }
    });

    // Primary ranking by Teams count (descending)
    const sorted = Array.from(collegeMap.values()).sort((a, b) => b.teamCount - a.teamCount || b.memberCount - a.memberCount);

    const result: CollegeStatItem[] = sorted.map((item, index) => {
      const pct = totalTeams > 0 ? (item.teamCount / totalTeams) * 100 : 0;
      return {
        college: item.college,
        displayName: item.college,
        shortName: item.shortName,
        place: item.place,
        memberCount: item.memberCount,
        teamCount: item.teamCount,
        percentage: pct,
        color: COLLEGE_PALETTE[index % COLLEGE_PALETTE.length]
      };
    });

    return {
      items: result,
      totalTeams,
      totalMembers,
      totalColleges: result.length,
      topCollege: result[0] || null
    };
  }, [registrations, selectedEvent, eventsList]);

  // Overall metrics
  const metrics = useMemo(() => {
    const total = registrations.length;
    const notConfirmed = registrations.filter(r => r.status !== "Confirmed").length;
    const groupCount = registrations.filter(r => r.groupName && r.groupName !== "Individual RSVP").length;
    const individualCount = total - groupCount;
    let totalMembers = 0;
    registrations.forEach(r => {
      totalMembers += Math.max(1, r.teamSize || ((r.members && r.members.length > 0) ? r.members.length + 1 : 1));
    });

    return {
      total: total,
      totalMembers: totalMembers,
      pending: notConfirmed,
      group: groupCount,
      individual: individualCount
    };
  }, [registrations]);

  const handleExportCollegeBreakdown = () => {
    if (collegeStats.items.length === 0) {
      alert("No college data available to export.");
      return;
    }

    const headers = [
      "College / Institution Name",
      "Short Code",
      "City / Location",
      "Total Registered Teams",
      "Total Registered Students",
      "Team Share (%)"
    ];

    const rows = collegeStats.items.map(item => [
      `"${item.college.replace(/"/g, '""')}"`,
      `"${item.shortName.replace(/"/g, '""')}"`,
      `"${(item.place || "").replace(/"/g, '""')}"`,
      item.teamCount,
      item.memberCount,
      `${item.percentage.toFixed(2)}%`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `AI_Verse_College_Distribution_${selectedEvent.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
              <TrendingUp className="h-3 w-3" /> +12%
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Registrations</span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : metrics.total}
              </h3>
              {!loading && metrics.totalMembers > 0 && (
                <span className="text-[11px] font-semibold text-slate-500">
                  ({metrics.totalMembers} students)
                </span>
              )}
            </div>
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
              {metrics.total > 0 ? Math.round((metrics.group / metrics.total) * 100) : 0}% of total
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Group Registrations</span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 mt-1" /> : metrics.group}
            </h3>
          </div>
        </div>

        {/* College Distribution Pie Chart Card */}
        <div 
          onClick={() => setIsCollegeModalOpen(true)}
          className="bg-white p-4.5 sm:p-5 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col justify-between hover:shadow-md hover:border-indigo-100 transition-all duration-300 cursor-pointer group relative overflow-hidden text-left"
          title="Click to view college registration distribution pie chart"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/60 rounded-full blur-xl pointer-events-none -mr-6 -mt-6 group-hover:scale-125 transition-transform duration-500" />

          {/* Card Header */}
          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                <GraduationCap className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block leading-none">
                  Colleges
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {loading ? "..." : `${collegeStats.totalColleges} ${collegeStats.totalColleges === 1 ? 'Campus' : 'Campuses'}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollegeModalOpen(true);
              }}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100/80 group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <PieChart className="h-3 w-3" />
              <span>Pie Chart</span>
            </button>
          </div>

          {/* Card Body: Mini Donut Chart & College Legend */}
          <div className="mt-3 flex items-center justify-between gap-3 relative z-10">
            {/* SVG Donut Chart */}
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              ) : (
                <>
                  <CollegeDonutChart 
                    items={collegeStats.items} 
                    totalTeams={collegeStats.totalTeams} 
                    size={68} 
                    donutWidth={8} 
                    interactive={false}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-black text-slate-800 leading-none">
                      {collegeStats.totalTeams}
                    </span>
                    <span className="text-[7.5px] font-bold text-slate-400 leading-none mt-0.5 uppercase tracking-tighter">
                      teams
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Top Colleges List */}
            <div className="flex-1 min-w-0 space-y-1">
              {loading ? (
                <div className="space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded w-full animate-pulse" />
                  <div className="h-3 bg-slate-100 rounded w-3/4 animate-pulse" />
                </div>
              ) : collegeStats.items.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium">No registrations yet</p>
              ) : (
                collegeStats.items.slice(0, 2).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: item.color }} 
                      />
                      <span 
                        className="font-bold text-slate-700 truncate max-w-[85px] sm:max-w-[100px]" 
                        title={item.college}
                      >
                        {item.shortName}
                      </span>
                    </div>
                    <span className="font-extrabold text-slate-900 shrink-0 text-[11px]">
                      {item.teamCount} <span className="text-[9px] font-medium text-slate-400">teams ({item.percentage.toFixed(0)}%)</span>
                    </span>
                  </div>
                ))
              )}

              {!loading && collegeStats.items.length > 2 && (
                <div className="text-[10px] font-bold text-indigo-600 pt-0.5 flex items-center gap-0.5 hover:underline">
                  <span>+{collegeStats.items.length - 2} more colleges →</span>
                </div>
              )}
            </div>
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
                onClick={() => {
                  setExportSelectedEvent(selectedEvent);
                  setIsExportModalOpen(true);
                }}
                className="flex items-center gap-1.5 justify-center px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition-all whitespace-nowrap cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export Data
              </button>

              <button
                onClick={() => resetAddForm()}
                className="flex items-center gap-1.5 justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition-all whitespace-nowrap cursor-pointer"
                title="Add a new participant or team registration"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Registration
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
                              <span className="text-[10px] text-slate-500 font-bold">
                                {isGroup ? `👑 Lead: ${reg.teamLeadName} ${reg.teamLeadStudentId ? `(${reg.teamLeadStudentId})` : ""}` : `👤 ${reg.teamLeadName} ${reg.teamLeadStudentId ? `(${reg.teamLeadStudentId})` : ""}`}
                              </span>
                              {isGroup && reg.members && reg.members.length > 0 && (
                                <span className="text-[10px] text-purple-700 font-semibold mt-0.5 max-w-[280px] truncate" title={reg.members.map((m: any) => `${m.name}${m.studentId ? ` (${m.studentId})` : ''}`).join(', ')}>
                                  👥 Members: {reg.members.map((m: any) => m.name || m.studentId).filter(Boolean).join(", ")}
                                </span>
                              )}
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
      {selectedReg && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 w-screen h-screen z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden"
          onClick={() => {
            setSelectedReg(null);
            setIsEditing(false);
          }}
        >
          <div 
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-left relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
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
        </div>,
        document.body
      )}

      {/* ================= EXPORT DATA MODAL ================= */}
      {isExportModalOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 w-screen h-screen z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-hidden"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-3xl border border-slate-100 shadow-2xl overflow-hidden p-6 space-y-6 text-left relative z-10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold shadow-inner">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-850">Export Registration Records</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Select an event to download member records in CSV or Excel format.</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
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
                  {uniqueEvents.filter(ev => ev !== "All").map((ev, idx) => {
                    const count = registrations.filter(r => 
                      (r.eventTitle && r.eventTitle.trim().toLowerCase() === ev.trim().toLowerCase()) ||
                      (r.eventId && eventsList.some(e => (e.id === r.eventId || e._id === r.eventId) && e.title?.trim().toLowerCase() === ev.trim().toLowerCase()))
                    ).length;
                    return (
                      <option key={idx} value={ev}>
                        {ev} ({count} {count === 1 ? "registration" : "registrations"})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/60 text-xs text-slate-600 space-y-1.5">
                <span className="font-bold text-blue-700 block">Report Summary:</span>
                <p className="leading-relaxed">
                  Exporting records for <span className="font-bold text-slate-800">{exportSelectedEvent}</span> ({exportSelectedEvent === "All" ? registrations.length : registrations.filter(r => (r.eventTitle && r.eventTitle.trim().toLowerCase() === exportSelectedEvent.trim().toLowerCase()) || (r.eventId && eventsList.some(e => (e.id === r.eventId || e._id === r.eventId) && e.title?.trim().toLowerCase() === exportSelectedEvent.trim().toLowerCase()))).length} registration entries).
                </p>
                <p className="text-[11px] text-slate-500">
                  ✓ Includes complete roster breakdown (Team Names, Team Leads & all registered team members) with contact info, roll numbers, departments, payment verification status, and timestamps.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </button>
              <button
                onClick={() => handleExport("excel")}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download Excel (.xls)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= COLLEGE DISTRIBUTION ANALYTICS MODAL ================= */}
      {isCollegeModalOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 w-screen h-screen z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 overflow-hidden"
          onClick={() => setIsCollegeModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-3xl rounded-3xl border border-slate-100 shadow-2xl overflow-hidden text-left max-h-[90vh] flex flex-col relative z-10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-inner">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-850">
                      College Registration Analytics
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {selectedEvent === "All" ? "All Events" : selectedEvent}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Live breakdown of team registrations and participation across institutions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCollegeModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Top 4 Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Campuses</span>
                  <p className="text-xl font-black text-slate-800 mt-0.5">{collegeStats.totalColleges}</p>
                  <span className="text-[10px] text-slate-500 font-medium">Institutions</span>
                </div>

                <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100/60">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Total Teams</span>
                  <p className="text-xl font-black text-indigo-950 mt-0.5">{collegeStats.totalTeams}</p>
                  <span className="text-[10px] text-indigo-700 font-medium">{metrics.group} Groups / {metrics.individual} Solo</span>
                </div>

                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100/60">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Top College</span>
                  <p className="text-sm font-black text-emerald-900 mt-1 truncate" title={collegeStats.topCollege?.college}>
                    {collegeStats.topCollege?.shortName || "None"}
                  </p>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    {collegeStats.topCollege ? `${collegeStats.topCollege.teamCount} teams (${collegeStats.topCollege.percentage.toFixed(0)}%)` : "No data"}
                  </span>
                </div>

                <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-100/60">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Total Students</span>
                  <p className="text-xl font-black text-blue-900 mt-0.5">{collegeStats.totalMembers}</p>
                  <span className="text-[10px] text-blue-600 font-medium">Across all teams</span>
                </div>
              </div>

              {/* Chart & Breakdown Side-by-Side */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Large Interactive Donut SVG */}
                <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                  <CollegeDonutChart 
                    items={collegeStats.items} 
                    totalTeams={collegeStats.totalTeams} 
                    size={160} 
                    donutWidth={16} 
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                    <span className="text-2xl font-black text-slate-800 leading-none">
                      {collegeStats.totalTeams}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                      Teams
                    </span>
                  </div>
                </div>

                {/* College Share Legend & Progress Bars */}
                <div className="flex-1 w-full space-y-2.5">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Institutional Distribution (By Teams)
                  </h4>
                  {collegeStats.items.length === 0 ? (
                    <p className="text-xs text-slate-400">No college data available for this selection.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {collegeStats.items.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="font-bold text-slate-800 truncate max-w-[240px] sm:max-w-[320px]" title={item.college}>
                                {item.college}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-extrabold text-slate-900">{item.teamCount} {item.teamCount === 1 ? 'team' : 'teams'}</span>
                              <span className="text-[11px] font-semibold text-slate-400">({item.percentage.toFixed(1)}%) • {item.memberCount} students</span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ width: `${Math.max(item.percentage, 2)}%`, backgroundColor: item.color }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Breakdown Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Full College Breakdown Table
                  </h4>
                  <span className="text-xs font-semibold text-slate-400">
                    Click "Filter Directory" to inspect participants
                  </span>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4">#</th>
                          <th className="py-2.5 px-4">College / Institution</th>
                          <th className="py-2.5 px-4">City/Place</th>
                          <th className="py-2.5 px-4 text-center">Registered Teams</th>
                          <th className="py-2.5 px-4 text-center">Total Students</th>
                          <th className="py-2.5 px-4 text-center">Team Share</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {collegeStats.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-4 text-slate-400 font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <div>
                                  <span className="font-extrabold text-slate-800 block">
                                    {item.college}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    Code: {item.shortName}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              {item.place || "Bhimavaram"}
                            </td>
                            <td className="py-2.5 px-4 text-center font-black text-indigo-700">
                              {item.teamCount}
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-slate-600">
                              {item.memberCount}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100/60">
                                {item.percentage.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSearchQuery(item.shortName !== "Unspecified" ? item.shortName : item.college);
                                  setIsCollegeModalOpen(false);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer"
                                title={`Filter directory to ${item.college}`}
                              >
                                Filter Directory
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                onClick={handleExportCollegeBreakdown}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export College Breakdown (CSV)</span>
              </button>

              <button
                onClick={() => setIsCollegeModalOpen(false)}
                className="px-5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ================= ADD REGISTRATION MODAL ================= */}
      {isAddModalOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 w-screen h-screen z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 overflow-hidden"
          onClick={() => !isSubmittingAdd && setIsAddModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-3xl rounded-3xl border border-slate-100 shadow-2xl overflow-hidden text-left max-h-[92vh] flex flex-col relative z-10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-inner shrink-0">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-850">
                      Add Event Registration
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddStep(1)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                          addStep === 1 ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        1. Select Event
                      </button>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => selectedAddEventId && setAddStep(2)}
                        disabled={!selectedAddEventId}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                          addStep === 2 
                            ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" 
                            : selectedAddEventId 
                            ? "bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer" 
                            : "bg-slate-50 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        2. Registration Details
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {addStep === 1 
                      ? "Select the event you want to register participants or teams into."
                      : "Fill in team/participant details, college affiliation, and membership roster."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingAdd && setIsAddModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto">
              
              {/* Error Message */}
              {addFormError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs font-semibold animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">{addFormError}</div>
                </div>
              )}

              {/* ================= STEP 1: SELECT EVENT ================= */}
              {addStep === 1 && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search events by title, category, or track..."
                      value={addEventSearch}
                      onChange={(e) => setAddEventSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium text-xs text-slate-800 bg-slate-50/40 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    {(() => {
                      const filteredEvents = (eventsList || []).filter(ev => {
                        const q = addEventSearch.trim().toLowerCase();
                        if (!q) return true;
                        const title = (ev.title || "").toLowerCase();
                        const cat = (ev.category || "").toLowerCase();
                        const track = (ev.track || "").toLowerCase();
                        return title.includes(q) || cat.includes(q) || track.includes(q);
                      });

                      if (filteredEvents.length === 0) {
                        return (
                          <div className="text-center py-10 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-600">No matching events found</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Try searching with a different keyword</p>
                          </div>
                        );
                      }

                      return filteredEvents.map((ev) => {
                        const evId = ev.id || ev._id;
                        const isSelected = selectedAddEventId === evId;
                        const isIndiv = ev.registrationType === "Individual" || ev.maxTeamSize === 1;

                        return (
                          <div
                            key={evId}
                            onClick={() => handleSelectEventForAdd(evId)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                                : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50"
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-black text-slate-850 truncate">
                                  {ev.title}
                                </h4>
                                {ev.category && (
                                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                    {ev.category}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                                <span>Type: <strong className="text-slate-700 font-bold">{isIndiv ? "Individual (1 Person)" : `Team (${ev.minTeamSize || 1}-${ev.maxTeamSize || 6} Members)`}</strong></span>
                                {ev.date && <span>• Date: <strong className="text-slate-700">{ev.date}</strong></span>}
                                {ev.currentReg !== undefined && (
                                  <span>• Current Regs: <strong className="text-slate-700">{ev.currentReg}</strong></span>
                                )}
                              </p>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {isSelected ? (
                                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                  <Check className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-400 group-hover:border-slate-300">
                                  <ChevronRight className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* ================= STEP 2: REGISTRATION DETAILS ================= */}
              {addStep === 2 && (
                <div className="space-y-5">
                  {/* Selected Event Card Banner */}
                  {(() => {
                    const activeEv = eventsList.find(e => (e.id === selectedAddEventId || e._id === selectedAddEventId));
                    return (
                      <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Selected Event</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-850">{activeEv?.title || "Event Selected"}</span>
                            {activeEv?.category && (
                              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {activeEv.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAddStep(1)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer shrink-0"
                        >
                          Change Event
                        </button>
                      </div>
                    );
                  })()}

                  {/* Registration Type Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                      Registration Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAddForm(prev => ({ ...prev, registrationType: "Group" }))}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                          addForm.registrationType === "Group"
                            ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          addForm.registrationType === "Group" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                          <UsersIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-850 block">Team / Group</span>
                          <span className="text-[10px] text-slate-500">Lead + multiple members</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddForm(prev => ({ ...prev, registrationType: "Individual" }))}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                          addForm.registrationType === "Individual"
                            ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          addForm.registrationType === "Individual" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-850 block">Individual RSVP</span>
                          <span className="text-[10px] text-slate-500">Single participant</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Team Name (if Group) */}
                  {addForm.registrationType === "Group" && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <span>Team / Group Name</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CodeForge, AI Gladiators, ByteSquad"
                        value={addForm.teamName}
                        onChange={(e) => setAddForm(prev => ({ ...prev, teamName: e.target.value }))}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                      />
                    </div>
                  )}

                  {/* Lead / Participant Primary Details */}
                  <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span>{addForm.registrationType === "Group" ? "Team Lead Details" : "Participant Details"}</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">Primary Contact</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Full Name */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Rama Raju K"
                          value={addForm.fullName}
                          onChange={(e) => setAddForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="e.g. ramaraju@gmail.com"
                          value={addForm.email}
                          onChange={(e) => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                        />
                      </div>

                      {/* Phone */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          Contact / Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. 9876543210"
                          value={addForm.phone}
                          onChange={(e) => setAddForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                        />
                      </div>

                      {/* Roll / Student ID */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          Roll No / Student ID <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 22PA1A4541"
                          value={addForm.studentId}
                          onChange={(e) => setAddForm(prev => ({ ...prev, studentId: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white uppercase"
                        />
                      </div>

                      {/* College Selection */}
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          College / University <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={addForm.collegeName}
                          onChange={(e) => {
                            const val = e.target.value;
                            let place = addForm.collegePlace;
                            if (val.includes("Vishnu") || val.includes("SVECW")) place = "Bhimavaram";
                            else if (val.includes("BVRIT Hyderabad")) place = "Hyderabad";
                            else if (val.includes("B V Raju") || val.includes("BVRIT")) place = "Narsapur";
                            else if (val.includes("SRKR")) place = "Bhimavaram";
                            else if (val.includes("Sasi")) place = "Tadepalligudem";
                            else if (val.includes("Swarnandhra")) place = "Narsapur";
                            else if (val.includes("Aditya")) place = "Surampalem";
                            else if (val.includes("JNTU")) place = "Kakinada";
                            setAddForm(prev => ({ ...prev, collegeName: val, collegePlace: place }));
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-850 focus:outline-none focus:border-emerald-500 bg-white"
                        >
                          <option value="Vishnu Institute of Technology">Vishnu Institute of Technology (VITB), Bhimavaram</option>
                          <option value="Shri Vishnu Engineering College for Women">Shri Vishnu Engineering College for Women (SVECW), Bhimavaram</option>
                          <option value="B V Raju Institute of Technology">B V Raju Institute of Technology (BVRIT), Narsapur</option>
                          <option value="BVRIT Hyderabad College of Engineering for Women">BVRIT Hyderabad College of Engineering for Women, Hyderabad</option>
                          <option value="SRKR Engineering College">SRKR Engineering College, Bhimavaram</option>
                          <option value="Sasi Institute of Technology and Engineering">Sasi Institute of Technology and Engineering, Tadepalligudem</option>
                          <option value="Swarnandhra College of Engineering and Technology">Swarnandhra College of Engineering and Technology, Narsapur</option>
                          <option value="Aditya Engineering College">Aditya Engineering College, Surampalem</option>
                          <option value="Raghu Engineering College">Raghu Engineering College, Visakhapatnam</option>
                          <option value="Gayatri Vidya Parishad College of Engineering">Gayatri Vidya Parishad College of Engineering (GVP), Visakhapatnam</option>
                          <option value="Jawaharlal Nehru Technological University">JNTU Kakinada / Hyderabad</option>
                          <option value="Other">Other Institution (Type manually below)</option>
                        </select>
                      </div>

                      {/* Custom College Name (if Other) */}
                      {addForm.collegeName === "Other" && (
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">
                            Enter Institution Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Indian Institute of Technology, Madras"
                            value={addForm.customCollegeName}
                            onChange={(e) => setAddForm(prev => ({ ...prev, customCollegeName: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                          />
                        </div>
                      )}

                      {/* College City/Place */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          College City / Location
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bhimavaram"
                          value={addForm.collegePlace}
                          onChange={(e) => setAddForm(prev => ({ ...prev, collegePlace: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                        />
                      </div>

                      {/* Branch / Department */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          Branch / Department
                        </label>
                        <select
                          value={addForm.branch}
                          onChange={(e) => setAddForm(prev => ({ ...prev, branch: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-850 focus:outline-none focus:border-emerald-500 bg-white"
                        >
                          <option value="CSE">Computer Science & Engineering (CSE)</option>
                          <option value="IT">Information Technology (IT)</option>
                          <option value="AI & DS">Artificial Intelligence & Data Science (AI & DS)</option>
                          <option value="AI & ML">Artificial Intelligence & Machine Learning (AI & ML)</option>
                          <option value="CSBS">Computer Science & Business Systems (CSBS)</option>
                          <option value="Cyber Security">Cyber Security</option>
                          <option value="ECE">Electronics & Communication Engineering (ECE)</option>
                          <option value="EEE">Electrical & Electronics Engineering (EEE)</option>
                          <option value="Mechanical">Mechanical Engineering</option>
                          <option value="Civil">Civil Engineering</option>
                          <option value="Other">Other Specialization</option>
                        </select>
                      </div>

                      {addForm.branch === "Other" && (
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">
                            Enter Department / Specialization
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Data Analytics / Biotech"
                            value={addForm.customBranch}
                            onChange={(e) => setAddForm(prev => ({ ...prev, customBranch: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                          />
                        </div>
                      )}

                      {/* Year of Study */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          Year of Study
                        </label>
                        <select
                          value={addForm.year}
                          onChange={(e) => setAddForm(prev => ({ ...prev, year: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-850 focus:outline-none focus:border-emerald-500 bg-white"
                        >
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                        </select>
                      </div>

                      {/* Section */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          Section (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. A, B, C"
                          value={addForm.section}
                          onChange={(e) => setAddForm(prev => ({ ...prev, section: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Team Members Section (if Group) */}
                  {addForm.registrationType === "Group" && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <UsersIcon className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Additional Team Members ({addForm.members.length})</span>
                          </h4>
                          <span className="text-[10px] text-slate-500">
                            Total team size: 1 Lead + {addForm.members.length} Member{addForm.members.length === 1 ? "" : "s"} = {addForm.members.length + 1}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddMember}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Member
                        </button>
                      </div>

                      {addForm.members.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-medium">
                          No additional members added yet. Click "+ Add Member" to add team roster participants.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {addForm.members.map((m, idx) => (
                            <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                                <span className="text-[11px] font-extrabold text-slate-700">
                                  Member #{idx + 2}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Remove Member"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                <input
                                  type="text"
                                  placeholder="Full Name *"
                                  value={m.name}
                                  onChange={(e) => handleMemberChange(idx, "name", e.target.value)}
                                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white"
                                />
                                <input
                                  type="email"
                                  placeholder="Email Address *"
                                  value={m.email}
                                  onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white"
                                />
                                <input
                                  type="tel"
                                  placeholder="Phone Number"
                                  value={m.phone}
                                  onChange={(e) => handleMemberChange(idx, "phone", e.target.value)}
                                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white"
                                />
                                <input
                                  type="text"
                                  placeholder="Roll No / Student ID"
                                  value={m.studentId}
                                  onChange={(e) => handleMemberChange(idx, "studentId", e.target.value)}
                                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white uppercase"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Administrative & Status Options */}
                  <div className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-3">
                    <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-600" />
                      <span>Status & Preferences</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Registration Status */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Status</label>
                        <select
                          value={addForm.status}
                          onChange={(e) => setAddForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-850 bg-white"
                        >
                          <option value="Confirmed">Confirmed (Approved)</option>
                          <option value="Not Confirmed">Not Confirmed (Pending)</option>
                          <option value="Waitlisted">Waitlisted</option>
                        </select>
                      </div>

                      {/* Payment Status */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Payment</label>
                        <select
                          value={addForm.paymentStatus}
                          onChange={(e) => setAddForm(prev => ({ ...prev, paymentStatus: e.target.value as any }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-850 bg-white"
                        >
                          <option value="Free">Free</option>
                          <option value="Paid">Paid / Confirmed</option>
                        </select>
                      </div>

                      {/* Food Preference */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Food Preference</label>
                        <select
                          value={addForm.foodPreference}
                          onChange={(e) => setAddForm(prev => ({ ...prev, foodPreference: e.target.value as any }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-850 bg-white"
                        >
                          <option value="Veg">Vegetarian</option>
                          <option value="Non-Veg">Non-Vegetarian</option>
                          <option value="None">Not Applicable</option>
                        </select>
                      </div>
                    </div>

                    {addForm.paymentStatus === "Paid" && (
                      <div className="space-y-1 pt-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Transaction ID / UTR Number</label>
                        <input
                          type="text"
                          placeholder="e.g. UPI1234567890"
                          value={addForm.transactionId}
                          onChange={(e) => setAddForm(prev => ({ ...prev, transactionId: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                    )}

                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addForm.sendConfirmationEmail}
                        onChange={(e) => setAddForm(prev => ({ ...prev, sendConfirmationEmail: e.target.checked }))}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        Send official confirmation email with event ticket & pass to participant
                      </span>
                    </label>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
              {addStep === 2 ? (
                <button
                  type="button"
                  onClick={() => setAddStep(1)}
                  disabled={isSubmittingAdd}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Events</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => !isSubmittingAdd && setIsAddModalOpen(false)}
                  disabled={isSubmittingAdd}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  Cancel
                </button>

                {addStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedAddEventId) {
                        setAddFormError("Please select an event to proceed.");
                        return;
                      }
                      setAddFormError(null);
                      setAddStep(2);
                    }}
                    disabled={!selectedAddEventId}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Next: Enter Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCreateRegistration()}
                    disabled={isSubmittingAdd}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAdd ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit Registration</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default RegistrationsManagementPage;
