import React, { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Image,
  Users,
  ClipboardList,
  LogOut,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  ClipboardCheck,
  BarChart2,
  Mail,
  ShieldCheck
} from "lucide-react";

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!user) return null;

  const isOrganizer = user.role === "organizer";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  let menuItems = user.role === "participant" ? [
    { path: "/participant/dashboard", label: "Participant Portal", icon: LayoutDashboard },
    { path: "/participant/set-password", label: "Change Password", icon: Settings },
  ] : [
    { path: "/faculty/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/faculty/events", label: "Events", icon: Calendar },
    { path: "/faculty/registrations", label: "Registrations", icon: ClipboardList },
    { path: "/faculty/attendance", label: "Attendance", icon: ClipboardCheck },
    { path: "/faculty/users", label: "User Management", icon: Users },
    { path: "/faculty/contacts", label: "Contact Inquiries", icon: Mail },
    { path: "/faculty/results", label: "Results", icon: BarChart2 },
    { path: "/faculty/gallery", label: "Gallery", icon: Image },
    { path: "/faculty/settings", label: "Settings", icon: Settings },
  ];

  if (user.email?.toLowerCase().trim() === "facultycoordinator@aiverse.in") {
    menuItems = menuItems.filter(item =>
      item.path !== "/faculty/gallery" &&
      item.path !== "/faculty/settings" &&
      item.path !== "/faculty/users" &&
      item.path !== "/faculty/contacts"
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex font-sans overflow-hidden">
      {/* Mobile Menu Backdrop */}
      {!isOrganizer && isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        ></div>
      )}

      {/* Sidebar Container (Hidden for Student Organizer) */}
      {!isOrganizer && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white text-slate-600 border-r border-slate-200/90 transition-all duration-300 h-full shadow-xs
            ${isSidebarOpen ? "w-64" : "w-20"} 
            ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} 
            lg:relative`}
        >
          {/* Sidebar Header with AI Club Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100/90 bg-white shrink-0">
            <Link to="/" className="flex items-center gap-2.5 font-black text-[#2563EB] text-xl">
              <img src="/ai_verse.png" alt="AI Verse Logo" className="w-10 h-10 rounded-xl object-contain shrink-0 shadow-xs" />
              {isSidebarOpen && (
                <span className="tracking-tight font-sans text-slate-900 font-extrabold">AI Verse</span>
              )}
            </Link>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-grow py-4 px-3 space-y-1 overflow-y-auto no-scrollbar">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={index}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 py-2.5 px-3.5 rounded-xl font-semibold text-sm transition-all duration-150 group relative z-0
                    ${isActive
                      ? "text-white font-bold"
                      : "text-slate-500 hover:bg-blue-50/60 hover:text-blue-700"
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-[#2563EB] rounded-xl shadow-md shadow-blue-600/25 -z-10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon className={`relative z-10 h-4.5 w-4.5 shrink-0 transition-colors duration-150 ${isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600"}`} />
                  {isSidebarOpen ? (
                    <span className="relative z-10 text-[13px]">{item.label}</span>
                  ) : (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer with user profile card */}
          <div className="p-3.5 border-t border-slate-100/90 space-y-2 bg-white shrink-0">
            <Link
              to={user.role === "faculty" ? "/faculty/profile" : "/organizer/profile"}
              className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200/60 cursor-pointer transition-all duration-200 block"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User Avatar"}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shadow-sm border border-slate-200 shrink-0 font-sans">
                  {(() => {
                    if (!user.name) return "AV";
                    const parts = user.name.trim().split(/\s+/);
                    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                    return parts[0].substring(0, 2).toUpperCase();
                  })()}
                </div>
              )}
              {isSidebarOpen && (
                <div className="text-left leading-tight min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {user.name}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide truncate">
                    {user.displayRole || "Faculty Advisor"}
                  </div>
                </div>
              )}
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full py-2 px-3 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0 h-full overflow-y-auto">
        {/* Topbar / Header */}
        <header className="h-16 flex items-center justify-between px-3 sm:px-6 lg:px-8 sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {isOrganizer ? (
              <Link to="/" className="flex items-center gap-2 sm:gap-2.5 font-black text-[#2563EB] text-base sm:text-lg hover:opacity-90 transition-opacity min-w-0">
                <img src="/ai_verse.png" alt="AI Verse Logo" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shrink-0 shadow-xs" />
                <div className="leading-tight text-left min-w-0">
                  <span className="tracking-tight font-sans font-black block text-xs sm:text-sm text-slate-900 truncate">AI Verse Club</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-bold uppercase tracking-wider block truncate">Attendance Portal</span>
                </div>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setIsMobileOpen(true)}
                  className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                >
                  <Menu className="h-5 w-5" />
                </button>

                {/* Sidebar toggle button for desktop */}
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                  className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-500 hover:text-slate-800 transition-all shadow-2xs cursor-pointer"
                >
                  {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Status indicator badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-[10px] sm:text-xs font-bold font-sans shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>AI Verse <span className="uppercase text-[9px] opacity-80 font-black">ONLINE</span></span>
            </div>

            {/* Mobile Status Dot */}
            <div className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-[9px] font-black shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>LIVE</span>
            </div>

            {/* Notification Bell with red dot */}
            <button className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl relative transition-colors cursor-pointer shrink-0">
              <Bell className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* Profile Avatar / Circle */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="text-right hidden md:block leading-tight text-left">
                <div className="text-xs font-bold text-slate-800">{user.name}</div>
                <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">
                  {user.displayRole || (isOrganizer ? "Student Organizer" : "Faculty Advisor")}
                </div>
              </div>
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User Avatar"}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs border border-white shrink-0 font-sans">
                  {(() => {
                    if (!user.name) return "AV";
                    const parts = user.name.trim().split(/\s+/);
                    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                    return parts[0].substring(0, 2).toUpperCase();
                  })()}
                </div>
              )}
            </div>

            {/* Topbar Logout Button */}
            {isOrganizer && (
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-extrabold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200/90 transition-all cursor-pointer shadow-2xs shrink-0"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-grow p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto bg-slate-50/50">
          <Outlet />
        </main>

        {/* Dashboard Footer */}
        <footer className="py-5 border-t border-slate-100 bg-white text-center text-xs text-slate-400 font-medium">
          © 2026 AI Verse. Precise Innovation.
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
