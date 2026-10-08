import React, { useState } from "react";
import { 
  LayoutGrid, 
  ClipboardList, 
  Award,
  Settings,
  LogOut,
  HelpCircle,
  ShieldCheck,
  User
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import saImg from "../../assets/images/sarah.png";

export type JurySidebarTab = "Dashboard" | "Assignments" | "Settings";

interface JurySidebarProps {
  activeTab: JurySidebarTab;
  setActiveTab: (tab: JurySidebarTab) => void;
  onOpenSubmitModal: () => void;
  activeRound?: number;
}

const JurySidebar: React.FC<JurySidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSubmitModal,
  activeRound: propActiveRound
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const [internalRound, setInternalRound] = useState<number>(() => {
    if (propActiveRound) return propActiveRound;
    const local = localStorage.getItem("activeJuryRound");
    return local ? Number(local) : 1;
  });

  React.useEffect(() => {
    if (propActiveRound) setInternalRound(propActiveRound);
  }, [propActiveRound]);

  React.useEffect(() => {
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

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out from the Jury Portal?")) {
      setIsLoggingOut(true);
      try {
        await logout();
        navigate("/login");
      } catch (err) {
        console.error("Logout failed:", err);
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  const navItems = [
    { id: "Dashboard" as const, label: "Dashboard", icon: LayoutGrid },
    { id: "Assignments" as const, label: "Assignments", icon: ClipboardList },
    { id: "Settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-16 md:w-20 lg:w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between p-3 lg:p-4 shrink-0 min-h-[calc(100vh-57px)] transition-all duration-300">
      <div className="space-y-5">
        {/* Top Portal Title Header & Active Round Badge */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-1 lg:px-2 py-1 justify-center lg:justify-start">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div className="hidden lg:block leading-tight">
              <h2 className="text-xs font-bold text-slate-800 tracking-tight">
                Jury Portal
              </h2>
              <p className="text-[10px] font-medium text-slate-400">
                AI Verse Hackathon
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-between px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-700 text-[10px] font-bold mx-1">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
              Round {currentRound} Active
            </span>
            <span className="text-[9px] font-mono font-semibold bg-white px-1.5 py-0.2 rounded border border-blue-200 text-blue-600">
              R{currentRound}
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#2563EB] text-white shadow-sm shadow-blue-600/20"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-semibold"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Button: Submit Final Scores */}
        <div className="pt-2">
          <button
            onClick={onOpenSubmitModal}
            title="Submit Final Scores"
            className="w-full py-2.5 px-2 lg:px-4 bg-[#0B4AC6] hover:bg-[#093EB0] text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/15 hover:shadow-lg transition-all text-center flex items-center justify-center gap-2"
          >
            <Award className="h-4 w-4 lg:hidden shrink-0" />
            <span className="hidden lg:inline">Submit Final Scores</span>
          </button>
        </div>
      </div>

      {/* Sidebar Footer with Juror Profile snippet & Logout */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        {/* Juror Account summary (Desktop) */}
        <div 
          onClick={() => setActiveTab("Settings")}
          className="hidden lg:flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
          title="Go to Settings"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
            {!imgFailed ? (
              <img
                src={user?.image || saImg}
                alt="Juror"
                className="w-full h-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <User className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight text-left">
            <p className="text-xs font-bold text-slate-800 truncate">
              {user?.name || "Dr. Sarah Chen"}
            </p>
            <span className="text-[10px] font-semibold text-blue-600 truncate block">
              {user?.displayRole || "Jury Evaluator"}
            </span>
          </div>
        </div>

        {/* Support Link */}
        <button
          onClick={() => alert("Connecting to Jury Support Team: support@aiverse.in")}
          title="Support"
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="hidden lg:inline">Support</span>
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Logout"
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="hidden lg:inline">
            {isLoggingOut ? "Logging out..." : "Logout"}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default JurySidebar;
