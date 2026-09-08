import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Eye, EyeOff, ArrowRight, Network, Check } from "lucide-react";
import SEO from "../../components/layout/SEO";

export const ParticipantSetPasswordPage: React.FC = () => {
  const { updateUserPassword } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isFormValid = newPassword.length >= 6 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (updateUserPassword) {
        await updateUserPassword(newPassword);
      }
      setIsSuccess(true);
      setTimeout(() => {
        navigate("/participant/review-team", { replace: true });
      }, 500);
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <SEO 
        title="Set New Password - AI Verse Participant Portal"
        description="Create a password to access your AI Verse participant portal."
      />

      <div className="bg-white rounded-[32px] border border-slate-100/70 max-w-[460px] w-full p-8 sm:p-10 shadow-[0_24px_50px_rgba(0,0,0,0.03)] text-center relative z-10">
        
        {/* Brand Icon Squircle */}
        <div className="w-14 h-14 rounded-2xl bg-[#0266C8] text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20 border border-blue-400/20">
          <Network className="h-7 w-7 stroke-[2.2]" />
        </div>

        {/* Brand Title */}
        <h1 className="text-xl font-bold text-slate-900 tracking-tight font-sans mb-6">
          AI Verse
        </h1>

        {/* Form Heading */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          Set your new password
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-xs mx-auto mb-8 leading-relaxed">
          Create a password to access your participant portal.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs p-3.5 rounded-xl mb-5 border border-red-100 text-center font-semibold animate-shake">
            {error}
          </div>
        )}

        {isSuccess && (
          <div className="bg-emerald-50 text-emerald-700 text-xs p-3.5 rounded-xl mb-5 border border-emerald-200 text-center font-bold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Password updated! Redirecting to Portal...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          
          {/* New Password Input */}
          <div className="space-y-1.5">
            <label htmlFor="set-new-password" className="block text-xs font-bold text-slate-700 tracking-wide">
              New Password
            </label>
            <div className="relative flex items-center">
              <input
                id="set-new-password"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-sm text-slate-800 placeholder-slate-400 pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors p-1"
                aria-label="Toggle password visibility"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-1.5">
            <label htmlFor="set-confirm-password" className="block text-xs font-bold text-slate-700 tracking-wide">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <input
                id="set-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-sm text-slate-800 placeholder-slate-400 pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors p-1"
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-[11px] text-red-500 font-semibold pt-0.5">Passwords do not match</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className={`w-full py-3.5 mt-4 rounded-xl font-bold text-white transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md ${
              isFormValid
                ? "bg-[#3B82F6] hover:bg-blue-600 active:bg-blue-700 shadow-blue-500/25"
                : "bg-blue-400/80 cursor-not-allowed opacity-90"
            }`}
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <span>Set Password & Continue</span>
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};

export default ParticipantSetPasswordPage;
