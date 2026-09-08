import React, { useState } from "react";
import { Bell, HelpCircle, User } from "lucide-react";
import saImg from "../../assets/images/sarah.png";

interface JuryHeaderProps {
  activeTab: "Dashboard" | "Assignments";
  setActiveTab: (tab: "Dashboard" | "Assignments") => void;
  pendingCount?: number;
}

const JuryHeader: React.FC<JuryHeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingCount = 4
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Brand Logo */}
      <div className="flex items-center gap-8">
        <div onClick={() => setActiveTab("Dashboard")} className="flex items-center gap-1.5 cursor-pointer">
          <span className="text-xl font-extrabold tracking-tight text-[#2563EB]">
            AI Verse
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            Jury
          </span>
        </div>

        {/* Top Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {(["Dashboard", "Assignments"] as const).map((tab) => {
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
          className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          title="Help & Support"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center">
            {!imgFailed ? (
              <img
                src={saImg}
                alt="Juror Profile"
                className="w-full h-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <User className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default JuryHeader;
