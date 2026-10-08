import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SEO from "../../components/layout/SEO";
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export const OrgChangePasswordPage: React.FC = () => {
  const { user, updateUserPassword } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Focus new password input on mount
  useEffect(() => {
    const input = document.getElementById("coordinator-page-new-password");
    if (input) input.focus();
  }, []);

  const isLengthValid = newPassword.length >= 6;
  const isMatchValid = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = isLengthValid && isMatchValid;

  const getPasswordStrength = () => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 6) score++;
    if (newPassword.length >= 8) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      if (updateUserPassword) {
        await updateUserPassword(newPassword);
      }
      setSuccess(true);
      setTimeout(() => {
        navigate("/organizer/attendance");
      }, 1500);
    } catch (err: any) {
      console.error("Change password error:", err);
      setError(err?.message || "Failed to update password. Please check your network and retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 text-left font-sans max-w-2xl mx-auto">
      <SEO
        title="Change Password - Student Coordinator"
        description="Update login password for Student Coordinator attendance portal."
      />

      {/* Top Navigation Back Link */}
      <div>
        <Link
          to="/organizer/attendance"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors py-1.5 px-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Attendance Desk</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="space-y-1.5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-50 text-blue-700 border border-blue-200/70 text-[9.5px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              Security Desk
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 pt-1">
            <KeyRound className="w-7 h-7 text-blue-600 shrink-0" />
            <span>Change Coordinator Password</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Set a new secure password for your Student Coordinator portal account.
          </p>
        </div>

        {/* User Account Info Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : "SO"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900 truncate">
                {user?.name || "Student Coordinator"}
              </div>
              <div className="text-xs text-slate-500 font-semibold truncate mt-0.5">
                {user?.email || "studentorganizer@aiverse.in"}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-3 py-1 rounded-xl">
            {user?.displayRole || "Student Organizer"}
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm p-5 rounded-2xl flex items-center gap-3.5 shadow-sm">
            <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600" />
            <div>
              <div className="font-black text-base text-emerald-900">Password Updated Successfully!</div>
              <div className="text-emerald-700 text-xs font-medium mt-0.5">
                Your new password is now active. Redirecting back to the Attendance Desk...
              </div>
            </div>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* New Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="coordinator-page-new-password"
              className="text-xs font-black uppercase tracking-wider text-slate-700 block"
            >
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="coordinator-page-new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 6 characters"
                required
                minLength={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {newPassword && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1.5 h-1.5 w-full">
                  <div
                    className={`h-full flex-1 rounded-full transition-colors ${
                      strength >= 1 ? "bg-rose-500" : "bg-slate-200"
                    }`}
                  />
                  <div
                    className={`h-full flex-1 rounded-full transition-colors ${
                      strength >= 2 ? "bg-amber-500" : "bg-slate-200"
                    }`}
                  />
                  <div
                    className={`h-full flex-1 rounded-full transition-colors ${
                      strength >= 3 ? "bg-blue-500" : "bg-slate-200"
                    }`}
                  />
                  <div
                    className={`h-full flex-1 rounded-full transition-colors ${
                      strength >= 4 ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400 font-bold">
                  <span>Strength</span>
                  <span
                    className={
                      strength <= 1
                        ? "text-rose-500"
                        : strength === 2
                        ? "text-amber-500"
                        : strength === 3
                        ? "text-blue-500"
                        : "text-emerald-500"
                    }
                  >
                    {strength <= 1 ? "Weak" : strength === 2 ? "Fair" : strength === 3 ? "Good" : "Strong"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="coordinator-page-confirm-password"
              className="text-xs font-black uppercase tracking-wider text-slate-700 block"
            >
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="coordinator-page-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                minLength={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2.5 text-xs font-bold">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  isLengthValid ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className={isLengthValid ? "text-emerald-700" : "text-slate-500"}>
                Minimum 6 characters in length
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-xs font-bold">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  isMatchValid ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className={isMatchValid ? "text-emerald-700" : "text-slate-500"}>
                New password and confirm password match
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3">
            <Link
              to="/organizer/attendance"
              className="flex-1 py-3.5 px-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm text-center transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="flex-[2] bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs sm:text-sm py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Password Updated!</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Update Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrgChangePasswordPage;
