import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Calendar, 
  MapPin, 
  ArrowRight, 
  ChevronRight, 
  ChevronLeft, 
  SlidersHorizontal, 
  Bookmark, 
  IndianRupee, 
  Layers, 
  Users, 
  GraduationCap, 
  Sparkles, 
  Award, 
  Mail 
} from "lucide-react";
import SEO from "../../components/layout/SEO";
import Button from "../../components/ui/Button";
import { fetchEvents, fetchEventById, fetchTeamMembers } from "../../services/apiClient";
import { dataCache } from "../../utils/dataCache";
import { formatRoundDateRange } from "../../utils/dateFormatter";
import { StructuredEventOverview } from "../../components/events/StructuredEventOverview";

// Import local assets
import sparkImg from "../../assets/images/spark.png";
import hackathonImg from "../../assets/images/hackathon.png";
import seminarImg from "../../assets/images/seminar.png";
import elenaImg from "../../assets/images/elena.png";

const getInitials = (name: string): string => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

interface DetailedEvent {
  id: string;
  title: string;
  type: "Workshop" | "Hackathon" | "Seminar" | "Networking" | "Quiz";
  date: string;
  time: string;
  location: string;
  description: string;
  image: string;
  posterImages?: {filename: string, preview: string}[];
  primaryTag?: string;
  status?: "Draft" | "Active" | "Opened" | "Completed" | "Archived";
  maxReg: number;
  currentReg: number;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isVirtual?: boolean;
  speakerName?: string;
  speakerRole?: string;
  speakerBio?: string;
  speakerLinkedin?: string;
  speakerTwitter?: string;
  speakerImagePreview?: string;
  facultyCoordinator?: string;
  facultyCoordinatorEmail?: string;
  facultyCoordinatorPhone?: string;
  facultyCoordinator2?: string;
  facultyCoordinatorEmail2?: string;
  facultyCoordinatorPhone2?: string;
  studentCoordinator?: string;
  studentCoordinatorEmail?: string;
  studentCoordinatorPhone?: string;
  studentCoordinator2?: string;
  studentCoordinatorEmail2?: string;
  studentCoordinatorPhone2?: string;
  coordinators?: Array<{
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    image?: string;
  }>;
  juryName?: string;
  juryRole?: string;
  juryBio?: string;
  juryLinkedin?: string;
  juryImagePreview?: string;
  minTeamSize?: number;
  maxTeamSize?: number;
  registrationFee?: number;
  pricingType?: "per_person" | "per_team";
  isPaidEvent?: boolean;
  paymentQrImagePreview?: string;
  paymentQr?: string;
  upiId?: string;
  hasAgenda?: boolean;
  agendaTime1?: string;
  agendaTitle1?: string;
  agendaDesc1?: string;
  agendaTime2?: string;
  agendaTitle2?: string;
  agendaDesc2?: string;
  agendaTime3?: string;
  agendaTitle3?: string;
  agendaDesc3?: string;
  agendaItems?: Array<{ time: string, title: string, description: string }>;
  regDeadline?: string;
  regDeadlineTime?: string;
  registrationDeadline?: string;
  registrationDeadlineTime?: string;
  allowRegistrations?: boolean;
  rounds?: Array<{
    roundNumber: number;
    name: string;
    type: string;
    description: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    status: string;
  }>;
}

const mapRawToDetailedEvent = (data: any, defaultId: string): DetailedEvent => {
  const evId = data.id || data._id || defaultId;
  let eventType: DetailedEvent["type"] = "Workshop";
  const catUpper = String(data.category || "").toUpperCase();
  if (catUpper.includes("HACKATHON")) eventType = "Hackathon";
  else if (catUpper.includes("LECTURE") || catUpper.includes("SEMINAR")) eventType = "Seminar";
  else if (catUpper.includes("QUIZ")) eventType = "Quiz";
  
  // 1. Resolve actual uploaded poster / image
  let actualImg = "";
  if (Array.isArray(data.posterImages) && data.posterImages.length > 0) {
    actualImg = data.posterImages[0]?.preview || data.posterImages[0]?.url || "";
  }
  if (!actualImg) {
    actualImg = data.posterUrl || data.posterPreview || data.image || data.coverImage || data.bannerImage || data.banner || "";
  }

  // Fallback assets ONLY if no custom poster/image exists
  let fallbackImg = sparkImg;
  if (data.imageName === "hackathonImg" || catUpper.includes("HACKATHON")) fallbackImg = hackathonImg;
  else if (data.imageName === "seminarImg" || catUpper.includes("SEMINAR") || catUpper.includes("LECTURE")) fallbackImg = seminarImg;

  const img = actualImg || fallbackImg;

  let eventImages: { filename: string; preview: string }[] = [];
  if (Array.isArray(data.posterImages) && data.posterImages.length > 0) {
    eventImages = data.posterImages.map((pi: any, idx: number) => ({
      filename: pi?.filename || `poster-${idx + 1}.png`,
      preview: pi?.preview || pi?.url || img
    }));
  } else if (actualImg) {
    eventImages = [{ filename: 'poster.png', preview: actualImg }];
  } else {
    eventImages = [{ filename: 'default.png', preview: fallbackImg }];
  }

  let timeText = data.time || "10:00 AM";
  if (data.startTime) {
    timeText = data.startTime;
    if (data.endTime) timeText += ` - ${data.endTime}`;
  }

  const hasAgenda = data.hasAgenda === false || data.hasAgenda === "false"
    ? false
    : data.hasAgenda === true || data.hasAgenda === "true"
    ? true
    : Boolean((Array.isArray(data.agendaItems) && data.agendaItems.length > 0) || (data.agendaTitle1 && data.agendaTitle1 !== "Morning Keynote: The Future of Compute"));

  const facCoords = Array.isArray(data.coordinators)
    ? data.coordinators.filter((c: any) => (c.role || "").toLowerCase().includes("faculty"))
    : [];
  const stuCoords = Array.isArray(data.coordinators)
    ? data.coordinators.filter((c: any) => (c.role || "").toLowerCase().includes("student"))
    : [];

  return {
    id: evId,
    title: data.title || "",
    type: eventType,
    date: data.date || "Oct 24",
    time: timeText,
    location: data.location || "Virtual Hub",
    description: data.description || "No description provided.",
    image: img,
    posterImages: eventImages,
    primaryTag: data.primaryTag || "",
    status: data.status || "Opened",
    maxReg: data.maxReg || 100,
    currentReg: Math.max(0, Number(data.currentReg) || 0),
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    startTime: data.startTime || "",
    endTime: data.endTime || "",
    isVirtual: data.isVirtual !== undefined ? data.isVirtual : true,
    speakerName: data.speakerName || "",
    speakerRole: data.speakerRole || "",
    speakerBio: data.speakerBio || "",
    speakerLinkedin: data.speakerLinkedin || "#",
    speakerTwitter: data.speakerTwitter || "#",
    speakerImagePreview: data.speakerImagePreview || "",
    facultyCoordinator: data.facultyCoordinator || facCoords[0]?.name || "",
    facultyCoordinatorEmail: data.facultyCoordinatorEmail || facCoords[0]?.email || "",
    facultyCoordinatorPhone: data.facultyCoordinatorPhone || facCoords[0]?.phone || "",
    facultyCoordinator2: data.facultyCoordinator2 || facCoords[1]?.name || "",
    facultyCoordinatorEmail2: data.facultyCoordinatorEmail2 || facCoords[1]?.email || "",
    facultyCoordinatorPhone2: data.facultyCoordinatorPhone2 || facCoords[1]?.phone || "",
    studentCoordinator: data.studentCoordinator || stuCoords[0]?.name || "",
    studentCoordinatorEmail: data.studentCoordinatorEmail || stuCoords[0]?.email || "",
    studentCoordinatorPhone: data.studentCoordinatorPhone || stuCoords[0]?.phone || "",
    studentCoordinator2: data.studentCoordinator2 || stuCoords[1]?.name || "",
    studentCoordinatorEmail2: data.studentCoordinatorEmail2 || stuCoords[1]?.email || "",
    studentCoordinatorPhone2: data.studentCoordinatorPhone2 || stuCoords[1]?.phone || "",
    coordinators: data.coordinators || [],
    juryName: data.juryName || "",
    juryRole: data.juryRole || "",
    juryBio: data.juryBio || "",
    juryLinkedin: data.juryLinkedin || "#",
    juryImagePreview: data.juryImagePreview || "",
    minTeamSize: data.minTeamSize || null,
    maxTeamSize: data.maxTeamSize || null,
    registrationFee: data.registrationFee !== undefined ? Number(data.registrationFee) : 0,
    pricingType: data.pricingType === "per_team" || data.pricingModel === "per_team" ? "per_team" : "per_person",
    isPaidEvent: data.isPaidEvent !== undefined ? Boolean(data.isPaidEvent) : (Number(data.registrationFee) > 0),
    paymentQrImagePreview: data.paymentQrImagePreview || data.paymentQr || "",
    paymentQr: data.paymentQr || data.paymentQrImagePreview || "",
    upiId: data.upiId || "",
    hasAgenda,
    agendaTime1: hasAgenda ? (data.agendaTime1 || "") : "",
    agendaTitle1: hasAgenda ? (data.agendaTitle1 || "") : "",
    agendaDesc1: hasAgenda ? (data.agendaDesc1 || "") : "",
    agendaTime2: hasAgenda ? (data.agendaTime2 || "") : "",
    agendaTitle2: hasAgenda ? (data.agendaTitle2 || "") : "",
    agendaDesc2: hasAgenda ? (data.agendaDesc2 || "") : "",
    agendaTime3: hasAgenda ? (data.agendaTime3 || "") : "",
    agendaTitle3: hasAgenda ? (data.agendaTitle3 || "") : "",
    agendaDesc3: hasAgenda ? (data.agendaDesc3 || "") : "",
    agendaItems: hasAgenda ? (Array.isArray(data.agendaItems) ? data.agendaItems : []) : [],
    regDeadline: data.regDeadline || data.registrationDeadline || "",
    regDeadlineTime: data.regDeadlineTime || data.registrationDeadlineTime || "",
    registrationDeadline: data.regDeadline || data.registrationDeadline || "",
    registrationDeadlineTime: data.regDeadlineTime || data.registrationDeadlineTime || "",
    allowRegistrations: data.allowRegistrations !== undefined ? data.allowRegistrations : true,
    rounds: data.rounds || []
  };
};

const findCachedEvent = (eventId?: string): DetailedEvent | null => {
  if (!eventId) return null;
  const direct = dataCache.get<DetailedEvent>(`event_detail_${eventId}`);
  if (direct) return direct;

  const candidateLists = [
    dataCache.get<any[]>("public_events"),
    dataCache.get<any[]>("faculty_events"),
    dataCache.get<any[]>("all_events"),
    dataCache.get<any[]>("home_highlights"),
    dataCache.get<any[]>("org_dashboard_events")
  ];

  for (const list of candidateLists) {
    if (Array.isArray(list)) {
      const found = list.find((e: any) =>
        e?.id === eventId ||
        e?._id === eventId ||
        (e?.title && e.title.toLowerCase().replace(/[^a-z0-9]/g, "-").includes(eventId.toLowerCase()))
      );
      if (found) {
        return mapRawToDetailedEvent(found, eventId);
      }
    }
  }
  return null;
};

const EventDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const initialCachedEvent = React.useMemo(() => findCachedEvent(id), [id]);
  const [event, setEvent] = useState<DetailedEvent | null>(() => initialCachedEvent);
  const [loading, setLoading] = useState<boolean>(() => !initialCachedEvent);
  const [relatedEvents, setRelatedEvents] = useState<DetailedEvent[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  const [facultyProfile, setFacultyProfile] = useState<{
    name: string;
    role?: string;
    position?: string;
    image?: string;
    email?: string;
    phone?: string;
  } | null>(null);

  const [facultyProfile2, setFacultyProfile2] = useState<{
    name: string;
    role?: string;
    position?: string;
    image?: string;
    email?: string;
    phone?: string;
  } | null>(null);

  const [studentProfile, setStudentProfile] = useState<{
    name: string;
    role?: string;
    position?: string;
    image?: string;
    email?: string;
    phone?: string;
  } | null>(null);

  const [studentProfile2, setStudentProfile2] = useState<{
    name: string;
    role?: string;
    position?: string;
    image?: string;
    email?: string;
    phone?: string;
  } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    setCurrentImageIndex(0);
    if (!id) return;

    // Instant Cache Hydration if not already active
    const cachedNow = findCachedEvent(id);
    if (cachedNow && !event) {
      setEvent(cachedNow);
      setLoading(false);
    }
    if (!cachedNow && !event) {
      setLoading(true);
    }

    let isMounted = true;

    const fetchAllData = async () => {
      try {
        // Parallel non-blocking execution for speed
        const [eventRes, teamRes, allEventsRes] = await Promise.allSettled([
          fetchEventById(id),
          fetchTeamMembers(),
          fetchEvents()
        ]);

        let docSnap: any = eventRes.status === "fulfilled" ? eventRes.value : null;
        const allEvents: any[] = allEventsRes.status === "fulfilled" && Array.isArray(allEventsRes.value) ? allEventsRes.value : [];
        const allPeople: any[] = teamRes.status === "fulfilled" && Array.isArray(teamRes.value) ? teamRes.value : [];

        if (!docSnap && allEvents.length > 0) {
          docSnap = allEvents.find((e: any) =>
            e.id === id ||
            e._id === id ||
            (e.title && e.title.toLowerCase().replace(/[^a-z0-9]/g, "-").includes(id.toLowerCase()))
          ) || null;
        }

        if (!isMounted) return;

        if (docSnap) {
          const formattedEvent = mapRawToDetailedEvent(docSnap, id);
          setEvent(formattedEvent);
          dataCache.set(`event_detail_${id}`, formattedEvent, 60_000);

          // Helper to match coordinator with member directory
          const resolveProfile = (
            name?: string,
            email?: string,
            phone?: string,
            defaultRole = "Coordinator",
            defaultPosition = "Organizer"
          ) => {
            if (!name && !email) return null;
            const cleanName = (name || "").toLowerCase().replace(/dr\.|mr\.|mrs\.|prof\./g, "").trim();
            const cleanEmail = (email || "").toLowerCase().trim();

            const found = allPeople.find(p => {
              const pEmail = (p.email || "").toLowerCase().trim();
              const pName = (p.name || p.fullName || "").toLowerCase().replace(/dr\.|mr\.|mrs\.|prof\./g, "").trim();
              if (cleanEmail && pEmail === cleanEmail) return true;
              if (cleanName && pName && (pName.includes(cleanName) || cleanName.includes(pName))) return true;
              return false;
            });

            if (found) {
              return {
                name: found.name || found.fullName || name || "",
                role: found.role || defaultRole,
                position: found.position || defaultPosition,
                image: found.image || "",
                email: found.email || email || "",
                phone: found.phone || found.phoneNumber || phone || ""
              };
            }

            return {
              name: name || "",
              role: defaultRole,
              position: defaultPosition,
              image: "",
              email: email || "",
              phone: phone || ""
            };
          };

          const matchedFac1 = resolveProfile(
            formattedEvent.facultyCoordinator || docSnap.facultyCoordinator,
            formattedEvent.facultyCoordinatorEmail || docSnap.facultyCoordinatorEmail,
            formattedEvent.facultyCoordinatorPhone || docSnap.facultyCoordinatorPhone,
            "Faculty Coordinator",
            "Faculty In-Charge"
          );

          const matchedFac2 = resolveProfile(
            formattedEvent.facultyCoordinator2 || docSnap.facultyCoordinator2,
            formattedEvent.facultyCoordinatorEmail2 || docSnap.facultyCoordinatorEmail2,
            formattedEvent.facultyCoordinatorPhone2 || docSnap.facultyCoordinatorPhone2,
            "Faculty Coordinator",
            "Faculty Coordinator"
          );

          const matchedStu1 = resolveProfile(
            formattedEvent.studentCoordinator || docSnap.studentCoordinator,
            formattedEvent.studentCoordinatorEmail || docSnap.studentCoordinatorEmail,
            formattedEvent.studentCoordinatorPhone || docSnap.studentCoordinatorPhone,
            "Student Organizer",
            "Student Lead / Organizer"
          );

          const matchedStu2 = resolveProfile(
            formattedEvent.studentCoordinator2 || docSnap.studentCoordinator2,
            formattedEvent.studentCoordinatorEmail2 || docSnap.studentCoordinatorEmail2,
            formattedEvent.studentCoordinatorPhone2 || docSnap.studentCoordinatorPhone2,
            "Student Organizer",
            "Student Coordinator"
          );

          setFacultyProfile(matchedFac1);
          setFacultyProfile2(matchedFac2);
          setStudentProfile(matchedStu1);
          setStudentProfile2(matchedStu2);
        }

        // Calculate related events
        if (allEvents.length > 0) {
          const related: DetailedEvent[] = [];
          allEvents.forEach((doc: any) => {
            const docId = doc._id || doc.id || "";
            if (docId !== id && related.length < 3) {
              related.push(mapRawToDetailedEvent(doc, docId));
            }
          });
          setRelatedEvents(related);
        }
      } catch (err) {
        console.error("Error reading event details:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider animate-pulse">Loading event details...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-extrabold text-slate-800">Event Not Found</h2>
        <p className="text-slate-500 mt-2 text-sm max-w-xs font-semibold">The event you are looking for does not exist or has been removed.</p>
        <Link to="/events" className="mt-6">
          <Button variant="gradient" className="font-bold rounded-xl text-xs px-6 py-2.5">
            Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  const parseTimeString = (timeStr?: string): { hours: number; minutes: number } | null => {
    if (!timeStr) return null;
    const parts = timeStr.split("-");
    const target = (parts[parts.length - 1] || "").trim();
    const match = target.match(/(\d{1,2}):(\d{2})(?:\s*([ap]m))?/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3]?.toLowerCase();
    if (meridian === "pm" && hours < 12) hours += 12;
    if (meridian === "am" && hours === 12) hours = 0;
    return { hours, minutes };
  };

  const parseEventDate = (dateStr?: string, defaultYear = new Date().getFullYear()): Date | null => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (!trimmed || trimmed === "TBD") return null;

    // 1. Check ISO YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      return new Date(year, month, day);
    }

    // 2. Check DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      return new Date(year, month, day);
    }

    const yearMatch = trimmed.match(/\b(20\d\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : defaultYear;

    const monthMap: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11
    };

    const tokens = trimmed.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean);
    let month = -1;
    let day = -1;

    for (const t of tokens) {
      if (monthMap[t] !== undefined) {
        month = monthMap[t];
      } else {
        const n = parseInt(t, 10);
        if (!isNaN(n) && n >= 1 && n <= 31 && day === -1) {
          day = n;
        }
      }
    }

    if (month !== -1 && day !== -1) {
      return new Date(year, month, day);
    }

    const direct = Date.parse(`${trimmed}, ${year}`);
    if (!isNaN(direct)) {
      return new Date(direct);
    }

    return null;
  };

  const isPastEvent = (): boolean => {
    if (!event) return false;
    if (event.status === "Completed") return true;
    if ((event as any).isPastEvent) return true;

    const now = Date.now();
    const eventDateStr = event.endDate || event.startDate || event.date;
    const eventTimeStr = event.endTime || event.time;

    if (eventDateStr) {
      const d = parseEventDate(eventDateStr);
      if (d) {
        if (eventTimeStr) {
          const t = parseTimeString(eventTimeStr);
          if (t) {
            d.setHours(t.hours, t.minutes, 59, 999);
          } else {
            d.setHours(23, 59, 59, 999);
          }
        } else {
          d.setHours(23, 59, 59, 999);
        }
        if (now > d.getTime()) return true;
      }
    }

    return false;
  };

  const isRegistrationOpen = (): { isOpen: boolean; reason?: string; deadlineLabel?: string } => {
    if (!event) return { isOpen: false };
    if (event.status === "Completed" || (event as any).isPastEvent) {
      return { isOpen: false, reason: "Event Completed" };
    }
    if (event.allowRegistrations === false) {
      return { isOpen: false, reason: "Registration Closed" };
    }

    const now = Date.now();
    const deadlineDateStr = (event as any).regDeadline || (event as any).registrationDeadline;
    const deadlineTimeStr = (event as any).regDeadlineTime || (event as any).registrationDeadlineTime || event.endTime;

    if (deadlineDateStr) {
      const d = parseEventDate(deadlineDateStr);
      if (d) {
        if (deadlineTimeStr) {
          const t = parseTimeString(deadlineTimeStr);
          if (t) {
            d.setHours(t.hours, t.minutes, 59, 999);
          } else {
            d.setHours(23, 59, 59, 999);
          }
        } else {
          d.setHours(23, 59, 59, 999);
        }

        if (now > d.getTime()) {
          return { isOpen: false, reason: "Registration Closed" };
        } else {
          return { 
            isOpen: true, 
            deadlineLabel: `Registration open till ${deadlineDateStr}${deadlineTimeStr ? ` at ${deadlineTimeStr}` : " (11:59 PM)"}` 
          };
        }
      }
    }

    // If no explicit registration deadline date is set, check event end date/time
    if (isPastEvent()) {
      return { isOpen: false, reason: "Event Completed" };
    }

    return { isOpen: true };
  };

  const isPast = isPastEvent();
  const regStatus = isRegistrationOpen();

  return (
    <div className="bg-[#F8FAFC] pb-24 text-left font-sans animate-in fade-in duration-200">
      <SEO 
        title={`${event.title} | AI Verse VITB Hackathons`} 
        description={event.description?.substring(0, 160) || `Register for ${event.title} organized by AI Verse VITB at Vishnu Institute of Technology.`}
        keywords={`${event.type || "Hackathon"}, ${event.title}, AI Verse VITB, VIT Bhimavaram, Coding Hackathon, Tech Event`}
        url={`/events/${event.id}`}
        image={event.image || "/event-banner.png"}
        type="article"
        schema={{
          "@context": "https://schema.org",
          "@type": "Event",
          "name": event.title,
          "description": event.description || `Hackathon & Workshop event by AI Verse VITB`,
          "image": event.image || "https://aiversevitb.in/event-banner.png",
          "startDate": event.startDate || event.date || "2026-09-01",
          "endDate": event.endDate || event.date || "2026-09-02",
          "eventStatus": isPast ? "https://schema.org/EventCompleted" : "https://schema.org/EventScheduled",
          "eventAttendanceMode": (event.location || "").toLowerCase().includes("online") 
            ? "https://schema.org/OnlineEventAttendanceMode" 
            : "https://schema.org/OfflineEventAttendanceMode",
          "location": {
            "@type": "Place",
            "name": event.location || "Vishnu Institute of Technology",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Vishnupur",
              "addressLocality": "Bhimavaram",
              "addressRegion": "Andhra Pradesh",
              "postalCode": "534202",
              "addressCountry": "IN"
            }
          },
          "organizer": {
            "@type": "EducationalOrganization",
            "name": "AI Verse VITB",
            "url": "https://aiversevitb.in"
          },
          "offers": {
            "@type": "Offer",
            "price": event.registrationFee || 0,
            "priceCurrency": "INR",
            "availability": regStatus.isOpen ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
            "url": `https://aiversevitb.in/events/${event.id}`
          }
        }}
      />

      {/* ================= HERO BANNER ================= */}
      <section className="relative pt-24 pb-12 bg-gradient-to-tr from-slate-50 via-blue-50/20 to-sky-50/20 rounded-b-[40px] border-b border-slate-100 shadow-sm overflow-hidden">
        {/* Background Decorative Gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(219,234,254,0.5)_0%,transparent_70%)] transform-gpu" />
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(224,242,254,0.5)_0%,transparent_70%)] transform-gpu" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Title Column */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block bg-blue-600/10 text-blue-700 text-[9px] font-black tracking-widest px-3 py-1 rounded-full uppercase">
                  {event.type}
                </span>
                {event.primaryTag && (
                  <span className="inline-block bg-slate-100 text-slate-500 text-[9px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border border-slate-200/40">
                    #{event.primaryTag}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 tracking-tight leading-tight">
                {event.title}
              </h1>

              {/* Meta Details */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-xs sm:text-sm text-slate-550 font-semibold">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  {formatRoundDateRange(event.startDate || event.date, event.endDate)}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  {event.location}
                </span>
              </div>
            </div>

            {/* Registration Float Box */}
            <div className="lg:col-span-4 self-stretch flex items-center">
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl w-full flex flex-col space-y-4 text-left">
                <div className="border-b border-slate-50 pb-3">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">REGISTRATION</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                      {event.isPaidEvent && event.registrationFee && event.registrationFee > 0
                        ? `₹${event.registrationFee}`
                        : "Free"}
                    </h3>
                    {event.isPaidEvent && event.registrationFee && event.registrationFee > 0 && (
                      <span className="text-xs font-bold text-slate-400">
                        {event.pricingType === "per_team" ? "/ team" : "/ person"}
                      </span>
                    )}
                  </div>
                  {event.isPaidEvent && event.registrationFee && event.registrationFee > 0 && (
                    <p className="text-[10px] text-slate-400 font-semibold">
                      {event.pricingType === "per_team"
                        ? "Paid Hackathon Entry (Flat Team Rate)"
                        : "Paid Hackathon Entry (Per Person)"}
                    </p>
                  )}
                </div>

                {/* Paid Hackathon Payment Status Badge */}
                {event.isPaidEvent && event.registrationFee && event.registrationFee > 0 && (
                  <div className="bg-emerald-50/70 rounded-2xl p-2.5 border border-emerald-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Paid Registration</span>
                    </div>
                    <span className="text-[9px] font-black text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 uppercase tracking-wider">
                      UPI / QR
                    </span>
                  </div>
                )}

                {event.type === "Hackathon" && event.minTeamSize && event.maxTeamSize && (
                  <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50 flex items-center justify-between text-xs mt-2 text-left">
                    <span className="font-bold text-slate-500">Team Size:</span>
                    <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-[10px]">
                      {event.minTeamSize === event.maxTeamSize ? `${event.minTeamSize} member` : `${event.minTeamSize} - ${event.maxTeamSize} members`}
                    </span>
                  </div>
                )}

                {(event.type === "Hackathon" || (event as any).category === "HACKATHONS" || (event as any).category === "Hackathon" || (event as any).category?.toLowerCase()?.includes("hackathon")) ? (
                  !regStatus.isOpen ? (
                    <Button variant="secondary" disabled className="w-full font-bold rounded-2xl py-3 text-xs flex items-center justify-center gap-2 text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed">
                      {regStatus.reason || "Registration Closed"}
                    </Button>
                  ) : (
                    <div className="space-y-2 w-full">
                      <Link to={`/events/${event.id}/register`} className="w-full block">
                        <Button variant="gradient" className="w-full font-bold rounded-2xl py-3.5 text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.01] transition-all">
                          Register Now
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      {regStatus.deadlineLabel && (
                        <p className="text-[10px] font-bold text-center text-blue-600 bg-blue-50/70 py-1 px-2 rounded-lg border border-blue-100/60">
                          ⏳ {regStatus.deadlineLabel}
                        </p>
                      )}
                    </div>
                  )
                ) : (
                  !regStatus.isOpen ? (
                    <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center">
                      <span className="text-xs font-bold text-slate-500 block">{regStatus.reason || "Event Completed"}</span>
                      <span className="text-[10px] font-medium text-slate-400 block mt-0.5">This event is no longer accepting entries</span>
                    </div>
                  ) : (
                    <div className="space-y-2 w-full">
                      <Link to={`/events/${event.id}/register`} className="w-full block">
                        <Button variant="gradient" className="w-full font-bold rounded-2xl py-3.5 text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.01] transition-all">
                          Register Now
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      {regStatus.deadlineLabel && (
                        <p className="text-[10px] font-bold text-center text-blue-600 bg-blue-50/70 py-1 px-2 rounded-lg border border-blue-100/60">
                          ⏳ {regStatus.deadlineLabel}
                        </p>
                      )}
                    </div>
                  )
                )}

                <span className="text-[10px] text-slate-400 font-bold text-center block pt-1">
                  Includes Certificate & Event Assets
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ================= DETAILS CONTENT GRID ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (span 8) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Banner poster container */}
            <div className="relative w-full rounded-3xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50 flex justify-center group">
              <img 
                src={event.posterImages?.[currentImageIndex]?.preview || event.image} 
                alt={event.title} 
                className="w-full h-auto max-h-[80vh] object-contain transition-opacity duration-300"
              />
              {event.posterImages && event.posterImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(prev => (prev === 0 ? event.posterImages!.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(prev => (prev === event.posterImages!.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    {event.posterImages.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-3' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* About the Event */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.01)] space-y-4">
              <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 border-b border-slate-50 pb-3">
                <Bookmark className="h-4.5 w-4.5 text-blue-600" />
                About the Event
              </h2>
              <StructuredEventOverview
                description={event.description}
                showMetadataPills={false}
              />
            </div>

            {/* Event Agenda */}
            {!isPast && event.hasAgenda && (() => {
              const items = (Array.isArray(event.agendaItems) && event.agendaItems.length > 0)
                ? event.agendaItems.filter(it => it && (it.time || it.title || it.description))
                : [
                    { time: event.agendaTime1, title: event.agendaTitle1, description: event.agendaDesc1 },
                    { time: event.agendaTime2, title: event.agendaTitle2, description: event.agendaDesc2 },
                    { time: event.agendaTime3, title: event.agendaTitle3, description: event.agendaDesc3 }
                  ].filter(it => it && (it.time || it.title || it.description));

              if (items.length === 0) return null;

              return (
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.01)] space-y-6">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 border-b border-slate-50 pb-3">
                    <SlidersHorizontal className="h-4.5 w-4.5 text-blue-600" />
                    Event Agenda
                  </h2>
                  
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 text-left">
                    {items.map((item, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
                        <div className="space-y-1">
                          {item.time && <span className="text-[10px] font-black text-blue-600">{item.time}</span>}
                          {item.title && <h4 className="text-sm font-bold text-slate-850">{item.title}</h4>}
                          {item.description && (
                            <p className="text-xs text-slate-550 font-semibold leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Competition Rounds & Timeline (if configured) */}
            {!isPast && event.rounds && event.rounds.length > 0 && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.01)] space-y-6 text-left">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Layers className="h-4.5 w-4.5 text-indigo-600" />
                    Competition Rounds & Schedule
                  </h2>
                  <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    {event.rounds.length} Stages
                  </span>
                </div>

                <div className="space-y-4">
                  {event.rounds.map((rnd, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        rnd.status === "Active"
                          ? "border-indigo-200 bg-indigo-50/25 ring-2 ring-indigo-500/10 shadow-xs"
                          : rnd.status === "Completed"
                          ? "bg-slate-50/50 border-slate-200 opacity-85"
                          : "bg-white border-slate-100 shadow-xs"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                            rnd.status === "Active"
                              ? "bg-indigo-600 text-white shadow-sm"
                              : rnd.status === "Completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}>
                            {rnd.roundNumber || idx + 1}
                          </span>
                          <h4 className="text-sm font-black text-slate-850">{rnd.name}</h4>
                          {rnd.type && (
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/60 uppercase">
                              {rnd.type}
                            </span>
                          )}
                        </div>

                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          rnd.status === "Active"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : rnd.status === "Completed"
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}>
                          {rnd.status}
                        </span>
                      </div>

                      {/* Round Dates display */}
                      {(rnd.startDate || rnd.endDate) && (
                        <div className="flex flex-wrap items-center gap-2.5 py-1 text-xs text-slate-500 font-semibold">
                          <div className="flex items-center gap-1.5 text-indigo-700 font-bold bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100/80 text-[11px]">
                            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                            <span>
                              {formatRoundDateRange(rnd.startDate, rnd.endDate)}
                            </span>
                          </div>
                        </div>
                      )}

                      {rnd.description && (
                        <p className="text-xs text-slate-500 font-normal leading-relaxed mt-1">
                          {rnd.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}


          </div>

          {/* Right Column (span 4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Event Coordinators & Organizing Team (Sidebar Card) */}
            {(event.facultyCoordinator || event.facultyCoordinator2 || event.studentCoordinator || event.studentCoordinator2 || facultyProfile || facultyProfile2 || studentProfile || studentProfile2) && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Event Coordinators
                </h3>

                <div className="space-y-3.5">
                  {/* Faculty Coordinator 1 Item */}
                  {(event.facultyCoordinator || facultyProfile) && (
                    <div className="p-3.5 rounded-2xl bg-purple-50/40 border border-purple-100/80 hover:bg-purple-50/70 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {facultyProfile?.image ? (
                            <img
                              src={facultyProfile.image}
                              alt="Faculty Coordinator"
                              className="w-11 h-11 rounded-xl object-cover border border-purple-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {getInitials(facultyProfile?.name || event.facultyCoordinator || "FC")}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs" title="Faculty Coordinator">
                            <GraduationCap className="w-2.5 h-2.5" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-850 truncate">
                            {facultyProfile?.name || event.facultyCoordinator}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md mt-1 border border-purple-200/50">
                            <GraduationCap className="w-3 h-3" />
                            {event.facultyCoordinator2 || facultyProfile2 ? "Faculty Coordinator 1" : "Faculty Coordinator"}
                          </span>
                          {(facultyProfile?.email || event.facultyCoordinatorEmail) && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-1 truncate">
                              <Mail className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="truncate">{facultyProfile?.email || event.facultyCoordinatorEmail}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Faculty Coordinator 2 Item */}
                  {(event.facultyCoordinator2 || facultyProfile2) && (
                    <div className="p-3.5 rounded-2xl bg-purple-50/40 border border-purple-100/80 hover:bg-purple-50/70 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {facultyProfile2?.image ? (
                            <img
                              src={facultyProfile2.image}
                              alt="Faculty Coordinator 2"
                              className="w-11 h-11 rounded-xl object-cover border border-purple-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {getInitials(facultyProfile2?.name || event.facultyCoordinator2 || "FC")}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs" title="Faculty Coordinator 2">
                            <GraduationCap className="w-2.5 h-2.5" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-850 truncate">
                            {facultyProfile2?.name || event.facultyCoordinator2}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md mt-1 border border-purple-200/50">
                            <GraduationCap className="w-3 h-3" />
                            Faculty Coordinator 2
                          </span>
                          {(facultyProfile2?.email || event.facultyCoordinatorEmail2) && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-1 truncate">
                              <Mail className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="truncate">{facultyProfile2?.email || event.facultyCoordinatorEmail2}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Student Coordinator 1 Item */}
                  {(event.studentCoordinator || studentProfile) && (
                    <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-100/80 hover:bg-amber-50/70 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {studentProfile?.image ? (
                            <img
                              src={studentProfile.image}
                              alt="Student Coordinator"
                              className="w-11 h-11 rounded-xl object-cover border border-amber-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {getInitials(studentProfile?.name || event.studentCoordinator || "SC")}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs" title="Student Coordinator 1">
                            <Sparkles className="w-2.5 h-2.5" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-850 truncate">
                            {studentProfile?.name || event.studentCoordinator}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md mt-1 border border-amber-200/50">
                            <Sparkles className="w-3 h-3" />
                            {event.studentCoordinator2 || studentProfile2 ? "Student Coordinator 1" : "Student Organizer"}
                          </span>
                          {(studentProfile?.email || event.studentCoordinatorEmail) && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-1 truncate">
                              <Mail className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{studentProfile?.email || event.studentCoordinatorEmail}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Student Coordinator 2 Item */}
                  {(event.studentCoordinator2 || studentProfile2) && (
                    <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-100/80 hover:bg-amber-50/70 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {studentProfile2?.image ? (
                            <img
                              src={studentProfile2.image}
                              alt="Student Coordinator 2"
                              className="w-11 h-11 rounded-xl object-cover border border-amber-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {getInitials(studentProfile2?.name || event.studentCoordinator2 || "SC")}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs" title="Student Coordinator 2">
                            <Sparkles className="w-2.5 h-2.5" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-850 truncate">
                            {studentProfile2?.name || event.studentCoordinator2}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md mt-1 border border-amber-200/50">
                            <Sparkles className="w-3 h-3" />
                            Student Coordinator 2
                          </span>
                          {(studentProfile2?.email || event.studentCoordinatorEmail2) && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-1 truncate">
                              <Mail className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{studentProfile2?.email || event.studentCoordinatorEmail2}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1. Meet the Speaker */}
            {event.speakerName && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5 text-left">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50">
                  Meet the Speaker
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-100 shadow-inner">
                    <img src={event.speakerImagePreview || elenaImg} alt="Speaker" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">{event.speakerName}</h4>
                    <span className="text-[10px] text-blue-600 font-bold block">{event.speakerRole || "Speaker & Guest"}</span>
                  </div>
                </div>

                {event.speakerBio && (
                  <p className="text-xs text-slate-550 leading-relaxed font-semibold">
                    {event.speakerBio}
                  </p>
                )}

                <div className="flex items-center gap-3.5 pt-3 border-t border-slate-50 text-slate-450">
                  {event.speakerLinkedin && event.speakerLinkedin !== "#" && (
                    <a href={event.speakerLinkedin} target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors" title="LinkedIn">
                      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                    </a>
                  )}
                  {event.speakerTwitter && event.speakerTwitter !== "#" && (
                    <a href={event.speakerTwitter} target="_blank" rel="noreferrer" className="hover:text-sky-500 transition-colors" title="Twitter">
                      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Meet the Jury */}
            {event.juryName && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5 text-left">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50 flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600" />
                  Meet the Jury
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-100 shadow-inner">
                    <img src={event.juryImagePreview || elenaImg} alt="Jury" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">{event.juryName}</h4>
                    <span className="text-[10px] text-indigo-600 font-bold block">{event.juryRole || "Grand Jury Evaluator"}</span>
                  </div>
                </div>

                {event.juryBio && (
                  <p className="text-xs text-slate-550 leading-relaxed font-semibold">
                    {event.juryBio}
                  </p>
                )}

                {event.juryLinkedin && event.juryLinkedin !== "#" && (
                  <div className="flex items-center gap-3.5 pt-3 border-t border-slate-50 text-slate-450">
                    <a href={event.juryLinkedin} target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors" title="LinkedIn">
                      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 2. Venue */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5 text-left">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50">
                Venue
              </h3>

              <div className="space-y-1 leading-normal">
                <span className="text-xs font-bold text-slate-700 block">{event.location}</span>
                <span className="text-[10px] text-slate-450 font-semibold block">University Tech Campus Hub</span>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/20 space-y-1">
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">CHECK-IN INSTRUCTIONS</span>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Please bring a valid photo ID. On-site parking is validated for all registered attendees.
                </p>
              </div>
            </div>

            {/* 3. Pricing & Payment QR Information */}
            {event.isPaidEvent && event.registrationFee && event.registrationFee > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-emerald-600" />
                    Payment Details
                  </h3>
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                    ₹{event.registrationFee} {event.pricingType === "per_team" ? "/ team" : "/ person"}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/80 space-y-2.5">
                  <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                    Registration fee is required for all participating members. Scan the QR code or pay to the official UPI ID.
                  </p>

                  {(event.paymentQrImagePreview || event.paymentQr) && (
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs flex flex-col items-center justify-center gap-1.5">
                      <div className="w-28 h-28 flex items-center justify-center">
                        <img
                          src={event.paymentQrImagePreview || event.paymentQr}
                          alt="Official Payment QR"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Scan to Pay via UPI
                      </span>
                    </div>
                  )}

                  {event.upiId && (
                    <div className="bg-white p-2 rounded-xl border border-emerald-200/80 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Official UPI ID</span>
                      <span className="text-xs font-mono font-black text-emerald-700 select-all block mt-0.5">
                        {event.upiId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ================= RELATED EVENTS ================= */}
      {relatedEvents.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-16 border-t border-slate-100">
          <div className="flex justify-between items-center mb-8 text-left">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
              Related Events
            </h3>
            <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
              Explore More
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedEvents.map((rEvent) => (
              <div 
                key={rEvent.id}
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img 
                      src={rEvent.image} 
                      alt={rEvent.title} 
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-white/95 text-blue-700 text-[8px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase shadow">
                      {rEvent.type}
                    </span>
                  </div>

                  <div className="p-5 text-left space-y-2">
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[40px]">
                      {rEvent.title}
                    </h4>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-blue-500" />
                        {formatRoundDateRange((rEvent as any).startDate || rEvent.date, (rEvent as any).endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-blue-500 truncate" />
                        {rEvent.location.split("/")[0].trim()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-1">
                  <Link to={`/events/${rEvent.id}`} onClick={() => window.scrollTo(0, 0)}>
                    <Button variant="secondary" size="sm" className="w-full rounded-xl bg-slate-50 border border-slate-200/50 hover:bg-slate-100 text-slate-650 font-bold text-xs py-2">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

export default EventDetailsPage;
