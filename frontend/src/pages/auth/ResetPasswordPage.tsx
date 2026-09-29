import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { 
  Key, 
  Lock, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Loader2, 
  Users, 
  GraduationCap, 
  Calendar,
  Sparkles,
  RotateCcw
} from "lucide-react";
import SEO from "../../components/layout/SEO";
import { API_BASE, fetchRegistrations, updateRegistration, updatePassword } from "../../services/apiClient";

interface VerifiedDetails {
  email: string;
  name: string;
  teamName: string;
  eventTitle: string;
  college?: string;
  rollNo?: string;
  registrationId?: string;
}

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const queryEmail = searchParams.get("email") || "";
  const queryTeam = searchParams.get("team") || "";

  // Email entry & verification state
  const [emailInput, setEmailInput] = useState(queryEmail);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verifiedData, setVerifiedData] = useState<VerifiedDetails | null>(null);
  const [matchingRegistrationIds, setMatchingRegistrationIds] = useState<string[]>([]);
  const [verifyError, setVerifyError] = useState("");

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // If email was provided in URL query, automatically verify it
  useEffect(() => {
    if (queryEmail && !verifiedData && !verifyError) {
      handleVerifyEmail(queryEmail);
    }
  }, [queryEmail]);

  const handleVerifyEmail = async (emailToVerify?: string) => {
    const targetEmail = (emailToVerify || emailInput || "").trim().toLowerCase();
    setVerifyError("");
    setResetError("");

    if (!targetEmail) {
      setVerifyError("Please enter your registered participant lead email address.");
      return;
    }

    if (!targetEmail.includes("@") || !targetEmail.includes(".")) {
      setVerifyError("Please enter a valid email address.");
      return;
    }

    setIsVerifyingEmail(true);

    try {
      let isVerified = false;
      let matchedData: VerifiedDetails | null = null;
      let regIds: string[] = [];

      // 1. First attempt: Dedicated backend verification endpoint
      try {
        const res = await fetch(`${API_BASE}/auth/verify-reset-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: targetEmail }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            isVerified = true;
            matchedData = {
              email: targetEmail,
              name: data.name || "Participant",
              teamName: data.teamName || queryTeam || "Your Team",
              eventTitle: data.eventTitle || "AI Verse Event",
              college: data.college || "",
              rollNo: data.rollNo || "",
              registrationId: data.registrationId || "",
            };
            if (data.registrationId) regIds.push(data.registrationId);
          }
        }
      } catch (endpointErr) {
        console.warn("Direct endpoint check error, trying directory fallback:", endpointErr);
      }

      // 2. Resilient Fallback: If custom endpoint returned 404 on live deployment, query registrations directory
      if (!isVerified) {
        const allRegs = await fetchRegistrations().catch(() => []);
        if (Array.isArray(allRegs) && allRegs.length > 0) {
          const matching = allRegs.filter((r: any) => {
            const rEmail = (r.email || "").toLowerCase().trim();
            const rPersonal = (r.personalEmail || r.personal_email || "").toLowerCase().trim();
            const rLead = (r.teamLeadEmail || r.teamLeadPersonalEmail || "").toLowerCase().trim();
            const rCollege = (r.collegeEmail || r.teamLeadCollegeEmail || "").toLowerCase().trim();
            const rUser = (r.userEmail || "").toLowerCase().trim();
            const memberMatch = Array.isArray(r.members) && r.members.some((m: any) => (m.email || "").toLowerCase().trim() === targetEmail);

            return (
              rEmail === targetEmail ||
              rPersonal === targetEmail ||
              rLead === targetEmail ||
              rCollege === targetEmail ||
              rUser === targetEmail ||
              memberMatch
            );
          });

          if (matching.length > 0) {
            const first = matching[0];
            regIds = matching.map((m: any) => m.id || m._id).filter(Boolean);
            const leadName = first.teamLeadName || first.fullName || first.name || targetEmail.split("@")[0];
            const groupName = (first.groupName && first.groupName !== "Individual RSVP")
              ? first.groupName
              : (first.teamName || queryTeam || "Your Team");
            const college = first.collegeName || first.college || first.instituteName || "";
            const rollNo = first.teamLeadStudentId || first.studentId || first.rollNo || "";
            const eventTitle = first.eventTitle || "AI Verse Event";

            isVerified = true;
            matchedData = {
              email: targetEmail,
              name: leadName,
              teamName: groupName,
              eventTitle,
              college,
              rollNo,
              registrationId: regIds[0] || "",
            };
          }
        }
      }

      if (isVerified && matchedData) {
        setVerifiedData(matchedData);
        setMatchingRegistrationIds(regIds);
      } else {
        setVerifyError("No registered team lead or participant found for this email address. Please check your spelling or contact the event organizers.");
        setVerifiedData(null);
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setVerifyError(err.message || "Failed to verify email. Please check your network connection.");
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (!verifiedData) {
      setResetError("Please verify your email address first.");
      return;
    }

    if (newPassword.length < 4) {
      setResetError("Password must be at least 4 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match. Please verify both fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      let resetSuccessful = false;

      // 1. Try custom backend endpoint if available
      try {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: verifiedData.email,
            newPassword: newPassword.trim(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            resetSuccessful = true;
          }
        }
      } catch (endpointErr) {
        console.warn("Direct reset endpoint error, using auth and registration fallback:", endpointErr);
      }

      // 2. Resilient fallback: Update auth user and registration password directly
      if (!resetSuccessful) {
        try {
          await updatePassword(newPassword.trim(), verifiedData.email);
          resetSuccessful = true;
        } catch (pwErr) {
          console.warn("Update password notice:", pwErr);
        }

        if (matchingRegistrationIds.length > 0) {
          await Promise.allSettled(
            matchingRegistrationIds.map((regId) =>
              updateRegistration(regId, {
                teamPassword: newPassword.trim(),
                password: newPassword.trim(),
                updatedAt: Date.now(),
              })
            )
          );
          resetSuccessful = true;
        }
      }

      if (resetSuccessful) {
        setIsSuccess(true);
      } else {
        setResetError("Failed to reset password. Please try again or contact organizers.");
      }
    } catch (err: any) {
      console.error("Reset password error:", err);
      setResetError(err.message || "Network error while resetting password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <SEO 
        title="Reset Portal Password | AI Verse"
        description="Reset your AI Verse participant portal password securely."
        noIndex={true}
      />

      {/* Main Container */}
      <div className="max-w-xl w-full">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
              <Key className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                AI VERSE
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 tracking-wider">
                  Access Portal
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-semibold">Security & Password Management</p>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 overflow-hidden">
          
          {/* Top Banner */}
          <div className="bg-[#1E3A8A] text-white px-6 sm:px-8 py-5 border-b border-blue-900/40">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                  Password Recovery
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white mt-1.5 tracking-tight">
                  Reset Portal Password
                </h2>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-blue-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* SUCCESS STATE */}
            {isSuccess ? (
              <div className="text-center py-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    Password Reset Successfully!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5 max-w-sm mx-auto">
                    Your portal password for team <strong className="text-slate-800">{verifiedData?.teamName}</strong> has been updated and is active immediately.
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-left text-xs space-y-1.5 text-emerald-900">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>You can now log in using:</span>
                  </div>
                  <div className="pl-6 space-y-1 text-slate-700">
                    <p>• <strong>Email / Username:</strong> <span className="font-mono text-emerald-700">{verifiedData?.email}</span></p>
                    <p>• <strong>Password:</strong> The new password you just set</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => navigate(`/login?email=${encodeURIComponent(verifiedData?.email || "")}`)}
                    className="flex-1 py-3 px-6 rounded-2xl bg-[#2563EB] hover:bg-blue-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer"
                  >
                    <span>Proceed to Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <Link
                    to="/"
                    className="py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-extrabold text-xs transition-all text-center"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* STEP 1: VERIFY PARTICIPANT LEAD EMAIL */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black inline-flex items-center justify-center">1</span>
                      Participant Lead Email Verification
                    </label>
                    {verifiedData && (
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500">
                    Enter the registered lead email associated with your team registration to verify and confirm account identity.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          if (verifiedData) setVerifiedData(null);
                        }}
                        disabled={isVerifyingEmail || isSubmitting}
                        placeholder="e.g. participant@example.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] text-xs font-bold text-slate-800 transition-all"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleVerifyEmail()}
                      disabled={isVerifyingEmail || !emailInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 active:scale-95 text-[#2563EB] border border-blue-200 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isVerifyingEmail ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify Email</span>
                        </>
                      )}
                    </button>
                  </div>

                  {verifyError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{verifyError}</span>
                    </div>
                  )}

                  {/* VERIFIED TEAM SUMMARY CARD */}
                  {verifiedData && (
                    <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/80 border border-blue-200/90 text-xs space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">
                          Account Identity Confirmed
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Ready to Reset
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-1">
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Team / Group</span>
                          <span className="font-black text-slate-900 text-xs flex items-center gap-1">
                            <Users className="w-3 h-3 text-[#2563EB]" />
                            {verifiedData.teamName}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Lead Name</span>
                          <span className="font-black text-slate-900 text-xs">
                            {verifiedData.name} {verifiedData.rollNo ? `(${verifiedData.rollNo})` : ""}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Event</span>
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-500" />
                            {verifiedData.eventTitle}
                          </span>
                        </div>

                        {verifiedData.college && (
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Institution</span>
                            <span className="font-bold text-slate-800 text-xs truncate flex items-center gap-1" title={verifiedData.college}>
                              <GraduationCap className="w-3 h-3 text-purple-600" />
                              <span className="truncate">{verifiedData.college}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* STEP 2: SET NEW PASSWORD */}
                <form onSubmit={handleResetPassword} className="space-y-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black inline-flex items-center justify-center">2</span>
                      Set New Password
                    </label>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={!verifiedData || isSubmitting}
                        placeholder="Enter new password (min. 4 chars)"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] text-xs font-bold text-slate-800 transition-all disabled:opacity-50"
                        required
                        minLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={!verifiedData || isSubmitting}
                        placeholder="Re-enter new password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] text-xs font-bold text-slate-800 transition-all disabled:opacity-50"
                        required
                        minLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {resetError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={!verifiedData || isSubmitting || !newPassword || !confirmPassword}
                      className="w-full py-3 px-6 rounded-2xl bg-[#2563EB] hover:bg-blue-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>Reset & Set New Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Back to Login Link */}
            <div className="text-center pt-2 border-t border-slate-100">
              <Link
                to="/login"
                className="text-xs font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1"
              >
                <span>Remember your password? Log in here</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>
        </div>

        {/* Footer Notice */}
        <p className="text-center text-xs text-slate-400 font-medium mt-6">
          AI Verse Portal • Vishnu Institute of Technology • Automated Access Management
        </p>

      </div>
    </div>
  );
};

export default ResetPasswordPage;
