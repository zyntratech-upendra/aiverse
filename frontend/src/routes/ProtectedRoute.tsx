import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: Array<"faculty" | "organizer" | "member" | "jury" | "participant">;
  disallowEmails?: string[];
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  disallowEmails,
  redirectTo = "/faculty/dashboard"
}) => {
  const { user, loading } = useAuth();

  // Show loading spinner while auth state is being resolved
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-aether-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userEmail = user.email?.toLowerCase().trim() || "";

  // Block specific user emails from accessing restricted routes (e.g. facultycoordinator@aiverse.in from gallery/settings)
  if (disallowEmails && disallowEmails.map(e => e.toLowerCase().trim()).includes(userEmail)) {
    return <Navigate to={redirectTo} replace />;
  }

  // Normalize user.role for allowedRoles check
  const rawRole = user.role;
  let normalizedRole = rawRole;
  if (rawRole) {
    const lower = String(rawRole).toLowerCase().trim();
    if (lower === "faculty" || lower.includes("super admin") || lower.includes("faculty advisor") || lower.includes("faculty coordinator") || lower.includes("admin")) {
      normalizedRole = "faculty";
    } else if (lower === "organizer" || lower.includes("organizer") || lower.includes("lead organizer") || lower.includes("student organizer")) {
      normalizedRole = "organizer";
    } else if (lower === "jury" || lower.includes("jury")) {
      normalizedRole = "jury";
    } else if (lower === "participant" || lower.includes("participant")) {
      normalizedRole = "participant";
    } else if (lower === "member" || lower.includes("member")) {
      normalizedRole = "member";
    }
  }

  if (allowedRoles && (!normalizedRole || !allowedRoles.includes(normalizedRole as any))) {
    return <Navigate to="/404" replace />;
  }

  return children;
};
export default ProtectedRoute;
