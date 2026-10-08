import React, { useState, useRef, useEffect } from "react";
import { Bell, HelpCircle, User, Settings, LogOut, ChevronDown } from "lucide-react";
import saImg from "../../assets/images/sarah.png";
import type { JurySidebarTab } from "./JurySidebar";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface JuryHeaderProps {
  activeTab: JurySidebarTab;
  setActiveTab: (tab: JurySidebarTab) => void;
  pendingCount?: number;
  activeRound?: number;
}

const JuryHeader: React.FC<JuryHeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingCount = 4,
  activeRound: propActiveRound
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [internalRound, setInternalRound] = useState<number>(() => {
    if (propActiveRound) return propActiveRound;
    const local = localStorage.getItem("activeJuryRound");
    return local ? Number(local) : 1;
  });

  useEffect(() => {
    if (propActiveRound) {
      setInternalRound(propActiveRound);
    }
  }, [propActiveRound]);

  useEffect(() => {
    const syncRound = () => {
      const local = localStorage.getItem("activeJuryRound");
      if (local) setInternalRound(Number(local));
    };
    window.addEventListener("storage", syncRound);
    window.addEventListener("juryPortalStatusChanged", syncRound);
    return () => {
      window.removeEventListener("storage", syncRound);
      window.removeEventListener("juryPortalStatusChanged", syncRound);
    };
  }, []);

  const currentRound = propActiveRound || internalRound || 1;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    if (window.confirm("Are you sure you want to log out from the Jury Portal?")) {
      try {
        await logout();
        navigate("/login");
      } catch (err) {
        console.error("Logout failed:", err);
      }
    }
  };

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Brand Logo & Active Round Badge */}
      <div className="flex items-center gap-6 sm:gap-8">
        <div onClick={() => setActiveTab("Dashboard")} className="flex items-center gap-3 cursor-pointer">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-extrabold tracking-tight text-[#2563EB]">
              AI Verse
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              Jury
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-extrabold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Round {currentRound} Active</span>
          </div>
        </div>

        {/* Top Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {(["Dashboard", "Assignments", "Settings"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-bold transition-all relative py-1 ${
                  isActive
                    ? "text-[#2563EB]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563EB] rounded-full animate-in fade-in duration-200" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          className="relative p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
          )}
        </button>

        {/* Help */}
        <button
          onClick={() => alert("AI Verse Jury Portal Support: support@aiverse.in")}
          className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          title="Help & Support"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* User Profile Avatar with Dropdown */}
        <div className="relative pl-2 border-l border-slate-100" ref={menuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            title="User Profile Menu"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center">
              {!imgFailed ? (
                <img
                  src={user?.image || saImg}
                  alt="Juror Profile"
                  className="w-full h-full object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <User className="h-4 w-4 text-slate-400" />
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user?.name || "Dr. Sarah Chen"}
                </p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {user?.email || "jury@aiverse.in"}
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-100">
                  {user?.displayRole || "Jury Evaluator"}
                </span>
              </div>

              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    setActiveTab("Settings");
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Account & Password Settings</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-4 w-4 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default JuryHeader;
