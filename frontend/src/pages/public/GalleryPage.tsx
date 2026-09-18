import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/ui/Button";

import SEO from "../../components/layout/SEO";
import { db, collection, getDocs } from "../../config/firebase";
import { fetchAlbums } from "../../services/apiClient";
import { dataCache } from "../../utils/dataCache";
import { 
  Calendar, 
  X, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  ExternalLink, 
  Eye, 
  Search, 
  Image as ImageIcon,
  Download
} from "lucide-react";

export interface EventPhoto {
  id: string;
  title: string;
  imageUrl: string;
  caption?: string;
  date: string;
  category: "Workshops" | "Hackathons" | "Symposiums" | "Socials";
  tags?: string[];
  driveLink?: string;
  createdAt?: number;
}

export interface EventGallerySection {
  eventKey: string;
  eventTitle: string;
  category: "Workshops" | "Hackathons" | "Symposiums" | "Socials";
  date: string;
  description?: string;
  driveLink?: string;
  tags?: string[];
  createdAt: number;
  photos: EventPhoto[];
}

const normalizeCategory = (cat?: string): EventPhoto["category"] => {
  if (!cat) return "Workshops";
  const c = cat.trim().toLowerCase();
  if (c === "hackathons" || c === "hackathon") return "Hackathons";
  if (c === "symposiums" || c === "symposium" || c === "seminars" || c === "seminar" || c === "lectures" || c === "talks") return "Symposiums";
  if (c === "socials" || c === "social" || c === "community" || c === "meetups" || c === "meetup") return "Socials";
  if (c === "workshops" || c === "workshop" || c === "bootcamps" || c === "bootcamp" || c === "training") return "Workshops";
  if (["Workshops", "Hackathons", "Symposiums", "Socials"].includes(cat)) return cat as EventPhoto["category"];
  return "Workshops";
};

const GalleryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"All" | "Workshops" | "Hackathons" | "Symposiums" | "Socials">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [photos, setPhotos] = useState<EventPhoto[]>(() => dataCache.get<EventPhoto[]>("public_gallery_photos") || []);
  const [loading, setLoading] = useState<boolean>(() => !dataCache.get<EventPhoto[]>("public_gallery_photos"));
  
  // Lightbox State (Active Event Section & Photo Index)
  const [activeLightbox, setActiveLightbox] = useState<{
    section: EventGallerySection;
    index: number;
  } | null>(null);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const resolveCover = (data: any) => {
          if (data?.imageUrl && typeof data.imageUrl === "string" && data.imageUrl.trim() !== "") {
            return data.imageUrl;
          }
          if (data?.url && typeof data.url === "string" && data.url.trim() !== "") {
            return data.url;
          }
          if (data?.bannerImage && typeof data.bannerImage === "string" && data.bannerImage.trim() !== "") {
            return data.bannerImage;
          }
          if (data?.coverImage && typeof data.coverImage === "string" && (data.coverImage.startsWith("data:") || data.coverImage.startsWith("http") || data.coverImage.startsWith("/"))) {
            return data.coverImage;
          }
          return "";
        };

        // 1. Try Backend API
        let backendItems: any[] = [];
        try {
          backendItems = await fetchAlbums();
        } catch (apiErr) {
          console.warn("Backend fetch error, trying Firestore fallback:", apiErr);
        }

        // 2. Try Firestore fallback if empty
        if (!backendItems || backendItems.length === 0) {
          try {
            const querySnapshot = await getDocs(collection(db, "albums"));
            backendItems = querySnapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
          } catch (e) {
            console.warn("Firestore fallback notice:", e);
          }
        }

        const list: EventPhoto[] = [];

        (backendItems || []).forEach((data: any) => {
          if (data.status === "Draft") return; // Skip drafts

          const category = normalizeCategory(data.category);
          const dateStr = data.date || "Just now";
          const drive = data.driveLink || "";
          const tags = Array.isArray(data.tags) ? data.tags : [];
          const createdAt = data.createdAt || data.created_at || Date.now();
          const baseTitle = (data.eventTitle || data.title || "Visual Moment").trim();

          // Case A: Item contains multiple images inside `images` array
          if (Array.isArray(data.images) && data.images.length > 0) {
            data.images.forEach((imgObj: any, idx: number) => {
              const url = typeof imgObj === "string" ? imgObj : imgObj?.url;
              if (!url) return;
              list.push({
                id: `${data.id || data._id || 'album'}-${idx}`,
                title: baseTitle,
                imageUrl: url,
                category: category,
                date: dateStr,
                caption: (typeof imgObj === "object" ? imgObj.caption : "") || data.caption || data.description || "",
                driveLink: drive,
                tags: tags,
                createdAt: createdAt
              });
            });
          } else {
            // Case B: Single photo item
            const photoUrl = resolveCover(data);
            if (photoUrl) {
              list.push({
                id: data.id || data._id || `${Date.now()}-${Math.random()}`,
                title: data.title || baseTitle,
                imageUrl: photoUrl,
                category: category,
                date: dateStr,
                caption: data.caption || data.description || "",
                driveLink: drive,
                tags: tags,
                createdAt: createdAt
              });
            }
          }
        });

        setPhotos(list);
        dataCache.set("public_gallery_photos", list);
      } catch (err) {
        console.error("Error loading gallery photos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, []);

  // Group photos by clean Event Name + Date + Category
  const groupedEvents = useMemo<EventGallerySection[]>(() => {
    const groupMap = new Map<string, EventGallerySection>();

    photos.forEach((photo) => {
      // Clean event title: strip trailing sequential numbers like "(1)", "(2)", "#1"
      const cleanTitle = photo.title
        .replace(/\s*\(\d+\)$/, "")
        .replace(/\s*#\d+$/, "")
        .trim() || "Event Highlights";

      const groupKey = `${cleanTitle.toLowerCase()}___${photo.category}___${photo.date}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          eventKey: groupKey,
          eventTitle: cleanTitle,
          category: photo.category,
          date: photo.date,
          description: photo.caption || "",
          driveLink: photo.driveLink || "",
          tags: photo.tags || [],
          createdAt: photo.createdAt || 0,
          photos: [photo]
        });
      } else {
        const group = groupMap.get(groupKey)!;
        // Avoid duplicate photos
        if (!group.photos.some((p) => p.imageUrl === photo.imageUrl && p.id === photo.id)) {
          group.photos.push(photo);
        }
        if (!group.description && photo.caption) {
          group.description = photo.caption;
        }
        if (!group.driveLink && photo.driveLink) {
          group.driveLink = photo.driveLink;
        }
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [photos]);

  // Filter grouped events by selected category tab and search query
  const filteredEvents = useMemo(() => {
    return groupedEvents.filter((eventSection) => {
      const matchesTab = activeTab === "All" || eventSection.category === activeTab;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === "" ||
        eventSection.eventTitle.toLowerCase().includes(query) ||
        (eventSection.description && eventSection.description.toLowerCase().includes(query)) ||
        eventSection.category.toLowerCase().includes(query) ||
        (eventSection.tags && eventSection.tags.some((t) => t.toLowerCase().includes(query))) ||
        eventSection.photos.some((p) => p.caption && p.caption.toLowerCase().includes(query));

      return matchesTab && matchesSearch;
    });
  }, [groupedEvents, activeTab, searchQuery]);

  const tabOptions: Array<"All" | "Workshops" | "Hackathons" | "Symposiums" | "Socials"> = [
    "All",
    "Workshops",
    "Hackathons",
    "Symposiums",
    "Socials"
  ];

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case "Hackathons":
        return "bg-rose-50/90 text-rose-700 border-rose-200/80";
      case "Symposiums":
        return "bg-amber-50/90 text-amber-700 border-amber-200/80";
      case "Socials":
        return "bg-emerald-50/90 text-emerald-700 border-emerald-200/80";
      default:
        return "bg-blue-50/90 text-blue-700 border-blue-200/80";
    }
  };

  // Keyboard navigation for Lightbox
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!activeLightbox) return;
      if (e.key === "Escape") {
        setActiveLightbox(null);
      } else if (e.key === "ArrowLeft") {
        setActiveLightbox((prev) => {
          if (!prev) return null;
          const newIdx = prev.index > 0 ? prev.index - 1 : prev.section.photos.length - 1;
          return { ...prev, index: newIdx };
        });
      } else if (e.key === "ArrowRight") {
        setActiveLightbox((prev) => {
          if (!prev) return null;
          const newIdx = prev.index < prev.section.photos.length - 1 ? prev.index + 1 : 0;
          return { ...prev, index: newIdx };
        });
      }
    },
    [activeLightbox]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="overflow-hidden bg-[#FAFBFC] pb-24 min-h-screen font-sans">
      <SEO 
        title="Event Gallery & Tech Expos | AI Verse VIT Bhimavaram" 
        description="Explore the visual journey of AI Verse at Vishnu Institute of Technology, Bhimavaram. View photo highlights of our national-level hackathons, AI/ML workshops, tech expos, and student achievements." 
        keywords="AI Verse Gallery, Hackathon Photos, Tech Expo Images, VIT Bhimavaram Student Events, AI Workshops Gallery, Tech Club Photos Andhra Pradesh"
        url="/gallery"
        schema={{
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          "name": "AI Verse VITB Photo Gallery",
          "url": "https://aiversevitb.in/gallery",
          "description": "Visual highlights of technical workshops, hackathons, and AI projects at Vishnu Institute of Technology, Bhimavaram.",
          "publisher": {
            "@type": "EducationalOrganization",
            "name": "AI Verse VITB",
            "url": "https://aiversevitb.in"
          }
        }}
      />
      
      {/* ================= HERO / HEADER SECTION ================= */}
      <section className="relative pt-28 pb-14 px-6 lg:px-8 text-center bg-gradient-to-b from-blue-50/25 via-white to-transparent">
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-blue-50/40 blur-[120px]"></div>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-blue-50 border border-blue-200/60 rounded-full text-[#2563EB] text-[10px] font-black tracking-widest uppercase"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Visual Archive & Moments</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-[#2563EB] to-slate-900 tracking-tight"
          >
            Our Visual Legacy
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-xl mx-auto font-normal"
          >
            A visual documentation of trailblazing workshops, competitive student hackathons, and collaborative milestones shaped by our community.
          </motion.p>
        </div>
      </section>

      {/* ================= TAB CONTROLS & SEARCH ================= */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 mb-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            {tabOptions.map((tab) => {
              const isActive = activeTab === tab;
              const count = tab === "All" 
                ? groupedEvents.length 
                : groupedEvents.filter((g) => g.category === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide border transition-all duration-200 select-none cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#2563EB] text-white border-[#2563EB] shadow-md shadow-blue-500/20 scale-102 font-black"
                      : "bg-white text-slate-600 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>{tab}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600 font-black"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event name, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-full pl-9 pr-8 py-2 text-xs font-bold text-[#0F172A] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ================= GROUPED EVENTS & SIDE-BY-SIDE GALLERY ================= */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 mb-24">
        {loading ? (
          <div className="space-y-8">
            {[1, 2].map((n) => (
              <div key={n} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs space-y-5 animate-pulse">
                <div className="h-6 w-1/3 bg-slate-100 rounded-lg"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="aspect-[4/3] rounded-2xl bg-slate-100"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 border border-dashed border-slate-200 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <ImageIcon className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-[#0F172A]">
              {groupedEvents.length === 0 ? "No Gallery Photos Yet" : "No Events Found in this Category"}
            </h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
              {groupedEvents.length === 0
                ? "Photos uploaded by faculty and organizers will appear here grouped by event."
                : "Try selecting \"All\" or searching for a different event title."}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredEvents.map((eventSection) => (
              <motion.div
                layout
                key={eventSection.eventKey}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow space-y-6"
              >
                {/* ================= UPPER: EVENT NAME & DETAILS HEADER ================= */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider border ${getCategoryStyles(eventSection.category)}`}>
                        {eventSection.category}
                      </span>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>{eventSection.date}</span>
                      </span>
                      <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        {eventSection.photos.length} {eventSection.photos.length === 1 ? "Photo" : "Photos"}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight hover:text-blue-600 transition-colors">
                      {eventSection.eventTitle}
                    </h2>

                    {eventSection.description && (
                      <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-2xl">
                        {eventSection.description}
                      </p>
                    )}
                  </div>

                  {eventSection.driveLink && (
                    <a
                      href={eventSection.driveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold transition-colors w-fit shadow-2xs"
                    >
                      <span>Drive Folder</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* ================= SIDE BY SIDE: EVENT IMAGES GRID ================= */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {eventSection.photos.map((photo, pIdx) => (
                    <motion.div
                      key={photo.id}
                      onClick={() => setActiveLightbox({ section: eventSection, index: pIdx })}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                      className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 shadow-2xs border border-slate-200/80 cursor-pointer flex items-center justify-center"
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.caption || photo.title || eventSection.eventTitle}
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                        <span className="text-white text-xs font-bold flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>View Full</span>
                        </span>
                        {photo.caption && (
                          <span className="text-[10px] text-white/90 truncate max-w-[140px] font-medium">
                            {photo.caption}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ================= ENHANCED LIGHTBOX MODAL WITH EVENT NAVIGATION ================= */}
      <AnimatePresence>
        {activeLightbox && (
          <div
            onClick={() => setActiveLightbox(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/92 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-5xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[92vh]"
            >
              {/* Top Header */}
              <div className="p-4 bg-slate-950/90 border-b border-white/10 flex items-center justify-between shrink-0 text-white">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getCategoryStyles(
                        activeLightbox.section.category
                      )}`}
                    >
                      {activeLightbox.section.category}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {activeLightbox.section.date}
                    </span>
                    <span className="text-[11px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      Photo {activeLightbox.index + 1} of {activeLightbox.section.photos.length}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {activeLightbox.section.eventTitle}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={activeLightbox.section.photos[activeLightbox.index]?.imageUrl}
                    download={`photo-${activeLightbox.index + 1}.jpg`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                    title="Download Photo"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => setActiveLightbox(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* High-Res Photo Container with Navigation Arrows */}
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden p-2 min-h-[300px]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeLightbox.section.photos[activeLightbox.index]?.id || activeLightbox.index}
                    src={activeLightbox.section.photos[activeLightbox.index]?.imageUrl}
                    alt={activeLightbox.section.eventTitle}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
                  />
                </AnimatePresence>

                {/* Left arrow */}
                {activeLightbox.section.photos.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLightbox((prev) => {
                        if (!prev) return null;
                        const newIdx = prev.index > 0 ? prev.index - 1 : prev.section.photos.length - 1;
                        return { ...prev, index: newIdx };
                      });
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer border border-white/10"
                    title="Previous Photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Right arrow */}
                {activeLightbox.section.photos.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLightbox((prev) => {
                        if (!prev) return null;
                        const newIdx = prev.index < prev.section.photos.length - 1 ? prev.index + 1 : 0;
                        return { ...prev, index: newIdx };
                      });
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer border border-white/10"
                    title="Next Photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Bottom Caption & Thumbnails Bar */}
              <div className="p-4 bg-slate-950/90 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300">
                <div className="space-y-1 max-w-xl">
                  {activeLightbox.section.photos[activeLightbox.index]?.caption ? (
                    <p className="font-medium text-slate-200">
                      {activeLightbox.section.photos[activeLightbox.index].caption}
                    </p>
                  ) : activeLightbox.section.description ? (
                    <p className="text-slate-300">{activeLightbox.section.description}</p>
                  ) : (
                    <p className="text-slate-500 italic">No caption provided.</p>
                  )}
                </div>

                {/* Thumbnails Row if multi-photo */}
                {activeLightbox.section.photos.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-xs py-1">
                    {activeLightbox.section.photos.map((p, idx) => (
                      <button
                        key={p.id || idx}
                        onClick={() => setActiveLightbox((prev) => prev ? { ...prev, index: idx } : null)}
                        className={`w-10 h-8 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                          idx === activeLightbox.index
                            ? "border-blue-500 scale-105"
                            : "border-transparent opacity-50 hover:opacity-100"
                        }`}
                      >
                        <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= CALL TO ACTION SECTION ================= */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 mb-12">
        <div className="bg-gradient-to-r from-[#2563EB] to-blue-600 rounded-[28px] p-10 md:p-14 text-center text-white border border-blue-700 shadow-xl relative overflow-hidden">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)] pointer-events-none transform-gpu" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_70%)] pointer-events-none transform-gpu" />
          
          <div className="max-w-xl mx-auto space-y-6 relative z-10">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold leading-tight tracking-tight">
              Be Part of the Next Frame
            </h2>
            <p className="text-blue-150 text-sm md:text-base font-normal leading-relaxed">
              Join our upcoming events and help us build the future of AI innovation together.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link to="/events">
                <Button variant="secondary" className="rounded-full px-6 py-2.5 font-bold text-aether-blue-600 bg-white hover:bg-slate-50 hover:scale-102 transition-all text-sm shadow-md">
                  View Upcoming Events
                </Button>
              </Link>
              <Link to="/contact">
                <button className="rounded-full px-6 py-2.5 font-bold border border-white/30 bg-white/10 hover:bg-white/20 hover:scale-102 text-white transition-all text-sm flex items-center gap-1 cursor-pointer">
                  Submit Your Project
                  <ChevronRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GalleryPage;
