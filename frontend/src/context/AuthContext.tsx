import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  setToken as setApiToken, 
  getToken, 
  loginWithBackend, 
  registerWithBackend, 
  updatePassword as apiUpdatePassword, 
  fetchCurrentUser 
} from "../services/apiClient";

export const ALLOWED_EMAILS = [
  "admin@aiverse.in",
  "facultycoordinator@aiverse.in",
  "studentorganizer@aiverse.in",
  "jury@aiverse.in",
  "jurry@aiverse.in",
  "participant@aiverse.in"
];

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: "faculty" | "organizer" | "member" | "jury" | "participant" | null;
  displayRole?: string;
  image?: string;
  year?: string;
  requiresPasswordChange?: boolean;
  teamName?: string;
  eventTitle?: string;
  registrationId?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, roleOrPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
  register?: (email: string, passwordOrRole: string, name: string, role: "faculty" | "organizer" | "member" | "jury" | "participant") => Promise<void>;
  setMockRole: (role: "faculty" | "organizer" | "member" | "jury" | "participant" | null) => void;
  updateUserPassword?: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to normalize system role across the auth system
export const normalizeRole = (
  rawRole: any, 
  defaultRole: "faculty" | "organizer" | "member" | "jury" | "participant" = "participant"
): "faculty" | "organizer" | "member" | "jury" | "participant" => {
  if (!rawRole) return defaultRole;
  const lower = String(rawRole).toLowerCase().trim();
  if (
    lower === "faculty" || 
    lower === "admin" || 
    lower.includes("super admin") || 
    lower.includes("faculty advisor") || 
    lower.includes("faculty coordinator") || 
    lower.includes("system admin")
  ) {
    return "faculty";
  }
  if (
    lower === "organizer" || 
    lower.includes("lead organizer") || 
    lower.includes("student organizer") || 
    lower.includes("co-organizer") || 
    lower.includes("co organizer") || 
    lower.includes("secretary") || 
    lower.includes("facilitator")
  ) {
    return "organizer";
  }
  if (lower === "jury" || lower.includes("jury") || lower.includes("evaluator")) {
    return "jury";
  }
  if (
    lower === "participant" || 
    lower.includes("participant") || 
    lower === "member" || 
    lower.includes("student member") || 
    lower.includes("student") || 
    lower.includes("attendee") || 
    lower.includes("volunteer")
  ) {
    return "participant";
  }
  return defaultRole;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize and verify JWT session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = getToken();
        const savedUserStr = localStorage.getItem("aether_mock_user");

        if (token) {
          try {
            const res = await fetchCurrentUser();
            if (res?.user) {
              const u = res.user;
              const role = normalizeRole(u.role, "participant");
              const profile: UserProfile = {
                uid: u.uid || u._id || u.id || u.email,
                email: u.email || "",
                name: u.name || u.displayName || u.display_name || u.email?.split("@")[0] || "User",
                role,
                displayRole: u.displayRole || u.position || (role === "faculty" ? "Super Admin" : role === "organizer" ? "Student Organizer" : role === "jury" ? "Jury Evaluator" : "Participant"),
                image: u.image || "",
                year: u.year,
                requiresPasswordChange: Boolean(u.requiresPasswordChange),
                teamName: u.teamName || u.team_name,
                eventTitle: u.eventTitle || u.event_title,
                registrationId: u.registration_id || u.registrationId,
              };
              setUser(profile);
              localStorage.setItem("aether_mock_user", JSON.stringify(profile));
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn("[AuthContext] fetchCurrentUser error, trying cached user:", e);
          }
        }

        if (savedUserStr) {
          try {
            const saved = JSON.parse(savedUserStr);
            if (saved && saved.email && saved.role) {
              setUser(saved);
            } else {
              localStorage.removeItem("aether_mock_user");
              setUser(null);
            }
          } catch {
            localStorage.removeItem("aether_mock_user");
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("[AuthContext] Init auth error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (emailOrPhone: string, passwordInput?: string) => {
    setLoading(true);
    try {
      const backendAuth = await loginWithBackend(emailOrPhone, passwordInput);
      if (backendAuth?.success && backendAuth.user) {
        const u = backendAuth.user;
        const role = normalizeRole(u.role, "participant");
        const customUser: UserProfile = {
          uid: u.uid || u._id || u.id || u.email || emailOrPhone,
          email: u.email || emailOrPhone,
          name: u.name || u.displayName || u.display_name || emailOrPhone.split("@")[0] || "User",
          role,
          displayRole: u.displayRole || (role === "faculty" ? "Super Admin" : role === "organizer" ? "Student Organizer" : role === "jury" ? "Jury Evaluator" : "Participant"),
          requiresPasswordChange: false,
          teamName: u.teamName || u.team_name || undefined,
          eventTitle: u.eventTitle || u.event_title || undefined,
          registrationId: u.registration_id || u.registrationId || undefined,
        };

        setUser(customUser);
        localStorage.setItem("aether_mock_user", JSON.stringify(customUser));
        if (backendAuth.token) {
          setApiToken(backendAuth.token);
        }
        setLoading(false);
        return;
      }
      throw new Error("Invalid response from login server");
    } catch (error: any) {
      console.error("Login failed:", error);
      setLoading(false);
      throw error;
    }
  };

  const register = async (
    email: string, 
    passwordOrRole: string, 
    name: string, 
    role: "faculty" | "organizer" | "member" | "jury" | "participant"
  ) => {
    setLoading(true);
    const cleanEmail = email.toLowerCase().trim();

    try {
      const regRes = await registerWithBackend({
        email: cleanEmail,
        password: passwordOrRole,
        name,
        role,
      });

      if (regRes?.success && regRes.user) {
        const u = regRes.user;
        const normalizedRole = normalizeRole(u.role, role);
        const profile: UserProfile = {
          uid: u.uid || cleanEmail,
          email: cleanEmail,
          name: u.name || name,
          role: normalizedRole,
          displayRole: u.displayRole || "Participant",
        };
        setUser(profile);
        localStorage.setItem("aether_mock_user", JSON.stringify(profile));
        if (regRes.token) {
          setApiToken(regRes.token);
        }
      }
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      setApiToken(null);
      localStorage.removeItem("aether_mock_user");
      localStorage.removeItem("aiverse_api_token");
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const setMockRole = (role: "faculty" | "organizer" | "member" | "jury" | "participant" | null) => {
    if (role === null) {
      setUser(null);
      setApiToken(null);
      localStorage.removeItem("aether_mock_user");
      localStorage.removeItem("aiverse_api_token");
    } else {
      const email = role === "organizer" 
        ? "studentorganizer@aiverse.in" 
        : role === "participant" 
        ? "participant@aiverse.in" 
        : role === "jury"
        ? "jury@aiverse.in"
        : "admin@aiverse.in";
      const updatedUser: UserProfile = {
        uid: `mock-uid-${email}`,
        email,
        name: role === "organizer" ? "Student Organizer" : role === "participant" ? "Alex Rivera" : role === "jury" ? "Jury Panelist" : "System Admin",
        role: role === "organizer" ? "organizer" : role === "participant" ? "participant" : role === "jury" ? "jury" : "faculty",
        displayRole: role === "organizer" ? "Student Organizer" : role === "participant" ? "Participant" : role === "jury" ? "Jury Evaluator" : "Super Admin"
      };
      setUser(updatedUser);
      localStorage.setItem("aether_mock_user", JSON.stringify(updatedUser));
    }
  };

  const updateUserPassword = async (newPassword: string) => {
    try {
      await apiUpdatePassword(newPassword);
      if (user) {
        const updated = { ...user, requiresPasswordChange: false };
        setUser(updated);
        localStorage.setItem("aether_mock_user", JSON.stringify(updated));
      }
    } catch (err) {
      console.error("[AuthContext] Password update error:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, setMockRole, updateUserPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
