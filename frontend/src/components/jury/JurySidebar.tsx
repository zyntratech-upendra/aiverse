import React from "react";
import { 
  LayoutGrid, 
  ClipboardList, 
  HelpCircle,
  Award
} from "lucide-react";

export type JurySidebarTab = "Dashboard" | "Assignments";

interface JurySidebarProps {
  activeTab: JurySidebarTab;
  setActiveTab: (tab: JurySidebarTab) => void;
  onOpenSubmitModal: () => void;
}

const JurySidebar: React.FC<JurySidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSubmitModal
}) => {
  const navItems = [
    { id: "Dashboard" as const, label: "Dashboard", icon: LayoutGrid },
    { id: "Assignments" as const, label: "Assignments", icon: ClipboardList },
  ];

  return (
    <aside className="w-16 md:w-20 lg:w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between p-3 lg:p-4 shrink-0 min-h-[calc(100vh-57px)] transition-all duration-300">
      <div className="space-y-6">
        {/* Top Portal Title Header */}
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

      {/* Sidebar Footer Support Item */}
      <div className="pt-4 border-t border-slate-100">
        <button
          onClick={() => alert("Connecting to Jury Support Team...")}
          title="Support"
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="hidden lg:inline">Support</span>
        </button>
      </div>
    </aside>
  );
};

export default JurySidebar;
