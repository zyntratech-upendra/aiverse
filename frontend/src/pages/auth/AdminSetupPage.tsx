import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useNavigate } from "react-router-dom";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";
import SEO from "../../components/layout/SEO";

const ROLE_OPTIONS = [
  { value: "Super Admin", label: "Super Admin", description: "Full system access — faculty-level dashboard", normalized: "faculty" },
  { value: "Faculty Advisor", label: "Faculty Advisor", description: "Faculty dashboard with all management features", normalized: "faculty" },
  { value: "Lead Organizer", label: "Lead Organizer", description: "Organizer dashboard with event management", normalized: "organizer" },
  { value: "Organizer", label: "Organizer", description: "Organizer dashboard with limited access", normalized: "organizer" },
];

const AdminSetupPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 bg-[#F8FAFC]">
        <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full p-8 text-center shadow-lg">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Not Logged In</h2>
          <p className="text-sm text-slate-500 mb-4">Please log in first to set up your admin role.</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const handleUpdateRole = async () => {
    if (!selectedRole || (!user.uid.startsWith("mock-") && !user.uid)) return;
    
    setIsUpdating(true);
    setError("");
    try {
      const option = ROLE_OPTIONS.find(r => r.value === selectedRole);
      const normalizedRole = option?.normalized || "faculty";

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { 
        role: normalizedRole,
        displayRole: selectedRole 
      });
      setSuccess(true);
      
      // Redirect to the appropriate dashboard after 1.5 seconds
      setTimeout(() => {
        if (normalizedRole === "faculty") {
          navigate("/faculty/dashboard");
        } else {
          navigate("/organizer/attendance");
        }
      }, 1500);
    } catch (err: any) {
      console.error("Failed to update role:", err);
      setError(err?.message || "Failed to update role. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-[#F8FAFC]">
      <SEO title="Admin Setup" description="Set up admin role for AI Verse portal access." />
      
      <div className="bg-white rounded-[32px] border border-slate-100/60 max-w-lg w-full p-8 md:p-10 shadow-[0_24px_50px_rgba(0,0,0,0.03)]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mx-auto mb-4 border border-amber-100/40">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Role Setup</h2>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            Logged in as <span className="font-bold text-slate-600">{user.email}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Current role: <span className="font-bold text-blue-600">{user.displayRole || user.role || "none"}</span>
          </p>
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-slate-900">Role Updated!</p>
            <p className="text-sm text-slate-500 mt-1">Redirecting to your dashboard...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-3.5 rounded-xl mb-5 border border-red-100 text-center font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedRole(option.value)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                    selectedRole === option.value
                      ? "border-blue-500 bg-blue-50/50 shadow-sm"
                      : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="font-bold text-sm text-slate-800">{option.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{option.description}</div>
                </button>
              ))}
            </div>

            <button
              onClick={handleUpdateRole}
              disabled={!selectedRole || isUpdating}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              {isUpdating ? "Updating..." : "Set Role & Continue"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminSetupPage;
