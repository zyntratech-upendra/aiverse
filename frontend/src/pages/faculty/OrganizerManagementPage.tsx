import React, { useState, useMemo, useEffect } from "react";
import SEO from "../../components/layout/SEO";
import { 
  Plus, 
  SlidersHorizontal, 
  Download, 
  Trophy,
  X,
  Search,
  CheckCircle2,
  Lock,
  ChevronRight,
  Clock,
  UserPlus,
  MoreVertical,
  Trash2
} from "lucide-react";
import { db } from "../../config/firebase";
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc } from "firebase/firestore";
import { fetchEvents as apiFetchEvents, fetchUsers as apiFetchUsers, fetchOrganizers } from "../../services/apiClient";
import { userService } from "../../services/userService";

// Import local assets if they exist
import elenaImg from "../../assets/images/elena.png";
import sarahImg from "../../assets/images/sarah.png";
import satoshiImg from "../../assets/images/satoshi.png";

interface Organizer {
  id: string;
  name: string;
  email: string;
  eventsCount: number;
  eventNames?: string[];
  successRate: number;
  xp: number;
  badge: string;
  image?: string;
  username?: string;
  tempPassword?: string;
}

interface Achievement {
  id: string;
  time: string;
  title: string;
  description: string;
  color: string;
}

const OrganizerManagementPage: React.FC = () => {
  // Initial list of organizers for sorting/pagination
  const [organizers, setOrganizers] = useState<Organizer[]>([
    {
      id: "1",
      name: "Alex Rivers",
      email: "a.rivers@uni.edu",
      eventsCount: 8,
      eventNames: ["AI Ethics Summit", "Neural Hackathon", "Quantum Workshop"],
      successRate: 98,
      xp: 2450,
      badge: "CHAMPION",
      image: elenaImg // Reusing Elena image for Alex
    },
    {
      id: "2",
      name: "Sarah Chen",
      email: "s.chen@uni.edu",
      eventsCount: 5,
      eventNames: ["Neural Hackathon", "Deep Learning Symposium"],
      successRate: 92,
      xp: 2120,
      badge: "ELITE",
      image: sarahImg
    },
    {
      id: "3",
      name: "Jordan Smith",
      email: "j.smith@uni.edu",
      eventsCount: 3,
      eventNames: ["Quantum Workshop"],
      successRate: 85,
      xp: 1890,
      badge: "RISING STAR",
      image: satoshiImg // Reusing Satoshi image for Jordan
    },
    {
      id: "4",
      name: "Sophia Martinez",
      email: "s.martinez@uni.edu",
      eventsCount: 7,
      eventNames: ["AI Ethics Summit", "Deep Learning Symposium"],
      successRate: 94,
      xp: 1750,
      badge: "ELITE"
    },
    {
      id: "5",
      name: "David K.",
      email: "d.k@uni.edu",
      eventsCount: 4,
      eventNames: ["AI Ethics Summit"],
      successRate: 88,
      xp: 1600,
      badge: "RISING STAR"
    }
  ]);

  // Achievement timeline state
  const [achievements, setAchievements] = useState<Achievement[]>([
    {
      id: "1",
      time: "2 hours ago",
      title: "Alex completed 'Deep Learning Symposium'",
      description: "Successfully managed 250+ attendees and speakers.",
      color: "bg-emerald-500"
    },
    {
      id: "2",
      time: "Yesterday",
      title: "Sarah earned 'Master Recruiter' badge",
      description: "Onboarded 10 new volunteers this month.",
      color: "bg-blue-600"
    },
    {
      id: "3",
      time: "2 days ago",
      title: "Tech Club Hackathon Approved",
      description: "Finalized venue and sponsor agreements.",
      color: "bg-sky-400"
    }
  ]);

  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEvents, setNewEvents] = useState(1);
  const [newSuccess, setNewSuccess] = useState(90);

  // Firebase Live Sync States
  const [showAddOrganizerForm, setShowAddOrganizerForm] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  
  // Selection/Form state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assignedEventIds, setAssignedEventIds] = useState<string[]>([]);
  const [formUsername, setFormUsername] = useState("");
  const [formTempPassword, setFormTempPassword] = useState("");
  const [formConfirmTempPassword, setFormConfirmTempPassword] = useState("");
  const [sendEmailToggle, setSendEmailToggle] = useState(true);
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);

  // Fetch roles from settings
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const getSnap = await getDocs(collection(db, "settings"));
        getSnap.forEach(d => {
          if (d.id === "portal_config") {
            const data = d.data();
            if (data.availableRoles) setAvailableRoles(data.availableRoles);
          }
        });
      } catch (e) {
        console.error("Error loading available roles:", e);
      }
    };
    fetchRoles();
  }, []);

  // Helper to fetch and reload organizers dynamically with event name lookups
  const reloadOrganizers = async () => {
    try {
      const eventsSnap = await apiFetchEvents();
      setActiveProjectsCount((eventsSnap || []).length);
      const eventsLookup: { [id: string]: string } = {};
      const eventsList: string[] = [];
      (eventsSnap || []).forEach((d: any) => {
        const id = d._id || d.id || "";
        const title = d.title || d.name || "";
        if (title) {
          eventsLookup[id] = title;
          eventsList.push(title);
        }
      });
      if (eventsList.length === 0) {
        eventsList.push("AI Ethics Summit", "Neural Hackathon", "Quantum Workshop", "Deep Learning Symposium");
      }

      const usersSnap = await apiFetchUsers();
      const pendingUsersCount = (usersSnap || []).filter((u: any) => {
        const status = (u.status || "").toString();
        return status.toLowerCase() === "pending";
      }).length;
      setPendingCount(pendingUsersCount);

      const querySnapshot = await fetchOrganizers();
      const list: Organizer[] = [];
      (querySnapshot || []).forEach((docSnap: any) => {
        const data = docSnap || {};
        const roleTypeLower = (data.roleType || "").toLowerCase();
        const emailLower = (data.email || "").toLowerCase().trim();
        const isFaculty = roleTypeLower.includes("faculty") || emailLower.includes("faculty") || emailLower === "admin@aiverse.in";

        if (!isFaculty) {
          const count = parseInt(data.events) || data.eventsCount || 4;
          
          let names: string[] = [];
          if (Array.isArray(data.assignedEvents)) {
            names = data.assignedEvents;
          } else if (typeof data.events === "string" && data.events.includes(",")) {
            names = data.events.split(",").map((s: string) => s.trim());
          } else {
            names = eventsList.slice(0, count);
          }

          list.push({
            id: docSnap.id || docSnap._id || "",
            name: data.name || "Unnamed",
            email: data.email || "",
            eventsCount: count,
            eventNames: names,
            successRate: parseInt(data.success) || data.successRate || 92,
            xp: data.xp || 1500,
            badge: data.badge || "ELITE",
            image: data.image || "",
            username: data.username || data.email || "",
            tempPassword: data.tempPassword || ""
          });
        }
      });

      setOrganizers(list);
    } catch (err) {
      console.error("Error reloading organizers:", err);
    }
  };

  // Fetch real organizers to replace static sample data
  useEffect(() => {
    reloadOrganizers();
  }, []);

  // Fetch selection data when form is active
  useEffect(() => {
    if (showAddOrganizerForm) {
      const fetchUsers = async () => {
        try {
          const mergedList: any[] = [];
          const seenEmails = new Set<string>();

          // 1. Fetch from Supabase
          try {
            const supaUsers = await userService.getUsers();
            if (supaUsers && supaUsers.length > 0) {
              supaUsers.forEach(u => {
                const emailKey = (u.email || "").toLowerCase().trim();
                if (emailKey && !seenEmails.has(emailKey)) {
                  seenEmails.add(emailKey);
                  mergedList.push({
                    id: u.id,
                    name: u.name || u.display_name || u.email?.split("@")[0] || "User",
                    displayName: u.display_name || u.name,
                    email: u.email,
                    role: u.role || "Member",
                    position: u.position || u.role || "Member",
                    image: u.image || "",
                    phone: u.phone || "",
                    status: u.status || "Active"
                  });
                }
              });
            }
          } catch (supaErr) {
            console.warn("Supabase fetch users notice in OrganizerManagement:", supaErr);
          }

          // 2. Fetch from backend users
          try {
            const snap = await apiFetchUsers();
            (snap || []).forEach((d: any) => {
              const data = d || {};
              const emailKey = (data.email || "").toLowerCase().trim();
              if (emailKey && !seenEmails.has(emailKey)) {
                seenEmails.add(emailKey);
                mergedList.push({
                  id: data.id || data._id || "",
                  name: data.name || data.displayName || data.teamLeadName || data.email?.split("@")[0] || "User",
                  displayName: data.displayName || data.name,
                  email: data.email,
                  role: data.role || data.roleType || "Member",
                  position: data.position || data.displayRole || data.role || "Member",
                  image: data.image || "",
                  phone: data.phoneNumber || data.phone || "",
                  status: data.status || "Active"
                });
              }
            });
          } catch (fsErr) {
            console.warn("Backend fetch users notice in OrganizerManagement:", fsErr);
          }

          mergedList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          setAllUsers(mergedList);
        } catch (e) {
          console.error("Error fetching users:", e);
        }
      };
      const fetchEvents = async () => {
        try {
          const snap = await apiFetchEvents();
          const list: any[] = [];
          (snap || []).forEach((d: any) => list.push({ id: d._id || d.id || "", ...d }));
          setAllEvents(list);
        } catch (e) {
          console.error("Error fetching events:", e);
        }
      };
      fetchUsers();
      fetchEvents();
    }
  }, [showAddOrganizerForm]);

  const selectUser = (u: any) => {
    setSelectedUserId(u.id);
    setFormUsername(u.email || "");
    const generatedPass = Math.random().toString(36).slice(-8) + "@AI";
    setFormTempPassword(generatedPass);
    setFormConfirmTempPassword(generatedPass);
  };

  const handleCreateOrganizerSubmit = async () => {
    if (!selectedUserId) {
      alert("Please select a team member first!");
      return;
    }
    if (!formTempPassword || !formConfirmTempPassword) {
      alert("Password fields cannot be empty!");
      return;
    }
    if (formTempPassword !== formConfirmTempPassword) {
      alert("Passwords do not match!");
      return;
    }

    // Validate that formUsername is a valid email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formUsername)) {
      alert("The Username field must be a valid email address (e.g. name@uni.edu) for authentication.");
      return;
    }

    const selectedUser = allUsers.find(u => u.id === selectedUserId);
    if (!selectedUser) return;

    try {
      // 1. Update user profile in MongoDB users collection
      try {
        const existingUser = await userService.getUserByEmail(formUsername);
        if (!existingUser) {
          await userService.addUser({
            email: formUsername,
            name: selectedUser.name,
            role: "organizer",
            position: "student Organizer",
            status: "Active",
            image: selectedUser.image || ""
          });
        } else {
          await userService.updateUser(existingUser.id, {
            role: "organizer",
            position: "student Organizer",
            status: "Active"
          });
        }
      } catch (profileErr) {
        console.warn("MongoDB user profile update notice:", profileErr);
      }

      const assignedNames: string[] = [];
      assignedEventIds.forEach(id => {
        const found = allEvents.find(e => e.id === id);
        if (found) {
          assignedNames.push(found.title || found.name);
        }
      });
      if (assignedNames.length === 0 && assignedEventIds.length > 0) {
        assignedEventIds.forEach(id => {
          if (id === "1") assignedNames.push("AI Ethics Global Summit 2024");
          if (id === "2") assignedNames.push("Neural Hackathon: Next Gen");
          if (id === "3") assignedNames.push("Quantum Computing Workshop");
        });
      }

      const payload = {
        name: selectedUser.name,
        email: selectedUser.email,
        roleType: "Organizer",
        position: "student Organizer",
        bio: "Dedicated event manager delegating event responsibilities.",
        image: selectedUser.image || "",
        events: String(assignedEventIds.length).padStart(2, "0"),
        assignedEvents: assignedNames,
        success: "95%",
        username: formUsername,
        tempPassword: formTempPassword,
        createdAt: Date.now()
      };
      await addDoc(collection(db, "organizers"), payload);

      if (newUid) {
        // Create user document at the new Supabase Auth UID
        const newUserRef = doc(db, "users", newUid);
        await setDoc(newUserRef, {
          name: selectedUser.name,
          email: selectedUser.email,
          role: "student Organizer",
          status: "Active",
          image: selectedUser.image || ""
        });

        // Delete the old user document at the temporary random ID if they are different
        if (selectedUserId !== newUid) {
          try {
            await deleteDoc(doc(db, "users", selectedUserId));
          } catch (delErr) {
            console.error("Error deleting old temp user document:", delErr);
          }
        }
      } else {
        // They already had an auth account, so selectedUserId is their real UID. Update it.
        const userRef = doc(db, "users", selectedUserId);
        await setDoc(userRef, { role: "student Organizer" }, { merge: true });
      }

      alert("Organizer successfully created!");
      setShowAddOrganizerForm(false);
      setSelectedUserId(null);
      setAssignedEventIds([]);

      await reloadOrganizers();
    } catch (e: any) {
      console.error("Error creating organizer:", e);
      alert("Failed to create organizer: " + (e?.message || e));
    }
  };

  const handleDeleteOrganizer = async (id: string, email: string) => {
    if (!window.confirm("Are you sure you want to delete this organizer?")) return;
    try {
      // 1. Delete organizer profile doc from Firestore 'organizers' collection
      const docRef = doc(db, "organizers", id);
      await deleteDoc(docRef);

      // 2. Reset target user account role in 'users' collection to default role (e.g. member/Volunteer)
      const usersSnap = await getDocs(collection(db, "users"));
      let targetUserId = "";
      usersSnap.forEach(uDoc => {
        if (uDoc.data().email === email) {
          targetUserId = uDoc.id;
        }
      });
      if (targetUserId) {
        await setDoc(doc(db, "users", targetUserId), { role: "member" }, { merge: true });
      }

      alert("Organizer successfully deleted!");
      setActiveMenuId(null);
      await reloadOrganizers();
    } catch (err) {
      console.error("Error deleting organizer:", err);
      alert("Failed to delete organizer.");
    }
  };

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
    const match = rolesList.find(r => r.toLowerCase() === dbRoleLower);
    if (match) return match;
    return dbRole;
  };

  const filteredSelectionUsers = useMemo(() => {
    return allUsers.filter(u => {
      const uRole = (u.role || u.roleType || "").toLowerCase();
      const uEmail = (u.email || "").toLowerCase().trim();
      const isFaculty = uRole.includes("faculty") || uEmail.includes("faculty") || uEmail === "admin@aiverse.in";
      if (isFaculty) return false;
      return (u.name || "").toLowerCase().includes(searchUserQuery.toLowerCase()) ||
             (u.email || "").toLowerCase().includes(searchUserQuery.toLowerCase());
    });
  }, [allUsers, searchUserQuery]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;



  // Filtered organizers
  const filteredOrganizers = useMemo(() => {
    return organizers.filter(org => 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [organizers, searchQuery]);

  // Paginated organizers
  const paginatedOrganizers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrganizers.slice(start, start + itemsPerPage);
  }, [filteredOrganizers, currentPage]);

  const totalPages = Math.ceil(filteredOrganizers.length / itemsPerPage) || 1;

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Handlers
  const handleAddOrganizer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    // Determine badge and XP based on success rate for mock purposes
    let badge = "RISING STAR";
    let xp = 1000 + newEvents * 100;
    if (newSuccess >= 95) {
      badge = "CHAMPION";
      xp += 500;
    } else if (newSuccess >= 90) {
      badge = "ELITE";
      xp += 300;
    }

    const newOrg: Organizer = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: newName,
      email: newEmail,
      eventsCount: Number(newEvents),
      successRate: Number(newSuccess),
      xp,
      badge
    };

    setOrganizers([newOrg, ...organizers]);

    // Log achievement automatically
    const newAch: Achievement = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      time: "Just now",
      title: `${newName} joined as Organizer`,
      description: "Successfully onboarded to AI Verse.",
      color: "bg-blue-600"
    };
    setAchievements([newAch, ...achievements]);

    // Clear form
    setNewName("");
    setNewEmail("");
    setIsAddModalOpen(false);
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
        title={showAddOrganizerForm ? "Add New Organizer - Faculty Portal" : "Organizer Management - Faculty Portal"}
        description="Oversee club leadership, manage student organizers, and monitor performance metrics across all departments."
      />

      {!showAddOrganizerForm ? (
        <>
          {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Organizer Management</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl font-medium leading-relaxed">
            Oversee club leadership, manage student organizers, and monitor performance metrics 
            across all departments within Azure Intelligence.
          </p>
        </div>

      </div>

      {/* ================= METRICS CARDS (COMPACT THEME WITH LEFT COLOR BORDERS) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Organizers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border-l-4 border-l-blue-500 flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Organizers</span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                {organizers.length.toString().padStart(2, "0")}
              </h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                +12%
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-3">Active this semester</p>
        </div>

        {/* Pending Applications */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border-l-4 border-l-amber-500 flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pending Applications</span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                {pendingCount.toString().padStart(2, "0")}
              </h3>
              <span className="text-[8px] font-extrabold text-amber-700 bg-[#FEF3C7] px-1.5 py-0.5 rounded uppercase tracking-wider">
                Urgent
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-3">Review required</p>
        </div>

        {/* Active Projects */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border-l-4 border-l-indigo-600/90 flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Projects</span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                {activeProjectsCount.toString().padStart(2, "0")}
              </h3>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-3">Ongoing initiatives</p>
        </div>


      </div>

      {/* ================= CONTENT GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Organizer Directory (Full Width) */}
        <div className="lg:col-span-12 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden text-left">
            {/* Card Header with search & filters */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-800 tracking-tight">Organizer Directory</h3>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search organizers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-700 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                  />
                </div>
                <button
                  onClick={() => alert("Downloading directory data...")}
                  className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
                  title="Export List"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Table wrapper */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50/70 text-[9px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100">
                  <tr>
                    <th scope="col" className="px-6 py-3">Organizer</th>
                    <th scope="col" className="px-6 py-3">Events</th>
                    <th scope="col" className="px-6 py-3">Login Credentials</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedOrganizers.length > 0 ? (
                    paginatedOrganizers.map(org => {
                      return (
                        <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Organizer Info */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {org.image ? (
                                <img
                                  src={org.image}
                                  alt={org.name}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-100"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-xs text-slate-500">
                                  {org.name.split(" ").map(n => n[0]).join("")}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-800 text-xs leading-normal">{org.name}</div>
                                <div className="text-[10px] text-slate-400 font-medium">{org.email}</div>
                              </div>
                            </div>
                          </td>




                          {/* Assigned Event Names */}
                          <td className="px-6 py-3.5 text-xs text-slate-800">
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {(org.eventNames || []).map((evName, idx) => (
                                <span 
                                  key={idx} 
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap"
                                >
                                  {evName}
                                </span>
                              ))}
                              {(!org.eventNames || org.eventNames.length === 0) && (
                                <span className="text-slate-400 font-semibold italic text-[10px]">No events</span>
                              )}
                            </div>
                          </td>



                          {/* Login Credentials */}
                          <td className="px-6 py-3.5 whitespace-nowrap text-xs text-slate-800">
                            <div className="leading-tight text-left space-y-1">
                              <div>
                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block">Username</span> 
                                <span className="font-semibold text-slate-700">{org.username || org.email}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block">Password</span> 
                                <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-blue-650">{org.tempPassword || "organizer"}</code>
                              </div>
                            </div>
                          </td>

                          {/* Quick Actions (Three dot menu) */}
                          <td className="px-6 py-3.5 whitespace-nowrap text-right relative font-sans">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === org.id ? null : org.id);
                              }}
                              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-650 rounded-lg transition-colors inline-flex items-center justify-center"
                            >
                              <MoreVertical className="h-4.5 w-4.5" />
                            </button>

                            {activeMenuId === org.id && (
                              <div className="absolute right-6 mt-1 w-32 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-50 text-left ring-1 ring-black/5 animate-in fade-in duration-100">
                                <button
                                  onClick={() => handleDeleteOrganizer(org.id, org.email)}
                                  className="w-full px-4 py-1.5 text-xs font-bold hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-xs font-semibold text-slate-400">
                        No organizers found matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-150/50 bg-slate-50/40 flex items-center justify-between gap-4">
              <div className="text-[10px] text-slate-400 font-bold tracking-tight">
                Showing {Math.min(filteredOrganizers.length, itemsPerPage)} of {filteredOrganizers.length} organizers
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 font-bold hover:bg-slate-50 transition-all ${currentPage === 1 ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 text-xs border border-[#2563EB] rounded-lg bg-[#2563EB] text-white font-bold hover:bg-blue-700 transition-all ${currentPage === totalPages ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* ================= ADD NEW ORGANIZER MODAL ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800">
                <Plus className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold">Add Student Organizer</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddOrganizer} className="p-6 space-y-4 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivers"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. a.rivers@uni.edu"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                />
              </div>



              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Events Managed</label>
                  <input
                    type="number"
                    min="0"
                    value={newEvents}
                    onChange={(e) => setNewEvents(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Success Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newSuccess}
                    onChange={(e) => setNewSuccess(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
                >
                  Add Organizer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      ) : (
        /* ================= STEPPER ADD ORGANIZER VIEW (INLINE) ================= */
        <div className="space-y-6 animate-in fade-in duration-200 text-left">
          
          {/* Nav Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                <span>User Management</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-blue-600">Add New Organizer</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Add New Organizer</h1>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl font-medium leading-relaxed">
                Create a new administrative role to delegate event management responsibilities.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
              <button
                onClick={() => setShowAddOrganizerForm(false)}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-sm transition-all shadow-sm bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrganizerSubmit}
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
              >
                Create Organizer
              </button>
            </div>
          </div>

          {/* Content Split columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form Cards Stack */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Step 1: Select Team Member Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-50 mb-6">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-slate-800">Select Team Member</h3>
                  </div>
                  
                  {/* Inner filter */}
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Filter by name..."
                      value={searchUserQuery}
                      onChange={(e) => setSearchUserQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-850 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-1">
                  {filteredSelectionUsers.map((u) => {
                    const isSelected = selectedUserId === u.id;
                    const initials = (u.name || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                    return (
                      <div
                        key={u.id}
                        onClick={() => selectUser(u)}
                        className={`p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${isSelected ? 'border-blue-600 bg-blue-50/20' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          {u.image ? (
                            <img src={u.image} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-slate-150" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs border border-slate-150">
                              {initials}
                            </div>
                          )}
                          <div className="text-left">
                            <h4 className="text-sm font-bold text-slate-855">{u.name}</h4>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">{getDisplayRole(u.role, availableRoles)}</p>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />}
                      </div>
                    );
                  })}
                  {filteredSelectionUsers.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-slate-400 font-medium text-sm">
                      No team members found.
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Assign Events Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] text-left">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-50 mb-6">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-slate-800">Assign Events</h3>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const list = allEvents.length > 0 ? allEvents : [
                      { id: "1", title: "AI Ethics Global Summit 2024", timeline: "Oct 12-14", location: "Grand Ballroom", badge: "PRIORITY" },
                      { id: "2", title: "Neural Hackathon: Next Gen", timeline: "Nov 05", location: "Innovation Lab", badge: "PRIORITY" },
                      { id: "3", title: "Quantum Computing Workshop", timeline: "Dec 01", location: "Physics Block", badge: "PLANNING" }
                    ];
                    return list.map((ev) => {
                      const isChecked = assignedEventIds.includes(ev.id);
                      return (
                        <div
                          key={ev.id}
                          onClick={() => {
                            setAssignedEventIds(prev => 
                              isChecked ? prev.filter(id => id !== ev.id) : [...prev, ev.id]
                            );
                          }}
                          className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 ${isChecked ? 'border-blue-100 bg-blue-50/10' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="w-4 h-4 rounded text-blue-600 border-slate-200 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="text-left">
                              <h4 className="text-sm font-bold text-slate-800">{ev.title}</h4>
                              <p className="text-slate-400 text-xs mt-0.5 font-medium">{ev.timeline || ev.date} • {ev.location || ev.venue || "Online"}</p>
                            </div>
                          </div>
                          {ev.badge && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ev.badge === 'PRIORITY' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-150'}`}>
                              {ev.badge}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Step 3: Set Credentials Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] text-left">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-50 mb-6">
                  <Lock className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-slate-800">Account Credentials</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Username</label>
                    <input
                      type="text"
                      placeholder="e.g. arjun_varma_ai"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Temporary Password</label>
                    <input
                      type="text"
                      placeholder="••••••••••••"
                      value={formTempPassword}
                      onChange={(e) => setFormTempPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confirm Password</label>
                    <input
                      type="text"
                      placeholder="••••••••••••"
                      value={formConfirmTempPassword}
                      onChange={(e) => setFormConfirmTempPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-slate-700">Email Login Details</h4>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">Send setup credentials to their registered email automatically.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmailToggle}
                      onChange={() => setSendEmailToggle(!sendEmailToggle)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

            </div>

            {/* Sidebar Guide */}
            <div className="space-y-6">
              
              {/* Guidelines */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] text-left">
                <h3 className="text-sm font-bold text-slate-855 flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                  <SlidersHorizontal className="h-4.5 w-4.5 text-blue-600" />
                  Organizer Guidelines
                </h3>

                <div className="space-y-4 text-slate-600 text-xs leading-relaxed font-medium">
                  <div>
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Responsibilities</h4>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Manage participant registrations and attendance.</li>
                      <li>Update event schedule, speakers, and venue details.</li>
                      <li>Communicate with attendees via portal announcements.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Permissions</h4>
                    <p>Organizers have <strong>Editor-level</strong> access to assigned events. They cannot delete global events or modify settings.</p>
                  </div>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="bg-[#0F172A] p-6 rounded-3xl text-left text-white relative overflow-hidden shadow-xl border border-slate-800">
                <h3 className="text-sm font-bold flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 text-slate-100">
                  <Trophy className="h-4.5 w-4.5 text-blue-400" />
                  Active Sessions
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed font-medium">
                  Currently, there are {organizers.filter(o => o.eventsCount > 0).length} active organizers managing upcoming events.
                </p>
                
                <div className="flex items-center gap-1.5 mt-4">
                  {organizers.slice(0, 4).map((org) => {
                    const init = org.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                    return org.image ? (
                      <img key={org.id} src={org.image} alt={org.name} className="w-8 h-8 rounded-full border border-slate-800 object-cover" />
                    ) : (
                      <div key={org.id} className="w-8 h-8 rounded-full bg-slate-800 text-slate-350 border border-slate-750 flex items-center justify-center text-[10px] font-bold">
                        {init}
                      </div>
                    );
                  })}
                  {organizers.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold border border-slate-800">
                      +{organizers.length - 4}
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerManagementPage;
