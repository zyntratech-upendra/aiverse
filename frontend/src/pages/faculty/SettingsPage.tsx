import React, { useState, useEffect } from "react";
import SEO from "../../components/layout/SEO";
import Button from "../../components/ui/Button";
import { db } from "../../config/firebase";
import { supabase } from "../../config/supabase";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { 
  Globe, 
  Palette, 
  Settings, 
  Share2, 
  Bell, 
  AlertCircle, 
  X, 
  Upload, 
  Lock, 
  Save, 
  Archive,
  CheckCircle2,
  Trash2,
  Settings2,
  FileArchive,
  Award,
  Eye,
  EyeOff,
  Key,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  Edit3,
  Check,
  RotateCcw,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "info" | "warning" | "error";
}

interface PortalConfig {
  websiteName: string;
  tagline: string;
  contactEmail: string;
  officeLocation: string;
  logoFilename: string;
  primaryColor: string;
  fontFamily: string;
  maintenanceMode: boolean;
  publicRegistration: boolean;
  pinnedAnnouncements: boolean;
  twitter: string;
  github: string;
  linkedin: string;
  discord: string;
  notifyNewRegistrations: boolean;
  notifyEventSubmissions: boolean;
  notifySecurityThresholds: boolean;
  availableRoles: string[];
  juryPortalActive: boolean;
  activeJuryEventId?: string;
  activeJuryEventTitle?: string;
}

const SettingsPage: React.FC = () => {
  // Saved default configurations (to support Discard & Reset)
  const defaultConfigs: PortalConfig = {
    websiteName: "AI Excellence Club Portal",
    tagline: "Empowering Innovation",
    contactEmail: "contact@aiexcellence.edu",
    officeLocation: "Innovation Hub, Room 402, North Campus Engineering Block",
    logoFilename: "ai_excellence_logo_v2.png",
    primaryColor: "#0B4AC6",
    fontFamily: "Plus Jakarta Sans (Modern)",
    maintenanceMode: false,
    publicRegistration: true,
    pinnedAnnouncements: false,
    twitter: "twitter.com/aiexcellence",
    github: "github.com/aiexcellence-club",
    linkedin: "linkedin.com/school/ai-excellence",
    discord: "discord.gg/invite_code",
    notifyNewRegistrations: true,
    notifyEventSubmissions: true,
    notifySecurityThresholds: true,
    availableRoles: ["Faculty Coordinator", "Student Lead", "Organizer", "Volunteer"],
    juryPortalActive: true,
    activeJuryEventId: "ALL_EVENTS",
    activeJuryEventTitle: "All Events"
  };

  // Real events list fetched from Firestore for Jury Control selector
  const [dbEventsList, setDbEventsList] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsSnap = await getDocs(collection(db, "events"));
        if (!eventsSnap.empty) {
          const list = eventsSnap.docs
            .map(docSnap => ({
              id: docSnap.id,
              title: docSnap.data().title || "Unnamed Event",
              status: docSnap.data().status || "Active"
            }))
            .filter(e => {
              const s = (e.status || "").toLowerCase();
              return !s.includes("completed") && !s.includes("finished") && !s.includes("archive");
            });
          setDbEventsList(list);
        }
      } catch (err) {
        console.error("Error loading events for Jury Control:", err);
      }
    };
    fetchEvents();
  }, []);

  // State configurations
  const [savedConfig, setSavedConfig] = useState<PortalConfig>(defaultConfigs);
  const [currentConfig, setCurrentConfig] = useState<PortalConfig>(defaultConfigs);
  
  // Interactive UI states
  const [toastQueue, setToastQueue] = useState<ToastMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  
  // Authentication & Password Change State
  const { user, updateUserPassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Modals state
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [editingRoleIndex, setEditingRoleIndex] = useState<number | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState("");

  // Toast trigger helper
  const addToast = (text: string, type: ToastMessage["type"] = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToastQueue(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToastQueue(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Password update handler for Super Admin
  const handleUpdatePassword = async () => {
    setPasswordError("");

    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match. Please re-check.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // 1. Update through AuthContext helper
      if (updateUserPassword) {
        await updateUserPassword(newPassword);
      }

      // 2. Direct Supabase Auth update
      try {
        await supabase.auth.updateUser({ password: newPassword });
      } catch (err) {
        console.warn("Supabase auth direct password update:", err);
      }

      // 3. Update Firestore users collection for the admin email
      const adminEmail = (user?.email || "admin@aiverse.in").toLowerCase().trim();
      const docId = adminEmail.replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, "users", docId), {
        password: newPassword,
        requiresPasswordChange: false,
        updatedAt: Date.now()
      }, { merge: true });

      // Also update mock user in localStorage
      const savedUserStr = localStorage.getItem("aether_mock_user");
      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          u.requiresPasswordChange = false;
          localStorage.setItem("aether_mock_user", JSON.stringify(u));
        } catch (e) {}
      }

      setNewPassword("");
      setConfirmPassword("");
      addToast("Super Admin password updated successfully!", "success");
    } catch (err: any) {
      console.error("Error updating password:", err);
      setPasswordError(err?.message || "Failed to update password. Please try again.");
      addToast(err?.message || "Failed to update password.", "error");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Fetch settings from Firestore on mount
  useEffect(() => {
    const fetchPortalSettings = async () => {
      try {
        const docRef = doc(db, "settings", "portal_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fetchedData = docSnap.data() as PortalConfig;
          const mergedConfig = { ...defaultConfigs, ...fetchedData };
          setSavedConfig(mergedConfig);
          setCurrentConfig(mergedConfig);
        } else {
          // If document does not exist, save the default config to Firestore
          await setDoc(docRef, defaultConfigs);
          setSavedConfig(defaultConfigs);
          setCurrentConfig(defaultConfigs);
        }
      } catch (err) {
        console.error("Error loading settings from Firestore:", err);
        addToast("Failed to load settings from database. Using local defaults.", "warning");
      }
    };

    fetchPortalSettings();
  }, []);

  // Form value change handler
  const handleChange = (key: keyof PortalConfig, value: any) => {
    setCurrentConfig(prev => ({ ...prev, [key]: value }));
  };

  // Toggle switch handler with immediate Toast feedback
  const handleToggle = (key: keyof PortalConfig, label: string) => {
    const nextVal = !currentConfig[key];
    handleChange(key, nextVal);
    addToast(
      `${label} is now ${nextVal ? "ENABLED" : "DISABLED"}.`,
      nextVal ? "success" : "warning"
    );
  };

  const handleAddRole = () => {
    const trimmed = newRoleInput.trim();
    if (!trimmed) return;
    const currentRoles = currentConfig.availableRoles || ["Faculty Coordinator", "Student Lead", "Organizer", "Volunteer"];
    if (currentRoles.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
      addToast("Role already exists!", "warning");
      return;
    }
    handleChange("availableRoles", [...currentRoles, trimmed]);
    setNewRoleInput("");
    addToast(`"${trimmed}" added to role hierarchy. Save Changes to apply!`, "info");
  };

  const handleRemoveRole = (roleToRemove: string) => {
    if (window.confirm(`Are you sure you want to delete the role: "${roleToRemove}"?`)) {
      const currentRoles = currentConfig.availableRoles || ["Faculty Coordinator", "Student Lead", "Organizer", "Volunteer"];
      const nextRoles = currentRoles.filter(r => r !== roleToRemove);
      handleChange("availableRoles", nextRoles);
      addToast(`"${roleToRemove}" removed.`, "warning");
    }
  };

  const handleMoveRoleUp = (index: number) => {
    if (index <= 0) return;
    const currentRoles = [...(currentConfig.availableRoles || [])];
    const temp = currentRoles[index - 1];
    currentRoles[index - 1] = currentRoles[index];
    currentRoles[index] = temp;
    handleChange("availableRoles", currentRoles);
    addToast(`Moved "${currentRoles[index - 1]}" to Position #${index}. Save Changes to apply!`, "info");
  };

  const handleMoveRoleDown = (index: number) => {
    const currentRoles = [...(currentConfig.availableRoles || [])];
    if (index >= currentRoles.length - 1) return;
    const temp = currentRoles[index + 1];
    currentRoles[index + 1] = currentRoles[index];
    currentRoles[index] = temp;
    handleChange("availableRoles", currentRoles);
    addToast(`Moved "${currentRoles[index + 1]}" to Position #${index + 2}. Save Changes to apply!`, "info");
  };

  const handleSaveEditRole = (index: number) => {
    const trimmed = editingRoleValue.trim();
    if (!trimmed) {
      addToast("Role name cannot be empty.", "warning");
      return;
    }
    const currentRoles = [...(currentConfig.availableRoles || [])];
    currentRoles[index] = trimmed;
    handleChange("availableRoles", currentRoles);
    setEditingRoleIndex(null);
    setEditingRoleValue("");
    addToast(`Role renamed to "${trimmed}". Save Changes to apply!`, "info");
  };

  const handleResetDefaultRoles = () => {
    if (window.confirm("Reset all roles to the recommended default hierarchy?")) {
      const defaultRolesList = [
        "Faculty Coordinators",
        "Student Leads",
        "Technical",
        "Design",
        "Content and Media",
        "Video and Photography",
        "Logistics and Operations",
        "PR and HR",
        "Event Management",
        "Student Organizers",
        "Volunteers"
      ];
      handleChange("availableRoles", defaultRolesList);
      addToast("Roles reset to standard hierarchy. Click Save Changes to apply!", "info");
    }
  };

  // Save Portal Configurations
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate email
    if (!currentConfig.contactEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      addToast("Please enter a valid contact email address", "error");
      return;
    }

    setIsSaving(true);
    addToast("Saving portal configurations to Firestore...", "info");

    try {
      const docRef = doc(db, "settings", "portal_config");
      await setDoc(docRef, currentConfig);
      setSavedConfig(currentConfig);
      addToast("Portal configurations updated successfully!");
    } catch (err) {
      console.error("Error writing settings to Firestore:", err);
      addToast("Failed to save configurations to Firestore.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Discard Changes
  const handleDiscardChanges = () => {
    setIsDiscarding(true);
    addToast("Reverting current modifications...", "info");

    setTimeout(() => {
      setCurrentConfig(savedConfig);
      setIsDiscarding(false);
      addToast("Form changes discarded successfully.", "info");
    }, 800);
  };

  // Archive Semester Simulation
  const handleArchiveSemester = () => {
    setIsArchiving(true);
    addToast("Freezing Fall 2023 semester historical records...", "info");

    setTimeout(() => {
      setIsArchiving(false);
      setIsArchiveModalOpen(false);
      addToast("Fall 2023 semester data frozen & archived successfully!");
    }, 1500);
  };

  // Reset Portal Configuration to system defaults
  const handleResetPortal = async () => {
    setIsResetting(true);
    addToast("Restoring settings to factory defaults in Firestore...", "info");

    try {
      const docRef = doc(db, "settings", "portal_config");
      await setDoc(docRef, defaultConfigs);
      setCurrentConfig(defaultConfigs);
      setSavedConfig(defaultConfigs);
      addToast("All configurations restored to system defaults.");
    } catch (err) {
      console.error("Error resetting settings in Firestore:", err);
      addToast("Failed to reset configurations in Firestore.", "error");
    } finally {
      setIsResetting(false);
      setIsResetModalOpen(false);
    }
  };

  // Simulate Logo Upload
  const handleLogoUploadClick = () => {
    addToast("Selecting new club logo file...", "info");
    setTimeout(() => {
      const mockLogoName = `logo_excellence_${Math.floor(Math.random() * 900) + 100}.png`;
      handleChange("logoFilename", mockLogoName);
      addToast(`Logo file "${mockLogoName}" uploaded successfully.`);
    }, 1000);
  };

  return (
    <div className="space-y-6 text-left relative">
      <SEO 
        title="Portal Configuration - Settings Dashboard" 
        description="Configure general settings, brand visual identity, operation modes, notifications toggles, and Superadmin danger zone credentials." 
        keywords="AI Verse settings portal, brand customizers, database archivers"
      />

      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toastQueue.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-4 rounded-xl shadow-lg flex items-center gap-3 border text-sm font-semibold 
                ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : ""}
                ${toast.type === "info" ? "bg-blue-50 border-blue-200 text-blue-800" : ""}
                ${toast.type === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : ""}
                ${toast.type === "error" ? "bg-red-50 border-red-200 text-red-800" : ""}`}
            >
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header section with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight font-sans">Settings</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Manage global parameters and visual identity of the AI Excellence Club portal.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button 
            variant="outline" 
            size="md" 
            onClick={handleDiscardChanges}
            disabled={isSaving || isDiscarding}
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold"
          >
            Discard Changes
          </Button>
          <Button 
            variant="primary" 
            size="md" 
            onClick={() => handleSaveConfig()}
            isLoading={isSaving}
            className="bg-[#2563EB] hover:bg-blue-700 text-white flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Main Grid: Portal Configuration (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: General, Operations, Notifications (7 / 12) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card 1: General Settings */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card text-left space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Globe className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">General Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Website Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Website Name</label>
                  <input
                    type="text"
                    required
                    value={currentConfig.websiteName}
                    onChange={(e) => handleChange("websiteName", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50"
                  />
                </div>

                {/* Tagline */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tagline</label>
                  <input
                    type="text"
                    required
                    value={currentConfig.tagline}
                    onChange={(e) => handleChange("tagline", e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50"
                  />
                </div>
              </div>

              {/* Contact Email Address */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Contact Email Address</label>
                <input
                  type="email"
                  required
                  value={currentConfig.contactEmail}
                  onChange={(e) => handleChange("contactEmail", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50"
                />
              </div>

              {/* Office Location */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Office Location</label>
                <textarea
                  rows={2}
                  required
                  value={currentConfig.officeLocation}
                  onChange={(e) => handleChange("officeLocation", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Operations */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card text-left space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Settings className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Operations</h2>
            </div>

            <div className="space-y-4">
              {/* Maintenance Mode */}
              <div className="flex items-center justify-between py-1 hover:bg-slate-50/50 rounded-lg transition-colors px-2">
                <div className="text-left leading-tight">
                  <h4 className="text-xs font-bold text-slate-800">Maintenance Mode</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Show maintenance page to public
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("maintenanceMode", "Maintenance Mode")}
                  className={`w-9 h-5.5 flex items-center rounded-full p-1 transition-colors cursor-pointer outline-none
                    ${currentConfig.maintenanceMode ? "bg-[#2563EB]" : "bg-slate-200"}`}
                >
                  <div className={`bg-white w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 
                    ${currentConfig.maintenanceMode ? "translate-x-3.5" : "translate-x-0"}`} 
                  />
                </button>
              </div>

              {/* Public Registration */}
              <div className="flex items-center justify-between py-1 hover:bg-slate-50/50 rounded-lg transition-colors px-2">
                <div className="text-left leading-tight">
                  <h4 className="text-xs font-bold text-slate-800">Public Registration</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Allow new students to sign up
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("publicRegistration", "Public Registration")}
                  className={`w-9 h-5.5 flex items-center rounded-full p-1 transition-colors cursor-pointer outline-none
                    ${currentConfig.publicRegistration ? "bg-[#2563EB]" : "bg-slate-200"}`}
                >
                  <div className={`bg-white w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 
                    ${currentConfig.publicRegistration ? "translate-x-3.5" : "translate-x-0"}`} 
                  />
                </button>
              </div>

              {/* Pinned Announcements */}
              <div className="flex items-center justify-between py-1 hover:bg-slate-50/50 rounded-lg transition-colors px-2">
                <div className="text-left leading-tight">
                  <h4 className="text-xs font-bold text-slate-800">Pinned Announcements</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Force banner visibility globally
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("pinnedAnnouncements", "Pinned Announcements banner")}
                  className={`w-9 h-5.5 flex items-center rounded-full p-1 transition-colors cursor-pointer outline-none
                    ${currentConfig.pinnedAnnouncements ? "bg-[#2563EB]" : "bg-slate-200"}`}
                >
                  <div className={`bg-white w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 
                    ${currentConfig.pinnedAnnouncements ? "translate-x-3.5" : "translate-x-0"}`} 
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: System Notifications */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card text-left space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Bell className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">System Notifications</h2>
            </div>

            <div className="space-y-4">
              {/* New Registrations */}
              <div className="flex items-center justify-between py-1.5 hover:bg-slate-50/50 rounded-xl transition-colors px-3 border border-slate-100">
                <div className="text-left leading-tight">
                  <h4 className="text-xs font-bold text-slate-800">New Registrations</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Receive email alert when a student joins
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("notifyNewRegistrations", "New Registrations alerts")}
                  className={`w-9 h-5.5 flex items-center rounded-full p-1 transition-colors cursor-pointer outline-none
                    ${currentConfig.notifyNewRegistrations ? "bg-[#2563EB]" : "bg-slate-200"}`}
                >
                  <div className={`bg-white w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 
                    ${currentConfig.notifyNewRegistrations ? "translate-x-3.5" : "translate-x-0"}`} 
                  />
                </button>
              </div>

              {/* Event Submissions */}
              <div className="flex items-center justify-between py-1.5 hover:bg-slate-50/50 rounded-xl transition-colors px-3 border border-slate-100">
                <div className="text-left leading-tight">
                  <h4 className="text-xs font-bold text-slate-800">Event Submissions</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Alert when a proposal requires review
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("notifyEventSubmissions", "Event Submissions alerts")}
                  className={`w-9 h-5.5 flex items-center rounded-full p-1 transition-colors cursor-pointer outline-none
                    ${currentConfig.notifyEventSubmissions ? "bg-[#2563EB]" : "bg-slate-200"}`}
                >
                  <div className={`bg-white w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 
                    ${currentConfig.notifyEventSubmissions ? "translate-x-3.5" : "translate-x-0"}`} 
                  />
                </button>
              </div>

              {/* Security Thresholds */}
              <div className="flex items-center justify-between py-1.5 hover:bg-slate-50/50 rounded-xl transition-colors px-3 border border-slate-100">
                <div className="text-left leading-tight">
                  <h4 className="text-xs font-bold text-slate-800">Security Thresholds</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Alert for multiple failed login attempts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("notifySecurityThresholds", "Security Thresholds warnings")}
                  className={`w-9 h-5.5 flex items-center rounded-full p-1 transition-colors cursor-pointer outline-none
                    ${currentConfig.notifySecurityThresholds ? "bg-[#2563EB]" : "bg-slate-200"}`}
                >
                  <div className={`bg-white w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 
                    ${currentConfig.notifySecurityThresholds ? "translate-x-3.5" : "translate-x-0"}`} 
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Card: Roles & Positions Hierarchy */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card text-left space-y-5">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800">Roles & Positions Hierarchy</h2>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-extrabold border border-blue-100">
                      {(currentConfig.availableRoles || []).length} Roles
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    The top-to-bottom order below dictates the exact sections and order on the Public Team Page.
                  </p>
                </div>
              </div>
            </div>

            {/* Explanatory Banner */}
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2.5">
              <div className="p-1 bg-blue-100 text-blue-600 rounded-lg shrink-0 mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs text-blue-900 font-medium leading-relaxed">
                Use the <strong>Up (↑)</strong> and <strong>Down (↓)</strong> arrows to rearrange roles. Position #1 will appear at the top of the <strong>Public Team page</strong>, followed in sequential order.
              </p>
            </div>

            <div className="space-y-4">
              {/* Add New Role */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Lead Coordinator, Technical Lead..."
                  value={newRoleInput}
                  onChange={(e) => setNewRoleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddRole();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddRole}
                  className="px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>+ Add Role</span>
                </button>
              </div>

              {/* Roles List - Full View with Up/Down/Edit/Delete */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Role Display Order (#1 = Top Section on Team Page)
                  </label>
                  <button
                    type="button"
                    onClick={handleResetDefaultRoles}
                    className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Reset to recommended default order"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {(currentConfig.availableRoles || []).map((role, index) => {
                    const isFirst = index === 0;
                    const isLast = index === (currentConfig.availableRoles || []).length - 1;
                    const isEditing = editingRoleIndex === index;

                    return (
                      <div
                        key={`${role}-${index}`}
                        className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Left: Position Rank & Role Name */}
                        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-black flex items-center justify-center shrink-0 border border-blue-100">
                            {index + 1}
                          </span>
                          
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingRoleValue}
                                onChange={(e) => setEditingRoleValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEditRole(index);
                                  if (e.key === "Escape") setEditingRoleIndex(null);
                                }}
                                autoFocus
                                className="flex-1 px-2.5 py-1 text-xs font-bold text-slate-800 border border-blue-500 rounded-lg bg-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditRole(index)}
                                className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors cursor-pointer"
                                title="Save"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRoleIndex(null)}
                                className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="truncate">
                              <span className="text-xs font-bold text-slate-800 block truncate">
                                {role}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400 block">
                                Section {index + 1} on Public Team Page
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right: Order & Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveRoleUp(index)}
                            disabled={isFirst}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isFirst
                                ? "text-slate-200 border-slate-100 cursor-not-allowed bg-slate-50/50"
                                : "text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                            }`}
                            title="Move Up in Team Page Order"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveRoleDown(index)}
                            disabled={isLast}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isLast
                                ? "text-slate-200 border-slate-100 cursor-not-allowed bg-slate-50/50"
                                : "text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                            }`}
                            title="Move Down in Team Page Order"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingRoleIndex(index);
                              setEditingRoleValue(role);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Rename Role"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveRole(role)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                            title="Delete Role"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {(currentConfig.availableRoles || []).length === 0 && (
                    <div className="px-4 py-8 text-center space-y-2">
                      <p className="text-xs font-bold text-slate-500">No roles configured.</p>
                      <button
                        type="button"
                        onClick={handleResetDefaultRoles}
                        className="text-xs font-bold text-blue-600 underline cursor-pointer"
                      >
                        Click to load recommended roles
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card: Jury Control */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card text-left space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Jury Control</h2>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Control access and active status for the Jury Portal evaluation page.</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Jury Portal Status Toggle */}
              <div className="flex items-center justify-between py-3 px-4 bg-slate-50/60 rounded-2xl border border-slate-100">
                <div className="text-left leading-tight space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-800">Jury Portal Status</h4>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase
                      ${currentConfig.juryPortalActive !== false ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${currentConfig.juryPortalActive !== false ? "bg-emerald-600 animate-pulse" : "bg-red-600"}`}></span>
                      {currentConfig.juryPortalActive !== false ? "ACTIVE" : "DEACTIVATED"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    {currentConfig.juryPortalActive !== false 
                      ? "Jury evaluation page is active. Jurors can log in, view project assignments, and enter evaluation scores." 
                      : "Jury Portal is currently deactivated. Access is locked for all jurors."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = currentConfig.juryPortalActive === false ? true : false;
                    handleChange("juryPortalActive", nextVal);
                    localStorage.setItem("juryPortalActive", String(nextVal));
                    
                    // Immediately write change to Firestore for instant live sync across all tabs/jurors
                    try {
                      const docRef = doc(db, "settings", "portal_config");
                      await setDoc(docRef, { ...currentConfig, juryPortalActive: nextVal }, { merge: true });
                    } catch (err) {
                      console.error("Error writing juryPortalActive to Firestore:", err);
                    }

                    // Dispatch custom storage events to wake up open tabs immediately
                    window.dispatchEvent(new Event("storage"));
                    window.dispatchEvent(new Event("juryPortalStatusChanged"));

                    addToast(
                      `Jury Portal access is now ${nextVal ? "ACTIVATED (Open)" : "DEACTIVATED (Locked)"}.`,
                      nextVal ? "success" : "warning"
                    );
                  }}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer outline-none shrink-0
                    ${currentConfig.juryPortalActive !== false ? "bg-[#2563EB]" : "bg-slate-300"}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform duration-200 
                    ${currentConfig.juryPortalActive !== false ? "translate-x-5" : "translate-x-0"}`} 
                  />
                </button>
              </div>

              {/* Event Selector for Jury Scoring */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Event for Jury Evaluation
                </label>
                <select
                  value={currentConfig.activeJuryEventId || "ALL_EVENTS"}
                  onChange={async (e) => {
                    const selectedId = e.target.value;
                    const selectedEv = dbEventsList.find(ev => ev.id === selectedId);
                    const selectedTitle = selectedId === "ALL_EVENTS" ? "All Events" : (selectedEv?.title || "Selected Event");

                    handleChange("activeJuryEventId", selectedId);
                    handleChange("activeJuryEventTitle", selectedTitle);

                    localStorage.setItem("activeJuryEventId", selectedId);
                    localStorage.setItem("activeJuryEventTitle", selectedTitle);

                    try {
                      const docRef = doc(db, "settings", "portal_config");
                      await setDoc(docRef, { 
                        ...currentConfig, 
                        activeJuryEventId: selectedId, 
                        activeJuryEventTitle: selectedTitle 
                      }, { merge: true });
                    } catch (err) {
                      console.error("Error writing activeJuryEventId to Firestore:", err);
                    }

                    window.dispatchEvent(new Event("storage"));
                    window.dispatchEvent(new Event("juryPortalStatusChanged"));

                    addToast(`Active Jury Event set to "${selectedTitle}".`, "info");
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="ALL_EVENTS">All Events / All Tracks (Default)</option>
                  {dbEventsList.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Select which event participants the jury will evaluate and mark in the spreadsheet.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Branding, Social, Danger Zone (5 / 12) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 4: Branding & Theme */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card text-left space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Palette className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Branding & Theme</h2>
            </div>

            <div className="space-y-4">
              {/* Club Logo */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Club Logo</label>
                <div className="flex items-center gap-4">
                  {/* Upload logo box */}
                  <div 
                    onClick={handleLogoUploadClick}
                    className="w-20 h-20 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors shrink-0"
                  >
                    <Upload className="h-4.5 w-4.5 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 mt-1 block">LOGO</span>
                  </div>
                  
                  <div className="leading-tight">
                    <span className="text-xs font-bold text-slate-800 block truncate max-w-[200px]">
                      {currentConfig.logoFilename}
                    </span>
                    <p className="text-[9px] font-bold text-slate-400 leading-normal mt-1">
                      Recommended size 512x512px. SVG or PNG preferred.
                    </p>
                    <button 
                      type="button" 
                      onClick={() => addToast("Current Logo downloaded successfully.", "info")}
                      className="text-[10px] font-bold text-[#2563EB] hover:underline mt-1.5 block"
                    >
                      Download Current
                    </button>
                  </div>
                </div>
              </div>

              {/* Primary Brand Color */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Brand Color</label>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-10 h-10 border rounded-xl shadow-sm transition-colors duration-200 shrink-0"
                    style={{ backgroundColor: currentConfig.primaryColor }}
                  />
                  <input
                    type="text"
                    value={currentConfig.primaryColor}
                    onChange={(e) => handleChange("primaryColor", e.target.value)}
                    placeholder="#2563EB"
                    className="flex-grow px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              {/* Font Family Preference */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Font Family Preference</label>
                <select
                  value={currentConfig.fontFamily}
                  onChange={(e) => handleChange("fontFamily", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-700 bg-slate-50 cursor-pointer"
                >
                  <option value="Plus Jakarta Sans (Modern)">Plus Jakarta Sans (Modern)</option>
                  <option value="Inter (Classic)">Inter (Classic)</option>
                  <option value="Poppins (Geometrical)">Poppins (Geometrical)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card: Super Admin Security & Password Change */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card text-left space-y-5">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Change Password</h2>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Update security credentials for your administrator account.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                <ShieldCheck className="w-3 h-3" />
                {user?.role === "faculty" ? "Super Admin" : "Admin"}
              </span>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Admin Account</span>
                <span className="text-xs font-bold text-slate-800 truncate block">{user?.email || "admin@aiverse.in"}</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">
                Active
              </span>
            </div>

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200/80 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* New Password Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Enter at least 6 characters"
                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Re-enter your new password"
                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password Match Status helper */}
              {newPassword && confirmPassword && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  {newPassword === confirmPassword ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-rose-500 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Passwords do not match
                    </span>
                  )}
                </div>
              )}

              {/* Update Password Button */}
              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {isUpdatingPassword ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Update Super Admin Password</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 5: Social Ecosystem */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card text-left space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Share2 className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Social Ecosystem</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Twitter X */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Twitter (X)</label>
                <input
                  type="text"
                  value={currentConfig.twitter}
                  onChange={(e) => handleChange("twitter", e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50"
                />
              </div>

              {/* GitHub */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">GitHub</label>
                <input
                  type="text"
                  value={currentConfig.github}
                  onChange={(e) => handleChange("github", e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50"
                />
              </div>

              {/* LinkedIn */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">LinkedIn</label>
                <input
                  type="text"
                  value={currentConfig.linkedin}
                  onChange={(e) => handleChange("linkedin", e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50"
                />
              </div>

              {/* Discord Invite */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Discord Invite</label>
                <input
                  type="text"
                  value={currentConfig.discord}
                  onChange={(e) => handleChange("discord", e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700 bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Card 6: Danger Zone */}
          <div className="bg-red-50/30 p-6 rounded-card border border-red-200/60 text-left space-y-4">
            <div className="flex items-center gap-3 border-b border-red-100 pb-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-red-800">Danger Zone</h2>
            </div>
            
            <p className="text-[10px] font-medium text-slate-500 leading-normal">
              Irreversible actions that affect the core portal infrastructure and historical data.
            </p>

            <div className="space-y-3.5">
              {/* Archive Semester */}
              <div className="flex items-center justify-between p-3.5 bg-white border border-red-100 rounded-xl">
                <div className="leading-tight">
                  <h4 className="text-xs font-bold text-slate-800">Archive Semester</h4>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                    Freeze Fall 2023 data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all outline-none"
                >
                  Archive Now
                </button>
              </div>

              {/* Reset Configurations */}
              <div className="flex items-center justify-between p-3.5 bg-white border border-red-100 rounded-xl">
                <div className="leading-tight">
                  <h4 className="text-xs font-bold text-slate-800">Reset Configuration</h4>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                    Restore all default settings
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all outline-none"
                >
                  Reset Portal
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-1.5 text-[9px] font-extrabold text-red-600 uppercase tracking-widest leading-none">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Superadmin Authentication Required</span>
            </div>
          </div>

        </div>

      </div>

      {/* FOOTER ACTIONS BAR */}
      <div className="border-t border-slate-200 pt-6 mt-6 flex flex-col sm:flex-row items-center justify-end gap-3.5">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleDiscardChanges}
          disabled={isSaving || isDiscarding}
          className="w-full sm:w-auto border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold"
        >
          Discard All Changes
        </Button>
        <Button 
          type="button" 
          variant="primary" 
          onClick={handleSaveConfig}
          isLoading={isSaving}
          className="w-full sm:w-auto bg-[#2563EB] hover:bg-blue-700 text-white flex items-center justify-center gap-1.5"
        >
          <Settings2 className="h-4 w-4" />
          Confirm System Update
        </Button>
      </div>

      {/* ARCHIVE CONFIRMATION MODAL */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => !isArchiving && setIsArchiveModalOpen(false)}
          />
          
          <div className="bg-white rounded-card shadow-xl border border-slate-100 max-w-md w-full relative z-10 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => !isArchiving && setIsArchiveModalOpen(false)}
              disabled={isArchiving}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 text-red-600">
              <Archive className="h-6 w-6" />
              <h3 className="text-xl font-bold text-slate-800 font-sans">Archive Semester</h3>
            </div>
            
            <div className="mt-4 space-y-3 text-left text-sm leading-normal text-slate-600">
              <p>
                You are about to archive the **Fall 2023** semester. This action will freeze all records, event data, student registrations, and statistics for this period.
              </p>
              <p className="font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 text-xs">
                WARNING: This process is irreversible and prevents further edits to event history or database parameters for Fall 2023.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsArchiveModalOpen(false)}
                disabled={isArchiving}
                className="border-slate-200"
              >
                Cancel
              </Button>
              <Button 
                variant="danger" 
                onClick={handleArchiveSemester}
                isLoading={isArchiving}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
              >
                <FileArchive className="h-3.5 w-3.5" />
                Confirm Archival
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => !isResetting && setIsResetModalOpen(false)}
          />
          
          <div className="bg-white rounded-card shadow-xl border border-slate-100 max-w-md w-full relative z-10 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => !isResetting && setIsResetModalOpen(false)}
              disabled={isResetting}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 text-red-600">
              <Trash2 className="h-6 w-6" />
              <h3 className="text-xl font-bold text-slate-800 font-sans">Reset Portal Configurations</h3>
            </div>
            
            <div className="mt-4 space-y-3 text-left text-sm leading-normal text-slate-600">
              <p>
                This action will restore all website portal configurations (Website Name, brand colors, taglines, social invite links, operations parameters, and notifications configurations) to their factory defaults.
              </p>
              <p className="font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 text-xs">
                WARNING: All current active configurations will be lost and immediately overwritten.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="border-slate-200"
              >
                Cancel
              </Button>
              <Button 
                variant="danger" 
                onClick={handleResetPortal}
                isLoading={isResetting}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsPage;
