import React, { useState, useEffect } from "react";
import JuryHeader from "./JuryHeader";
import JurySidebar from "./JurySidebar";
import type { JurySidebarTab } from "./JurySidebar";
import JuryDashboardView from "./JuryDashboardView";
import JuryAssignmentsView from "./JuryAssignmentsView";
import JurySettingsView from "./JurySettingsView";
import SubmitScoresModal from "./SubmitScoresModal";
import SEO from "../layout/SEO";
import { Lock, ShieldAlert } from "lucide-react";
import { fetchSettings } from "../../services/apiClient";

interface JuryPortalProps {
  initialTab?: JurySidebarTab;
  standalone?: boolean;
}

const JuryPortal: React.FC<JuryPortalProps> = ({
  initialTab = "Dashboard",
  standalone = true
}) => {
  const [activeTab, setActiveTab] = useState<JurySidebarTab>(initialTab);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isJuryActive, setIsJuryActive] = useState<boolean>(() => {
    const local = localStorage.getItem("juryPortalActive");
    return local !== null ? local !== "false" : true;
  });
  const [activeRound, setActiveRound] = useState<number>(() => {
    const local = localStorage.getItem("activeJuryRound");
    return local ? Number(local) : 1;
  });

  // Track Full Screen state so the sidebar and top header are cleanly hidden when full screen is active
  const [isFullScreenMode, setIsFullScreenMode] = useState<boolean>(() => {
    return Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  });

  const toggleFullScreen = () => {
    const isFs = Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement ||
      isFullScreenMode
    );

    if (!isFs) {
      setIsFullScreenMode(true);
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      } else if ((el as any).mozRequestFullScreen) {
        (el as any).mozRequestFullScreen();
      } else if ((el as any).msRequestFullscreen) {
        (el as any).msRequestFullscreen();
      }
    } else {
      setIsFullScreenMode(false);
      if (
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      ) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullScreenMode(isFs);
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullScreenChange);
    document.addEventListener("mozfullscreenchange", handleFullScreenChange);
    document.addEventListener("MSFullscreenChange", handleFullScreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullScreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullScreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullScreenChange);
    };
  }, []);

  useEffect(() => {
    const syncStatus = () => {
      const local = localStorage.getItem("juryPortalActive");
      if (local !== null) {
        setIsJuryActive(local !== "false");
      }
      const roundLocal = localStorage.getItem("activeJuryRound");
      if (roundLocal) {
        setActiveRound(Number(roundLocal));
      }
    };

    window.addEventListener("storage", syncStatus);
    window.addEventListener("juryPortalStatusChanged", syncStatus);

    let poll: any = null;
    const load = async () => {
      try {
        const data = await fetchSettings("portal_config");
        if (data && typeof data.juryPortalActive === "boolean") {
          setIsJuryActive(data.juryPortalActive);
          localStorage.setItem("juryPortalActive", String(data.juryPortalActive));
        }
        if (data && data.currentRound) {
          setActiveRound(Number(data.currentRound));
          localStorage.setItem("activeJuryRound", String(data.currentRound));
        }
      } catch (e) {}
    };
    load();
    poll = setInterval(load, 15000);

    return () => {
      window.removeEventListener("storage", syncStatus);
      window.removeEventListener("juryPortalStatusChanged", syncStatus);
      if (poll) clearInterval(poll);
    };
  }, []);

  if (!isJuryActive) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans">
        <SEO
          title="Jury Portal Deactivated - AI Verse"
          description="The Jury Evaluation Portal is currently deactivated by system administrators."
          keywords="Jury Portal locked, Evaluation portal inactive"
        />
        <div className="bg-white rounded-3xl p-8 sm:p-12 max-w-md w-full border border-slate-100 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 mx-auto flex items-center justify-center shadow-inner">
            <Lock className="h-8 w-8" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full border border-red-100">
              ACCESS DEACTIVATED
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-3 tracking-tight">Jury Portal Locked</h2>
            <p className="text-xs text-slate-500 font-semibold mt-2 leading-relaxed">
              The Jury Evaluation Portal has been deactivated by the administrator. Project scoring and jury evaluation workflows are currently paused.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-400 shrink-0" />
            <span>Contact your Faculty Lead or Superadmin to re-activate access.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      <SEO
        title="Jury Portal - AI Verse Hackathon"
        description="Official evaluation & judging portal for AI Verse hackathons, project scoring, and track rankings."
        keywords="AI Verse Jury, Hackathon Judging, Evaluation Portal"
      />

      {/* Top Header Navigation (Hidden in distraction-free full screen mode) */}
      {standalone && !isFullScreenMode && (
        <JuryHeader
          activeTab={activeTab}
          setActiveTab={(t) => setActiveTab(t as JurySidebarTab)}
          pendingCount={4}
          activeRound={activeRound}
        />
      )}

      {/* Body Area: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Hidden when in fullscreen mode) */}
        {!isFullScreenMode && (
          <JurySidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
            activeRound={activeRound}
          />
        )}

        {/* Main Content Pane */}
        <main
          className={`flex-1 overflow-y-auto w-full min-w-0 transition-all ${
            isFullScreenMode
              ? "p-3 sm:p-5 md:p-6 bg-[#F8FAFC]"
              : "p-4 sm:p-6 md:p-8 max-w-7xl mx-auto"
          }`}
        >
          {activeTab === "Dashboard" && (
            <JuryDashboardView
              onNavigateTab={setActiveTab}
              activeRound={activeRound}
            />
          )}

          {activeTab === "Assignments" && (
            <JuryAssignmentsView
              isFullScreenMode={isFullScreenMode}
              toggleFullScreen={toggleFullScreen}
              onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
              activeRound={activeRound}
            />
          )}

          {activeTab === "Settings" && (
            <JurySettingsView onNavigateTab={setActiveTab} />
          )}
        </main>
      </div>

      {/* Submit Final Scores Modal */}
      <SubmitScoresModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
      />
    </div>
  );
};

export default JuryPortal;
