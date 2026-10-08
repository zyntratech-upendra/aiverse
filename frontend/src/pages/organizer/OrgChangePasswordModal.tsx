import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
} from "lucide-react";

interface OrgChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrgChangePasswordModal: React.FC<OrgChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, updateUserPassword } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const isLengthValid = newPassword.length >= 6;
  const isMatchValid = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = isLengthValid && isMatchValid;

  // Calculate rough strength
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
        setSuccess(false);
        setNewPassword("");
        setConfirmPassword("");
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error("Change password error:", err);
      setError(err?.message || "Failed to update password. Please check backend connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setError(null);
    setSuccess(false);
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleResetAndClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-slate-200/90 p-5 sm:p-7 relative text-left space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-50 text-blue-700 border border-blue-200/70 text-[9.5px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              Coordinator Security Desk
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-blue-600" />
            <span>Change Coordinator Password</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Update your authentication credentials for the Student Coordinator & Attendance portal.
          </p>
        </div>

        {/* Account Info Pill */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : "SO"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900 truncate">
                {user?.name || "Student Coordinator"}
              </div>
              <div className="text-[11px] text-slate-500 font-semibold truncate">
                {user?.email || "studentorganizer@aiverse.in"}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg">
            {user?.displayRole || "Student Organizer"}
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-2xl flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in-95 duration-200 shadow-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <div>
              <div className="font-black text-sm">Password Updated Successfully!</div>
              <div className="text-emerald-700 text-[11px] font-medium mt-0.5">
                Your new password is saved. You can now use it on your next login.
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* New Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="coordinator-new-password"
              className="text-[11px] font-black uppercase tracking-wider text-slate-600 block"
            >
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="coordinator-new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter minimum 6 characters"
                required
                minLength={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {newPassword && (
              <div className="space-y-1 pt-1">
                <div className="flex gap-1 h-1.5 w-full">
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
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
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
              htmlFor="coordinator-confirm-password"
              className="text-[11px] font-black uppercase tracking-wider text-slate-600 block"
            >
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="coordinator-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                required
                minLength={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Validation Checklist */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  isLengthValid ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
              </div>
              <span className={isLengthValid ? "text-emerald-700" : "text-slate-500"}>
                At least 6 characters
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  isMatchValid ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
              </div>
              <span className={isMatchValid ? "text-emerald-700" : "text-slate-500"}>
                Passwords match
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetAndClose}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="flex-[2] bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs sm:text-sm py-3 px-5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Updated!</span>
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
    </div>,
    document.body
  );
};

export default OrgChangePasswordModal;
