import React from "react";
import { Link } from "react-router-dom";
import { Send, MessageSquare } from "lucide-react";

// Custom SVG Social Icons to bypass missing brand icons in this version of lucide-react
const Twitter = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const Linkedin = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export const Footer: React.FC = () => {
  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Thank you for subscribing to our newsletter!");
  };

  return (
    <footer className="bg-white text-slate-500 font-sans border-t border-slate-100 pt-20 pb-12 relative overflow-hidden">
      {/* Subtle background glow for light theme */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-blue-200 to-transparent"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-50/50 rounded-full blur-[100px] pointer-events-none -z-10"></div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        
        {/* Main Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-slate-100">
          
          {/* Column 1: Logo & description */}
          <div className="md:col-span-4 space-y-6">
            <Link to="/" className="inline-flex items-center gap-2.5 group font-extrabold tracking-tight select-none">
              <img src="/ai_verse.png" alt="AI Verse Logo" className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-contain shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform duration-300 shrink-0" />
              <span className="text-slate-900 font-sans text-2xl font-black tracking-tight">AI Verse</span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
              Empowering the next generation of AI pioneers through rigorous research and community-driven innovation.
            </p>
            {/* Social Links under logo */}
            <div className="flex items-center gap-3 text-slate-400 pt-2">
              <a href="#" className="p-2 -ml-2 rounded-lg hover:bg-blue-50 hover:text-[#2563EB] transition-all duration-300" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="p-2 rounded-lg hover:bg-blue-50 hover:text-[#2563EB] transition-all duration-300" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="p-2 rounded-lg hover:bg-blue-50 hover:text-[#2563EB] transition-all duration-300" aria-label="Discord">
                <MessageSquare className="h-5 w-5" />
              </a>
              <a href="#" className="p-2 rounded-lg hover:bg-blue-50 hover:text-[#2563EB] transition-all duration-300" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Column 2: Community */}
          <div className="md:col-span-2 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 tracking-wider uppercase font-sans">Community</h3>
            <ul className="space-y-3 text-sm font-medium text-slate-500">
              <li>
                <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Twitter</a>
              </li>
              <li>
                <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">GitHub</a>
              </li>
              <li>
                <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Discord</a>
              </li>
              <li>
                <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">LinkedIn</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="md:col-span-2 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 tracking-wider uppercase font-sans">Resources</h3>
            <ul className="space-y-3 text-sm font-medium text-slate-500">
              <li>
                <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Newsletter</a>
              </li>
              <li>
                <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Privacy Policy</a>
              </li>
              <li>
                <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Code of Conduct</a>
              </li>
              <li>
                <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Contact</a>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter Sign-up */}
          <div className="md:col-span-4 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 tracking-wider uppercase font-sans">Newsletter</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Join our weekly newsletter to stay updated on the latest news and features.</p>
            <form onSubmit={handleNewsletterSubmit} className="flex items-center mt-2 max-w-sm">
              <div className="relative flex-grow">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 text-sm px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                />
              </div>
              <button
                type="submit"
                className="ml-3 bg-[#2563EB] hover:bg-blue-700 text-white p-3.5 rounded-xl flex items-center justify-center transition-all duration-300 shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5"
                aria-label="Subscribe"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

        </div>

        {/* Footer Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold text-slate-400 gap-4">
          <div>
            © {new Date().getFullYear()} AI Verse. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Terms</a>
            <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Privacy</a>
            <a href="#" className="hover:text-[#2563EB] transition-colors duration-200">Cookies</a>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
