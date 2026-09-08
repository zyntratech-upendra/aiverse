import React, { useState, useMemo } from "react";
import SEO from "../../components/layout/SEO";
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Trash2, 
  Check, 
  UserX, 
  UserCheck, 
  X, 
  Filter,
  Shield,
  Clock,
  Archive,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  User,
  Zap,
  ClipboardList,
  AlertCircle,
  Upload,
  Download,
  FileUp,
  ClipboardPaste,
  Edit2,
  Eye,
  Users,
  ChevronDown,
  ShieldCheck,
  Camera
} from "lucide-react";
import Papa from "papaparse";
import { db, app } from "../../config/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, addDoc, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { fetchUsers as apiFetchUsers, createUser as apiCreateUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser } from "../../services/apiClient";
import Button from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import TeamGraphModal from "../../components/dashboard/TeamGraphModal";
import { sendResendEmail } from "../../utils/resendEmailService";
import { buildWelcomeMemberEmail } from "../../utils/emailTemplates";
import { compressImageBase64 } from "../../utils/imageCompressor";

export interface UserItem {
  id: string;
  name: string;
  email: string;
  personal_email?: string;
  personalEmail?: string;
  phone?: string;
  role: "Faculty Coordinator" | "Student Organizer" | "Volunteer" | "Guest" | "Student Member" | "Organizer" | "Convener" | "Event Manager" | "System Admin" | "Jury Evaluator" | string;
  position?: string;
  status: "Active" | "Pending" | "Deactivated" | string;
  image?: string;
  showInAbout?: "Yes" | "No";
  bio?: string;
  linkedin?: string;
  github?: string;
}

const SYSTEM_STAFF_EMAILS = [
  "admin@aiverse.in",
  "facultycoordinator@aiverse.in",
  "studentorganizer@aiverse.in",
  "jurry@aiverse.in",
  "jury@aiverse.in"
];

export const formatRoleLabel = (role: string): string => {
  if (!role) return "Select Role";
  const rLower = role.toLowerCase().trim();
  if (rLower === "conviner") return "Convener";
  if (rLower === "media handing") return "Media Handling";
  if (rLower === "pr and marketing") return "PR & Marketing";
  if (rLower === "video and photography") return "Video & Photography";
  if (rLower === "student organizer") return "Student Organizer";
  if (rLower === "student co-organizer") return "Student Co-Organizer";
  if (rLower === "faculty coordinator") return "Faculty Coordinator";
  if (rLower === "mobile app developer") return "Mobile App Developer";
  if (rLower === "web app developer") return "Web App Developer";
  if (rLower === "event manager") return "Event Manager";
  if (rLower === "volunteer") return "Volunteer";
  if (rLower === "student member") return "Student Member";
  if (rLower === "jury evaluator") return "Jury Evaluator";
  if (rLower === "system admin") return "System Admin";

  return role
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

export const isAiVerseMember = (u: UserItem) => {
  const email = (u.email || "").toLowerCase().trim();
  const role = (u.role || "").toLowerCase().trim();

  // Exclude system administrative / staff accounts
  if (SYSTEM_STAFF_EMAILS.includes(email)) return false;
  if (
    role.includes("admin") ||
    role.includes("faculty") ||
    role.includes("coordinator") ||
    role.includes("organizer") ||
    role.includes("jury") ||
    role.includes("evaluator")
  ) {
    return false;
  }

  return role.includes("member") || role.includes("volunteer") || role.includes("student") || role === "user" || role === "aiverse member";
};

// Helper to resolve legacy/db roles to settings configuration roles
const getDisplayRole = (dbRole: string, rolesList: string[]) => {
  if (!dbRole) return "Guest";
  const dbRoleLower = dbRole.toLowerCase();
  if (dbRoleLower === "faculty") {
    return rolesList.find(r => r.toLowerCase().includes("faculty")) || "Faculty Coordinator";
  }
  if (dbRoleLower === "organizer") {
    return rolesList.find(r => r.toLowerCase().includes("organizer")) || "student Organizer";
  }
  if (dbRoleLower === "member") {
    return rolesList.find(r => r.toLowerCase().includes("member") || r.toLowerCase().includes("volunteer")) || "Volunteer";
  }
  if (dbRoleLower === "guest") {
    return rolesList.find(r => r.toLowerCase().includes("guest")) || "Guest";
  }
  const match = rolesList.find(r => r.toLowerCase() === dbRoleLower);
  if (match) return match;
  return dbRole;
};

const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  // Initial list of users for pagination/filtering
  const [users, setUsers] = useState<UserItem[]>([]);

  // Fetch users from database
  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const combinedList: UserItem[] = [];
        const seenEmails = new Set<string>();

        // 1. Fetch from backend users collection
        try {
          const backendUsers = await apiFetchUsers();
          if (backendUsers && backendUsers.length > 0) {
            backendUsers.forEach((u: any) => {
              const name = (u.name || u.display_name || "").trim();
              const email = (u.email || "").toLowerCase().trim();
              if (!name && !email) return;
              if (name.toLowerCase() === "unnamed user" && !email) return;

              if (email) seenEmails.add(email);
              combinedList.push({
                id: u.id || u._id || u._doc || "",
                name: name || "User",
                email: u.email || "",
                personal_email: u.personal_email || "",
                personalEmail: u.personal_email || "",
                phone: u.phone || "",
                role: (u.role || "Guest") as any,
                position: u.position || "",
                status: (u.status || "Active") as any,
                image: u.image || "",
                showInAbout: u.show_in_about ? "Yes" : "No",
                bio: u.bio || "",
                linkedin: u.linkedin || "",
                github: u.github || ""
              });
            });
          }
        } catch (backendErr) {
          console.warn("[UserManagement] Notice fetching users from backend:", backendErr);
        }

        try {
          const usersSnap = await getDocs(collection(db, "users"));
          usersSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const email = (data.email || "").toLowerCase().trim();
            const rawName = (data.name || data.displayName || data.teamLeadName || "").trim();
            
            // Ignore ghost or revoked entries that have neither name nor email
            if (!rawName && !email) return;
            if (rawName.toLowerCase() === "unnamed user" && !email) return;

            if (email && seenEmails.has(email)) {
              // Update existing entry with any extra fields from Firestore
              const idx = combinedList.findIndex(item => (item.email || "").toLowerCase().trim() === email);
              if (idx >= 0) {
                combinedList[idx] = {
                  ...combinedList[idx],
                  personal_email: combinedList[idx].personal_email || data.personal_email || data.personalEmail || "",
                  personalEmail: combinedList[idx].personalEmail || data.personalEmail || data.personal_email || "",
                  image: combinedList[idx].image || data.image || "",
                  bio: combinedList[idx].bio || data.bio || "",
                  linkedin: combinedList[idx].linkedin || data.linkedin || "",
                  github: combinedList[idx].github || data.github || "",
                  phone: combinedList[idx].phone || data.phone || data.phoneNumber || "",
                  role: combinedList[idx].role || data.role || data.roleType || "Guest",
                  position: combinedList[idx].position || data.position || data.sub_role || data.subRole || "",
                  showInAbout: combinedList[idx].showInAbout || (data.showInAbout === true || data.showInAbout === "Yes" || data.showInAboutPage === true || data.showInAboutPage === "Yes" ? "Yes" : "No")
                };
              }
            } else {
              if (email) seenEmails.add(email);
              combinedList.push({
                id: docSnap.id,
                name: rawName || "User",
                email: data.email || "",
                personal_email: data.personal_email || data.personalEmail || "",
                personalEmail: data.personalEmail || data.personal_email || "",
                phone: data.phone || data.phoneNumber || "",
                role: data.role || data.roleType || "Guest",
                position: data.position || data.sub_role || data.subRole || "",
                status: data.status || "Active",
                image: data.image || "",
                showInAbout: data.showInAbout === true || data.showInAbout === "Yes" || data.showInAboutPage === true || data.showInAboutPage === "Yes" ? "Yes" : "No",
                bio: data.bio || "",
                linkedin: data.linkedin || "",
                github: data.github || ""
              });
            }
          });
        } catch (fsErr) {
          console.warn("[UserManagement] Notice fetching users from Firestore:", fsErr);
        }

        // 3. Fetch and merge from Firestore 'organizers'
        try {
          const organizersSnap = await getDocs(collection(db, "organizers"));
          organizersSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const email = (data.email || "").toLowerCase().trim();
            const rawName = (data.name || data.displayName || "").trim();

            if (!rawName && !email) return;
            if (rawName.toLowerCase() === "unnamed user" && !email) return;

            if (email && seenEmails.has(email)) {
              const idx = combinedList.findIndex(item => (item.email || "").toLowerCase().trim() === email);
              if (idx >= 0) {
                combinedList[idx] = {
                  ...combinedList[idx],
                  personal_email: combinedList[idx].personal_email || data.personal_email || data.personalEmail || "",
                  personalEmail: combinedList[idx].personalEmail || data.personal_email || data.personalEmail || "",
                  image: combinedList[idx].image || data.image || "",
                  bio: combinedList[idx].bio || data.bio || "",
                  linkedin: combinedList[idx].linkedin || data.linkedin || "",
                  github: combinedList[idx].github || data.github || "",
                  phone: combinedList[idx].phone || data.phone || data.phoneNumber || "",
                };
              }
            } else {
              if (email) seenEmails.add(email);
              combinedList.push({
                id: docSnap.id,
                name: rawName || "Organizer",
                email: data.email || "",
                personal_email: data.personal_email || data.personalEmail || "",
                personalEmail: data.personalEmail || data.personal_email || "",
                phone: data.phone || data.phoneNumber || "",
                role: data.role || data.roleType || "Organizer",
                status: data.status || "Active",
                image: data.image || "",
                showInAbout: data.showInAbout === true || data.showInAbout === "Yes" ? "Yes" : "No",
                bio: data.bio || "",
                linkedin: data.linkedin || "",
                github: data.github || ""
              });
            }
          });
        } catch (orgErr) {
          console.warn("[UserManagement] Notice fetching organizers from Firestore:", orgErr);
        }

        // Filter out system administrative accounts and participant accounts from Club User Management
        const validUsers = combinedList.filter((u) => {
          const email = (u.email || "").toLowerCase().trim();
          const role = String(u.role || "").toLowerCase().trim();
          const name = (u.name || "").toLowerCase().trim();

          if (SYSTEM_STAFF_EMAILS.includes(email) || email === "participant@aiverse.in") return false;
          if (role === "participant" || role.includes("participant") || email.includes("participant") || email.startsWith("team")) return false;
          if (name === "participant user" || name === "system admin" || name === "jury evaluator") return false;

          return true;
        });

        setUsers(validUsers);
      } catch (err) {
        console.error("Error fetching users from database:", err);
      }
    };
    loadUsers();
  }, []);

  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Invite Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePersonalEmail, setInvitePersonalEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserItem["role"]>("Student Member");
  const [invitePosition, setInvitePosition] = useState<string>("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Dropdown actions states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showRoleSubMenu, setShowRoleSubMenu] = useState(false);
  const [roleConfirmState, setRoleConfirmState] = useState<{ isOpen: boolean, userId: string, newRole: string }>({ isOpen: false, userId: "", newRole: "" });
  const [showGraphModal, setShowGraphModal] = useState(false);

  // Add Team Member Form States
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPersonalEmail, setFormPersonalEmail] = useState("");
  const [formRoleType, setFormRoleType] = useState<string>("Organizer");
  const [formPosition, setFormPosition] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");
  const [formGithub, setFormGithub] = useState("");
  const [formPhotoPreview, setFormPhotoPreview] = useState("");
  const [formShowInAbout, setFormShowInAbout] = useState<string>("No");
  const [, setFormPassword] = useState("");
  const [, setFormConfirmPassword] = useState("");
  const [addingToTeam, setAddingToTeam] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showDownloadRoleModal, setShowDownloadRoleModal] = useState(false);
  const [selectedDownloadRole, setSelectedDownloadRole] = useState("All");

  const initialGridRow = {
    "Profile Photo": "",
    "Full Name": "",
    "College Mail": "",
    "Personal Mail ID": "",
    "Phone Number": "",
    "Role Type": "",
    "Sub Role": "",
    "Professional Bio": "",
    "LinkedIn URL": "",
    "GitHub URL": ""
  };
  const gridColumns = Object.keys(initialGridRow);

  const [showPasteModal, setShowPasteModal] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("aether_bulk_paste_modal") === "true";
    } catch {
      return false;
    }
  });
  const [gridData, setGridData] = useState<Array<Record<string, string>>>(() => {
    try {
      const saved = sessionStorage.getItem("aether_bulk_paste_grid");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return Array(5).fill({ ...initialGridRow });
  });

  // Sync modal and grid state to sessionStorage to prevent loss on window blur / Alt+Tab
  React.useEffect(() => {
    try {
      if (showPasteModal) {
        sessionStorage.setItem("aether_bulk_paste_modal", "true");
        sessionStorage.setItem("aether_bulk_paste_grid", JSON.stringify(gridData));
      } else {
        sessionStorage.removeItem("aether_bulk_paste_modal");
      }
    } catch {}
  }, [showPasteModal, gridData]);

  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, current: 0, success: 0, failed: 0 });
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [availableRoles, setAvailableRoles] = useState<string[]>([
    "Faculty Coordinator",
    "Student Lead",
    "Organizer",
    "Volunteer"
  ]);

  const handleDownloadTemplate = (roleArg?: string) => {
    let roleOptions = availableRoles.join(" | ");
    let roleHeader = `"Role Type (Options: ${roleOptions})"`;
    if (roleArg && roleArg !== "All") {
      roleHeader = `"Role Type (Fixed: ${roleArg})"`;
    }
    const headers = [
      "Full Name", 
      "College Mail", 
      "Personal Mail ID",
      "Phone Number",
      roleHeader, 
      "\"Sub Role (Lead | Co-Lead | Associate)\"",
      "Professional Bio", 
      "LinkedIn URL", 
      "GitHub URL"
    ];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "add_members_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowBulkMenu(false);
  };

  const processBulkAdd = async (data: any[]) => {
    setIsBulkProcessing(true);
    setBulkProgress({ total: data.length, current: 0, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;
    let emailSentCount = 0;
    let lastEmailError = "";

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      setBulkProgress(prev => ({ ...prev, current: i + 1 }));

      const name = row["Full Name"] || row["name"] || "";
      const email = row["College Mail"] || row["Email Address"] || row["email"] || "";
      const personalEmail = row["Personal Mail ID"] || row["Personal Email"] || row["personal_email"] || row["personalEmail"] || row["personalMailId"] || "";
      const phone = row["Phone Number"] || row["phone"] || "";
      const roleOptions = availableRoles.join(" | ");
      const roleType = row[`Role Type (Options: ${roleOptions})`] || row["Role Type"] || row["role"] || "";
      const position = row["Sub Role (Lead | Co-Lead | Associate)"] || row["Sub Role"] || row["sub_role"] || row["subRole"] || row["Position"] || row["position"] || "";
      const bio = row["Professional Bio"] || row["bio"] || "";
      const linkedin = row["LinkedIn URL"] || row["linkedin"] || "";
      const github = row["GitHub URL"] || row["github"] || "";

      const image = row["Profile Photo"] || row["image"] || row["photo"] || "";

      if (!name.trim() || !email.trim() || !email.includes("@") || !personalEmail.trim() || !personalEmail.includes("@") || !roleType.trim() || roleType === "Select Role") {
        failedCount++;
        continue;
      }

      let cleanedRole = roleType.trim();
      const roleKeys = Object.keys(row);
      const fixedRoleKey = roleKeys.find(k => k.startsWith("Role Type (Fixed: "));
      if (fixedRoleKey) {
        cleanedRole = fixedRoleKey.replace("Role Type (Fixed: ", "").replace(")", "").trim();
      }

      try {
        let createdId = "";
        const compressedImage = image ? await compressImageBase64(image, 500, 500, 0.75) : "";

        try {
          const supabaseRecord = await userService.addUser({
            name,
            display_name: name,
            email,
            personal_email: personalEmail,
            phone,
            role: cleanedRole,
            position,
            bio,
            linkedin,
            github,
            image: compressedImage,
            status: "Active"
          });
          createdId = supabaseRecord.id;
        } catch (supaErr) {
          console.warn("Supabase bulk insert fallback to Firestore:", supaErr);
        }

        const payload = {
          name,
          displayName: name,
          email,
          personalEmail: personalEmail,
          personal_email: personalEmail,
          phone,
          phoneNumber: phone,
          role: cleanedRole,
          roleType: cleanedRole,
          position,
          bio,
          linkedin,
          github,
          image: compressedImage,
          status: "Active",
          createdAt: Date.now()
        };

        if (!createdId) {
          const docRef = await addDoc(collection(db, "users"), payload);
          createdId = docRef.id;
        } else {
          // Keep Firestore in sync
          setDoc(doc(db, "users", createdId), payload, { merge: true }).catch(() => {});
        }

        const newUser: UserItem = {
          id: createdId,
          name: name,
          email: email,
          personal_email: personalEmail,
          personalEmail: personalEmail,
          phone: phone,
          role: cleanedRole,
          status: "Active",
          image: compressedImage
        };
        setUsers(prev => [newUser, ...prev]);
        successCount++;

        // Send Welcome Email to the user's personal mail ID
        const targetWelcomeMail = (personalEmail && personalEmail.includes("@")) ? personalEmail.trim() : email.trim();
        if (targetWelcomeMail && targetWelcomeMail.includes("@")) {
          const welcomeMailData = buildWelcomeMemberEmail({
            name,
            role: cleanedRole,
            collegeEmail: email,
            personalEmail: personalEmail,
            portalUrl: `${window.location.origin}/login`
          });
          const mailRes = await sendResendEmail({
            to: targetWelcomeMail,
            subject: welcomeMailData.subject,
            html: welcomeMailData.html,
            text: welcomeMailData.text
          });
          if (!mailRes.success) {
            console.warn(`[Welcome Email Notice for ${name} (${targetWelcomeMail})]:`, mailRes.error);
            lastEmailError = mailRes.error || "Email failed";
          } else {
            console.log(`[Welcome Email Sent] to ${targetWelcomeMail} for ${name}`);
            emailSentCount++;
          }
        }
      } catch (err) {
        console.error("Failed to add row", i, err);
        failedCount++;
      }
    }

    setBulkProgress(prev => ({ ...prev, success: successCount, failed: failedCount }));
    setTimeout(() => {
      setIsBulkProcessing(false);
      let alertMsg = `Bulk Add Complete!\nSuccess: ${successCount}\nFailed: ${failedCount}`;
      if (emailSentCount > 0) {
        alertMsg += `\nWelcome Emails Sent: ${emailSentCount}`;
      }
      if (lastEmailError) {
        alertMsg += `\n\n(Email Delivery Notice: ${lastEmailError})`;
      }
      alert(alertMsg);
    }, 500);
  };

  const handleGridPaste = (e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    // Only intercept if the pasted data appears to be multi-cell grid data (tabs or multiple lines).
    // This allows single-cell pastes to behave normally within individual input fields.
    const trimmed = pasteData.trim();
    const isGridData = pasteData.includes('\t') || trimmed.includes('\n');
    
    if (!isGridData) {
      return; // Let native paste handle it
    }

    e.preventDefault();
    Papa.parse(pasteData, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const newGrid = [...gridData];
          let startIndex = 0;
          const firstRow = results.data[0] as string[];
          if (firstRow[0]?.toLowerCase().includes("name") || firstRow[1]?.toLowerCase().includes("email") || firstRow[0]?.toLowerCase().includes("photo")) {
            startIndex = 1;
          }
          
          let gridIndex = 0;
          for (let i = startIndex; i < results.data.length; i++) {
            const row = results.data[i] as string[];
            if (!newGrid[gridIndex]) newGrid[gridIndex] = { ...initialGridRow };
            
            // Handle paste depending on number of columns
            if (row.length >= 10) {
              // Photo, Name, College Mail, Personal Mail ID, Phone, Role, Sub Role, Bio, LinkedIn, GitHub
              newGrid[gridIndex] = {
                "Profile Photo": row[0] || "",
                "Full Name": row[1] || "",
                "College Mail": row[2] || "",
                "Personal Mail ID": row[3] || "",
                "Phone Number": row[4] || "",
                "Role Type": row[5] || "",
                "Sub Role": row[6] || "",
                "Professional Bio": row[7] || "",
                "LinkedIn URL": row[8] || "",
                "GitHub URL": row[9] || ""
              };
            } else if (row.length === 9) {
              // Name, College Mail, Personal Mail ID, Phone, Role, Sub Role, Bio, LinkedIn, GitHub
              newGrid[gridIndex] = {
                "Profile Photo": "",
                "Full Name": row[0] || "",
                "College Mail": row[1] || "",
                "Personal Mail ID": row[2] || "",
                "Phone Number": row[3] || "",
                "Role Type": row[4] || "",
                "Sub Role": row[5] || "",
                "Professional Bio": row[6] || "",
                "LinkedIn URL": row[7] || "",
                "GitHub URL": row[8] || ""
              };
            } else if (row.length === 8) {
              // Name, College Mail, Personal Mail ID, Phone, Role, Bio, LinkedIn, GitHub
              newGrid[gridIndex] = {
                "Profile Photo": "",
                "Full Name": row[0] || "",
                "College Mail": row[1] || "",
                "Personal Mail ID": row[2] || "",
                "Phone Number": row[3] || "",
                "Role Type": row[4] || "",
                "Sub Role": "",
                "Professional Bio": row[5] || "",
                "LinkedIn URL": row[6] || "",
                "GitHub URL": row[7] || ""
              };
            } else if (row.length === 7) {
              // Legacy CSV: Name, College Mail, Phone, Role, Bio, LinkedIn, GitHub
              newGrid[gridIndex] = {
                "Profile Photo": "",
                "Full Name": row[0] || "",
                "College Mail": row[1] || "",
                "Personal Mail ID": "",
                "Phone Number": row[2] || "",
                "Role Type": row[3] || "",
                "Sub Role": "",
                "Professional Bio": row[4] || "",
                "LinkedIn URL": row[5] || "",
                "GitHub URL": row[6] || ""
              };
            } else {
              newGrid[gridIndex] = {
                "Profile Photo": "",
                "Full Name": row[0] || "",
                "College Mail": row[1] || "",
                "Personal Mail ID": row[2] || "",
                "Phone Number": row[3] || "",
                "Role Type": row[4] || "",
                "Sub Role": "",
                "Professional Bio": row[5] || "",
                "LinkedIn URL": row[6] || "",
                "GitHub URL": row[7] || ""
              };
            }
            gridIndex++;
          }
          while (newGrid.length < Math.max(5, gridIndex)) newGrid.push({ ...initialGridRow });
          setGridData(newGrid);
        }
      }
    });
  };

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const newGrid: Array<Record<string, string>> = [];
          let startIndex = 0;
          const firstRow = results.data[0] as string[];
          if (firstRow[0]?.toLowerCase().includes("name") || firstRow[1]?.toLowerCase().includes("email") || firstRow[1]?.toLowerCase().includes("mail") || firstRow[0]?.toLowerCase().includes("photo")) {
            startIndex = 1;
          }

          for (let i = startIndex; i < results.data.length; i++) {
            const row = results.data[i] as string[];
            if (row.length >= 10) {
              newGrid.push({
                "Profile Photo": row[0] || "",
                "Full Name": row[1] || "",
                "College Mail": row[2] || "",
                "Personal Mail ID": row[3] || "",
                "Phone Number": row[4] || "",
                "Role Type": row[5] || "",
                "Sub Role": row[6] || "",
                "Professional Bio": row[7] || "",
                "LinkedIn URL": row[8] || "",
                "GitHub URL": row[9] || ""
              });
            } else if (row.length === 9) {
              newGrid.push({
                "Profile Photo": "",
                "Full Name": row[0] || "",
                "College Mail": row[1] || "",
                "Personal Mail ID": row[2] || "",
                "Phone Number": row[3] || "",
                "Role Type": row[4] || "",
                "Sub Role": row[5] || "",
                "Professional Bio": row[6] || "",
                "LinkedIn URL": row[7] || "",
                "GitHub URL": row[8] || ""
              });
            } else if (row.length === 8) {
              newGrid.push({
                "Profile Photo": "",
                "Full Name": row[0] || "",
                "College Mail": row[1] || "",
                "Personal Mail ID": row[2] || "",
                "Phone Number": row[3] || "",
                "Role Type": row[4] || "",
                "Sub Role": "",
                "Professional Bio": row[5] || "",
                "LinkedIn URL": row[6] || "",
                "GitHub URL": row[7] || ""
              });
            } else if (row.length === 7) {
              newGrid.push({
                "Profile Photo": "",
                "Full Name": row[0] || "",
                "College Mail": row[1] || "",
                "Personal Mail ID": "",
                "Phone Number": row[2] || "",
                "Role Type": row[3] || "",
                "Sub Role": "",
                "Professional Bio": row[4] || "",
                "LinkedIn URL": row[5] || "",
                "GitHub URL": row[6] || ""
              });
            }
          }
          while (newGrid.length < 5) newGrid.push({ ...initialGridRow });
          setGridData(newGrid);
          setShowPasteModal(true);
        }
      }
    });
    e.target.value = "";
  };

  const handleRowImageUpload = (rowIndex: number, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const raw = reader.result as string;
      const compressed = await compressImageBase64(raw, 500, 500, 0.75);
      handleGridChange(rowIndex, "Profile Photo", compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleGridChange = (rowIndex: number, col: string, value: string) => {
    const newGrid = [...gridData];
    newGrid[rowIndex] = { ...newGrid[rowIndex], [col]: value };
    setGridData(newGrid);
  };

  const handlePasteSubmit = () => {
    const dataToProcess = gridData.filter(row => row["Full Name"].trim() || row["College Mail"]?.trim() || row["Email Address"]?.trim());
    if (dataToProcess.length === 0) return;
    processBulkAdd(dataToProcess);
    setShowPasteModal(false);
    setGridData(Array(5).fill({...initialGridRow}));
    try {
      sessionStorage.removeItem("aether_bulk_paste_modal");
      sessionStorage.removeItem("aether_bulk_paste_grid");
    } catch {}
  };

  React.useEffect(() => {
    const fetchRoles = async () => {
      try {
        const docRef = doc(db, "settings", "portal_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.availableRoles && Array.isArray(data.availableRoles)) {
            setAvailableRoles(data.availableRoles);
            if (data.availableRoles.length > 0) {
              setFormRoleType(data.availableRoles[0]);
            }
          }
        }
      } catch (err) {
        console.error("Error loading available roles:", err);
      }
    };
    fetchRoles();
  }, [showAddMemberForm]);

  // Stats derived from all current users
  const totalCount = users.length;
  const pendingCount = users.filter(u => u.status === "Pending").length;
  const activeMembersCount = users.filter(u => u.status === "Active" || !u.status).length;
  const deactivatedCount = users.filter(u => u.status === "Deactivated").length;

  // Filters logic
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const displayRole = getDisplayRole(user.role, availableRoles);
      const matchesRole = roleFilter === "All" 
        ? true 
        : roleFilter === "Show in About Page"
        ? user.showInAbout === "Yes"
        : roleFilter === "AI Verse Members"
        ? isAiVerseMember(user)
        : displayRole === roleFilter;
      const matchesStatus = statusFilter === "All" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter, availableRoles]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));

  // Reset pagination if filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // Actions handlers
  const handleToggleShowInAbout = async (userId: string, value: string) => {
    const isShow = value === "Yes";
    try {
      // 1. Update in Supabase
      try {
        await userService.updateUser(userId, { show_in_about: isShow });
      } catch (e) {
        console.warn("Supabase update show_in_about error:", e);
      }

      // 2. Update in Firestore
      try {
        const docRef = doc(db, "users", userId);
        await setDoc(docRef, { showInAbout: isShow, showInAboutPage: isShow }, { merge: true });

        const targetUser = users.find(u => u.id === userId);
        if (targetUser && targetUser.email) {
          const orgSnap = await getDocs(collection(db, "organizers"));
          orgSnap.forEach(async (d) => {
            if ((d.data().email || "").toLowerCase().trim() === targetUser.email.toLowerCase().trim()) {
              await setDoc(doc(db, "organizers", d.id), { showInAbout: isShow, showInAboutPage: isShow }, { merge: true });
            }
          });
        }
      } catch (fsErr) {
        console.warn("Firestore showInAbout sync error:", fsErr);
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, showInAbout: isShow ? "Yes" : "No" } : u));
    } catch (err) {
      console.error("Error updating show in about status:", err);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const raw = reader.result as string;
        const compressed = await compressImageBase64(raw, 500, 500, 0.75);
        setFormPhotoPreview(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTeamMemberSubmit = async () => {
    if (!formName.trim()) {
      alert("Full Name is required!");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      alert("A valid College Mail is required!");
      return;
    }
    if (!formPersonalEmail.trim() || !formPersonalEmail.includes("@")) {
      alert("A valid Personal Mail ID is required!");
      return;
    }

    setAddingToTeam(true);
    try {
      let createdUserId = "";
      const finalPhoto = formPhotoPreview ? await compressImageBase64(formPhotoPreview, 500, 500, 0.75) : "";

      // 1. Add in Supabase
      try {
        const supaUser = await userService.addUser({
          name: formName,
          display_name: formName,
          email: formEmail,
          personal_email: formPersonalEmail,
          role: formRoleType,
          position: formPosition,
          bio: formBio,
          linkedin: formLinkedin,
          github: formGithub,
          image: finalPhoto,
          show_in_about: formShowInAbout === "Yes",
          status: "Active"
        });
        createdUserId = supaUser.id;
      } catch (supaErr) {
        console.warn("Supabase insert notice, attempting Firestore fallback:", supaErr);
      }

      // 2. Mirror to Firestore for cross-compatibility
      const payload = {
        name: formName,
        displayName: formName,
        email: formEmail,
        personalEmail: formPersonalEmail,
        personal_email: formPersonalEmail,
        role: formRoleType,
        roleType: formRoleType,
        position: formPosition,
        bio: formBio,
        linkedin: formLinkedin,
        github: formGithub,
        image: finalPhoto,
        showInAbout: formShowInAbout === "Yes",
        showInAboutPage: formShowInAbout === "Yes",
        status: "Active",
        createdAt: Date.now()
      };

      if (!createdUserId) {
        const userDocRef = await addDoc(collection(db, "users"), payload);
        createdUserId = userDocRef.id;
      } else {
        setDoc(doc(db, "users", createdUserId), payload, { merge: true }).catch(() => {});
      }

      alert("Member successfully added to team!");
      
      const newUser: UserItem = {
        id: createdUserId,
        name: formName,
        email: formEmail,
        personal_email: formPersonalEmail,
        personalEmail: formPersonalEmail,
        role: formRoleType as any,
        position: formPosition,
        image: finalPhoto,
        showInAbout: formShowInAbout === "Yes" ? "Yes" : "No",
        bio: formBio,
        linkedin: formLinkedin,
        github: formGithub,
        status: "Active"
      };
      setUsers(prev => [newUser, ...prev]);

      let emailStatusNotice = "";
      // Send Welcome Email to the user's personal mail ID
      const targetWelcomeMail = (formPersonalEmail && formPersonalEmail.includes("@")) ? formPersonalEmail.trim() : formEmail.trim();
      if (targetWelcomeMail && targetWelcomeMail.includes("@")) {
        const welcomeMailData = buildWelcomeMemberEmail({
          name: formName,
          role: formRoleType,
          collegeEmail: formEmail,
          personalEmail: formPersonalEmail,
          portalUrl: `${window.location.origin}/login`
        });
        const mailRes = await sendResendEmail({
          to: targetWelcomeMail,
          subject: welcomeMailData.subject,
          html: welcomeMailData.html,
          text: welcomeMailData.text
        });
        if (!mailRes.success) {
          console.warn(`[Welcome Email Notice for ${formName} (${targetWelcomeMail})]:`, mailRes.error);
          emailStatusNotice = `\n\n(Email Delivery Note: ${mailRes.error})`;
        } else {
          console.log(`[Welcome Email Sent] to ${targetWelcomeMail} for ${formName}`);
          emailStatusNotice = `\n\n(Welcome email delivered to ${targetWelcomeMail}!)`;
        }
      }

      alert(`Member successfully added to team!${emailStatusNotice}`);

      // Reset state and return to user list view
      setFormName("");
      setFormEmail("");
      setFormPersonalEmail("");
      setFormRoleType("Organizer");
      setFormPosition("");
      setFormBio("");
      setFormLinkedin("");
      setFormGithub("");
      setFormPhotoPreview("");
      setFormShowInAbout("No");
      setFormPassword("");
      setFormConfirmPassword("");
      setShowAddMemberForm(false);
    } catch (err) {
      console.error("Error adding team member:", err);
      alert("Failed to add team member. Please try again.");
    } finally {
      setAddingToTeam(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !invitePersonalEmail.trim()) {
      alert("Please fill in all required fields (Full Name, College Mail, Personal Mail ID).");
      return;
    }

    try {
      let createdId = "";
      try {
        const supaUser = await userService.addUser({
          name: inviteName,
          email: inviteEmail,
          personal_email: invitePersonalEmail,
          role: inviteRole,
          position: invitePosition,
          status: "Active",
          show_in_about: false
        });
        createdId = supaUser.id;
      } catch (e) {
        console.warn("Supabase add user error:", e);
      }

      const newUserDoc = {
        name: inviteName,
        email: inviteEmail,
        personalEmail: invitePersonalEmail,
        personal_email: invitePersonalEmail,
        role: inviteRole,
        position: invitePosition,
        status: "Active",
        showInAbout: "No"
      };

      if (!createdId) {
        const docRef = await addDoc(collection(db, "users"), newUserDoc);
        createdId = docRef.id;
      } else {
        setDoc(doc(db, "users", createdId), newUserDoc, { merge: true }).catch(() => {});
      }

      const newUser: UserItem = {
        id: createdId,
        name: inviteName,
        email: inviteEmail,
        personal_email: invitePersonalEmail,
        personalEmail: invitePersonalEmail,
        role: inviteRole,
        position: invitePosition,
        status: "Active",
        showInAbout: "No"
      };
      setUsers([newUser, ...users]);

      let emailStatusNotice = "";
      // Send Welcome Email to the user's personal mail ID
      const targetWelcomeMail = (invitePersonalEmail && invitePersonalEmail.includes("@")) ? invitePersonalEmail.trim() : inviteEmail.trim();
      if (targetWelcomeMail && targetWelcomeMail.includes("@")) {
        const welcomeMailData = buildWelcomeMemberEmail({
          name: inviteName,
          role: inviteRole,
          collegeEmail: inviteEmail,
          personalEmail: invitePersonalEmail,
          portalUrl: `${window.location.origin}/login`
        });
        const mailRes = await sendResendEmail({
          to: targetWelcomeMail,
          subject: welcomeMailData.subject,
          html: welcomeMailData.html,
          text: welcomeMailData.text
        });
        if (!mailRes.success) {
          console.warn(`[Welcome Email Notice for ${inviteName} (${targetWelcomeMail})]:`, mailRes.error);
          emailStatusNotice = `\n\n(Email Delivery Note: ${mailRes.error})`;
        } else {
          console.log(`[Welcome Email Sent] to ${targetWelcomeMail} for ${inviteName}`);
          emailStatusNotice = `\n\n(Welcome email delivered to ${targetWelcomeMail}!)`;
        }
      }

      alert(`User added successfully!${emailStatusNotice}`);

      setInviteName("");
      setInviteEmail("");
      setInvitePersonalEmail("");
      setInvitePosition("");
      setIsInviteModalOpen(false);
    } catch (err) {
      console.error("Error adding user to database:", err);
      alert("Failed to add user to database.");
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId || !formName || !formEmail) return;

    try {
      const finalPhoto = formPhotoPreview ? await compressImageBase64(formPhotoPreview, 500, 500, 0.75) : "";

      // 1. Update in Supabase
      try {
        await userService.updateUser(editingUserId, {
          name: formName,
          display_name: formName,
          email: formEmail,
          personal_email: formPersonalEmail,
          role: formRoleType,
          position: formPosition,
          image: finalPhoto,
          show_in_about: formShowInAbout === "Yes",
          bio: formBio,
          linkedin: formLinkedin,
          github: formGithub
        });
      } catch (supaErr) {
        console.warn("Supabase update user error:", supaErr);
      }

      // 2. Mirror to Firestore
      try {
        const docRef = doc(db, "users", editingUserId);
        await setDoc(docRef, {
          name: formName,
          displayName: formName,
          email: formEmail,
          personalEmail: formPersonalEmail,
          personal_email: formPersonalEmail,
          role: formRoleType,
          roleType: formRoleType,
          position: formPosition,
          image: finalPhoto,
          showInAbout: formShowInAbout === "Yes",
          showInAboutPage: formShowInAbout === "Yes",
          bio: formBio,
          linkedin: formLinkedin,
          github: formGithub
        }, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore update user notice:", fsErr);
      }

      setUsers(users.map(u => u.id === editingUserId ? {
        ...u,
        name: formName,
        email: formEmail,
        personal_email: formPersonalEmail,
        personalEmail: formPersonalEmail,
        role: formRoleType as any,
        position: formPosition,
        image: finalPhoto,
        showInAbout: formShowInAbout === "Yes" ? "Yes" : "No",
        bio: formBio,
        linkedin: formLinkedin,
        github: formGithub
      } : u));

      setEditingUserId(null);
      // Reset form
      setFormName("");
      setFormEmail("");
      setFormPersonalEmail("");
      setFormRoleType("Organizer");
      setFormPosition("");
      setFormPhotoPreview("");
      setFormShowInAbout("No");
    } catch (err) {
      console.error("Error updating user in database:", err);
      alert("Failed to update user.");
    }
  };

  const handleStatusChange = async (id: string, newStatus: UserItem["status"]) => {
    try {
      // 1. Supabase
      try {
        await userService.updateUser(id, { status: newStatus });
      } catch (supaErr) {
        console.warn("Supabase update status notice:", supaErr);
      }

      // 2. Firestore
      try {
        const docRef = doc(db, "users", id);
        await setDoc(docRef, { status: newStatus }, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore update status notice:", fsErr);
      }

      setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error("Error updating user status:", err);
      alert("Failed to update status.");
    }
    setActiveMenuId(null);
  };

  const handleRoleChange = (id: string, newRole: UserItem["role"]) => {
    setRoleConfirmState({ isOpen: true, userId: id, newRole });
    setActiveMenuId(null);
    setShowRoleSubMenu(false);
  };

  const confirmRoleChange = async () => {
    const { userId: id, newRole } = roleConfirmState;
    if (!id || !newRole) return;

    try {
      // 1. Supabase
      try {
        await userService.updateUser(id, { role: newRole });
      } catch (supaErr) {
        console.warn("Supabase update role notice:", supaErr);
      }

      // 2. Firestore
      try {
        const docRef = doc(db, "users", id);
        await setDoc(docRef, { role: newRole }, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore update role notice:", fsErr);
      }

      setUsers(users.map(u => u.id === id ? { ...u, role: newRole as any } : u));
    } catch (err) {
      console.error("Error updating user role:", err);
      alert("Failed to update role.");
    }
    setRoleConfirmState({ isOpen: false, userId: "", newRole: "" });
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) return;
    
    try {
      // 1. Delete user record from Supabase (both auth.users and public.users)
      try {
        const targetUser = users.find(u => u.id === id);
        if (targetUser && targetUser.email) {
          await userService.deleteUserByEmail(targetUser.email);
        } else {
          await userService.deleteUser(id);
        }
      } catch (supaErr) {
        console.warn("Supabase delete user notice:", supaErr);
      }

      // 2. Delete user record from Firestore
      try {
        await deleteDoc(doc(db, "users", id));
      } catch (fsErr) {
        console.warn("Firestore delete user notice:", fsErr);
      }

      // 3. Try deleting Firebase Auth account if exists
      try {
        const functions = getFunctions(app);
        const deleteUserAccount = httpsCallable(functions, "deleteUserAccount");
        await deleteUserAccount({ uid: id });
      } catch {
        // User may not have an auth record (database-only user) — expected fallback
      }
      
      setUsers(prev => prev.filter(u => u.id !== id));
      alert("User successfully deleted.");
    } catch (err: any) {
      console.error("Error deleting user:", err);
      alert(`Failed to delete user: ${err.message || err}`);
    }
    setActiveMenuId(null);
  };



  // Helper to render beautiful role badge dynamically
  const renderRoleBadge = (role: string) => {
    const rLower = (role || "").toLowerCase();
    let bg = "bg-slate-100 text-slate-750 border-slate-205";
    if (rLower.includes("admin")) {
      bg = "bg-blue-50 text-blue-700 border-blue-200";
    } else if (rLower.includes("faculty") || rLower.includes("advisor") || rLower.includes("coordinator")) {
      bg = "bg-emerald-50 text-emerald-700 border-emerald-100";
    } else if (rLower.includes("organizer") || rLower.includes("lead") || rLower.includes("head") || rLower.includes("manager") || rLower.includes("conviner")) {
      bg = "bg-indigo-50 text-indigo-700 border-indigo-100";
    } else if (rLower.includes("jury") || rLower.includes("evaluator")) {
      bg = "bg-purple-50 text-purple-700 border-purple-100";
    } else if (rLower.includes("volunteer") || rLower.includes("guest") || rLower.includes("member") || rLower.includes("participant")) {
      bg = "bg-slate-100 text-slate-600 border-slate-200";
    } else {
      bg = "bg-purple-50 text-purple-700 border-purple-100";
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${bg}`}>
        {role}
      </span>
    );
  };

  // Helper to render beautiful initials avatar / placeholder
  const renderAvatar = (user: UserItem) => {
    let avatarUrl = user.image;
    if (!avatarUrl || avatarUrl.trim() === "") {
      avatarUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23CBD5E1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
    }

    return (
      <img 
        src={avatarUrl} 
        alt={user.name} 
        className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm" 
      />
    );
  };

  if (showAddMemberForm || editingUserId !== null) {
    const isEditMode = editingUserId !== null;
    return (
      <div className="space-y-6 pb-12 text-left font-sans animate-in fade-in duration-200">
        <SEO title={`${isEditMode ? 'Edit' : 'Add'} Team Member - Faculty Portal`} description={isEditMode ? "Update team member details." : "Expand the club's influence by adding key contributors and leaders."} />
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <button onClick={() => { setShowAddMemberForm(false); setEditingUserId(null); }} className="hover:text-blue-600 transition-colors">User Management</button>
          <span>&gt;</span>
          <span className="text-slate-600 font-black">{isEditMode ? 'Edit' : 'Add'} Team Member</span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">{isEditMode ? 'Edit Team Member' : 'Add New Team Member'}</h1>
          <p className="text-slate-455 text-xs font-semibold mt-1.5">{isEditMode ? "Update this member's profile, role, and details." : "Expand the club's influence by adding key contributors and leaders to the organization."}</p>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (span 8) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Personal Details Card */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5">
              <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-50/50 text-blue-600 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5" />
                </span>
                Personal Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/20 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">College Mail *</label>
                  <input
                    type="email"
                    required
                    placeholder="john.doe@university.edu"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/20 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Personal Mail ID *</label>
                  <input
                    type="email"
                    required
                    placeholder="john.personal@gmail.com"
                    value={formPersonalEmail}
                    onChange={(e) => setFormPersonalEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/20 focus:bg-white transition-all"
                  />
                </div>
              </div>



            </div>

            {/* Role & Position Card */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5">
              <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-50/50 text-blue-600 flex items-center justify-center shrink-0">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                Role & Position
              </h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Role Type</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {availableRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormRoleType(role)}
                        className={`py-3 px-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                          formRoleType === role
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {formatRoleLabel(role)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub Role Selector */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sub Role</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {["Lead", "Co-Lead", "Associate"].map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setFormPosition(formPosition === sub ? "" : sub)}
                        className={`py-2.5 px-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                          formPosition === sub
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Show in About Page Card */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
              <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-50/50 text-blue-600 flex items-center justify-center shrink-0">
                  <Eye className="h-3.5 w-3.5" />
                </span>
                Show in About Page
              </h3>
              <p className="text-xs text-slate-500 font-normal leading-relaxed">
                Choose whether this user profile should be displayed on the public About page under Club Leadership.
              </p>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select Option
                </label>
                <select
                  value={formShowInAbout}
                  onChange={(e) => setFormShowInAbout(e.target.value)}
                  className="w-full sm:w-72 px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-bold text-sm text-slate-800 bg-slate-50/20 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="Yes">Yes (Show Profile on About Page)</option>
                  <option value="No">No (Do Not Show on About Page)</option>
                </select>
              </div>
            </div>

            {/* Bio & Online Presence Card */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5">
              <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-50/50 text-blue-600 flex items-center justify-center shrink-0">
                  <ClipboardList className="h-3.5 w-3.5" />
                </span>
                Bio & Online Presence
              </h3>
              <div className="space-y-4.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Professional Bio</label>
                  <textarea
                    rows={4}
                    maxLength={300}
                    placeholder="Briefly describe the member's expertise and role in the AI Verse club..."
                    value={formBio}
                    onChange={(e) => setFormBio(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/20 focus:bg-white transition-all resize-none"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-1">
                    <span>Recommended: 150 - 300 characters</span>
                    <span>{formBio.length}/300</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">LinkedIn URL</label>
                    <input
                      type="url"
                      placeholder="linkedin.com/in/username"
                      value={formLinkedin}
                      onChange={(e) => setFormLinkedin(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/20 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">GitHub URL</label>
                    <input
                      type="url"
                      placeholder="github.com/username"
                      value={formGithub}
                      onChange={(e) => setFormGithub(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 bg-slate-50/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-2 flex justify-start gap-3">
              <Button
                variant="gradient"
                disabled={addingToTeam}
                onClick={isEditMode ? handleEditUser : handleAddTeamMemberSubmit}
                className="px-6 py-3 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/10"
              >
                {addingToTeam ? "Saving..." : isEditMode ? "Save Changes" : "Add to Team"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => { setShowAddMemberForm(false); setEditingUserId(null); }}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-655 font-bold rounded-2xl text-xs hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>

          </div>

          {/* Right Column (span 4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Profile Photo Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5 text-center">
              <h3 className="text-sm font-black text-slate-800 tracking-tight text-left">Profile Photo</h3>
              
              <div className="flex flex-col items-center py-4">
                <label className="relative w-28 h-28 rounded-full border-2 border-dashed border-slate-200 hover:border-blue-500 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all bg-slate-50/30 group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  {formPhotoPreview ? (
                    <img 
                      src={formPhotoPreview} 
                      alt="Profile preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition-colors">
                      <UserPlus className="h-6 w-6 stroke-[1.8] mb-1.5" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Upload</span>
                    </div>
                  )}
                </label>
                <span className="text-[10px] text-slate-400 font-semibold mt-3.5 block max-w-[200px]">Click the area above to upload a professional portrait.</span>
              </div>

              <div className="pt-4 border-t border-slate-100/60 flex items-center justify-between text-[10px] font-bold text-slate-450">
                <div className="flex flex-col items-start">
                  <span>Max Size</span>
                  <span className="text-slate-800 font-black">2 MB</span>
                </div>
                <div className="flex flex-col items-end">
                  <span>Format</span>
                  <span className="text-slate-800 font-black">JPG, PNG, WEBP</span>
                </div>
              </div>
            </div>

            {/* Team Guidelines Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
              <h3 className="text-sm font-black text-slate-805 tracking-tight flex items-center gap-1.5 text-left">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                Team Guidelines
              </h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="text-xs font-black text-blue-600 bg-blue-50/50 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">01</span>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-0.5 text-left">Ensure photos have a neutral background and adequate lighting for professional consistency.</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-xs font-black text-blue-600 bg-blue-50/50 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">02</span>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-0.5 text-left">Bio should highlight academic background and specific contributions to AIVerse initiatives.</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-xs font-black text-blue-600 bg-blue-50/50 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">03</span>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-0.5 text-left">Verify social handles correctly as they link directly to public profiles from the portal.</p>
                </div>
              </div>
            </div>

            {/* Quote Decorative card */}
            <div className="relative p-5 bg-gradient-to-tr from-blue-50/60 to-indigo-50/40 border border-blue-100/50 rounded-3xl overflow-hidden text-slate-700">
              <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:12px_12px]"></div>
              <p className="relative z-10 text-[10px] text-slate-500 font-semibold leading-relaxed italic text-left">
                "Great teams are built on diverse skills and shared passion. Every new member brings us closer to pioneering the future of AI."
              </p>
            </div>

          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <SEO 
        title="User Management - Faculty Portal" 
        description="Administrate club membership, assign hierarchical roles, and oversee onboarding of new faculty/student researchers."
      />

      {/* ================= HEADER ================= */}
      <div className="text-left">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight font-sans">User Management</h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed font-medium">
          Administrate club membership, assign hierarchical roles, and oversee the onboarding of 
          new faculty and student researchers within the AI Excellence ecosystem.
        </p>
      </div>

      {/* ================= METRICS CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <UserPlus className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-0.5">
              +12%
            </span>
          </div>
          <div className="mt-3 text-left">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Members</span>
            <h3 className="text-2xl font-extrabold mt-1 text-slate-800 tracking-tight font-sans">
              {totalCount.toLocaleString()}
            </h3>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-sky-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Active Members */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <UserCheck className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              Active
            </span>
          </div>
          <div className="mt-3 text-left">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Members</span>
            <h3 className="text-2xl font-extrabold mt-1 text-slate-800 tracking-tight font-sans">
              {activeMembersCount}
            </h3>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Deactivated */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
              <Archive className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-150">
              Archived
            </span>
          </div>
          <div className="mt-3 text-left">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Deactivated</span>
            <h3 className="text-2xl font-extrabold mt-1 text-slate-800 tracking-tight font-sans">
              {deactivatedCount.toString().padStart(2, "0")}
            </h3>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-slate-500 to-slate-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Open Graph */}
        <div 
          className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative overflow-hidden group hover:shadow-md transition-all duration-300 cursor-pointer"
          onClick={() => setShowGraphModal(true)}
        >
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
              Hiring
            </span>
          </div>
          <div className="mt-3 text-left">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Open Graph</span>
            <h3 className="text-2xl font-extrabold mt-1 text-slate-800 tracking-tight font-sans">
              {pendingCount}
            </h3>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>
      </div>

      {/* ================= USER MANAGEMENT TABS ================= */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap -mb-px gap-6 text-left">
          <button
            onClick={() => setRoleFilter("All")}
            className={`pb-3 px-1 text-xs font-bold transition-all border-b-2 select-none whitespace-nowrap
              ${roleFilter === "All" 
                ? "border-[#2563EB] text-[#2563EB] font-black" 
                : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
          >
            All Users ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter("Show in About Page")}
            className={`pb-3 px-1 text-xs font-bold transition-all border-b-2 select-none whitespace-nowrap flex items-center gap-1.5
              ${roleFilter === "Show in About Page" 
                ? "border-[#2563EB] text-[#2563EB] font-black" 
                : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Show in About Page ({users.filter(u => u.showInAbout === "Yes").length})
          </button>
          <button
            onClick={() => setRoleFilter("AI Verse Members")}
            className={`pb-3 px-1 text-xs font-bold transition-all border-b-2 select-none whitespace-nowrap flex items-center gap-1.5
              ${roleFilter === "AI Verse Members" 
                ? "border-[#2563EB] text-[#2563EB] font-black" 
                : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
          >
            <Users className="h-3.5 w-3.5" />
            AI Verse Members ({users.filter(isAiVerseMember).length})
          </button>
        </div>
      </div>

      {/* ================= FILTER TOOLBAR ================= */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search & Select dropdown filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search by Name */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              id="search-users"
              name="search-users"
              autoComplete="off"
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Role Filter */}
          <div className="relative w-full sm:w-auto">
            <select
              id="role-filter"
              name="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="appearance-none w-full sm:w-48 px-4 py-2 pr-10 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-700 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium cursor-pointer"
            >
              <option value="All">Role: All</option>
              <option value="Show in About Page">Show in About Page</option>
              <option value="AI Verse Members">AI Verse Members</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{formatRoleLabel(role)}</option>
              ))}
              {!availableRoles.includes("Student Member") && <option value="Student Member">Student Member</option>}
              {!availableRoles.includes("Student Organizer") && <option value="Student Organizer">Student Organizer</option>}
              {!availableRoles.includes("Faculty Coordinator") && <option value="Faculty Coordinator">Faculty Coordinator</option>}
              {!availableRoles.includes("Guest") && <option value="Guest">Guest</option>}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Filter className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative w-full sm:w-auto">
            <select
              id="status-filter"
              name="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none w-full sm:w-36 px-4 py-2 pr-10 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-700 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium cursor-pointer"
            >
              <option value="All">Status: All</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Deactivated">Deactivated</option>
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Filter className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Bulk Add Members Button */}
          <div className="relative w-full md:w-auto">
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleCSVFileSelect} 
            />
            <button
              onClick={() => setShowBulkMenu(!showBulkMenu)}
              className="flex items-center gap-2 justify-center w-full md:w-auto px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-2xl shadow-sm transition-all text-sm whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              Bulk Add Members
            </button>

            {showBulkMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setShowBulkMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-20 py-2">
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add members</div>
                  <button
                    onClick={() => {
                      setShowBulkMenu(false);
                      if (fileInputRef.current) fileInputRef.current.click();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700 flex items-center gap-2"
                  >
                    <FileUp className="h-4 w-4 text-slate-400" />
                    Upload excel/.csv
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkMenu(false);
                      setShowPasteModal(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700 flex items-center gap-2"
                  >
                    <ClipboardPaste className="h-4 w-4 text-slate-400" />
                    Open .csv (Paste)
                  </button>
                  <div className="h-px bg-slate-100 my-1 mx-2"></div>
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Templates</div>
                  <button
                    onClick={() => {
                      setShowBulkMenu(false);
                      setShowDownloadRoleModal(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4 text-slate-400" />
                    Download template
                  </button>
                </div>
              </>
            )}
          </div>
          
          {/* Add Member Button */}
          <button
            onClick={() => setShowAddMemberForm(true)}
            className="flex items-center gap-2 justify-center w-full md:w-auto px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl shadow-md shadow-blue-600/10 hover:shadow-lg hover:shadow-blue-600/15 transition-all text-sm whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" />
            Add Member
          </button>
        </div>
      </div>

      {/* ================= USERS TABLE ================= */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-visible">
        <div className="overflow-x-auto overflow-y-visible min-h-[300px]">
          <table className="w-full border-collapse text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100">
              <tr>
                <th scope="col" className="px-6 py-4">User</th>
                <th scope="col" className="px-6 py-4">Role</th>
                <th scope="col" className="px-6 py-4">Status</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((user, index) => {
                  const isNearBottom = paginatedUsers.length >= 4 && index >= paginatedUsers.length - 2;

                  return (
                  <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors group relative ${activeMenuId === user.id ? "z-30" : "z-auto"}`}>
                    {/* User Identity */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {renderAvatar(user)}
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-800 text-sm">{user.name}</div>
                            {user.showInAbout === "Yes" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-600 border border-blue-100">
                                <Eye className="w-2.5 h-2.5" />
                                Shown in About
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-xs font-medium">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Sub Role Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderRoleBadge(getDisplayRole(user.role, availableRoles))}
                        {user.position && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                            {user.position}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Dot */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.status === "Active" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          Active
                        </span>
                      )}
                      {user.status === "Pending" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Pending
                        </span>
                      )}
                      {user.status === "Deactivated" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Deactivated
                        </span>
                      )}
                    </td>

                    {/* Row Interactive Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                      {currentUser?.uid === user.id ? (
                        <div className="flex justify-end pr-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">You</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Approve Pending Guest */}
                          {user.status === "Pending" && (
                            <button
                              onClick={() => handleStatusChange(user.id, "Active")}
                              title="Approve Member"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-100/50 bg-emerald-50/20 transition-all"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}

                          {/* Dropdown Menu Trigger */}
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === user.id ? null : user.id);
                                setShowRoleSubMenu(false);
                              }}
                              className={`p-1.5 rounded-xl transition-all border ${
                                activeMenuId === user.id
                                  ? "bg-slate-100 text-slate-800 border-slate-200 shadow-inner"
                                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100 border-transparent hover:border-slate-200"
                              }`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {/* Quick Edit Popup Context Menu */}
                            {activeMenuId === user.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40 cursor-default"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    setShowRoleSubMenu(false);
                                  }}
                                />
                                <div className={`absolute right-0 ${isNearBottom ? "bottom-full mb-2 origin-bottom-right" : "top-full mt-1.5 origin-top-right"} w-56 bg-white border border-slate-200/90 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.12)] p-1.5 z-50 text-left font-sans ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100`}>
                                  {showRoleSubMenu ? (
                                    <>
                                      <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex justify-between items-center">
                                        Select Role
                                        <button onClick={() => setShowRoleSubMenu(false)} className="hover:text-slate-600 p-0.5 rounded transition-colors hover:bg-slate-100">
                                          <ChevronLeft className="h-3 w-3" />
                                        </button>
                                      </div>
                                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                                        {(() => {
                                          const options = [...availableRoles];
                                          const displayRole = getDisplayRole(user.role, availableRoles);
                                          if (displayRole && !options.includes(displayRole)) {
                                            options.push(displayRole);
                                          }
                                          return options;
                                        })().map((role) => (
                                          <button
                                            key={role}
                                            onClick={() => handleRoleChange(user.id, role as any)}
                                            className={`w-full px-3 py-2 text-xs font-semibold rounded-xl transition-colors hover:bg-slate-50 text-slate-700 flex items-center gap-2 ${getDisplayRole(user.role, availableRoles) === role ? 'bg-blue-50 text-blue-600 font-bold' : ''}`}
                                          >
                                            {role}
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setActiveMenuId(null);
                                          setEditingUserId(user.id);
                                          setFormName(user.name);
                                          setFormEmail(user.email);
                                          setFormPersonalEmail(user.personal_email || user.personalEmail || "");
                                          setFormRoleType(user.role || "Organizer");
                                          setFormPhotoPreview(user.image || "");
                                          setFormShowInAbout(user.showInAbout === "Yes" ? "Yes" : "No");
                                          setFormBio(user.bio || "");
                                          setFormLinkedin(user.linkedin || "");
                                          setFormGithub(user.github || "");
                                        }}
                                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 transition-colors"
                                      >
                                        <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                                        Edit Profile
                                      </button>
                                      <button
                                        onClick={() => setShowRoleSubMenu(true)}
                                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 text-slate-700 flex items-center justify-between transition-colors"
                                      >
                                        <span className="flex items-center gap-2.5">
                                          <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                                          Change Role
                                        </span>
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                      </button>
                                      
                                      <div className="h-px bg-slate-100 my-1 mx-1" />

                                      <div className="px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
                                        <span className="flex items-center gap-2 text-slate-600">
                                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                                          About Page
                                        </span>
                                        <select
                                          value={user.showInAbout === "Yes" ? "Yes" : "No"}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            handleToggleShowInAbout(user.id, e.target.value);
                                          }}
                                          className="px-2 py-0.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                                        >
                                          <option value="Yes">Show</option>
                                          <option value="No">Hide</option>
                                        </select>
                                      </div>

                                      <div className="h-px bg-slate-100 my-1 mx-1" />

                                      {user.status === "Active" ? (
                                        <button
                                          onClick={() => handleStatusChange(user.id, "Deactivated")}
                                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl hover:bg-amber-50 text-amber-700 flex items-center gap-2.5 transition-colors"
                                        >
                                          <UserX className="h-3.5 w-3.5 text-amber-500" />
                                          Deactivate
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleStatusChange(user.id, "Active")}
                                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl hover:bg-emerald-50 text-emerald-700 flex items-center gap-2.5 transition-colors"
                                        >
                                          <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                                          Activate
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-2.5 transition-colors"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        Remove Member
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium font-sans">
                    No members match the current search or filter parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ================= PAGINATION ================= */}
        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 font-semibold tracking-tight">
            Showing <span className="text-slate-700 bg-white border border-slate-200/80 px-2 py-0.5 rounded-lg font-bold">{Math.min(filteredUsers.length, itemsPerPage)}</span> of{" "}
            <span className="text-slate-700 font-bold">{totalCount.toLocaleString()}</span> users
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl border border-slate-200/80 font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all ${currentPage === 1 ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-9 h-9 rounded-xl font-bold text-sm transition-all border
                  ${currentPage === i + 1 
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-md shadow-blue-600/10" 
                    : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50"
                  }`}
              >
                {i + 1}
              </button>
            ))}

            {totalPages > 3 && (
              <>
                <span className="text-slate-400 px-1">...</span>
                <button
                  onClick={() => setCurrentPage(129)}
                  className="w-9 h-9 rounded-xl bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 font-bold text-sm"
                >
                  129
                </button>
              </>
            )}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-xl border border-slate-200/80 font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all ${currentPage === totalPages ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= ADD MEMBER MODAL ================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold">Add New Member</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddMember} className="p-6 space-y-4 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elena Rodriguez"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">College Mail *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. elena.r@university.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Personal Mail ID *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. elena.personal@gmail.com"
                  value={invitePersonalEmail}
                  onChange={(e) => setInvitePersonalEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserItem["role"])}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 cursor-pointer"
                >
                  {availableRoles.map(role => (
                    <option key={role} value={role}>{formatRoleLabel(role)}</option>
                  ))}
                  {!availableRoles.includes("Student Member") && <option value="Student Member">Student Member</option>}
                  {!availableRoles.includes("Student Organizer") && <option value="Student Organizer">Student Organizer</option>}
                  {!availableRoles.includes("Faculty Coordinator") && <option value="Faculty Coordinator">Faculty Coordinator</option>}
                  {!availableRoles.includes("Guest") && <option value="Guest">Guest</option>}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sub Role</label>
                <select
                  value={invitePosition}
                  onChange={(e) => setInvitePosition(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 cursor-pointer"
                >
                  <option value="">Select Sub Role (Optional)</option>
                  <option value="Lead">Lead</option>
                  <option value="Co-Lead">Co-Lead</option>
                  <option value="Associate">Associate</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDownloadRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-black text-slate-800 mb-2">Select Role for Template</h3>
            <p className="text-xs text-slate-500 font-semibold mb-4">
              Choose the role this template is for, or leave as 'All' to allow any role.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role Type</label>
                <select
                  value={selectedDownloadRole}
                  onChange={(e) => setSelectedDownloadRole(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="All">All Roles</option>
                  {availableRoles.map(role => (
                    <option key={role} value={role}>{formatRoleLabel(role)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-sm transition-all"
                  onClick={() => setShowDownloadRoleModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
                  onClick={() => {
                    handleDownloadTemplate(selectedDownloadRole);
                    setShowDownloadRoleModal(false);
                  }}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paste CSV Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-[90vw] shadow-xl flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-black text-slate-800 mb-2">Manual Entry / Paste Data</h3>
            <p className="text-sm text-slate-500 font-medium mb-4">
              Type data into the grid below, or click any cell and paste (Ctrl+V) from Excel/CSV to auto-fill the rows.
            </p>
            <div className="flex-1 overflow-auto border border-slate-200 rounded-2xl relative" onPaste={handleGridPaste}>
              <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 shadow-sm border-r border-slate-200 sticky left-0 z-20 w-10 text-center">#</th>
                    {gridColumns.map(col => (
                      <th key={col} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 shadow-sm">
                        {col}
                        {["Full Name", "College Mail", "Personal Mail ID", "Role Type"].includes(col) && <span className="text-red-500 ml-1">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gridData.map((row, rIndex) => (
                    <tr key={rIndex} className="hover:bg-slate-50/50 group">
                      <td className="px-4 py-2 text-slate-400 font-bold text-xs border-r border-slate-100 bg-white group-hover:bg-slate-50/50 sticky left-0 z-10 text-center">{rIndex + 1}</td>
                      {gridColumns.map(col => (
                        <td key={col} className="p-0 border-r border-slate-50 last:border-r-0 focus-within:ring-1 focus-within:ring-inset focus-within:ring-blue-500">
                          {col === "Profile Photo" ? (
                            <div className="flex items-center justify-center p-2 min-w-[100px]">
                              <input
                                type="file"
                                id={`row-photo-input-${rIndex}`}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleRowImageUpload(rIndex, f);
                                }}
                              />
                              {row["Profile Photo"] ? (
                                <div className="relative group/photo">
                                  <img
                                    src={row["Profile Photo"]}
                                    alt="Profile"
                                    onClick={() => document.getElementById(`row-photo-input-${rIndex}`)?.click()}
                                    className="w-9 h-9 rounded-full object-cover border-2 border-blue-400 shadow-xs cursor-pointer hover:opacity-80 transition-opacity"
                                    title="Click to change photo"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGridChange(rIndex, "Profile Photo", "");
                                    }}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[9px] shadow-xs transition-colors"
                                    title="Remove photo"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <label
                                  htmlFor={`row-photo-input-${rIndex}`}
                                  className="w-9 h-9 rounded-full border-2 border-dashed border-slate-200 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/60 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer transition-all shadow-2xs group/upload"
                                  title="Upload Profile Image"
                                >
                                  <Camera className="w-4 h-4 group-hover/upload:scale-110 transition-transform" />
                                </label>
                              )}
                            </div>
                          ) : col === "Role Type" ? (
                            <div className="relative flex items-center p-1.5">
                              <select
                                value={row[col] || ""}
                                onChange={(e) => handleGridChange(rIndex, col, e.target.value)}
                                className="w-full min-w-[160px] appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 text-xs font-semibold cursor-pointer transition-all shadow-2xs"
                              >
                                <option value="" disabled className="text-slate-400">Select Role</option>
                                {availableRoles.map(role => (
                                  <option key={role} value={role} className="text-slate-800 font-medium py-1">{formatRoleLabel(role)}</option>
                                ))}
                                {!availableRoles.some(r => r.toLowerCase().includes("member")) && (
                                  <option value="Student Member" className="text-slate-800 font-medium py-1">Student Member</option>
                                )}
                              </select>
                              <ChevronDown className="absolute right-3.5 pointer-events-none h-3.5 w-3.5 text-slate-400" />
                            </div>
                          ) : col === "Sub Role" ? (
                            <div className="relative flex items-center p-1.5">
                              <select
                                value={row[col] || ""}
                                onChange={(e) => handleGridChange(rIndex, col, e.target.value)}
                                className="w-full min-w-[140px] appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 text-xs font-semibold cursor-pointer transition-all shadow-2xs"
                              >
                                <option value="">Select Sub Role</option>
                                <option value="Lead" className="text-slate-800 font-medium py-1">Lead</option>
                                <option value="Co-Lead" className="text-slate-800 font-medium py-1">Co-Lead</option>
                                <option value="Associate" className="text-slate-800 font-medium py-1">Associate</option>
                              </select>
                              <ChevronDown className="absolute right-3.5 pointer-events-none h-3.5 w-3.5 text-slate-400" />
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={row[col] || ""}
                              onChange={(e) => handleGridChange(rIndex, col, e.target.value)}
                              placeholder={col}
                              className="w-full min-w-[150px] px-4 py-3 bg-transparent border-0 focus:outline-none text-slate-700 text-sm font-medium placeholder:text-slate-300"
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex justify-start">
              <button 
                type="button" 
                onClick={() => setGridData([...gridData, { ...initialGridRow }])}
                className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1.5 p-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
              <button 
                type="button"
                className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-sm transition-all"
                onClick={() => {
                  setShowPasteModal(false);
                  try {
                    sessionStorage.removeItem("aether_bulk_paste_modal");
                    sessionStorage.removeItem("aether_bulk_paste_grid");
                  } catch {}
                }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="px-8 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
                onClick={handlePasteSubmit}
              >
                Process Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Processing Modal */}
      {isBulkProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-xl flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Processing Bulk Add...</h3>
            <p className="text-sm text-slate-500 font-medium mb-4">
              Please wait while we add these members. Do not close this window.
            </p>
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between w-full text-xs font-bold text-slate-400">
              <span>{bulkProgress.current} / {bulkProgress.total}</span>
              <span>{bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {roleConfirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Change Role?</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">
              Are you sure you want to change this user's role to <span className="font-bold text-slate-800">{roleConfirmState.newRole}</span>?
            </p>
            <div className="flex gap-3">
              <button 
                type="button"
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-sm transition-all"
                onClick={() => setRoleConfirmState({ isOpen: false, userId: "", newRole: "" })}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
                onClick={confirmRoleChange}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Graph Modal */}
      <TeamGraphModal 
        isOpen={showGraphModal} 
        onClose={() => setShowGraphModal(false)} 
        users={users} 
      />
    </div>
  );
};

export default UserManagementPage;
