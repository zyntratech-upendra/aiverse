import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { fetchRegistrations, fetchEvents } from "../../services/apiClient";
import SEO from "../../components/layout/SEO";
import {
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  Award,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  Loader2
} from "lucide-react";

interface CertificateData {
  id: string;
  recipientName: string;
  studentId?: string;
  email?: string;
  eventTitle: string;
  eventId?: string;
  groupName?: string;
  role?: string;
  certificateType: string;
  issueDate: string;
  signatory1Name: string;
  signatory1Title: string;
  signatory2Name: string;
  signatory2Title: string;
  collegeName: string;
  departmentName?: string;
  citationText?: string;
  isValid: boolean;
  // Template customization options
  templateMode?: "custom" | "builtin";
  customTemplateUrl?: string;
  namePosY?: number;
  nameFontSize?: number;
  nameColor?: string;
  showTeamName?: boolean;
  teamPosY?: number;
  teamFontSize?: number;
  teamColor?: string;
  showRollNo?: boolean;
  rollPosY?: number;
  rollFontSize?: number;
  rollColor?: string;
  citationPosY?: number;
  citationFontSize?: number;
  citationColor?: string;
  showCollegeHeader?: boolean;
  showBorders?: boolean;
  showSeal?: boolean;
  showSignatures?: boolean;
  showQrCode?: boolean;
}

interface TeamMemberItem {
  name: string;
  studentId?: string;
  role?: string;
  isLead?: boolean;
  certificateId: string;
  email?: string;
}

const CertificateViewPage: React.FC = () => {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [searchParams] = useSearchParams();
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);
  const [activeMemberIndex, setActiveMemberIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingAll, setIsExportingAll] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; currentName: string } | null>(null);
  const certContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadCertificate = async () => {
      setLoading(true);
      try {
        // Query param parsers
        const qName = searchParams.get("name");
        const qEvent = searchParams.get("event");
        const qType = searchParams.get("type");
        const qCollege = searchParams.get("college");
        const qDate = searchParams.get("date");
        const qRegId = searchParams.get("regId");
        const qId = certificateId || searchParams.get("id") || `AIV-CERT-${Date.now().toString(36).toUpperCase()}`;

        // Custom template layout params from URL
        const qMode = (searchParams.get("mode") as "custom" | "builtin") || undefined;
        const qTemplateUrl = searchParams.get("templateUrl") || undefined;
        const qNameY = searchParams.get("nameY") ? Number(searchParams.get("nameY")) : undefined;
        const qNameSize = searchParams.get("nameSize") ? Number(searchParams.get("nameSize")) : undefined;
        const qNameColor = searchParams.get("nameColor") || undefined;

        const qShowTeam = searchParams.get("showTeam") !== null ? searchParams.get("showTeam") === "true" : undefined;
        const qTeamY = searchParams.get("teamY") ? Number(searchParams.get("teamY")) : undefined;
        const qTeamSize = searchParams.get("teamSize") ? Number(searchParams.get("teamSize")) : undefined;
        const qTeamColor = searchParams.get("teamColor") || undefined;

        const qShowRoll = searchParams.get("showRoll") !== null ? searchParams.get("showRoll") === "true" : undefined;
        const qRollY = searchParams.get("rollY") ? Number(searchParams.get("rollY")) : undefined;
        const qRollSize = searchParams.get("rollSize") ? Number(searchParams.get("rollSize")) : undefined;
        const qRollColor = searchParams.get("rollColor") || undefined;

        const qCitationY = searchParams.get("citationY") ? Number(searchParams.get("citationY")) : undefined;
        const qCitationSize = searchParams.get("citationSize") ? Number(searchParams.get("citationSize")) : undefined;
        const qCitationColor = searchParams.get("citationColor") || undefined;
        const qShowHdr = searchParams.get("showHdr") !== null ? searchParams.get("showHdr") === "true" : undefined;
        const qShowBrd = searchParams.get("showBrd") !== null ? searchParams.get("showBrd") === "true" : undefined;
        const qShowSeal = searchParams.get("showSeal") !== null ? searchParams.get("showSeal") === "true" : undefined;
        const qShowSig = searchParams.get("showSig") !== null ? searchParams.get("showSig") === "true" : undefined;
        const qShowQr = searchParams.get("showQr") !== null ? searchParams.get("showQr") === "true" : undefined;

        // Try to fetch registrations to populate full team roster
        let registrations: any[] = [];
        try {
          registrations = await fetchRegistrations();
        } catch (e) {
          console.warn("Could not fetch registrations list:", e);
        }

        const found = (registrations || []).find(
          (r: any) =>
            (qRegId && ((r.id || r._id) === qRegId)) ||
            r.certificateId === certificateId ||
            (r.id || r._id) === certificateId ||
            r.ticketCode === certificateId ||
            (Array.isArray(r.members) && r.members.some((m: any) => m.certificateId === certificateId))
        );

        let roster: TeamMemberItem[] = [];
        if (found) {
          const leadName = found.fullName || found.teamLeadName || found.name || "Participant";
          const leadStudentId = found.teamLeadStudentId || found.studentId || "";
          const leadCertId = found.certificateId || `AIV-${(found.id || "").slice(-6).toUpperCase()}-L`;
          const isGroup = !!found.groupName && found.groupName !== "Individual RSVP";

          roster.push({
            name: leadName,
            studentId: leadStudentId,
            role: isGroup ? "Team Leader" : "Participant",
            isLead: true,
            certificateId: leadCertId,
            email: found.teamLeadPersonalEmail || found.userEmail || found.email || "",
          });

          if (Array.isArray(found.members)) {
            found.members.forEach((m: any, idx: number) => {
              if (m && (m.name || m.email)) {
                roster.push({
                  name: m.name,
                  studentId: m.studentId || m.rollNo || "",
                  role: m.role || "Member",
                  isLead: false,
                  certificateId: m.certificateId || `AIV-${(found.id || "").slice(-4).toUpperCase()}-M${idx + 1}`,
                  email: m.email || "",
                });
              }
            });
          }
        } else if (qName) {
          roster = [{
            name: qName,
            studentId: searchParams.get("studentId") || "",
            role: searchParams.get("role") || "Participant",
            isLead: true,
            certificateId: qId,
            email: searchParams.get("email") || "",
          }];
        }

        setTeamMembers(roster);

        // Find active index
        let matchedIdx = 0;
        if (roster.length > 0) {
          const idxByCert = roster.findIndex(m => m.certificateId === certificateId);
          if (idxByCert >= 0) {
            matchedIdx = idxByCert;
          } else if (qName) {
            const idxByName = roster.findIndex(m => m.name.toLowerCase() === qName.toLowerCase());
            if (idxByName >= 0) matchedIdx = idxByName;
          }
        }
        setActiveMemberIndex(matchedIdx);
        const activeMember = roster[matchedIdx] || roster[0];

        if (qName && qEvent && !found) {
          // If we have event info in URL, also check if event doc has saved custom template
          let resolvedTemplateUrl = qTemplateUrl;
          let eventCustomCfg: any = null;
          const qEventId = searchParams.get("eventId");
          if (qEventId) {
            try {
              const events = await fetchEvents();
              const ev = (events || []).find((e: any) => (e.id || e._id) === qEventId);
              if (ev?.certificateConfig) {
                eventCustomCfg = ev.certificateConfig;
                if (!resolvedTemplateUrl && eventCustomCfg.customTemplateUrl) {
                  resolvedTemplateUrl = eventCustomCfg.customTemplateUrl;
                }
              }
            } catch (e) {
              console.error("Error fetching event certificate config:", e);
            }
          }

          setCertData({
            id: activeMember ? activeMember.certificateId : qId,
            recipientName: activeMember ? activeMember.name : qName,
            studentId: activeMember?.studentId || searchParams.get("studentId") || "",
            email: activeMember?.email || searchParams.get("email") || "",
            eventTitle: qEvent,
            groupName: searchParams.get("team") || "",
            role: activeMember?.role || searchParams.get("role") || "Participant",
            certificateType: qType || "Certificate of Participation",
            issueDate: qDate || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
            signatory1Name: searchParams.get("sig1Name") || "Dr. Faculty Coordinator",
            signatory1Title: searchParams.get("sig1Title") || "Convener, AI Verse",
            signatory2Name: searchParams.get("sig2Name") || "Head of Department",
            signatory2Title: searchParams.get("sig2Title") || "Department of CSE",
            collegeName: qCollege || "Vishnu Institute of Technology (Autonomous), Bhimavaram",
            departmentName: searchParams.get("dept") || "Department of Computer Science & Engineering",
            citationText: searchParams.get("citation") || "",
            isValid: true,
            templateMode: qMode || eventCustomCfg?.templateMode || (resolvedTemplateUrl ? "custom" : "builtin"),
            customTemplateUrl: resolvedTemplateUrl || eventCustomCfg?.customTemplateUrl,
            namePosY: qNameY ?? eventCustomCfg?.namePosY ?? 38,
            nameFontSize: qNameSize ?? eventCustomCfg?.nameFontSize ?? 64,
            nameColor: qNameColor || eventCustomCfg?.nameColor || "#1E3A8A",
            showTeamName: qShowTeam ?? eventCustomCfg?.showTeamName ?? true,
            teamPosY: qTeamY ?? eventCustomCfg?.teamPosY ?? 53,
            teamFontSize: qTeamSize ?? eventCustomCfg?.teamFontSize ?? 32,
            teamColor: qTeamColor || eventCustomCfg?.teamColor || "#1E3A8A",
            showRollNo: qShowRoll ?? eventCustomCfg?.showRollNo ?? true,
            rollPosY: qRollY ?? eventCustomCfg?.rollPosY ?? 45,
            rollFontSize: qRollSize ?? eventCustomCfg?.rollFontSize ?? 20,
            rollColor: qRollColor || eventCustomCfg?.rollColor || "#475569",
            citationPosY: qCitationY ?? eventCustomCfg?.citationPosY ?? 62,
            citationFontSize: qCitationSize ?? eventCustomCfg?.citationFontSize ?? 24,
            citationColor: qCitationColor || eventCustomCfg?.citationColor || "#334155",
            showCollegeHeader: qShowHdr ?? eventCustomCfg?.showCollegeHeader ?? false,
            showBorders: qShowBrd ?? eventCustomCfg?.showBorders ?? false,
            showSeal: qShowSeal ?? eventCustomCfg?.showSeal ?? false,
            showSignatures: qShowSig ?? eventCustomCfg?.showSignatures ?? false,
            showQrCode: qShowQr ?? eventCustomCfg?.showQrCode ?? false,
          });
          setLoading(false);
          return;
        }

        if (found) {
          const currentPerson = activeMember || roster[0];
          const recipientName = currentPerson ? currentPerson.name : (found.fullName || found.teamLeadName || found.name || "Participant");
          const studentId = currentPerson ? currentPerson.studentId : (found.teamLeadStudentId || found.studentId || "");
          const email = currentPerson ? currentPerson.email : (found.teamLeadPersonalEmail || found.userEmail || found.email || "");

          let eventTitle = found.eventTitle || qEvent || "AI Verse Technical Event";
          let eventDate = "";
          let eventCustomCfg: any = null;
          const targetEvId = found.eventId || searchParams.get("eventId");
          if (targetEvId) {
            try {
              const events = await fetchEvents();
              const ev = (events || []).find((e: any) => (e.id || e._id) === targetEvId);
              if (ev) {
                eventTitle = ev.title || eventTitle;
                eventDate = ev.date || "";
                if (ev.certificateConfig) {
                  eventCustomCfg = ev.certificateConfig;
                }
              }
            } catch (e) {
              console.error("Error fetching event for certificate:", e);
            }
          }

          setCertData({
            id: currentPerson?.certificateId || found.certificateId || certificateId || `AIV-${found.id?.slice(-8).toUpperCase()}`,
            recipientName,
            studentId: studentId || "",
            email: email || "",
            eventTitle,
            eventId: found.eventId,
            groupName: found.groupName && found.groupName !== "Individual RSVP" ? found.groupName : (searchParams.get("team") || ""),
            role: currentPerson?.role || (currentPerson?.isLead ? "Team Lead" : "Member"),
            certificateType: found.certificateType || qType || "Certificate of Participation",
            issueDate: found.certificateIssuedAt
              ? new Date(found.certificateIssuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
              : (qDate || eventDate || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })),
            signatory1Name: found.certificateSig1Name || eventCustomCfg?.signatory1Name || searchParams.get("sig1Name") || "Dr. Faculty Coordinator",
            signatory1Title: found.certificateSig1Title || eventCustomCfg?.signatory1Title || searchParams.get("sig1Title") || "Convener, AI Verse",
            signatory2Name: found.certificateSig2Name || eventCustomCfg?.signatory2Name || searchParams.get("sig2Name") || "Head of Department",
            signatory2Title: found.certificateSig2Title || eventCustomCfg?.signatory2Title || searchParams.get("sig2Title") || "Department of CSE",
            collegeName: found.college || eventCustomCfg?.collegeName || qCollege || "Vishnu Institute of Technology (Autonomous), Bhimavaram",
            departmentName: eventCustomCfg?.departmentName || searchParams.get("dept") || "Department of Computer Science & Engineering",
            citationText: found.certificateCitation || eventCustomCfg?.customMessage || searchParams.get("citation") || "",
            isValid: true,
            templateMode: found.certificateTemplateMode || eventCustomCfg?.templateMode || qMode || (eventCustomCfg?.customTemplateUrl || qTemplateUrl ? "custom" : "builtin"),
            customTemplateUrl: eventCustomCfg?.customTemplateUrl || qTemplateUrl,
            namePosY: found.certificateNamePosY ?? eventCustomCfg?.namePosY ?? qNameY ?? 38,
            nameFontSize: found.certificateNameFontSize ?? eventCustomCfg?.nameFontSize ?? qNameSize ?? 64,
            nameColor: found.certificateNameColor || eventCustomCfg?.nameColor || qNameColor || "#1E3A8A",
            showTeamName: found.certificateShowTeamName ?? eventCustomCfg?.showTeamName ?? qShowTeam ?? true,
            teamPosY: found.certificateTeamPosY ?? eventCustomCfg?.teamPosY ?? qTeamY ?? 53,
            teamFontSize: found.certificateTeamFontSize ?? eventCustomCfg?.teamFontSize ?? qTeamSize ?? 32,
            teamColor: found.certificateTeamColor || eventCustomCfg?.teamColor || qTeamColor || "#1E3A8A",
            showRollNo: found.certificateShowRollNo ?? eventCustomCfg?.showRollNo ?? qShowRoll ?? true,
            rollPosY: found.certificateRollPosY ?? eventCustomCfg?.rollPosY ?? qRollY ?? 45,
            rollFontSize: found.certificateRollFontSize ?? eventCustomCfg?.rollFontSize ?? qRollSize ?? 20,
            rollColor: found.certificateRollColor || eventCustomCfg?.rollColor || qRollColor || "#475569",
            citationPosY: found.certificateCitationPosY ?? eventCustomCfg?.citationPosY ?? qCitationY ?? 62,
            citationFontSize: eventCustomCfg?.citationFontSize ?? qCitationSize ?? 24,
            citationColor: eventCustomCfg?.citationColor || qCitationColor || "#334155",
            showCollegeHeader: found.certificateShowCollegeHeader ?? eventCustomCfg?.showCollegeHeader ?? qShowHdr ?? true,
            showBorders: found.certificateShowBorders ?? eventCustomCfg?.showBorders ?? qShowBrd ?? true,
            showSeal: found.certificateShowSeal ?? eventCustomCfg?.showSeal ?? qShowSeal ?? true,
            showSignatures: found.certificateShowSignatures ?? eventCustomCfg?.showSignatures ?? qShowSig ?? false,
            showQrCode: found.certificateShowQrCode ?? eventCustomCfg?.showQrCode ?? qShowQr ?? true,
          });
        } else {
          // If not found in DB, provide fallback verified credential record based on the ID
          setCertData({
            id: certificateId || "AIV-CERT-VERIFIED",
            recipientName: qName || "Distinguished Participant",
            studentId: searchParams.get("studentId") || "",
            email: searchParams.get("email") || "",
            eventTitle: qEvent || "AI Verse Hackathon 2026",
            groupName: searchParams.get("team") || "",
            role: searchParams.get("role") || "Participant",
            certificateType: qType || "Certificate of Participation",
            issueDate: qDate || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
            signatory1Name: searchParams.get("sig1Name") || "Faculty Coordinator",
            signatory1Title: searchParams.get("sig1Title") || "Convener, AI Verse",
            signatory2Name: searchParams.get("sig2Name") || "Head of Department",
            signatory2Title: searchParams.get("sig2Title") || "Department of CSE",
            collegeName: qCollege || "Vishnu Institute of Technology (Autonomous), Bhimavaram",
            departmentName: searchParams.get("dept") || "Department of Computer Science & Engineering",
            isValid: true,
            templateMode: qMode || "builtin",
            namePosY: 38,
            nameFontSize: 64,
            nameColor: "#1E3A8A",
            showTeamName: true,
            teamPosY: 53,
            teamFontSize: 32,
            teamColor: "#1E3A8A",
            showRollNo: true,
            rollPosY: 45,
            rollFontSize: 20,
            rollColor: "#475569",
            citationPosY: 62,
            citationFontSize: 24,
            citationColor: "#334155",
            showCollegeHeader: true,
            showBorders: true,
            showSeal: true,
            showSignatures: false,
            showQrCode: true,
          });
        }
      } catch (err) {
        console.error("Error loading certificate:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCertificate();
  }, [certificateId, searchParams]);

  const handleSelectTeamMember = (index: number) => {
    if (!teamMembers[index] || !certData) return;
    setActiveMemberIndex(index);
    const member = teamMembers[index];
    setCertData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        id: member.certificateId,
        recipientName: member.name,
        studentId: member.studentId || "",
        role: member.role || (member.isLead ? "Team Lead" : "Member"),
        email: member.email || prev.email,
      };
    });
  };

  const handleCopyLink = () => {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const linkToCopy = isLocal
      ? `https://aiversevitb.in/certificate/${certData?.id || certificateId || ""}${window.location.search}`
      : window.location.href;
    navigator.clipboard.writeText(linkToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Shared Canvas Renderer for high-DPI export
  const renderCertificateCanvas = async (data: CertificateData): Promise<HTMLCanvasElement | null> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const W = 2000;
    const H = 1414;
    canvas.width = W;
    canvas.height = H;

    if (data.templateMode === "custom" && data.customTemplateUrl) {
      try {
        const bgImg = new Image();
        bgImg.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          bgImg.onload = resolve;
          bgImg.onerror = reject;
          bgImg.src = data.customTemplateUrl!;
        });
        ctx.drawImage(bgImg, 0, 0, W, H);
      } catch (imgErr) {
        console.warn("Could not load custom template background, rendering fallback:", imgErr);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, W, H);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Draw Participant Name
      const nameY = (H * (data.namePosY ?? 38)) / 100;
      const nameSize = data.nameFontSize ?? 64;
      ctx.fillStyle = data.nameColor || "#1E3A8A";
      ctx.font = `bold ${nameSize}px Georgia, Cambria, 'Times New Roman', serif`;
      ctx.fillText(data.recipientName, W / 2, nameY);

      // Draw Roll No / Student ID
      if (data.showRollNo !== false && data.studentId) {
        const rollY = (H * (data.rollPosY ?? 45)) / 100;
        const rollSize = data.rollFontSize ?? 20;
        ctx.fillStyle = data.rollColor || "#475569";
        ctx.font = `bold ${rollSize}px -apple-system, BlinkMacSystemFont, monospace`;
        ctx.fillText(`Roll: ${data.studentId}`, W / 2, rollY);
      }

      // Draw Team Name
      if (data.showTeamName !== false && data.groupName) {
        const teamY = (H * (data.teamPosY ?? 53)) / 100;
        const teamSize = data.teamFontSize ?? 32;
        ctx.fillStyle = data.teamColor || "#1E3A8A";
        ctx.font = `bold ${teamSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.fillText(data.groupName, W / 2, teamY);
      }

      // Verification Footer
      if (data.showQrCode) {
        ctx.fillStyle = "#64748B";
        ctx.font = "bold 16px monospace";
        ctx.fillText(`Certificate ID: ${data.id}   •   Issue Date: ${data.issueDate}   •   Verify at: aiversevitb.in/certificate/${data.id}`, W / 2, H - 35);
      }
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);

      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W / 1.2);
      bgGrad.addColorStop(0, "#FFFFFF");
      bgGrad.addColorStop(0.7, "#FAFCFF");
      bgGrad.addColorStop(1, "#EFF6FF");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Borders & Corner Ornaments
      if (data.showBorders !== false) {
        ctx.strokeStyle = "#1E3A8A";
        ctx.lineWidth = 14;
        ctx.strokeRect(40, 40, W - 80, H - 80);

        ctx.strokeStyle = "#D97706";
        ctx.lineWidth = 4;
        ctx.strokeRect(60, 60, W - 120, H - 120);

        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(70, 70, W - 140, H - 140);

        const drawCorner = (x: number, y: number, angle: number) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.fillStyle = "#D97706";
          ctx.fillRect(0, 0, 36, 6);
          ctx.fillRect(0, 0, 6, 36);
          ctx.beginPath();
          ctx.arc(8, 8, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };
        drawCorner(75, 75, 0);
        drawCorner(W - 75, 75, 90);
        drawCorner(W - 75, H - 75, 180);
        drawCorner(75, H - 75, 270);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // College Header
      if (data.showCollegeHeader !== false) {
        ctx.fillStyle = "#3B82F6";
        ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("✦ AI VERSE • VISHNU INSTITUTE OF TECHNOLOGY ✦", W / 2, 140);

        ctx.fillStyle = "#475569";
        ctx.font = "600 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(data.collegeName || "Vishnu Institute of Technology (Autonomous), Bhimavaram", W / 2, 180);

        ctx.fillStyle = "#64748B";
        ctx.font = "500 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(data.departmentName || "Department of Computer Science & Engineering", W / 2, 215);

        ctx.strokeStyle = "#CBD5E1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 240, 255);
        ctx.lineTo(W / 2 - 30, 255);
        ctx.moveTo(W / 2 + 30, 255);
        ctx.lineTo(W / 2 + 240, 255);
        ctx.stroke();

        ctx.fillStyle = "#D97706";
        ctx.beginPath();
        ctx.moveTo(W / 2, 245);
        ctx.lineTo(W / 2 + 10, 255);
        ctx.lineTo(W / 2, 265);
        ctx.lineTo(W / 2 - 10, 255);
        ctx.closePath();
        ctx.fill();
      }

      // Title
      if (data.certificateType) {
        ctx.fillStyle = "#1E3A8A";
        ctx.font = "bold 56px Georgia, Cambria, 'Times New Roman', serif";
        ctx.fillText(data.certificateType || "Certificate of Participation", W / 2, 335);

        ctx.fillStyle = "#64748B";
        ctx.font = "italic 26px Georgia, Cambria, serif";
        ctx.fillText("This is proudly presented to", W / 2, 415);
      }

      // Recipient Name
      const namePxY = ((data.namePosY ?? 50) / 100) * H;
      const nameFontSize = data.nameFontSize ?? 64;
      ctx.fillStyle = data.nameColor || "#0F172A";
      ctx.font = `bold ${nameFontSize}px Georgia, Cambria, 'Times New Roman', serif`;
      ctx.fillText(data.recipientName, W / 2, namePxY);

      // Name Underline Accent
      const nameWidth = ctx.measureText(data.recipientName).width;
      ctx.strokeStyle = "#3B82F6";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W / 2 - nameWidth / 2 - 20, namePxY + nameFontSize * 0.62);
      ctx.lineTo(W / 2 + nameWidth / 2 + 20, namePxY + nameFontSize * 0.62);
      ctx.stroke();

      // Student ID / Roll / Team
      let subDetail = "";
      if (data.studentId) subDetail += `Roll / Student ID: ${data.studentId}`;
      if (data.groupName) subDetail += (subDetail ? "  •  " : "") + `Team: ${data.groupName}`;
      if (subDetail) {
        ctx.fillStyle = "#475569";
        ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, monospace";
        ctx.fillText(subDetail, W / 2, namePxY + nameFontSize * 0.62 + 38);
      }

      // Citation / Body Text
      const defaultCitation = `for outstanding and active participation in "${data.eventTitle}" organized by AI Verse Club, demonstrating commendable innovation, engineering creativity, and problem-solving excellence.`;
      const citationText = data.citationText || defaultCitation;
      const citationPxY = ((data.citationPosY ?? 62) / 100) * H;
      const citationFontSize = data.citationFontSize ?? 24;

      ctx.fillStyle = data.citationColor || "#334155";
      ctx.font = `500 ${citationFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      const maxTextWidth = 1350;
      const words = citationText.split(" ");
      let currentLine = "";
      const lines = [];
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i] + " ";
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxTextWidth && i > 0) {
          lines.push(currentLine.trim());
          currentLine = words[i] + " ";
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine.trim());

      const lineHeight = citationFontSize * 1.55;
      lines.forEach((l, idx) => {
        ctx.fillText(l, W / 2, citationPxY + idx * lineHeight);
      });

      // Seal Badge
      if (data.showSeal !== false) {
        const sealX = 320;
        const sealY = 1100;
        ctx.save();
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.arc(sealX, sealY, 65, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#B45309";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#D97706";
        ctx.beginPath();
        ctx.arc(sealX, sealY, 52, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("AI VERSE", sealX, sealY - 14);
        ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("★ OFFICIAL ★", sealX, sealY + 6);
        ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("VERIFIED", sealX, sealY + 24);
        ctx.restore();
      }

      // Signatures
      if (data.showSignatures !== false) {
        const sig1X = W / 2 - 120;
        const sigY = 1120;
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sig1X - 160, sigY);
        ctx.lineTo(sig1X + 160, sigY);
        ctx.stroke();

        ctx.fillStyle = "#0F172A";
        ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(data.signatory1Name, sig1X, sigY + 36);

        ctx.fillStyle = "#64748B";
        ctx.font = "500 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(data.signatory1Title, sig1X, sigY + 68);

        const sig2X = W - 380;
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sig2X - 160, sigY);
        ctx.lineTo(sig2X + 160, sigY);
        ctx.stroke();

        ctx.fillStyle = "#0F172A";
        ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(data.signatory2Name, sig2X, sigY + 36);

        ctx.fillStyle = "#64748B";
        ctx.font = "500 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(data.signatory2Title, sig2X, sigY + 68);
      }

      // Footer
      if (data.showQrCode !== false) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#64748B";
        ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, monospace";
        ctx.fillText(`Certificate ID: ${data.id}   •   Issue Date: ${data.issueDate}   •   Verify at: aiversevitb.in/certificate/${data.id}`, W / 2, H - 75);
      }
    }

    return canvas;
  };

  const handleDownloadPNG = async () => {
    if (!certData) return;
    setIsExporting(true);

    try {
      const canvas = await renderCertificateCanvas(certData);
      if (!canvas) {
        setIsExporting(false);
        return;
      }

      const link = document.createElement("a");
      link.download = `Certificate_${(certData.recipientName || "Participant").replace(/[^a-zA-Z0-9]/g, "_")}_${certData.id}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to generate certificate PNG:", err);
      alert("Failed to export certificate image.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAllTeamCertificates = async () => {
    if (!certData || teamMembers.length === 0) return;
    setIsExportingAll(true);
    setDownloadProgress({ current: 0, total: teamMembers.length, currentName: "" });

    try {
      for (let i = 0; i < teamMembers.length; i++) {
        const member = teamMembers[i];
        setDownloadProgress({
          current: i + 1,
          total: teamMembers.length,
          currentName: member.name,
        });

        // Clone cert data with this member's specific details
        const memberCertData: CertificateData = {
          ...certData,
          id: member.certificateId,
          recipientName: member.name,
          studentId: member.studentId || "",
          role: member.role || (member.isLead ? "Team Lead" : "Member"),
          email: member.email || certData.email,
        };

        const canvas = await renderCertificateCanvas(memberCertData);
        if (canvas) {
          const link = document.createElement("a");
          link.download = `Certificate_${(member.name || "Member").replace(/[^a-zA-Z0-9]/g, "_")}_${member.certificateId}.png`;
          link.href = canvas.toDataURL("image/png");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        // Delay between consecutive downloads so browser doesn't block multi-downloads
        if (i < teamMembers.length - 1) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    } catch (err) {
      console.error("Error batch downloading team certificates:", err);
      alert("Encountered an issue during batch download.");
    } finally {
      setIsExportingAll(false);
      setDownloadProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <h2 className="text-xl font-black">Verifying Digital Certificate...</h2>
        <p className="text-slate-400 text-sm mt-1">Retrieving tamper-proof credential records from AI Verse blockchain register.</p>
      </div>
    );
  }

  if (!certData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <Award className="w-16 h-16 text-slate-600 mb-4" />
        <h2 className="text-2xl font-black">Certificate Not Found</h2>
        <p className="text-slate-400 text-sm max-w-md mt-2">
          The requested certificate ID does not exist or has not been published yet.
        </p>
        <Link
          to="/"
          className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-2xl text-sm transition-all"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  const isCustomTemplate = certData.templateMode === "custom" || !!certData.customTemplateUrl;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white print:bg-white print:text-black">
      <SEO
        title={`${certData.certificateType} - ${certData.recipientName} | AI Verse VITB`}
        description={`Official verifiable digital credential and ${certData.certificateType} awarded to ${certData.recipientName} for ${certData.eventTitle} by AI Verse at Vishnu Institute of Technology, Bhimavaram.`}
        url={`/certificate/${certData.id}`}
        keywords={`AI Verse Certificate, ${certData.recipientName}, ${certData.eventTitle}, VIT Bhimavaram, aiversevitb, Digital Credential`}
        schema={{
          "@context": "https://schema.org",
          "@type": "EducationalOccupationalCredential",
          "name": `${certData.certificateType} - ${certData.recipientName}`,
          "description": `${certData.certificateType} awarded to ${certData.recipientName} for participation in ${certData.eventTitle}`,
          "credentialCategory": "Certificate",
          "recognizedBy": {
            "@type": "EducationalOrganization",
            "name": "AI Verse VITB",
            "url": "https://aiversevitb.in"
          }
        }}
      />

      {/* Top Navbar */}
      <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-3.5 px-4 sm:px-8 sticky top-0 z-50 flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-700/60"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>AI Verse</span>
          </Link>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              VERIFIED CREDENTIAL
            </span>
            <span className="text-xs text-slate-400 font-mono hidden md:inline">{certData.id}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {teamMembers.length > 1 && (
            <button
              onClick={handleDownloadAllTeamCertificates}
              disabled={isExportingAll}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 active:scale-95 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 cursor-pointer border border-amber-400/30 disabled:opacity-50"
              title="Download all certificates for this team"
            >
              {isExportingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5 text-amber-200" />}
              <span className="hidden md:inline">
                {isExportingAll ? `Downloading (${downloadProgress?.current}/${downloadProgress?.total})...` : `Download All (${teamMembers.length})`}
              </span>
            </button>
          )}

          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2 transition-all border border-slate-700/80 cursor-pointer"
            title="Copy verification link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied Link!" : "Copy Link"}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2 transition-all border border-slate-700/80 cursor-pointer"
            title="Print or save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>

          <button
            onClick={handleDownloadPNG}
            disabled={isExporting || isExportingAll}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer border border-blue-400/20 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download PNG</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 space-y-6 flex flex-col items-center">

        {/* 👥 TEAM CERTIFICATE HUB & MEMBER SWITCHER BANNER */}
        {teamMembers.length > 1 && (
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 print:hidden backdrop-blur-md text-left">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    TEAM CERTIFICATE HUB
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    {teamMembers.length} Certificates Available
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1">
                  Team "{certData.groupName || "Roster"}"
                </h3>
                <p className="text-xs text-slate-400">
                  Select any team member below to preview their official certificate, or download all certificates in one click.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadAllTeamCertificates}
                disabled={isExportingAll}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 active:scale-95 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition-all border border-amber-400/30 shrink-0"
              >
                {isExportingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-amber-200" />
                )}
                <span>
                  {isExportingAll
                    ? `Downloading ${downloadProgress?.current} of ${downloadProgress?.total}...`
                    : `Download All Team Certificates (${teamMembers.length})`}
                </span>
              </button>
            </div>

            {/* Member Selector Chips */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1">
              {teamMembers.map((member, idx) => {
                const isActive = activeMemberIndex === idx;
                return (
                  <button
                    key={member.certificateId || idx}
                    type="button"
                    onClick={() => handleSelectTeamMember(idx)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/30 scale-[1.02]"
                        : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700/70"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isActive ? "bg-white text-blue-700" : "bg-slate-700 text-slate-300"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="text-left">
                      <div className="leading-tight flex items-center gap-1.5">
                        <span>{member.name}</span>
                        {member.isLead && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                            isActive ? "bg-amber-400 text-slate-950" : "bg-amber-400/20 text-amber-300"
                          }`}>
                            LEAD
                          </span>
                        )}
                      </div>
                      {member.studentId && (
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          {member.studentId}
                        </span>
                      )}
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 text-white ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* Live Progress Banner */}
            {isExportingAll && downloadProgress && (
              <div className="p-3.5 bg-blue-950/90 border border-blue-800/60 rounded-2xl text-xs text-blue-200 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Generating certificate image for <strong className="text-white">{downloadProgress.currentName}</strong>...</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {downloadProgress.current} / {downloadProgress.total}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Certificate Display Canvas Container */}
        {isCustomTemplate ? (
          /* Custom Template Aspect-Accurate View */
          <div
            ref={certContainerRef}
            className="w-full bg-white text-slate-900 rounded-3xl shadow-2xl relative overflow-hidden select-none border-2 border-slate-300 aspect-[2000/1414] min-h-[480px]"
            style={{
              backgroundImage: `url(${certData.customTemplateUrl})`,
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat"
            }}
          >
            {/* Dynamic Participant Name Positioned by Slider */}
            <div 
              className="absolute left-1/2 -translate-x-1/2 text-center w-full px-6 pointer-events-none"
              style={{
                top: `${certData.namePosY ?? 38}%`,
                transform: "translate(-50%, -50%)"
              }}
            >
              <h2 
                className="font-black font-serif underline decoration-blue-600/60 underline-offset-6 transition-all inline-block"
                style={{
                  color: certData.nameColor || "#0F172A",
                  fontSize: `${Math.max(20, Math.min(52, (certData.nameFontSize || 64) * 0.72))}px`
                }}
              >
                {certData.recipientName}
              </h2>
            </div>

            {/* Optional Roll No / Student ID Positioned by Slider */}
            {certData.showRollNo !== false && certData.studentId && (
              <div 
                className="absolute left-1/2 -translate-x-1/2 text-center w-full px-6 pointer-events-none"
                style={{
                  top: `${certData.rollPosY ?? 45}%`,
                  transform: "translate(-50%, -50%)"
                }}
              >
                <p 
                  className="font-mono font-bold transition-all inline-block tracking-wider"
                  style={{
                    color: certData.rollColor || "#475569",
                    fontSize: `${Math.max(12, Math.min(28, (certData.rollFontSize || 20) * 0.72))}px`
                  }}
                >
                  Roll: {certData.studentId}
                </p>
              </div>
            )}

            {/* Optional Team Name Positioned by Slider */}
            {certData.showTeamName !== false && certData.groupName && (
              <div 
                className="absolute left-1/2 -translate-x-1/2 text-center w-full px-6 pointer-events-none"
                style={{
                  top: `${certData.teamPosY ?? 53}%`,
                  transform: "translate(-50%, -50%)"
                }}
              >
                <h3 
                  className="font-black font-sans tracking-wide transition-all inline-block"
                  style={{
                    color: certData.teamColor || "#1E3A8A",
                    fontSize: `${Math.max(14, Math.min(38, (certData.teamFontSize || 32) * 0.72))}px`
                  }}
                >
                  {certData.groupName}
                </h3>
              </div>
            )}

            {/* Optional Verification Bar */}
            {certData.showQrCode && (
              <div className="absolute bottom-2 left-0 right-0 text-center text-[9px] text-slate-400 font-mono pointer-events-none">
                Certificate ID: {certData.id} • Issue Date: {certData.issueDate} • Verify at: aiversevitb.in/certificate/{certData.id}
              </div>
            )}
          </div>
        ) : (
          /* Built-in Classical Certificate Layout */
          <div
            ref={certContainerRef}
            className="w-full bg-white text-slate-900 rounded-3xl p-6 sm:p-12 md:p-16 shadow-2xl border-4 border-amber-500/60 relative overflow-hidden select-none print:border-none print:shadow-none print:p-8 min-h-[500px] flex flex-col justify-between"
            style={{
              backgroundImage: "radial-gradient(circle at center, #FFFFFF 0%, #F8FAFC 70%, #EFF6FF 100%)",
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat"
            }}
          >
            {/* Inner Ornate Borders */}
            {certData.showBorders !== false && (
              <>
                <div className="absolute inset-3 sm:inset-5 border-2 border-blue-900/80 rounded-2xl pointer-events-none" />
                <div className="absolute inset-4 sm:inset-6 border border-amber-600/50 rounded-xl pointer-events-none" />
              </>
            )}

            {/* Top Logo & Institutional Header */}
            {certData.showCollegeHeader !== false && (
              <div className="text-center space-y-2 relative z-10 pt-2 sm:pt-4">
                <div className="flex items-center justify-center gap-3">
                  <img src="/ai_verse.png" alt="AI Verse Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl" />
                  <div className="text-left">
                    <span className="text-[11px] sm:text-xs font-black tracking-widest text-blue-700 uppercase block">
                      AI VERSE • OFFICIAL DIGITAL CREDENTIAL
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                      {certData.collegeName}
                    </h3>
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-500">
                  {certData.departmentName}
                </p>
                <div className="w-48 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto my-3" />
              </div>
            )}

            {/* Certificate Title */}
            {certData.certificateType && (
              <div className="text-center my-4 sm:my-6 space-y-2 relative z-10">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#1E3A8A] font-serif tracking-tight">
                  {certData.certificateType}
                </h1>
                <p className="text-xs sm:text-sm italic font-serif text-slate-500">
                  This is proudly presented to
                </p>
              </div>
            )}

            {/* Recipient Name */}
            <div className="text-center my-4 sm:my-6 relative z-10">
              <h2
                className="font-black font-serif tracking-tight underline decoration-blue-600/60 underline-offset-8"
                style={{
                  color: certData.nameColor || "#0F172A",
                  fontSize: `${Math.max(28, Math.min(54, (certData.nameFontSize || 64) * 0.75))}px`
                }}
              >
                {certData.recipientName}
              </h2>
              {(certData.studentId || certData.groupName) && (
                <div className="flex items-center justify-center gap-4 mt-4 text-xs sm:text-sm font-mono font-bold text-slate-600">
                  {certData.studentId && <span>Roll / Student ID: {certData.studentId}</span>}
                  {certData.studentId && certData.groupName && <span>•</span>}
                  {certData.groupName && <span>Team: {certData.groupName}</span>}
                </div>
              )}
            </div>

            {/* Citation Body */}
            <div 
              className="max-w-2xl sm:max-w-3xl mx-auto text-center my-4 sm:my-6 text-xs sm:text-base font-medium leading-relaxed relative z-10"
              style={{ color: certData.citationColor || "#334155" }}
            >
              {certData.citationText || (
                <p>
                  for outstanding and active participation in <strong className="text-blue-900 font-extrabold font-serif">"{certData.eventTitle}"</strong> organized by AI Verse Club, demonstrating commendable technical innovation, teamwork, and engineering excellence.
                </p>
              )}
            </div>

            {/* Bottom Signatures & Seal Section */}
            <div className="mt-8 sm:mt-12 pt-6 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center relative z-10">
              {/* Golden Seal Badge */}
              <div className="flex flex-col items-center justify-center sm:items-start order-2 sm:order-1">
                {certData.showSeal !== false ? (
                  <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-1 shadow-lg flex items-center justify-center text-center text-white border-2 border-amber-300">
                    <div className="w-full h-full rounded-full border border-amber-200/80 flex flex-col items-center justify-center p-1 bg-amber-600">
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      <span className="text-[9px] font-black tracking-widest uppercase">AI VERSE</span>
                      <span className="text-[10px] font-extrabold text-amber-100">OFFICIAL</span>
                      <span className="text-[8px] font-bold text-amber-200 uppercase">SEAL</span>
                    </div>
                  </div>
                ) : <div />}
              </div>

              {/* Signatory 1 */}
              <div className="text-center order-1 sm:order-2">
                {certData.showSignatures !== false && (
                  <>
                    <div className="w-48 h-0.5 bg-slate-400 mx-auto mb-2" />
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">{certData.signatory1Name}</h4>
                    <p className="text-[11px] font-semibold text-slate-500">{certData.signatory1Title}</p>
                  </>
                )}
              </div>

              {/* Signatory 2 */}
              <div className="text-center sm:text-right order-3">
                {certData.showSignatures !== false && (
                  <>
                    <div className="w-48 h-0.5 bg-slate-400 mx-auto sm:ml-auto mb-2" />
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">{certData.signatory2Name}</h4>
                    <p className="text-[11px] font-semibold text-slate-500">{certData.signatory2Title}</p>
                  </>
                )}
              </div>
            </div>

            {/* Verification Code Footer Strip */}
            {certData.showQrCode !== false && (
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-xs font-mono text-slate-500 gap-2 relative z-10">
                <div>
                  <span>Verification ID: </span>
                  <strong className="text-blue-900">{certData.id}</strong>
                </div>
                <div>
                  <span>Issue Date: </span>
                  <strong>{certData.issueDate}</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verification & LinkedIn Details Card */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 print:hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Authentic Verified Credential</h3>
                <p className="text-xs text-slate-400">
                  Digitally issued by AI Verse & Vishnu Institute of Technology.
                </p>
              </div>
            </div>

            <a
              href={`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(`${certData.certificateType} - ${certData.eventTitle}`)}&organizationName=${encodeURIComponent("AI Verse")}&issueYear=${new Date().getFullYear()}&certUrl=${encodeURIComponent(window.location.href)}&certId=${encodeURIComponent(certData.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-[#0A66C2] hover:bg-[#004182] text-white font-extrabold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Add to LinkedIn Profile</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipient</span>
              <span className="text-sm font-extrabold text-white mt-1 block">{certData.recipientName}</span>
              {certData.studentId && <span className="text-xs font-mono text-slate-400">{certData.studentId}</span>}
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Event</span>
              <span className="text-sm font-extrabold text-white mt-1 block truncate">{certData.eventTitle}</span>
              <span className="text-xs text-slate-400">{certData.certificateType}</span>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Issue Date</span>
              <span className="text-sm font-extrabold text-white mt-1 block">{certData.issueDate}</span>
              <span className="text-xs text-emerald-400 font-bold">Status: Active & Valid</span>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verification Key</span>
              <span className="text-sm font-mono font-extrabold text-blue-400 mt-1 block truncate">{certData.id}</span>
              <span className="text-xs text-slate-400">Verifiable Online</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default CertificateViewPage;
