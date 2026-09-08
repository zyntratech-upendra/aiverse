import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Search, 
  Calendar, 
  MapPin, 
  TrendingUp, 
  Lightbulb
} from "lucide-react";
import Button from "../../components/ui/Button";
import SEO from "../../components/layout/SEO";
import { fetchEvents } from "../../services/apiClient";
import { dataCache } from "../../utils/dataCache";

// Import local assets
import sparkImg from "../../assets/images/spark.png";
import hackathonImg from "../../assets/images/hackathon.png";
import seminarImg from "../../assets/images/seminar.png";

interface Event {
  id: string;
  title: string;
  type: "Workshop" | "Hackathon" | "Seminar" | "Networking" | "Quiz";
  category?: string;
  date: string;
  time: string;
  location: string;
  description: string;
  image: string;
  status: "Draft" | "Active" | "Opened" | "Completed" | "Archived";
  currentReg: number;
  maxReg: number;
  endDate?: string;
  isPastEvent?: boolean;
  registrationFee?: number;
  pricingType?: "per_person" | "per_team";
  isPaidEvent?: boolean;
  allowRegistrations?: boolean;
}

const EventsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Hackathon" | "Workshop" | "Seminar" | "Quiz" | "Completed">("All");
  const [events, setEvents] = useState<Event[]>(() => dataCache.get<Event[]>("public_events") || []);
  const [loading, setLoading] = useState<boolean>(() => !dataCache.get<Event[]>("public_events"));

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const querySnapshot = await fetchEvents();
        const list: Event[] = [];
        const idsSeen = new Set<string>();

        (querySnapshot || []).forEach((docSnap: any) => {
          const data = docSnap || {};
          const eventId = String(data.id || data._id || "").trim();
          const title = (data.title || "").trim();
          
          if (!eventId || idsSeen.has(eventId)) {
            return;
          }
          idsSeen.add(eventId);
          
          let eventType: Event["type"] = "Workshop";
          const catUpper = String(data.category || "").toUpperCase();
          if (catUpper.includes("HACKATHON")) {
            eventType = "Hackathon";
          } else if (catUpper.includes("LECTURE") || catUpper.includes("SEMINAR")) {
            eventType = "Seminar";
          } else if (catUpper.includes("NETWORK") || catUpper.includes("MEETUP") || catUpper.includes("ALUMNI")) {
            eventType = "Networking";
          } else if (catUpper.includes("QUIZ")) {
            eventType = "Quiz";
          } else if (catUpper.includes("TECH") || catUpper.includes("WORKSHOP")) {
            eventType = "Workshop";
          }
          
          let img = sparkImg;
          if (data.imageName === "hackathonImg" || catUpper.includes("HACKATHON")) img = hackathonImg;
          else if (data.imageName === "seminarImg" || catUpper.includes("LECTURE") || catUpper.includes("SEMINAR")) img = seminarImg;
          
          if (data.posterPreview) {
            img = data.posterPreview;
          } else if (data.posterImages && data.posterImages[0]?.preview) {
            img = data.posterImages[0].preview;
          }

          let timeText = data.time || "10:00 AM";
          if (data.startTime) {
            timeText = data.startTime;
            if (data.endTime) timeText += ` - ${data.endTime}`;
          }

          const rawStatus = String(data.status || "Opened").trim();
          const isExplicitlyDraft = rawStatus.toLowerCase() === "draft";
          const isExplicitlyCompleted = rawStatus.toLowerCase() === "completed" || Boolean(data.isPastEvent);
          const normStatus = isExplicitlyCompleted ? "Completed" : isExplicitlyDraft ? "Draft" : "Opened";

          list.push({
            id: eventId,
            title: title || "Untitled Event",
            type: eventType,
            category: data.category || eventType,
            date: data.date || data.startDate || "TBD",
            time: timeText,
            location: data.location || data.venue || "Virtual Hub",
            description: data.description || data.shortDescription || "",
            image: img,
            status: normStatus as Event["status"],
            currentReg: Math.max(0, Number(data.currentReg) || 0),
            maxReg: data.maxReg || 100,
            endDate: data.endDate || data.startDate || "",
            isPastEvent: isExplicitlyCompleted,
            registrationFee: data.registrationFee !== undefined ? Number(data.registrationFee) : 0,
            pricingType: data.pricingType === "per_team" || data.pricingModel === "per_team" ? "per_team" : "per_person",
            isPaidEvent: data.isPaidEvent !== undefined ? Boolean(data.isPaidEvent) : (Number(data.registrationFee) > 0),
            allowRegistrations: data.allowRegistrations !== undefined ? data.allowRegistrations : true
          });
        });

        // Helper function to extract exact numerical timestamp from event date
        const getEventTimestamp = (ev: { date?: string; endDate?: string; createdAt?: number }): number => {
          if (ev.endDate) {
            const parsedEnd = Date.parse(ev.endDate);
            if (!isNaN(parsedEnd)) return parsedEnd;
          }
          if (ev.date && ev.date !== "TBD") {
            const dStr = ev.date.trim();
            const parsedDirect = Date.parse(dStr);
            if (!isNaN(parsedDirect)) return parsedDirect;

            const currentYear = new Date().getFullYear();
            const parsedWithYear = Date.parse(`${dStr}, ${currentYear}`);
            if (!isNaN(parsedWithYear)) return parsedWithYear;

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
              return new Date(foundYear, foundMonth, foundDay).getTime();
            }
          }

          return 0;
        };

        const startOfToday = new Date().setHours(0, 0, 0, 0);
        const upcomingEvents: Event[] = [];
        const pastEvents: Event[] = [];

        list.forEach((ev) => {
          const evTime = getEventTimestamp(ev);
          const endOfDay = evTime > 0 ? new Date(evTime).setHours(23, 59, 59, 999) : Infinity;
          if (ev.status === "Completed" || ev.isPastEvent || (evTime > 0 && endOfDay < startOfToday)) {
            pastEvents.push(ev);
          } else {
            upcomingEvents.push(ev);
          }
        });

        // Upcoming events: newly created or closest upcoming first
        upcomingEvents.sort((a, b) => {
          const timeA = getEventTimestamp(a);
          const timeB = getEventTimestamp(b);
          if (timeA === 0 && timeB === 0) return 0;
          if (timeA === 0) return -1;
          if (timeB === 0) return 1;
          return timeA - timeB;
        });

        pastEvents.sort((a, b) => getEventTimestamp(b) - getEventTimestamp(a));

        const finalSorted = [...upcomingEvents, ...pastEvents];
        setEvents(finalSorted);
        dataCache.set("public_events", finalSorted);
      } catch (err) {
        console.error("Error reading events from API:", err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
    window.addEventListener("eventsUpdated", loadEvents);
    window.addEventListener("storage", loadEvents);

    return () => {
      window.removeEventListener("eventsUpdated", loadEvents);
      window.removeEventListener("storage", loadEvents);
    };
  }, []);

  const parseEventDate = (dateStr?: string, endDateStr?: string): number => {
    if (endDateStr) {
      const parsedEnd = Date.parse(endDateStr);
      if (!isNaN(parsedEnd)) return parsedEnd;
    }
    if (!dateStr) return Infinity;
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) return parsed;
    const currentYear = new Date().getFullYear();
    const parsedWithYear = Date.parse(`${dateStr}, ${currentYear}`);
    if (!isNaN(parsedWithYear)) return parsedWithYear;

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

    const tokens = dateStr.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
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
      return new Date(foundYear, foundMonth, foundDay).getTime();
    }

    return Infinity;
  };

  const isCompletedEvent = (event: Event): boolean => {
    if (event.status === "Completed") return true;
    if (event.isPastEvent) return true;

    const eventTime = parseEventDate(event.date, event.endDate);
    if (eventTime !== Infinity) {
      const now = Date.now();
      const endOfDay = new Date(eventTime).setHours(23, 59, 59, 999);
      if (now > endOfDay) return true;
    }
    return false;
  };

  const timelineEvents = events.slice(0, 5).map(e => ({
    date: e.date,
    title: e.title,
    type: `${e.type} • ${e.location.split("/")[0].trim()}`
  }));

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case "Hackathon":
        return "bg-rose-50/80 text-rose-600 border border-rose-100/50";
      case "Seminar":
        return "bg-amber-50/80 text-amber-600 border border-amber-100/50";
      case "Networking":
        return "bg-emerald-50/80 text-emerald-600 border border-emerald-100/50";
      case "Quiz":
        return "bg-purple-50/80 text-purple-600 border border-purple-100/50";
      default: // Workshop
        return "bg-blue-50/80 text-[#2563EB] border border-blue-100/50";
    }
  };

  // Filter events based on active tab and search query
  const filteredEvents = events.filter((event) => {
    if (event.status === "Draft") return false;
    const isCompleted = isCompletedEvent(event);

    let matchesTab = false;
    if (activeTab === "Completed") {
      matchesTab = isCompleted;
    } else if (activeTab === "All") {
      matchesTab = true;
    } else if (activeTab === "Hackathon") {
      matchesTab = event.type === "Hackathon" || (event.category || "").toUpperCase().includes("HACKATHON");
    } else if (activeTab === "Workshop") {
      matchesTab = event.type === "Workshop" || (event.category || "").toUpperCase().includes("WORKSHOP") || (event.category || "").toUpperCase().includes("TECH");
    } else if (activeTab === "Seminar") {
      matchesTab = event.type === "Seminar" || (event.category || "").toUpperCase().includes("SEMINAR") || (event.category || "").toUpperCase().includes("LECTURE");
    } else if (activeTab === "Quiz") {
      matchesTab = event.type === "Quiz" || (event.category || "").toUpperCase().includes("QUIZ");
    } else {
      matchesTab = event.type === activeTab;
    }

    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (event.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const fadeInUp = {
    hidden: { opacity: 0, y: 25 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" as const }
    }
  };

  return (
    <div className="overflow-hidden bg-[#F8FAFC] pb-16">
      <SEO 
        title="Events & Hackathons | AI Verse VITB - VIT Bhimavaram" 
        description="Join AI Verse VITB hackathons, coding workshops, AI & Data Science symposiums, and technical guest lectures at Vishnu Institute of Technology, Bhimavaram."
        keywords="AI workshops, Hackathons, AI Seminars, Community Events, aiversevitb, AI Verse VITB, VIT Bhimavaram"
      />
      
      {/* ================= HERO SECTION ================= */}
      <section className="relative pt-24 pb-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-tr from-slate-50 via-blue-50/30 to-sky-50/20 rounded-b-[40px] border-b border-slate-100 shadow-sm">
        {/* Soft decorative background gradients */}
        <div className="absolute inset-0 overflow-hidden rounded-b-[40px] -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(219,234,254,0.6)_0%,transparent_70%)] transform-gpu" />
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(224,242,254,0.6)_0%,transparent_70%)] transform-gpu" />
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10 py-1">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-aether-dark"
          >
            Discover the <br />
            <span className="bg-gradient-to-r from-[#2563EB] via-blue-500 to-indigo-500 bg-clip-text text-transparent">Future of AI</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-500 text-xs sm:text-sm lg:text-base max-w-2xl mx-auto font-normal leading-relaxed"
          >
            Join our workshops, hackathons, and seminars to stay at the forefront of artificial intelligence innovation.
          </motion.p>

          {/* Interactive Search Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-md mx-auto pt-2"
          >
            <div className="relative flex items-center bg-white border border-slate-200/80 shadow-md shadow-slate-100/60 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-[#2563EB] transition-all">
              <Search className="absolute left-4 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                id="events-search"
                name="eventsSearch"
                type="text"
                aria-label="Find specific events"
                placeholder="Find specific events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent pl-11 pr-24 py-2.5 text-sm outline-none text-slate-800 font-sans placeholder-slate-400"
              />
              <button className="absolute right-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors select-none shadow-sm">
                Search
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= TABS NAVIGATION SECTION ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {(["All", "Hackathon", "Workshop", "Seminar", "Quiz", "Completed"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const labelMap = {
              All: "All Events",
              Hackathon: "Hackathons",
              Workshop: "Workshops",
              Seminar: "Seminars",
              Quiz: "Quizzes",
              Completed: "Completed"
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-5 text-xs sm:text-sm font-semibold border-b-2 transition-all relative shrink-0
                  ${isActive 
                    ? "border-[#2563EB] text-[#2563EB]" 
                    : "border-transparent text-slate-500 hover:text-[#2563EB]"
                  }`}
              >
                {labelMap[tab]}
                {isActive && (
                  <motion.div 
                    layoutId="activeEventTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563EB]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= EVENTS LAYOUT BODY ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Event List */}
          <div className="lg:col-span-8 space-y-6">
            {loading ? (
              <div className="bg-white rounded-card shadow-sm border border-slate-100 py-16 text-center text-slate-500 font-bold animate-pulse text-xs uppercase tracking-wider">
                Loading events from database...
              </div>
            ) : filteredEvents.length > 0 ? (
              filteredEvents.map((event) => {
                const isCompleted = isCompletedEvent(event);

                return (
                  <motion.div
                    key={event.id}
                    variants={fadeInUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-4 sm:p-5 flex flex-col md:flex-row gap-5 items-stretch group hover:shadow-card transition-all duration-300"
                  >
                    {/* Event Thumbnail */}
                    <div className="w-full md:w-56 aspect-[4/3] rounded-xl overflow-hidden shrink-0 bg-slate-100">
                      <img 
                        src={event.image} 
                        alt={event.title} 
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                      />
                    </div>

                    {/* Event Copy Details */}
                    <div className="flex flex-col justify-between py-1 text-left flex-grow space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-extrabold text-slate-800 leading-tight group-hover:text-[#2563EB] transition-colors line-clamp-1">
                          {event.title}
                        </h3>
                        
                        {/* Meta Details */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-[#2563EB]" />
                            {event.date} • {event.time}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {event.location}
                          </span>
                        </div>

                        <p className="text-slate-500 text-xs sm:text-sm font-normal leading-relaxed pt-1.5 line-clamp-2">
                          {event.description}
                        </p>
                      </div>

                      {/* Action Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <Button variant="secondary" size="sm" disabled className="rounded-lg font-bold text-xs px-5 py-2 text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed">
                              Event Completed
                            </Button>
                          ) : event.allowRegistrations === false ? (
                            <Button variant="secondary" size="sm" disabled className="rounded-lg font-bold text-xs px-5 py-2 text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed">
                              Registration Closed
                            </Button>
                          ) : (
                            <Link to={`/events/${event.id}/register`}>
                              <Button variant="gradient" size="sm" className="rounded-lg font-bold text-xs px-5 py-2 hover:scale-102 transition-transform">
                                Register Now
                              </Button>
                            </Link>
                          )}
                          <Link to={`/events/${event.id}`}>
                            <Button variant="secondary" size="sm" className="rounded-lg font-bold text-xs bg-slate-50 border border-slate-200/50 hover:bg-slate-100 hover:scale-102 transition-transform px-5 py-2 text-slate-600">
                              View Details
                            </Button>
                          </Link>
                        </div>

                        {/* Category, Price & Status Tags in right box region */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black tracking-wider px-2.5 py-1 rounded-lg uppercase shadow-sm ${
                            event.isPaidEvent && event.registrationFee && event.registrationFee > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-50 text-slate-600 border border-slate-200"
                          }`}>
                            {event.isPaidEvent && event.registrationFee && event.registrationFee > 0
                              ? `₹${event.registrationFee} ${event.pricingType === "per_team" ? "/ team" : "/ person"}`
                              : "Free"}
                          </span>
                          <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-lg uppercase shadow-sm ${getCategoryStyles(event.type)}`}>
                            {event.type}
                          </span>
                          {isCompleted && (
                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-lg uppercase shadow-sm">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="bg-white rounded-card shadow-sm border border-slate-100 py-16 text-center text-slate-500 font-medium">
                No events found matching your search.
              </div>
            )}

            {/* Load More Button */}
            {filteredEvents.length > 0 && (
              <button className="w-full py-3.5 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 transition-all font-bold text-xs rounded-xl shadow-sm">
                Load More Events
              </button>
            )}
          </div>

          {/* Right Column: Sidebar Timeline of Innovation */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-card shadow-sm border border-slate-100 p-6 text-left space-y-6">
              
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <TrendingUp className="h-4 w-4 text-aether-blue-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-aether-dark">
                  Timeline of Innovation
                </h3>
              </div>

              {/* Connected Vertical Timeline */}
              <div className="relative pl-6 space-y-7 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                {timelineEvents.map((timeEvent, idx) => (
                  <div key={idx} className="relative group/timeline">
                    {/* Bullet marker */}
                    <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-slate-200 group-hover/timeline:bg-aether-blue-500 transition-colors shadow-sm" />
                    
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-aether-blue-600">
                        {timeEvent.date}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-aether-dark group-hover/timeline:text-aether-blue-600 transition-colors">
                        {timeEvent.title}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                        {timeEvent.type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ================= BOTTOM CTA: HAVE AN EVENT IDEA? ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <motion.div 
          whileHover={{ scale: 1.005 }}
          className="bg-gradient-to-tr from-aether-blue-50/50 via-sky-50/30 to-blue-50/20 border border-aether-blue-100/40 rounded-[28px] p-10 sm:p-14 text-center max-w-5xl mx-auto space-y-5 relative overflow-hidden shadow-sm"
        >
          {/* Icon Badge */}
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white text-aether-blue-600 shadow-sm border border-aether-blue-100/30 mx-auto">
            <Lightbulb className="h-5 w-5" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-aether-dark tracking-tight">
            Have an Event Idea?
          </h2>
          <p className="text-slate-500 font-medium text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto font-normal">
            We are always looking for industry leaders and passionate innovators to host workshops or speak at our seminars. Let's shape the future together.
          </p>
          <div className="pt-2">
            <Link to="/contact">
              <Button variant="gradient" className="rounded-xl px-8 py-3.5 font-bold shadow-button hover:shadow-lg hover:scale-102 transition-all text-xs">
                Collaborate with Us
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

    </div>
  );
};

export default EventsPage;
