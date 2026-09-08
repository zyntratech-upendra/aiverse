import React from "react";
import { X, Users, Activity, Network } from "lucide-react";
import type { UserItem } from "../../pages/faculty/UserManagementPage";

interface TeamGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserItem[];
}

export const TeamGraphModal: React.FC<TeamGraphModalProps> = ({ isOpen, onClose, users }) => {
  if (!isOpen) return null;

  // Group users by role
  const usersByRole: Record<string, UserItem[]> = {};
  users.forEach((u) => {
    const role = u.role || "Unassigned";
    if (!usersByRole[role]) {
      usersByRole[role] = [];
    }
    usersByRole[role].push(u);
  });

  // Define the order of roles (a rough hierarchy)
  const roleHierarchy = [
    "Super Admin",
    "Faculty Coordinator",
    "Lead Organizer",
    "event manager",
    "student Organizer",
    "student co-organizer",
    "web app developer",
    "mobile app developer",
    "logistics",
    "media handing",
    "video and photography",
    "Volunteer",
    "Guest"
  ];

  // Sort available roles based on hierarchy
  const sortedRoles = Object.keys(usersByRole).sort((a, b) => {
    let indexA = roleHierarchy.indexOf(a);
    let indexB = roleHierarchy.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });

  const renderAvatar = (user: UserItem) => {
    if (user.image && user.image.startsWith("http")) {
      return (
        <img
          src={user.image}
          alt={user.name}
          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
        />
      );
    }
    const initials = user.name
      ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
      : "U";
    return (
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center border-2 border-white shadow-sm text-sm">
        {initials}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-50 w-full max-w-6xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Team Roles Graph</h2>
              <p className="text-sm text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> Organizational Hierarchy Overview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area - Scrollable Grid */}
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start w-full">
            {sortedRoles.map((role) => (
              <div key={role} className="w-full flex flex-col items-center relative bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                
                {/* Role Badge Title */}
                <div className="bg-slate-800 text-white px-6 py-2 rounded-full font-bold text-sm shadow-md mb-6 relative z-10 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  {role}
                  <span className="bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-full ml-2">
                    {usersByRole[role].length}
                  </span>
                </div>

                {/* Members Grid for this Role */}
                <div className="flex flex-wrap justify-center gap-4 w-full relative z-10">
                  {usersByRole[role].map((user) => (
                    <div 
                      key={user.id} 
                      className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3 w-full hover:shadow-md transition-shadow hover:border-blue-200 group"
                    >
                      {renderAvatar(user)}
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors" title={user.name}>
                          {user.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium truncate" title={user.email}>
                          {user.email}
                        </p>
                        <span className={`inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          user.status === 'Active' 
                            ? 'bg-emerald-50 text-emerald-600' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {user.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default TeamGraphModal;
