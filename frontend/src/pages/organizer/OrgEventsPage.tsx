import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../config/firebase";
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from "firebase/firestore";
import SEO from "../../components/layout/SEO";
import { useAuth } from "../../context/AuthContext";
import { 
  Calendar, 
  MapPin, 
  Users, 
  X, 
  Loader2, 
  TrendingUp, 
  BarChart3, 
  Archive, 
  Edit3, 
  Award,
  AlertCircle
} from "lucide-react";
import Button from "../../components/ui/Button";

// Import local assets matching existing images
import sparkImg from "../../assets/images/spark.png";
import hackathonImg from "../../assets/images/hackathon.png";
import seminarImg from "../../assets/images/seminar.png";
import galleryLabImg from "../../assets/images/gallery_lab.png";
import galleryCodingImg from "../../assets/images/gallery_coding.png";
import galleryCollabImg from "../../assets/images/gallery_collab.png";

interface EventItem {
  id: string;
  title: string;
  category: "WORKSHOPS" | "HACKATHONS" | "LECTURES" | "QUIZ" | string;
  status: "Draft" | "Active" | "Opened" | "Completed" | "Archived";
  date: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  location: string;
  currentReg: number;
  maxReg: number;
  role?: string;
  description?: string;
  posterPreview?: string;
  imageName?: string;
}

const OrgEventsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const searchQuery = "";
  const [activeTab, setActiveTab] = useState<"Upcoming" | "Active" | "Past">("Upcoming");
  const selectedCategory = "All";

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [reportingEvent, setReportingEvent] = useState<EventItem | null>(null);
  const [archivingEvent, setArchivingEvent] = useState<EventItem | null>(null);

  // Form States (Create/Edit)
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<"Workshop" | "Hackathon" | "Seminar" | "Quiz">("Workshop");
  const [formRole, setFormRole] = useState("Lead Coordinator");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("10:00 AM");
  const [formEndTime, setFormEndTime] = useState("04:00 PM");
  const [formLocation, setFormLocation] = useState("");
  const [formMaxReg, setFormMaxReg] = useState("150");
  const [formDescription, setFormDescription] = useState("");
  const [formPosterPreview, setFormPosterPreview] = useState("");
  const [formStatus, setFormStatus] = useState<"Draft" | "Active" | "Opened">("Active");

  // Fetch Events from Firestore
  const fetchEvents = async () => {
    try {
      setLoading(true);

      // Fetch organizers to filter events assigned to logged-in user
      const organizersSnapshot = await getDocs(collection(db, "organizers"));
      const organizerDoc = organizersSnapshot.docs.find(docSnap => 
        docSnap.data().email?.toLowerCase() === user?.email?.toLowerCase()
      )?.data();

      const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      let list: EventItem[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || "Untitled Event",
          category: data.category || "WORKSHOPS",
          status: data.status || "Active",
          date: data.date || "TBD",
          time: data.time || data.startTime || "TBD",
          startTime: data.startTime || "",
          endTime: data.endTime || "",
          location: data.location || "TBD",
          currentReg: Math.max(0, Number(data.currentReg) || 0),
          maxReg: Number(data.maxReg) || 100,
          role: data.role || "Lead Coordinator",
          description: data.description || "",
          posterPreview: data.posterPreview || "",
          imageName: data.imageName || "sparkImg"
        });
      });


      // Filter events by organizer's assigned events
      if (organizerDoc) {
        const assignedTitles: string[] = organizerDoc.assignedEvents || [];
        list = list.filter(evt =>
          assignedTitles.some(title => title.trim().toLowerCase() === evt.title.trim().toLowerCase())
        );
      }

      setEvents(list);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);


  // Helper to map event image name to actual asset
  const getEventImage = (imageName?: string, category?: string) => {
    if (imageName?.includes("collab")) return galleryCollabImg;
    if (imageName?.includes("coding")) return galleryCodingImg;
    if (imageName?.includes("lab")) return galleryLabImg;
    if (imageName?.includes("hackathon") || category === "HACKATHONS") return hackathonImg;
    if (imageName?.includes("seminar") || category === "LECTURES") return seminarImg;
    return sparkImg;
  };

  // Filter & Search Logic
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // 1. Tab filtering
      const matchesTab = 
        activeTab === "Upcoming" ? (e.status === "Active" || e.status === "Draft") :
        activeTab === "Active" ? (e.status === "Opened") :
        (e.status === "Completed");

      // 2. Category filtering
      const matchesCategory = 
        selectedCategory === "All" ||
        (selectedCategory === "Workshop" && e.category === "WORKSHOPS") ||
        (selectedCategory === "Hackathon" && e.category === "HACKATHONS") ||
        (selectedCategory === "Seminar" && e.category === "LECTURES");

      // 3. Search query
      const matchesSearch = 
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.location.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesCategory && matchesSearch;
    });
  }, [events, activeTab, selectedCategory, searchQuery]);

  // Counts for the badge
  const activeCount = useMemo(() => {
    return events.filter(e => e.status === "Active" || e.status === "Opened").length;
  }, [events]);

  // Open edit modal prefilled
  const openEditModal = (event: EventItem) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormCategory(
      event.category === "WORKSHOPS" ? "Workshop" :
      event.category === "HACKATHONS" ? "Hackathon" :
      event.category === "QUIZ" ? "Quiz" : "Seminar"
    );
    setFormRole(event.role || "Lead Coordinator");
    setFormDate(event.date || "");
    setFormStartTime(event.startTime || "10:05 AM");
    setFormEndTime(event.endTime || "04:00 PM");
    setFormLocation(event.location);
    setFormMaxReg(String(event.maxReg));
    setFormDescription(event.description || "");
    setFormPosterPreview(event.posterPreview || "");
    setFormStatus(event.status === "Completed" ? "Active" : (event.status as any));
    setIsCreateModalOpen(true);
  };

  // Handle Event submit (create or update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Event Title is required.");
      return;
    }

    const mappedCategory = 
      formCategory === "Workshop" ? "WORKSHOPS" :
      formCategory === "Hackathon" ? "HACKATHONS" :
      formCategory === "Quiz" ? "QUIZ" : "LECTURES";

    let displayDate = formDate;
    if (formDate.includes("-")) {
      const d = new Date(formDate);
      if (!isNaN(d.getTime())) {
        displayDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
    }

    const payload: any = {
      title: formTitle,
      category: mappedCategory,
      role: formRole,
      date: displayDate,
      startTime: formStartTime,
      endTime: formEndTime,
      location: formLocation || "TBD",
      maxReg: Number(formMaxReg) || 150,
      description: formDescription,
      posterPreview: formPosterPreview,
      status: formStatus,
      updatedAt: Date.now()
    };

    try {
      if (editingEvent) {
        // Update Firestore
        const docRef = doc(db, "events", editingEvent.id);
        await updateDoc(docRef, payload);
        
        // Update local state
        setEvents(prev => prev.map(evt => evt.id === editingEvent.id ? {
          ...evt,
          ...payload,
          time: formStartTime
        } : evt));
      } else {
        // Create Firestore
        payload.currentReg = 0;
        payload.createdAt = Date.now();
        payload.imageName = formCategory === "Hackathon" ? "hackathon.png" : "gallery_collab.png";
        
        const docRef = await addDoc(collection(db, "events"), payload);
        
        // Update local state
        setEvents(prev => [{
          id: docRef.id,
          ...payload,
          currentReg: 0,
          time: formStartTime
        }, ...prev]);
      }

      setIsCreateModalOpen(false);
      setEditingEvent(null);
    } catch (err) {
      console.error("Error saving event:", err);
      alert("Failed to save event.");
    }
  };

  // Handle Archive action
  const handleArchiveEvent = async () => {
    if (!archivingEvent) return;
    try {
      const docRef = doc(db, "events", archivingEvent.id);
      await updateDoc(docRef, { status: "Archived" });
      
      // Update local state
      setEvents(prev => prev.map(evt => evt.id === archivingEvent.id ? {
        ...evt,
        status: "Archived"
      } : evt));
      
      setArchivingEvent(null);
    } catch (err) {
      console.error("Error archiving event:", err);
      alert("Failed to archive event.");
    }
  };

  // Base64 file reader for poster previews
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormPosterPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-left font-sans">
      <SEO 
        title="My Events - Student Organizer Portal" 
        description="Manage your assigned events, track registration metrics, and request new event assignments."
      />

      {/* ================= TOP HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">My Events</h1>
          <span className="bg-aether-blue-50 text-aether-blue-600 text-xs font-bold px-3 py-1 rounded-full border border-aether-blue-100/50 shadow-inner">
            {activeCount} Active
          </span>
        </div>
      </div>

      {/* ================= FILTER ROW ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        {/* Navigation Tabs */}
        <div className="bg-slate-100/80 border border-slate-200/40 p-1 rounded-xl flex gap-1 self-start">
          {(["Upcoming", "Active", "Past"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab
                  ? "bg-white text-aether-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ================= EVENTS GRID ================= */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-aether-blue-600 animate-spin" />
          <p className="text-xs text-slate-400 mt-2 font-medium">Loading your events...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {filteredEvents.map((event) => {
            const isCompleted = event.status === "Completed";
            const percentRegistered = Math.min(
              100,
              Math.round((event.currentReg / event.maxReg) * 100)
            );

            return (
              <div
                key={event.id}
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-card hover:shadow-cardHover hover:scale-[1.01] transition-all duration-300 flex flex-col justify-between"
              >
                {/* Event Card Header (Image) */}
                <div className="h-44 relative bg-slate-100 overflow-hidden">
                  <img
                    src={event.posterPreview || getEventImage(event.imageName, event.category)}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Category Badge (Top-Left) */}
                  <span className={`absolute top-4 left-4 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                    isCompleted 
                      ? "bg-slate-500/80 text-white" 
                      : event.category === "HACKATHONS" 
                      ? "bg-rose-500/85 text-white" 
                      : event.category === "LECTURES" 
                      ? "bg-amber-500/85 text-white" 
                      : event.category === "QUIZ"
                      ? "bg-purple-500/85 text-white"
                      : "bg-aether-blue-600/85 text-white"
                  }`}>
                    {event.category === "WORKSHOPS" ? "Workshop" : event.category === "HACKATHONS" ? "Hackathon" : event.category === "QUIZ" ? "Quiz" : "Seminar"}
                  </span>

                  {/* Completed Badge (Top-Right) */}
                  {isCompleted && (
                    <span className="absolute top-4 right-4 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                      Completed
                    </span>
                  )}

                  {/* Role Assignment Badge (Bottom-Left) */}
                  {!isCompleted && event.role && (
                    <span className="absolute bottom-4 left-4 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider bg-aether-blue-600 text-white shadow-sm">
                      {event.role}
                    </span>
                  )}
                </div>

                {/* Event Card Info */}
                <div className="p-5 flex-grow flex flex-col justify-between space-y-4 text-left">
                  <div className="space-y-3">
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight line-clamp-1 hover:text-aether-blue-600 transition-colors" title={event.title}>
                      {event.title}
                    </h3>

                    {/* Metadata items */}
                    <div className="space-y-2 text-xs font-semibold text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-aether-blue-500 shrink-0" />
                        <span>{event.date} {event.time && `• ${event.time}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-sky-500 shrink-0" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Progress / Attendance info */}
                  {isCompleted ? (
                    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex items-center gap-2 text-xs font-semibold text-slate-650">
                      <Users className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{event.currentReg || 82} Participants attended</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-500 font-extrabold">{event.currentReg} Registered</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-aether-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentRegistered}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                    {isCompleted ? (
                      <>
                        <button
                          onClick={() => setReportingEvent(event)}
                          className="flex-1 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-650 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
                          Report
                        </button>
                        <button
                          onClick={() => setArchivingEvent(event)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                          <Archive className="h-3.5 w-3.5 text-slate-400" />
                          Archive
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openEditModal(event)}
                          className="flex-1 border border-aether-blue-200 text-aether-blue-600 hover:border-aether-blue-300 hover:bg-aether-blue-50/50 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-aether-blue-500" />
                          Edit
                        </button>
                        <button
                          onClick={() => navigate("/organizer/attendance")}
                          className="flex-1 bg-aether-blue-600 hover:bg-aether-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-aether-blue-600/10"
                        >
                          Manage
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* ================= CREATE/EDIT MODAL ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-800 tracking-tight">
                {editingEvent ? "Edit Event Assignment" : "Request New Event Assignment"}
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs font-semibold text-slate-650">
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Event Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Generative AI Workshop"
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                  >
                    <option value="Workshop">Workshop</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Quiz">Quiz</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">Your Assignment Role</label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g. Lead Coordinator, Logistics"
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">Event Date</label>
                  <input
                    type="text"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    placeholder="e.g. Oct 24, 2026"
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">Start Time</label>
                  <input
                    type="text"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    placeholder="e.g. 10:00 AM"
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">End Time</label>
                  <input
                    type="text"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    placeholder="e.g. 04:00 PM"
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">Location</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Room 402 or Hybrid"
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">Max Registrations</label>
                  <input
                    type="number"
                    value={formMaxReg}
                    onChange={(e) => setFormMaxReg(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide detail overview of goals and key learnings..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-aether-blue-500 text-xs"
                />
              </div>

              {/* Banner Poster Selection */}
              <div className="space-y-2">
                <label className="text-slate-500 font-bold block">Event Banner Poster</label>
                <div className="flex gap-4 items-center">
                  <div className="w-24 h-16 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                    {formPosterPreview ? (
                      <img src={formPosterPreview} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <span className="text-[10px] text-slate-450">No Image</span>
                    )}
                  </div>
                  <label className="cursor-pointer border border-slate-350 hover:bg-slate-50 font-bold text-[11px] px-3.5 py-2 rounded-xl transition-all shadow-sm">
                    Choose Image File
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {/* Status configuration */}
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Planning Status</label>
                <div className="flex gap-3">
                  {(["Active", "Draft"] as const).map((stat) => (
                    <button
                      type="button"
                      key={stat}
                      onClick={() => setFormStatus(stat)}
                      className={`flex-1 py-2 text-center rounded-xl transition-all border ${
                        formStatus === stat
                          ? "bg-aether-blue-50 border-aether-blue-200 text-aether-blue-650"
                          : "border-slate-200 hover:bg-slate-50 text-slate-550"
                      }`}
                    >
                      {stat === "Active" ? "Ready (Active)" : "Pending Review (Draft)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4.5 py-2.5 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 font-bold transition-all text-xs"
                >
                  Cancel
                </button>
                <Button variant="primary" type="submit" className="text-xs font-bold px-5">
                  {editingEvent ? "Save Changes" : "Submit Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= VIEW REPORT MODAL ================= */}
      {reportingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 flex flex-col max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <span className="text-[9px] font-black uppercase text-aether-blue-650 tracking-wider">Historical Analytics</span>
                <h2 className="text-lg font-black text-slate-800 tracking-tight leading-snug">
                  {reportingEvent.title} - Post Event Report
                </h2>
              </div>
              <button
                onClick={() => setReportingEvent(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="p-6 space-y-6 text-left">
              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4">
                  <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider">Attendance Rate</span>
                  <div className="text-2xl font-black text-slate-800 mt-1 flex items-baseline gap-1">
                    <span>94.5%</span>
                    <span className="text-xs text-emerald-500 font-bold flex items-center gap-0.5">
                      <TrendingUp className="h-3 w-3" /> Excellent
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4">
                  <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider">Total Attendees</span>
                  <div className="text-2xl font-black text-slate-800 mt-1">
                    {reportingEvent.currentReg || 82}
                    <span className="text-xs text-slate-400 font-bold"> / {reportingEvent.maxReg} Max</span>
                  </div>
                </div>
              </div>

              {/* Chart Breakdown (Simulated with CSS) */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Feedback Scores</h3>
                
                <div className="space-y-3 font-semibold text-xs text-slate-600">
                  {/* Score item 1 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Workshop Materials & Lab setups</span>
                      <span className="text-slate-700 font-bold">96.8%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-aether-blue-600 h-full rounded-full" style={{ width: "96.8%" }}></div>
                    </div>
                  </div>

                  {/* Score item 2 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Coordinators Logistics & Organization</span>
                      <span className="text-slate-700 font-bold">92.4%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: "92.4%" }}></div>
                    </div>
                  </div>

                  {/* Score item 3 */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Speaker Knowledge & Presentation</span>
                      <span className="text-slate-700 font-bold">95.0%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: "95%" }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendee breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Participant Breakdown</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Students</span>
                    <span className="text-slate-750 font-black">78%</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 block mb-0.5">External</span>
                    <span className="text-slate-750 font-black">15%</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Faculty</span>
                    <span className="text-slate-750 font-black">7%</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-800">
                <Award className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="font-semibold leading-relaxed">
                  <span className="font-bold">Coordination Performance Reward:</span> Feedback rating exceeded the targets (90%+). Outstanding coordination efforts logged by faculty advisor.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/30">
              <Button
                variant="outline"
                onClick={() => alert("Report Export feature is being prepared.")}
                className="text-xs font-bold"
              >
                Export PDF
              </Button>
              <Button
                variant="primary"
                onClick={() => setReportingEvent(null)}
                className="text-xs font-bold"
              >
                Close Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ARCHIVE EVENT DIALOG ================= */}
      {archivingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Archive Event?</h3>
            </div>
            
            <p className="text-xs text-slate-550 leading-relaxed font-semibold text-left">
              Are you sure you want to archive <span className="font-bold text-slate-750">"{archivingEvent.title}"</span>? 
              This moves the event to the history logs, removes it from active dashboards, and ends registration.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setArchivingEvent(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-650 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveEvent}
                className="px-4.5 py-2 bg-amber-650 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-amber-650/15"
              >
                Archive Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgEventsPage;
