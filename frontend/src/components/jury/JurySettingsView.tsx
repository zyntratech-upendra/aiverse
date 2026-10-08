import React, { useState } from "react";
import { 
  User, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  Save, 
  Bell, 
  RefreshCw, 
  Laptop,
  ArrowLeft
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { updatePassword as apiUpdatePassword } from "../../services/apiClient";
import saImg from "../../assets/images/sarah.png";
import type { JurySidebarTab } from "./JurySidebar";

interface JurySettingsViewProps {
  onNavigateTab?: (tab: JurySidebarTab) => void;
}

const JurySettingsView: React.FC<JurySettingsViewProps> = ({ onNavigateTab }) => {
  const { user, logout, updateUserPassword } = useAuth();
  const navigate = useNavigate();

  // Profile Information State
  const [name, setName] = useState(user?.name || "Dr. Sarah Chen");
  const email = user?.email || "jury@aiverse.in";
  const [expertise, setExpertise] = useState("Large Language Models, Computer Vision, Ethics");
  const [affiliation, setAffiliation] = useState("Department of AI & Innovation");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Notification Preferences State
  const [notifyDeadline, setNotifyDeadline] = useState(true);
  const [notifySubmissions, setNotifySubmissions] = useState(true);
  const [autoMaskScores, setAutoMaskScores] = useState(true);

  // Logout State & Modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "Empty", color: "bg-slate-200" };
    if (pass.length < 6) return { score: 1, label: "Too Short", color: "bg-rose-500" };
    let score = 1;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;
    
    if (score <= 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
    if (score === 3) return { score: 3, label: "Good", color: "bg-blue-500" };
    return { score: 4, label: "Strong", color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength(newPassword);

  // Handle Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setTimeout(() => {
      setIsSavingProfile(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3500);
    }, 600);
  };

  // Handle Password Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!newPassword.trim()) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match. Please verify both fields.");
      return;
    }

    setIsUpdatingPassword(true);
    const targetEmail = (user?.email || "jury@aiverse.in").toLowerCase().trim();

    try {
      // 1. Call backend REST API to update MongoDB credentials
      await apiUpdatePassword(newPassword, targetEmail);

      // 2. Update AuthContext state
      if (updateUserPassword) {
        await updateUserPassword(newPassword).catch(() => {});
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 4500);
    } catch (err: any) {
      console.error("Error updating jury password:", err);
      setPasswordError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200 text-left font-sans max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              JUROR ACCOUNT & SECURITY
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SESSION ACTIVE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
            Settings & Security
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Update your authentication credentials, change your password, configure panel notifications, or securely sign out of your evaluator workspace.
          </p>
        </div>

        {/* Actions in Header */}
        <div className="flex items-center gap-3 shrink-0">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab("Assignments")}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs hover:shadow"
              title="Return to Assignments"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500" />
              <span>Back to Assignments</span>
            </button>
          )}

          {/* Quick Logout Button in Header */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-2xl border border-rose-200/80 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer shadow-sm hover:shadow"
          >
            <LogOut className="h-4 w-4 text-rose-500" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Span 7): Change Password (Primary) + Account Session & Logout */}
        <div className="lg:col-span-7 space-y-8">
          {/* Card: Change Password */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Change Password
                  </h2>
                  <p className="text-[11px] font-medium text-slate-400">
                    Ensure your account stays secure with a unique password
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Security
              </span>
            </div>

            {/* Success Message Banner */}
            {passwordSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-extrabold">Password Updated Successfully!</p>
                  <p className="text-[11px] font-medium text-emerald-700 mt-0.5">
                    Your new password has been saved in the system. Use it for your next login.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message Banner */}
            {passwordError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-5">
              {/* Current Password Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current Password <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword.length > 0 && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>Password Strength:</span>
                      <span className={`capitalize font-black ${
                        strength.score <= 1 ? "text-rose-600" : strength.score === 2 ? "text-amber-600" : "text-emerald-600"
                      }`}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`flex-1 h-full rounded-full transition-all duration-300 ${
                            step <= strength.score ? strength.color : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements info */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${newPassword.length >= 6 ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span className={newPassword.length >= 6 ? "text-slate-700 font-bold" : "text-slate-500"}>
                    Must be at least 6 characters long
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${newPassword && newPassword === confirmPassword ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span className={newPassword && newPassword === confirmPassword ? "text-slate-700 font-bold" : "text-slate-500"}>
                    New password and confirmation must match
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full sm:w-auto px-7 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingPassword ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Card: Active Session & Logout */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
                  <LogOut className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Active Session & Logout
                  </h2>
                  <p className="text-[11px] font-medium text-slate-400">
                    Manage your current authentication session
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-rose-50 rounded-lg text-[10px] font-bold text-rose-600 uppercase tracking-wider border border-rose-100">
                Session
              </span>
            </div>

            {/* Session Card Details */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                  <Laptop className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Current Web Session</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Authenticated as <strong className="text-slate-600">{user?.email || "jury@aiverse.in"}</strong> ({user?.displayRole || "Jury Evaluator"})
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-[10px] text-slate-400">
                <span className="block font-semibold">AI Verse Jury Portal</span>
                <span className="text-emerald-600 font-bold">Secure JWT Verified</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Signing out terminates your current active session token and securely resets local storage on this computer. You will need your email and password to log in again.
            </p>

            {/* Logout Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                disabled={isLoggingOut}
                className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLoggingOut ? "Signing Out..." : "Sign Out from Jury Portal"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (Span 5): Juror Profile & Evaluation Preferences */}
        <div className="lg:col-span-5 space-y-8">
          {/* Card: Juror Profile */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Evaluator Profile
                  </h2>
                  <p className="text-[11px] font-medium text-slate-400">
                    Your official jury credentials
                  </p>
                </div>
              </div>
            </div>

            {/* Juror Avatar Banner */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/80">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-white shrink-0">
                <img
                  src={user?.image || saImg}
                  alt="Juror"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold text-slate-900 truncate">
                  {name}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 truncate">
                  {email}
                </p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-xs">
                  {user?.displayRole || "Jury Panelist"}
                </span>
              </div>
            </div>

            {/* Profile Saved Alert */}
            {profileSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Profile details saved successfully!
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Registered Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Managed by hackathon system administrators</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Subject Expertise
                </label>
                <input
                  type="text"
                  value={expertise}
                  onChange={(e) => setExpertise(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Affiliation / Department
                </label>
                <input
                  type="text"
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSavingProfile ? "Saving..." : "Save Profile Details"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card: Evaluation Preferences */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Panel Notifications
                </h2>
                <p className="text-[11px] font-medium text-slate-400">
                  Scoring alerts and deadline reminders
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 cursor-pointer transition-colors">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-800 block">Deadline Countdown Reminders</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Alert 2 hours prior to evaluation matrix closing</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyDeadline}
                  onChange={(e) => setNotifyDeadline(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 cursor-pointer transition-colors">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-800 block">New Assignment Alerts</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Notify when new teams are assigned to your panel</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifySubmissions}
                  onChange={(e) => setNotifySubmissions(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 cursor-pointer transition-colors">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-800 block">Auto-Mask Locked Scores</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Convert saved marks into dots on the scoring board</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoMaskScores}
                  onChange={(e) => setAutoMaskScores(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <LogOut className="h-7 w-7" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Log Out of Jury Portal?
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Are you sure you want to sign out? You will be returned to the login screen and will need to sign in again to access project evaluations.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoggingOut ? "Signing Out..." : "Yes, Log Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JurySettingsView;
