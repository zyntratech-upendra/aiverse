import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Calendar, 
  Clock, 
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
import { fetchEvents, fetchOrganizers } from "../../services/apiClient";
import { userService } from "../../services/userService";
import { dataCache } from "../../utils/dataCache";

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
  type: "Workshop" | "Hackathon" | "Seminar" | "Networking";
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
  studentCoordinator?: string;
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

const EventDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<DetailedEvent | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [facultyProfile, setFacultyProfile] = useState<{
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

  useEffect(() => {
    if (!id) return;

    // 1. Instant Cache Hydration
    const cachedEvent = dataCache.get<DetailedEvent>(`event_detail_${id}`);
    if (cachedEvent) {
      setEvent(cachedEvent);
      setLoading(false);
    }
    
    const fetchEventDetails = async () => {
      try {
        if (!cachedEvent) setLoading(true);
        const allEvents: any[] = await fetchEvents();
        const docSnap = (allEvents || []).find((e: any) => 
          e.id === id || 
          e._id === id || 
          (e.title && e.title.toLowerCase().replace(/[^a-z0-9]/g, "-").includes(id.toLowerCase()))
        ) || null;
        if (docSnap) {
          const data = docSnap || {};
          
          let eventType: DetailedEvent["type"] = "Workshop";
          const catUpper = String(data.category || "").toUpperCase();
          if (catUpper === "HACKATHONS" || catUpper === "HACKATHON") eventType = "Hackathon";
          else if (catUpper === "LECTURES" || catUpper === "SEMINAR" || catUpper === "SEMINARS") eventType = "Seminar";
          
          let img = data.coverImage || data.bannerImage || sparkImg;
          if (data.imageName === "hackathonImg" || catUpper === "HACKATHONS" || catUpper === "HACKATHON") img = data.coverImage || hackathonImg;
          else if (data.imageName === "seminarImg" || catUpper === "LECTURES" || catUpper === "SEMINAR") img = data.coverImage || seminarImg;
          
          let eventImages: {filename: string, preview: string}[] = [];
          if (data.posterImages && data.posterImages.length > 0) {
            eventImages = data.posterImages;
            img = eventImages[0].preview;
          } else if (data.posterPreview) {
            img = data.posterPreview;
            eventImages = [{filename: 'poster.png', preview: data.posterPreview}];
          } else if (data.coverImage) {
            img = data.coverImage;
            eventImages = [{filename: 'cover.png', preview: data.coverImage}];
          } else {
            eventImages = [{filename: 'default.png', preview: img}];
          }

          let timeText = data.time || "10:00 AM";
          if (data.startTime) {
            timeText = data.startTime;
            if (data.endTime) timeText += ` - ${data.endTime}`;
          }

          const facName = data.facultyCoordinator || "";
          const stuName = data.studentCoordinator || "";

          // Query user database in parallel to enrich coordinator profiles
          let matchedFac: any = null;
          let matchedStu: any = null;

          try {
            const allPeople: any[] = [];
            
            const [supaRes, orgsRes] = await Promise.allSettled([
              userService.getUsers(),
              fetchOrganizers()
            ]);

            if (supaRes.status === "fulfilled" && Array.isArray(supaRes.value)) {
              supaRes.value.forEach((u: any) => allPeople.push(u));
            }
            if (orgsRes.status === "fulfilled") {
              (orgsRes.value || []).forEach((d: any) => allPeople.push({ id: d.id || d._id, ...d }));
            }

            const facEmail = (data.facultyCoordinatorEmail || "").toLowerCase().trim();
            const stuEmail = (data.studentCoordinatorEmail || "").toLowerCase().trim();

            if (facName || facEmail) {
              const facLower = facName.toLowerCase().trim();
              const found = allPeople.find(p => {
                const pEmail = (p.email || "").toLowerCase().trim();
                if (facEmail && pEmail === facEmail) return true;
                const pRole = (p.role || p.position || "").toLowerCase();
                const isFaculty = pRole.includes("faculty") || pEmail.startsWith("facultycoordinator@");
                const pName = (p.name || p.displayName || "").toLowerCase().trim();
                return isFaculty && (pName === facLower || pEmail === facLower);
              }) || allPeople.find(p => {
                const pEmail = (p.email || "").toLowerCase().trim();
                const pRole = (p.role || p.position || "").toLowerCase();
                const isFaculty = pRole.includes("faculty") || pEmail.startsWith("facultycoordinator@");
                const pName = (p.name || p.displayName || "").toLowerCase().trim();
                return isFaculty && (pName.includes(facLower) || facLower.includes(pName));
              });

              if (found) {
                matchedFac = {
                  name: found.name || found.displayName || facName,
                  role: found.role || "Faculty Coordinator",
                  position: found.position || "Faculty Coordinator",
                  image: found.image || "",
                  email: found.email || facEmail || "",
                  phone: found.phone || found.phoneNumber || ""
                };
              } else {
                matchedFac = {
                  name: facName,
                  role: "Faculty Coordinator",
                  position: "Faculty Coordinator",
                  image: "",
                  email: facEmail || "",
                  phone: ""
                };
              }
            }

            if (stuName || stuEmail) {
              const stuLower = stuName.toLowerCase().trim();
              const found = allPeople.find(p => {
                const pEmail = (p.email || "").toLowerCase().trim();
                if (stuEmail && pEmail === stuEmail) return true;
                const pRole = (p.role || p.position || "").toLowerCase();
                const isNotFaculty = !pRole.includes("faculty") && !pEmail.startsWith("facultycoordinator@");
                const pName = (p.name || p.displayName || "").toLowerCase().trim();
                return isNotFaculty && (pName === stuLower || pEmail === stuLower);
              }) || allPeople.find(p => {
                const pEmail = (p.email || "").toLowerCase().trim();
                const pRole = (p.role || p.position || "").toLowerCase();
                const isNotFaculty = !pRole.includes("faculty") && !pEmail.startsWith("facultycoordinator@");
                const pName = (p.name || p.displayName || "").toLowerCase().trim();
                return isNotFaculty && (pName.includes(stuLower) || stuLower.includes(pName));
              });

              if (found) {
                matchedStu = {
                  name: found.name || found.displayName || stuName,
                  role: found.role || "Student Organizer",
                  position: found.position || "Student Coordinator",
                  image: found.image || "",
                  email: found.email || stuEmail || "",
                  phone: found.phone || found.phoneNumber || ""
                };
              } else {
                matchedStu = {
                  name: stuName,
                  role: "Student Organizer",
                  position: "Student Coordinator",
                  image: "",
                  email: stuEmail || "",
                  phone: ""
                };
              }
            }
          } catch (err) {
            console.warn("Notice enriching coordinator details:", err);
          }

          setFacultyProfile(matchedFac);
          setStudentProfile(matchedStu);

          const eventDetailObj: DetailedEvent = {
            id: docSnap.id,
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
            facultyCoordinator: data.facultyCoordinator || "",
            studentCoordinator: data.studentCoordinator || "",
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
            agendaTime1: data.agendaTime1 || "09:00 AM - 10:30 AM",
            agendaTitle1: data.agendaTitle1 || "Morning Keynote: The Future of Compute",
            agendaDesc1: data.agendaDesc1 || "Opening session detailing next-generation silicon and computation architectural design patterns.",
            agendaTime2: data.agendaTime2 || "11:30 AM - 01:00 PM",
            agendaTitle2: data.agendaTitle2 || "Workshop: Transformer Efficiency",
            agendaDesc2: data.agendaDesc2 || "Hands-on session covering FlashAttention, quantization techniques, and sparse computation models.",
            agendaTime3: data.agendaTime3 || "03:00 PM - 04:30 PM",
            agendaTitle3: data.agendaTitle3 || "Panel: Ethical Scaling",
            agendaDesc3: data.agendaDesc3 || "A roundtable discussion with industry leaders on the societal implications of massive model deployment.",
            agendaItems: data.agendaItems || [],
            allowRegistrations: data.allowRegistrations !== undefined ? data.allowRegistrations : true,
            rounds: data.rounds || []
          };

          setEvent(eventDetailObj);
          dataCache.set(`event_detail_${id}`, eventDetailObj);
        }

        // Fetch first 3 other events as related events
        const allEvents2: any[] = await fetchEvents();
        const related: any[] = [];
        (allEvents2 || []).forEach((doc: any) => {
          const docId = doc._id || doc.id || "";
          if (docId !== id && related.length < 3) {
            const data = doc || {};
            let eventType: DetailedEvent["type"] = "Workshop";
            if (data.category === "HACKATHONS") eventType = "Hackathon";
            else if (data.category === "LECTURES") eventType = "Seminar";
            
            let img = sparkImg;
            if (data.imageName === "hackathonImg" || data.category === "HACKATHONS") img = hackathonImg;
            else if (data.imageName === "seminarImg" || data.category === "LECTURES") img = seminarImg;
            
            if (data.posterPreview) {
              img = data.posterPreview;
            }

            related.push({
              id: doc._id || doc.id || "",
              title: data.title || "",
              type: eventType,
              date: data.date || "Oct 24",
              location: data.location || "Virtual Hub",
              image: img
            });
          }
        });
        setRelatedEvents(related);
      } catch (err) {
        console.error("Error reading event details:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEventDetails();
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

  const isPastEvent = (): boolean => {
    if (!event) return false;
    if (event.status === "Completed") return true;
    if ((event as any).isPastEvent) return true;

    // Check endDate or startDate
    if (event.endDate) {
      const parsedEnd = Date.parse(event.endDate);
      if (!isNaN(parsedEnd)) {
        const endOfDay = new Date(parsedEnd).setHours(23, 59, 59, 999);
        if (Date.now() > endOfDay) return true;
      }
    }
    if (event.startDate) {
      const parsedStart = Date.parse(event.startDate);
      if (!isNaN(parsedStart)) {
        const endOfDay = new Date(parsedStart).setHours(23, 59, 59, 999);
        if (Date.now() > endOfDay) return true;
      }
    }

    // Check event.date string
    if (event.date) {
      const dStr = event.date.trim();
      const direct = Date.parse(dStr);
      if (!isNaN(direct)) {
        const endOfDay = new Date(direct).setHours(23, 59, 59, 999);
        if (Date.now() > endOfDay) return true;
      }

      const currentYear = new Date().getFullYear();
      const withYear = Date.parse(`${dStr}, ${currentYear}`);
      if (!isNaN(withYear)) {
        const endOfDay = new Date(withYear).setHours(23, 59, 59, 999);
        if (Date.now() > endOfDay) return true;
      }

      const monthNames: Record<string, number> = {
        jan: 0, january: 0,
        feb: 1, february: 1,
        mar: 2, march: 2,
        apr: 3, april: 3,
        may: 4,
        jun: 5, june: 5,
        jul: 6, july: 6,
        aug: 7, august: 7,
        sep: 8, sept: 8, september: 8,
        oct: 9, october: 9,
        nov: 10, november: 10,
        dec: 11, december: 11
      };

      const tokens = dStr.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
      let foundMonth = -1;
      let foundDay = -1;
      let foundYear = currentYear;

      for (const t of tokens) {
        if (monthNames[t] !== undefined) {
          foundMonth = monthNames[t];
        } else {
          const n = parseInt(t, 10);
          if (!isNaN(n)) {
            if (n > 1900 && n < 2100) foundYear = n;
            else if (n >= 1 && n <= 31 && foundDay === -1) foundDay = n;
          }
        }
      }

      if (foundMonth !== -1 && foundDay !== -1) {
        const eventTime = new Date(foundYear, foundMonth, foundDay).getTime();
        const endOfDay = new Date(eventTime).setHours(23, 59, 59, 999);
        if (Date.now() > endOfDay) return true;
      }
    }

    return false;
  };

  const isPast = isPastEvent();

  return (
    <div className="bg-[#F8FAFC] pb-24 text-left font-sans animate-in fade-in duration-200">
      <SEO 
        title={`${event.title} - AI Verse`} 
        description={event.description.substring(0, 150)}
        keywords={`${event.type}, ${event.title}, AI Verse`}
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
                  {event.date}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  {event.time}
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
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">REGISTRATION</span>
                  <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {event.currentReg} Registered
                  </span>
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
                  <p className="text-[10px] text-slate-400 font-semibold">
                    {event.isPaidEvent && event.registrationFee && event.registrationFee > 0
                      ? event.pricingType === "per_team"
                        ? "Paid Hackathon Entry (Flat Team Rate)"
                        : "Paid Hackathon Entry (Per Person)"
                      : "Early Bird RSVP active"}
                  </p>
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
                  isPast ? (
                    <Button variant="secondary" disabled className="w-full font-bold rounded-2xl py-3 text-xs flex items-center justify-center gap-2 text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed">
                      Event Completed
                    </Button>
                  ) : event.allowRegistrations === false ? (
                    <Button variant="secondary" disabled className="w-full font-bold rounded-2xl py-3 text-xs flex items-center justify-center gap-2 text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed">
                      Registration Closed
                    </Button>
                  ) : (
                    <Link to={`/events/${event.id}/register`} className="w-full">
                      <Button variant="gradient" className="w-full font-bold rounded-2xl py-3 text-xs flex items-center justify-center gap-2">
                        Register Now
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )
                ) : (
                  isPast ? (
                    <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center">
                      <span className="text-xs font-bold text-slate-500 block">Event Completed</span>
                      <span className="text-[10px] font-medium text-slate-400 block mt-0.5">This event has already concluded</span>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center">
                      <span className="text-xs font-bold text-slate-700 block">Open Public Event</span>
                      <span className="text-[10px] font-medium text-slate-400 block mt-0.5">No registration required for this event</span>
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
              <p className="text-slate-550 text-sm leading-relaxed whitespace-pre-wrap font-semibold">
                {event.description}
              </p>
              <p className="text-slate-550 text-sm leading-relaxed font-semibold pt-2">
                This event is tailored for students, scholars, and builders wanting to deep-dive into cutting-edge applications. During the hands-on lab modules, mentors will assist step-by-step to design and deploy functional pipelines, reinforcing foundational frameworks.
              </p>
            </div>

            {/* Event Agenda */}
            {!isPast && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.01)] space-y-6">
                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 border-b border-slate-50 pb-3">
                  <SlidersHorizontal className="h-4.5 w-4.5 text-blue-600" />
                  Event Agenda
                </h2>
                
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 text-left">
                  {(event.agendaItems && event.agendaItems.length > 0
                    ? event.agendaItems
                    : [
                        { time: event.agendaTime1, title: event.agendaTitle1, description: event.agendaDesc1 },
                        { time: event.agendaTime2, title: event.agendaTitle2, description: event.agendaDesc2 },
                        { time: event.agendaTime3, title: event.agendaTitle3, description: event.agendaDesc3 }
                      ].filter(it => it.time || it.title)
                  ).map((item, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-blue-600">{item.time}</span>
                        <h4 className="text-sm font-bold text-slate-850">{item.title}</h4>
                        <p className="text-xs text-slate-550 font-semibold leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

                      {/* Round Dates & Time display */}
                      {(rnd.startDate || rnd.endDate || rnd.startTime || rnd.endTime) && (
                        <div className="flex flex-wrap items-center gap-2.5 py-1 text-xs text-slate-500 font-semibold">
                          {(rnd.startDate || rnd.endDate) && (
                            <div className="flex items-center gap-1.5 text-indigo-700 font-bold bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100/80 text-[11px]">
                              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                              <span>
                                {rnd.startDate}
                                {rnd.endDate && rnd.endDate !== rnd.startDate ? ` - ${rnd.endDate}` : ""}
                              </span>
                            </div>
                          )}
                          {(rnd.startTime || rnd.endTime) && (
                            <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60 text-[11px]">
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                              <span>
                                {rnd.startTime}
                                {rnd.endTime && rnd.endTime !== rnd.startTime ? ` - ${rnd.endTime}` : ""}
                              </span>
                            </div>
                          )}
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

            {/* Event Organizing Leadership & Coordinators (Main Column) */}
            {(event.facultyCoordinator || event.studentCoordinator || facultyProfile || studentProfile) && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.01)] space-y-6 text-left">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-blue-600" />
                    Event Coordinators & Organizing Team
                  </h2>
                  <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    Leadership
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Faculty Coordinator Card */}
                  {(event.facultyCoordinator || facultyProfile) && (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/60 via-purple-50/20 to-indigo-50/30 border border-purple-100/90 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="flex items-start gap-3.5">
                        <div className="relative">
                          {facultyProfile?.image ? (
                            <img
                              src={facultyProfile.image}
                              alt="Faculty Coordinator"
                              className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-200 shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-base flex items-center justify-center shadow-sm">
                              {getInitials(facultyProfile?.name || event.facultyCoordinator || "FC")}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-sm">
                            <GraduationCap className="w-3 h-3" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-black text-purple-700 bg-purple-100/90 border border-purple-200/70 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mb-1">
                            Faculty Coordinator
                          </span>
                          <h4 className="text-sm font-black text-slate-850 truncate">
                            {facultyProfile?.name || event.facultyCoordinator}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            {facultyProfile?.position || "Department Coordinator"}
                          </p>
                        </div>
                      </div>

                      {facultyProfile?.email && (
                        <div className="pt-2 border-t border-purple-100/60 flex items-center gap-1.5 text-xs text-purple-700 font-semibold truncate">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{facultyProfile.email}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Student Coordinator Card */}
                  {(event.studentCoordinator || studentProfile) && (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/60 via-amber-50/20 to-orange-50/30 border border-amber-100/90 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="flex items-start gap-3.5">
                        <div className="relative">
                          {studentProfile?.image ? (
                            <img
                              src={studentProfile.image}
                              alt="Student Coordinator"
                              className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-200 shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white font-black text-base flex items-center justify-center shadow-sm">
                              {getInitials(studentProfile?.name || event.studentCoordinator || "SC")}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-sm">
                            <Sparkles className="w-3 h-3" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-black text-amber-800 bg-amber-100/90 border border-amber-200/70 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mb-1">
                            Student Organizer
                          </span>
                          <h4 className="text-sm font-black text-slate-850 truncate">
                            {studentProfile?.name || event.studentCoordinator}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            {studentProfile?.position || "Student Lead / Organizer"}
                          </p>
                        </div>
                      </div>

                      {studentProfile?.email && (
                        <div className="pt-2 border-t border-amber-100/60 flex items-center gap-1.5 text-xs text-amber-700 font-semibold truncate">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{studentProfile.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Right Column (span 4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Event Coordinators & Organizing Team (Sidebar Card) */}
            {(event.facultyCoordinator || event.studentCoordinator || facultyProfile || studentProfile) && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Event Coordinators
                </h3>

                <div className="space-y-3.5">
                  {/* Faculty Coordinator Item */}
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
                            Faculty Coordinator
                          </span>
                          {facultyProfile?.email && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-1 truncate">
                              <Mail className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="truncate">{facultyProfile.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Student Coordinator Item */}
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
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs" title="Student Organizer">
                            <Sparkles className="w-2.5 h-2.5" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-850 truncate">
                            {studentProfile?.name || event.studentCoordinator}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md mt-1 border border-amber-200/50">
                            <Sparkles className="w-3 h-3" />
                            Student Organizer
                          </span>
                          {studentProfile?.email && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-1 truncate">
                              <Mail className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{studentProfile.email}</span>
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
                        {rEvent.date}
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
