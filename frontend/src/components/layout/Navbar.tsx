import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Menu, X, Shield } from "lucide-react";
import { motion } from "framer-motion";

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Monitor page scroll to add background blur/shadow
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { path: "/", label: "Home" },
    { path: "/events", label: "Events" },
    { path: "/gallery", label: "Gallery" },
    { path: "/team", label: "Team" },
    { path: "/contact", label: "Contact" },
  ];



  const getPortalPath = () => {
    if (!user) return "/login";
    const r = user.role;
    if (r === "faculty" || user.displayRole === "Super Admin" || String(r).toLowerCase().includes("admin") || String(r).toLowerCase().includes("faculty")) {
      return "/faculty/dashboard";
    }
    if (r === "organizer" || String(r).toLowerCase().includes("organizer")) {
      return "/organizer/attendance";
    }
    if (r === "jury" || String(r).toLowerCase().includes("jury") || String(r).toLowerCase().includes("evaluator")) {
      return "/jury";
    }
    if (r === "participant" || r === "member" || String(r).toLowerCase().includes("participant") || String(r).toLowerCase().includes("member")) {
      return "/participant/dashboard";
    }
    return "/participant/dashboard";
  };

  return (
    <header
      className={`fixed left-1/2 -translate-x-1/2 z-40 transition-all duration-300 flex items-center justify-between
        w-[92%] sm:w-[90%] max-w-7xl h-16 rounded-full border border-slate-200/50 shadow-[0_8px_30px_rgba(0,0,0,0.03)] px-6 sm:px-8
        ${isScrolled 
          ? "top-4 bg-white/90 backdrop-blur-md shadow-md border-slate-200/70" 
          : "top-6 bg-white/70 backdrop-blur-md"
        }`}
    >
      {/* Brand Logo */}
      <Link to="/" className="flex items-center gap-2.5 group font-extrabold text-aether-dark text-lg tracking-tight select-none">
        <img src="/ai_verse.png" alt="AI Verse Logo" className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-contain group-hover:scale-105 transition-transform shrink-0" />
        <span className="text-aether-blue-600 font-sans text-xl font-black">AI</span>
        <span className="text-slate-900 font-sans text-xl font-black">Verse</span>
      </Link>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        {navLinks.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`text-xs font-bold tracking-wide transition-colors relative py-1
                ${isActive 
                  ? "text-aether-blue-600 font-extrabold" 
                  : "text-slate-500 hover:text-aether-blue-600"
                }`}
            >
              {link.label}
              {isActive && (
                <motion.span
                  layoutId="activeDesktopNavLink"
                  transition={{ type: "spring", stiffness: 60, damping: 15 }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-aether-blue-600 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Action Button Area */}
      <div className="hidden md:flex items-center gap-4">
        {user ? (
          <Link
            to={getPortalPath()}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-aether-blue-600 transition-colors py-1.5 px-3 hover:bg-slate-50 rounded-xl"
          >
            <Shield className="h-4 w-4" />
            Portal
          </Link>
        ) : (
          <Link
            to="/login"
            className="text-xs font-bold text-slate-500 hover:text-aether-blue-600 transition-colors px-3 py-1.5"
          >
            Login
          </Link>
        )}


      </div>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-slate-200/50 shadow-lg px-6 py-6 space-y-4 flex flex-col font-sans animate-fade-in rounded-3xl"
        >
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-bold py-1.5 transition-colors text-left
                  ${isActive ? "text-[#2563EB]" : "text-slate-600 hover:text-[#2563EB]"}`}
              >
                {link.label}
              </Link>
            );
          })}
          
          <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
            {user ? (
              <Link
                to={getPortalPath()}
                className="w-full text-center py-2 bg-slate-50 font-bold rounded-xl text-slate-700 hover:bg-slate-100 transition-all text-xs flex items-center justify-center gap-1.5"
              >
                <Shield className="h-4 w-4" />
                Go to Portal
              </Link>
            ) : (
              <Link
                to="/login"
                className="w-full text-center py-2 bg-slate-50 font-bold rounded-xl text-slate-700 hover:bg-slate-100 transition-all text-xs"
              >
                Login
              </Link>
            )}


          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
