import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../../config/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { fetchRegistrations, fetchEvents } from "../../services/apiClient";
import SEO from "../../components/layout/SEO";
import { 
  Download, 
  Printer, 
  Loader2, 
  MessageSquare, 
  Home, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  MapPin, 
  Copy, 
  Check 
} from "lucide-react";

interface Teammate {
  name: string;
  email: string;
  studentId: string;
  role?: string;
}

interface RegistrationData {
  eventId: string;
  eventTitle: string;
  groupName: string;
  teamLeadName: string;
  teamLeadEmail: string;
  teamLeadPersonalEmail?: string;
  teamLeadCollegeEmail?: string;
  teamLeadStudentId: string;
  members: Teammate[];
  teamSize: number;
  qrCodeData?: string;
  status?: string;
  paymentStatus?: string;
  isPaidEvent?: boolean;
  totalFeePaid?: number;
  registrationFee?: number;
  foodPreference?: string;
  createdAt?: number;
}

interface TicketDesignConfig {
  bgPreview?: string;
  bgFilename?: string;
  qrPosition?: "bottom-right" | "bottom-center" | "top-right" | "top-left" | "bottom-left" | "center" | "right-panel" | "custom" | string;
  qrX?: number;
  qrY?: number;
  qrWidthPercent?: number;
  qrBg?: "white" | "transparent" | "glow";
  showAttendeeText?: boolean;
  textX?: number;
  textY?: number;
  textColor?: string;
  template?: string;
  passLabel?: string;
  primaryColor?: string;
  showMembers?: boolean;
  showVenue?: boolean;
  showBarcode?: boolean;
}

interface EventData {
  title: string;
  date: string;
  time: string;
  location: string;
  whatsGroupLink?: string;
  registrationFee?: number;
  isPaidEvent?: boolean;
  category?: string;
  ticketDesign?: TicketDesignConfig;
}

const TicketPage: React.FC = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadTicket = async () => {
      if (!registrationId) {
        setLoading(false);
        return;
      }
      try {
        const regs = await fetchRegistrations();
        const reg = (regs || []).find((r: any) => (r.id || r._id || "") === registrationId || r._id === registrationId || r.id === registrationId);
        if (reg) {
          setRegistration(reg);

          if (reg.eventId) {
            try {
              const events = await fetchEvents();
              const ev = (events || []).find((e: any) => (e.id || e._id || "") === reg.eventId || e._id === reg.eventId || e.id === reg.eventId);
              if (ev) setEvent(ev);
            } catch (e) {
              console.error("Error fetching event for ticket via API:", e);
            }
          }
        }
      } catch (err) {
        console.error("Error loading ticket via API:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [registrationId]);

  const displayTitle = event?.title || registration?.eventTitle || "AI Verse Hackathon 2026";
  const displayGroupName = registration?.groupName || "CodeCrafters";
  const displayLeadName = registration?.teamLeadName || "Team Lead";
  const displayLeadEmail = registration?.teamLeadPersonalEmail || registration?.teamLeadCollegeEmail || registration?.teamLeadEmail || "leader@vishnu.edu.in";
  
  // Ticket Design Config from Event
  const ticketDesign = event?.ticketDesign || {};
  const ticketBgPreview = ticketDesign.bgPreview || "";
  const ticketQrX = ticketDesign.qrX !== undefined ? ticketDesign.qrX : 75;
  const ticketQrY = ticketDesign.qrY !== undefined ? ticketDesign.qrY : 75;
  const ticketQrWidthPercent = ticketDesign.qrWidthPercent !== undefined ? ticketDesign.qrWidthPercent : 22;
  const ticketQrBg = ticketDesign.qrBg || "white";
  const ticketShowAttendeeText = ticketDesign.showAttendeeText || false;
  const ticketTextX = ticketDesign.textX !== undefined ? ticketDesign.textX : 20;
  const ticketTextY = ticketDesign.textY !== undefined ? ticketDesign.textY : 80;
  const ticketTextColor = ticketDesign.textColor || "#FFFFFF";
  const ticketPassLabel = ticketDesign.passLabel || "OFFICIAL ACCESS PASS";
  const ticketPrimaryColor = ticketDesign.primaryColor || "#2563EB";

  // Status check: whether the team registration is confirmed by coordinators
  const isConfirmed = 
    registration?.status?.toLowerCase() === "confirmed" || 
    registration?.status?.toLowerCase() === "approved" ||
    registration?.paymentStatus?.toLowerCase() === "confirmed" ||
    registration?.paymentStatus?.toLowerCase() === "approved";

  const allMembers = [
    { name: displayLeadName, email: displayLeadEmail, isLead: true, studentId: registration?.teamLeadStudentId || "" },
    ...(registration?.members || []).map(m => ({ 
      name: m.name || "Member", 
      email: m.email || "", 
      isLead: false, 
      studentId: m.studentId || "" 
    }))
  ];

  const totalAmount = registration?.totalFeePaid !== undefined ? registration.totalFeePaid : (event?.registrationFee || 0);
  const isFree = totalAmount === 0;

  const orderNumber = registrationId 
    ? `W${registrationId.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase()}` 
    : "W984210491823";

  const formattedDateStr = registration?.createdAt
    ? new Date(registration.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : event?.date || "19 Aug 2026";

  const formattedTimeStr = registration?.createdAt
    ? new Date(registration.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : event?.time || "10:00 AM";

  const handlePrintBrowser = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDownloadTicketImage = async () => {
    setIsExporting(true);
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${registrationId || "mock_reg_123"}`;
      
      const logoImage = new Image();
      logoImage.crossOrigin = "anonymous";

      const qrImage = new Image();
      qrImage.crossOrigin = "anonymous";

      const bgImage = new Image();
      if (ticketBgPreview) {
        bgImage.crossOrigin = "anonymous";
      }

      let loaded = 0;
      const totalImagesToLoad = 2; // (bgImage or logoImage) + qrImage

      const renderCanvas = () => {
        loaded++;
        if (loaded < totalImagesToLoad) return;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setIsExporting(false);
          return;
        }

        // ================= A. CUSTOM UPLOADED TICKET TEMPLATE EXPORT =================
        if (ticketBgPreview && bgImage.complete && bgImage.naturalWidth > 0) {
          const origW = bgImage.naturalWidth;
          const origH = bgImage.naturalHeight;
          canvas.width = origW;
          canvas.height = origH;

          // 1. Draw uploaded ticket template image
          ctx.drawImage(bgImage, 0, 0, origW, origH);

          // 2. Compute QR placeholder coordinates
          const qrWidth = origW * (ticketQrWidthPercent / 100);
          const qrHeight = qrWidth;
          const qrCenterX = origW * (ticketQrX / 100);
          const qrCenterY = origH * (ticketQrY / 100);
          const qrLeft = qrCenterX - qrWidth / 2;
          const qrTop = qrCenterY - qrHeight / 2;

          // 3. QR Background Container
          if (ticketQrBg === "white") {
            const pad = qrWidth * 0.08;
            ctx.fillStyle = "#FFFFFF";
            ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
            ctx.shadowBlur = 16;
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(qrLeft - pad, qrTop - pad, qrWidth + pad * 2, qrHeight + pad * 2, 16);
              ctx.fill();
            } else {
              ctx.fillRect(qrLeft - pad, qrTop - pad, qrWidth + pad * 2, qrHeight + pad * 2);
            }
            ctx.shadowColor = "transparent";
          } else if (ticketQrBg === "glow") {
            const pad = qrWidth * 0.08;
            ctx.fillStyle = "#0B0F19";
            ctx.strokeStyle = "#22D3EE";
            ctx.lineWidth = 4;
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(qrLeft - pad, qrTop - pad, qrWidth + pad * 2, qrHeight + pad * 2, 16);
              ctx.fill();
              ctx.stroke();
            } else {
              ctx.fillRect(qrLeft - pad, qrTop - pad, qrWidth + pad * 2, qrHeight + pad * 2);
              ctx.strokeRect(qrLeft - pad, qrTop - pad, qrWidth + pad * 2, qrHeight + pad * 2);
            }
          }

          // 4. Draw attendee QR code
          ctx.drawImage(qrImage, qrLeft, qrTop, qrWidth, qrHeight);

          // 5. Optional Attendee Text Overlay
          if (ticketShowAttendeeText) {
            const textCenterX = origW * (ticketTextX / 100);
            const textCenterY = origH * (ticketTextY / 100);
            ctx.fillStyle = ticketTextColor;
            ctx.font = `bold ${Math.max(16, Math.round(origW * 0.024))}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(`${displayGroupName} • ID: AV-${registrationId?.slice(-6).toUpperCase() || "PASS"}`, textCenterX, textCenterY);
          }
        } else {
          // ================= B. FALLBACK DEFAULT BOARDING PASS =================
          const scale = 2;
          const w = 840;
          const h = 380;
          
          canvas.width = w * scale;
          canvas.height = h * scale;
          ctx.scale(scale, scale);

          // Background
          ctx.fillStyle = "#FFFFFF";
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(0, 0, w, h, 24);
            ctx.fill();
          } else {
            ctx.fillRect(0, 0, w, h);
          }

          // Header strip
          ctx.fillStyle = ticketPrimaryColor;
          ctx.fillRect(0, 0, w, 10);

          // Left main content (560px)
          const leftW = 560;
          
          // Draw logo & brand
          ctx.drawImage(logoImage, 36, 28, 40, 40);
          ctx.fillStyle = "#0F172A";
          ctx.font = "900 18px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText("AI VERSE", 86, 46);
          ctx.fillStyle = ticketPrimaryColor;
          ctx.font = "800 10px sans-serif";
          ctx.fillText(ticketPassLabel.toUpperCase(), 86, 62);

          // Event Title
          ctx.fillStyle = "#0F172A";
          ctx.font = "900 22px sans-serif";
          ctx.fillText(displayTitle.length > 34 ? displayTitle.substring(0, 34) + "..." : displayTitle, 36, 115);

          // Date, Time, Venue Info Grid
          ctx.fillStyle = "#64748B";
          ctx.font = "800 9px sans-serif";
          ctx.fillText("DATE & TIME", 36, 160);
          ctx.fillText("VENUE / LOCATION", 240, 160);
          ctx.fillText("ADMISSION PASS", 420, 160);

          ctx.fillStyle = "#0F172A";
          ctx.font = "800 13px sans-serif";
          ctx.fillText(`${formattedDateStr} • ${formattedTimeStr}`, 36, 180);
          ctx.fillText(event?.location || "University Tech Campus Hub", 240, 180);
          ctx.fillStyle = "#059669";
          ctx.fillText(isConfirmed ? "✓ CONFIRMED" : "⏱ UNDER REVIEW", 420, 180);

          // Team Info
          ctx.fillStyle = "#64748B";
          ctx.font = "800 9px sans-serif";
          ctx.fillText("TEAM NAME", 36, 225);
          ctx.fillText("TEAM LEAD", 240, 225);
          ctx.fillText("ORDER NO", 420, 225);

          ctx.fillStyle = "#0F172A";
          ctx.font = "900 15px sans-serif";
          ctx.fillText(displayGroupName, 36, 248);

          ctx.fillStyle = "#1E293B";
          ctx.font = "800 13px sans-serif";
          ctx.fillText(displayLeadName, 240, 248);
          ctx.font = "800 12px monospace";
          ctx.fillText(orderNumber, 420, 248);

          // Bottom Barcode / ID Strip
          ctx.fillStyle = "#94A3B8";
          ctx.font = "700 10px monospace";
          ctx.fillText(`|||| | |||||| || ||||||| | |||||   PASS-AV-${registrationId?.slice(-6).toUpperCase() || "2026"}`, 36, 335);

          // Vertical Perforation Line
          ctx.strokeStyle = "#CBD5E1";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(leftW, 0);
          ctx.lineTo(leftW, h);
          ctx.stroke();
          ctx.setLineDash([]);

          // Perforation Notch Cutouts
          ctx.fillStyle = "#F1F5F9";
          ctx.beginPath();
          ctx.arc(leftW, 0, 14, 0, Math.PI, false);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(leftW, h, 14, Math.PI, 0, false);
          ctx.fill();

          // Right Stub (280px)
          const stubX = leftW + 25;
          const qrSize = 140;
          ctx.drawImage(qrImage, stubX + (280 - 50 - qrSize) / 2, 60, qrSize, qrSize);

          ctx.fillStyle = "#64748B";
          ctx.font = "800 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("SCAN FOR VENUE CHECK-IN", stubX + (280 - 50) / 2, 235);

          ctx.fillStyle = "#0F172A";
          ctx.font = "900 12px monospace";
          ctx.fillText(`AV-${registrationId?.slice(-6).toUpperCase() || "PASS"}`, stubX + (280 - 50) / 2, 260);

          ctx.fillStyle = isConfirmed ? "#059669" : "#D97706";
          ctx.font = "800 10px sans-serif";
          ctx.fillText(isConfirmed ? "OFFICIALLY VERIFIED" : "VERIFICATION PENDING", stubX + (280 - 50) / 2, 285);
        }

        // Download canvas
        const blobUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = blobUrl;
        
        const cleanGroupName = displayGroupName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const cleanEventName = displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        link.download = `${cleanEventName}_${cleanGroupName}_ticket.png`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExporting(false);
      };

      if (ticketBgPreview) {
        bgImage.onload = renderCanvas;
        bgImage.onerror = () => renderCanvas();
        bgImage.src = ticketBgPreview;
      } else {
        logoImage.onload = renderCanvas;
        logoImage.onerror = () => renderCanvas();
        logoImage.src = "/ai_verse.png";
      }

      qrImage.onload = renderCanvas;
      qrImage.onerror = (err) => {
        console.error("Failed to load QR image for canvas download", err);
        alert("Failed to render ticket image. Please try using Print Ticket instead.");
        setIsExporting(false);
      };
      qrImage.src = qrUrl;
    } catch (err) {
      console.error("Error downloading ticket image:", err);
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans text-left selection:bg-blue-600 selection:text-white pb-20 print:bg-white print:p-0">
      <SEO 
        title={`Event Ticket • ${displayTitle} • AI Verse`}
        description={`Your official event ticket pass for ${displayTitle}.`}
      />

      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="no-print border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img 
              src="/ai_verse.png" 
              alt="AI Verse Logo" 
              className="w-8 h-8 object-contain group-hover:scale-105 transition-transform" 
            />
            <span className="font-extrabold text-sm text-slate-850 tracking-tight">AI Verse</span>
          </Link>
          <span className="text-slate-300 font-medium">/</span>
          <span className="text-xs font-bold text-slate-500 truncate max-w-[200px] sm:max-w-xs">
            {displayTitle}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Copy Ticket URL"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>
          
          <button
            onClick={handlePrintBrowser}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Print Ticket"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <Link to="/">
            <button className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs">
              <Home className="w-3.5 h-3.5" />
              <span>Portal</span>
            </button>
          </Link>
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-28">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 mt-4 font-bold uppercase tracking-wider animate-pulse">
            Loading your attendance pass...
          </p>
        </div>
      ) : (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 print-container">
          
          {/* Header Banner */}
          <div className="text-center space-y-2.5 max-w-2xl mx-auto no-print">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-black uppercase tracking-wider shadow-2xs">
              {isConfirmed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Team Registration Confirmed & Verified</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span className="text-amber-800">Registration Under Coordinator Review</span>
                </>
              )}
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              Official Attendance Pass
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              Save or download this official ticket pass. Present the QR code on your mobile device at the venue check-in desk upon arrival.
            </p>
          </div>

          {/* ================= HERO TICKET SHOWCASE ================= */}
          <div className="flex flex-col items-center justify-center">
            
            {ticketBgPreview ? (
              /* ================= 1. CUSTOM UPLOADED TICKET TEMPLATE ================= */
              <div 
                ref={ticketRef}
                className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.14)] border border-slate-200 bg-slate-950 relative select-none group transition-all"
              >
                {/* Custom Ticket Graphic */}
                <img 
                  src={ticketBgPreview} 
                  alt="Official Event Ticket" 
                  className="w-full h-auto object-contain block"
                />

                {/* Stamped Dynamic Attendee QR Code */}
                <div 
                  style={{
                    left: `${ticketQrX}%`,
                    top: `${ticketQrY}%`,
                    width: `${ticketQrWidthPercent}%`,
                    transform: "translate(-50%, -50%)"
                  }}
                  className={`absolute z-20 aspect-square flex items-center justify-center p-1.5 sm:p-2.5 rounded-2xl transition-transform hover:scale-105 ${
                    ticketQrBg === "white"
                      ? "bg-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] border border-slate-200/80"
                      : ticketQrBg === "glow"
                      ? "bg-slate-950/90 shadow-[0_0_25px_#22d3ee] border-2 border-cyan-400 backdrop-blur-xs"
                      : "bg-transparent"
                  }`}
                >
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${registrationId || "mock_reg_123"}`} 
                    alt="Attendance QR Code"
                    className="w-full h-full object-contain block"
                  />
                </div>

                {/* Optional Attendee Text Overlay */}
                {ticketShowAttendeeText && (
                  <div
                    style={{
                      left: `${ticketTextX}%`,
                      top: `${ticketTextY}%`,
                      color: ticketTextColor,
                      transform: "translate(-50%, -50%)"
                    }}
                    className="absolute z-20 text-center font-black tracking-wide text-xs sm:text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] pointer-events-none whitespace-nowrap"
                  >
                    {displayGroupName} • AV-{registrationId?.slice(-6).toUpperCase() || "PASS"}
                  </div>
                )}
              </div>
            ) : (
              /* ================= 2. DEFAULT VIP BOARDING PASS ================= */
              <div 
                ref={ticketRef}
                className="w-full max-w-3xl rounded-3xl bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden grid grid-cols-1 md:grid-cols-12 relative select-none"
              >
                {/* Decorative Top Gradient Accent */}
                <div 
                  style={{ backgroundColor: ticketPrimaryColor }} 
                  className="absolute top-0 left-0 right-0 h-2.5 z-10"
                />

                {/* Main Ticket Section (Left - 8 cols) */}
                <div className="md:col-span-8 p-6 sm:p-8 flex flex-col justify-between space-y-6 text-left">
                  
                  {/* Brand & Pass Type */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src="/ai_verse.png" 
                        alt="AI Verse Logo" 
                        className="w-10 h-10 object-contain drop-shadow-xs" 
                      />
                      <div>
                        <h3 className="font-black text-slate-900 text-sm tracking-tight">AI VERSE</h3>
                        <span 
                          style={{ color: ticketPrimaryColor }} 
                          className="text-[10px] font-black uppercase tracking-wider block"
                        >
                          {ticketPassLabel}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider font-mono">
                      ORDER #{orderNumber}
                    </span>
                  </div>

                  {/* Event Title */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block">
                      {event?.category || "FEATURED EVENT"}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                      {displayTitle}
                    </h2>
                  </div>

                  {/* 2-Column Info Grid */}
                  <div className="grid grid-cols-2 gap-4 py-2 border-t border-b border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Date & Time
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-800 block">
                        {formattedDateStr}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        {formattedTimeStr}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Venue / Location
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-800 block truncate">
                        {event?.location || "University Campus Hub"}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Main Auditorium
                      </span>
                    </div>
                  </div>

                  {/* Team & Lead Information */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Registered Team
                      </span>
                      <span className="text-sm font-black text-slate-900 block">
                        {displayGroupName}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Lead: {displayLeadName}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Admission Pass
                      </span>
                      <span className="text-sm font-mono font-black text-blue-600 block">
                        AV-{registrationId?.slice(-6).toUpperCase() || "PASS"}
                      </span>
                      <span className="text-[10px] font-extrabold text-emerald-600 block">
                        ✓ {allMembers.length} Attendee(s)
                      </span>
                    </div>
                  </div>

                </div>

                {/* Perforation Divider (Desktop Only) */}
                <div className="hidden md:flex md:col-span-1 relative flex-col items-center justify-between py-6">
                  {/* Top Notch Cutout */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-slate-50 border border-slate-200 shadow-inner z-20" />
                  
                  {/* Dashed Line */}
                  <div className="w-[1.5px] h-full border-r-2 border-dashed border-slate-200" />
                  
                  {/* Bottom Notch Cutout */}
                  <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-slate-50 border border-slate-200 shadow-inner z-20" />
                </div>

                {/* Right Stub Section (Right - 3 cols) */}
                <div className="md:col-span-3 bg-slate-50/70 p-6 flex flex-col items-center justify-center text-center space-y-3.5 border-t md:border-t-0 border-slate-100">
                  <div className="p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${registrationId || "mock_reg_123"}`} 
                      alt="Attendance QR" 
                      className="w-32 h-32 object-contain block"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">
                      Scan at Entrance
                    </span>
                    <span className="text-xs font-mono font-black text-slate-900 block">
                      AV-{registrationId?.slice(-6).toUpperCase() || "PASS"}
                    </span>
                  </div>

                  <div className="pt-1">
                    <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      isConfirmed 
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      {isConfirmed ? "Confirmed" : "Review"}
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* ================= QUICK ACTION BUTTONS ================= */}
            <div className="w-full max-w-3xl flex flex-wrap items-center justify-center gap-3 pt-6 no-print">
              {/* Primary PNG Download Button */}
              <button
                onClick={handleDownloadTicketImage}
                disabled={isExporting}
                className="flex-1 min-w-[240px] sm:flex-none py-3.5 px-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20 hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-75"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download Ticket Pass (PNG)</span>
              </button>

              {/* Print Ticket Button */}
              <button
                onClick={handlePrintBrowser}
                className="py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                <span>Print Ticket</span>
              </button>

              {/* Copy Share Link */}
              <button
                onClick={handleCopyLink}
                className="py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              {/* WhatsApp Community Group */}
              {event?.whatsGroupLink && (
                <a
                  href={event.whatsGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3.5 px-6 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Join WhatsApp Group</span>
                </a>
              )}
            </div>

          </div>

          {/* ================= COMPREHENSIVE EVENT & ROSTER DETAILS ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 no-print text-left">
            
            {/* 1. Team & Attendees Roster */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Registered Team Roster
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {allMembers.length} Members
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Team Name
                  </span>
                  <h4 className="text-sm font-black text-slate-900">
                    {displayGroupName}
                  </h4>
                </div>

                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Participants List:
                  </span>
                  {allMembers.map((m, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/60 border border-slate-100">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5 ${
                        m.isLead ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="leading-tight flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-850 truncate">{m.name}</span>
                          {m.isLead && (
                            <span className="text-[9px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                              Lead
                            </span>
                          )}
                        </div>
                        {m.studentId && (
                          <span className="text-[10px] font-mono text-slate-500 block truncate">
                            Roll: {m.studentId}
                          </span>
                        )}
                        {m.email && (
                          <span className="text-[10px] text-slate-400 font-medium block truncate">
                            {m.email}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Event & Venue Logistics */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  Event Logistics
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                  Schedule
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Event Title
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                    {displayTitle}
                  </h4>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Date & Schedule
                  </span>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Calendar className="w-3.5 h-3.5 text-purple-500" />
                    <span>{formattedDateStr} • {formattedTimeStr}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Venue / Hall
                  </span>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-purple-500" />
                    <span>{event?.location || "University Campus Hub / Virtual Hub"}</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50/50 border border-purple-100 text-[11px] text-purple-900 leading-relaxed font-semibold">
                  📌 <strong className="font-black">Check-in Note:</strong> Please bring your college ID badge. On-site entry begins 30 minutes before commencement.
                </div>
              </div>
            </div>

            {/* 3. Verification & Order Information */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Order & Verification
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  isConfirmed 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                    : "bg-amber-50 text-amber-700 border border-amber-100"
                }`}>
                  {isConfirmed ? "Verified" : "Pending Review"}
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Order ID</span>
                    <span className="text-xs font-mono font-black text-slate-850 block mt-0.5 truncate">{orderNumber}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Amount</span>
                    <span className="text-xs font-black text-slate-850 block mt-0.5">
                      {isFree ? "Free Pass" : `₹${totalAmount}.00`}
                    </span>
                  </div>
                </div>

                {/* 3-Step Verification Checklist */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                    <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 text-emerald-700 font-black text-[10px] flex items-center justify-center shrink-0">
                      ✓
                    </div>
                    <span>Registration details submitted</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                    <div className={`w-4.5 h-4.5 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${
                      isConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700 animate-pulse"
                    }`}>
                      {isConfirmed ? "✓" : "2"}
                    </div>
                    <span className={isConfirmed ? "text-slate-700" : "text-amber-800 font-bold"}>
                      {isConfirmed ? "Coordinator review confirmed" : "Coordinator verification in progress"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                    <div className={`w-4.5 h-4.5 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${
                      isConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                    }`}>
                      {isConfirmed ? "✓" : "3"}
                    </div>
                    <span>QR Attendance Pass active</span>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <Link 
                    to="/"
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors inline-block"
                  >
                    ← Return to AI Verse Portal
                  </Link>
                </div>
              </div>
            </div>

          </div>

        </main>
      )}

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-slate-400 font-medium no-print">
        © 2026 AI Verse Club. Official Event Attendance Ticket Pass.
      </footer>

    </div>
  );
};

export default TicketPage;
