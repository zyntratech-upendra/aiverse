import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/ui/Button";

// Import local assets
import galleryLab from "../../assets/images/gallery_lab.png";
import gallerySymposium from "../../assets/images/gallery_symposium.png";
import galleryVr from "../../assets/images/gallery_vr.png";
import galleryCoding from "../../assets/images/gallery_coding.png";
import galleryCoworking from "../../assets/images/gallery_coworking.png";
import galleryCollab from "../../assets/images/gallery_collab.png";

import SEO from "../../components/layout/SEO";
import { db } from "../../config/firebase";
import { collection, getDocs } from "firebase/firestore";
import { dataCache } from "../../utils/dataCache";
import { Calendar, X, FolderOpen, Sparkles, ChevronRight, ExternalLink } from "lucide-react";

interface AlbumItem {
  id: string;
  title: string;
  photosCount: number;
  date: string;
  status: string;
  category: "Workshops" | "Hackathons" | "Symposiums" | "Socials";
  coverImage: string;
  description: string;
  driveLink?: string;
  images: string[];
}

const GalleryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"All" | "Workshops" | "Hackathons" | "Symposiums" | "Socials">("All");
  const [albums, setAlbums] = useState<AlbumItem[]>(() => dataCache.get<AlbumItem[]>("public_gallery") || []);
  const [loading, setLoading] = useState<boolean>(() => !dataCache.get<AlbumItem[]>("public_gallery"));
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "albums"));
        const list: AlbumItem[] = [];

        const resolveCover = (data: any, category: string) => {
          if (data?.bannerImage && typeof data.bannerImage === "string" && data.bannerImage.trim() !== "") {
            return data.bannerImage;
          }
          if (data?.coverImage && typeof data.coverImage === "string" && (data.coverImage.startsWith("data:") || data.coverImage.startsWith("http") || data.coverImage.startsWith("/"))) {
            return data.coverImage;
          }
          const name = data?.coverImage;
          if (name === "galleryCoding" || category === "Hackathons") return galleryCoding;
          if (name === "gallerySymposium" || category === "Symposiums") return gallerySymposium;
          if (name === "galleryCoworking" || category === "Socials") return galleryCoworking;
          if (name === "galleryCollab") return galleryCollab;
          if (name === "galleryVr") return galleryVr;
          return galleryLab;
        };

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status !== "Published") return; // Skip drafts

          const albumCategory = (data.category || "Workshops") as AlbumItem["category"];
          
          list.push({
            id: docSnap.id,
            title: data.title || "Unnamed Album",
            photosCount: data.photosCount || 0,
            date: data.date || "Just now",
            status: data.status || "Published",
            coverImage: resolveCover(data, albumCategory),
            category: albumCategory,
            description: data.description || "No event description available.",
            driveLink: data.driveLink || "",
            images: data.images || []
          });
        });

        setAlbums(list);
        dataCache.set("public_gallery", list);
      } catch (err) {
        console.error("Error loading gallery items from database:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, []);

  // Filter gallery items based on selected tab
  const filteredAlbums = albums.filter(album => {
    if (activeTab === "All") return true;
    return album.category === activeTab;
  });

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
        return "bg-rose-50/80 text-rose-600 border border-rose-100/50";
      case "Symposiums":
        return "bg-amber-50/80 text-amber-600 border border-amber-100/50";
      case "Socials":
        return "bg-emerald-50/80 text-emerald-600 border border-emerald-100/50";
      default: // Workshops
        return "bg-blue-50/80 text-[#2563EB] border border-blue-100/50";
    }
  };

  return (
    <div className="overflow-hidden bg-[#FAFBFC] pb-24 min-h-screen font-sans">
      <SEO 
        title="Gallery - Visual Moments | AI Verse VITB - VIT Bhimavaram" 
        description="Explore the visual legacy of AI Verse VITB — hackathons, AI & Data Science workshops, project expos, and student achievements at Vishnu Institute of Technology, Bhimavaram." 
        keywords="AI Verse Gallery, aiversevitb, AI Verse VITB, VIT Bhimavaram, Vishnu Institute of Technology, AI Workshops Gallery"
      />
      
      {/* ================= HERO / HEADER SECTION ================= */}
      <section className="relative pt-28 pb-16 px-6 lg:px-8 text-center bg-gradient-to-b from-blue-50/20 via-white to-transparent">
        {/* Soft background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-blue-50/40 blur-[120px]"></div>
        </div>

        <div className="max-w-3xl mx-auto space-y-5">
          {/* Subheader tag */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[#2563EB] text-[10px] font-bold tracking-widest uppercase"
          >
            <Sparkles className="w-3 h-3" />
            Visual Archive
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-serif font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-[#2563EB] to-slate-900 tracking-tight"
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

      {/* ================= TAB CONTROLS ================= */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 mb-16">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {tabOptions.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide border transition-all duration-300 select-none
                  ${isActive
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-md shadow-blue-500/10 scale-102"
                    : "bg-white text-slate-500 border-slate-200/80 hover:border-slate-350 hover:bg-slate-50"
                  }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= GALLERY IMAGES GRID ================= */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 mb-24">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-[24px] overflow-hidden border border-slate-100 p-5 space-y-4 animate-pulse">
                <div className="aspect-[4/3] w-full rounded-2xl bg-slate-100"></div>
                <div className="h-4 w-3/4 rounded bg-slate-100"></div>
                <div className="h-3 w-1/3 rounded bg-slate-100"></div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredAlbums.map((album) => (
              <motion.div
                layout
                key={album.id}
                onClick={() => setSelectedAlbum(album)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="group bg-white rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.012)] border border-slate-100 hover:shadow-card hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className="relative overflow-hidden aspect-[16/10] bg-slate-50 flex items-center justify-center">
                  <img
                    src={album.coverImage}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Category overlay */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className={`px-2.5 py-1 text-[9px] font-bold rounded-lg uppercase tracking-wider ${getCategoryStyles(album.category)}`}>
                      {album.category}
                    </span>
                  </div>
                </div>

                {/* Title & Info */}
                <div className="p-5 text-left space-y-2">
                  <h3 className="font-extrabold text-base text-slate-800 leading-snug group-hover:text-[#2563EB] transition-colors line-clamp-1">
                    {album.title}
                  </h3>
                  <p className="text-slate-400 text-xs font-semibold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{album.date}</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* ================= ALBUM LIGHTBOX MODAL ================= */}
      <AnimatePresence>
        {selectedAlbum && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" 
              onClick={() => setSelectedAlbum(null)}
            ></motion.div>

            {/* Modal Container */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-4xl w-full max-h-[85vh] relative z-10 flex flex-col overflow-hidden text-left"
            >
              {/* Top Close button */}
              <button
                onClick={() => setSelectedAlbum(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-xl transition-all z-20"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Scrollable Modal Content */}
              <div className="overflow-y-auto p-6 sm:p-8 space-y-8">
                {/* Top Row: Event Poster + Details Description */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Event Poster Column */}
                  <div className="md:col-span-5 bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden relative shadow-sm flex items-center justify-center p-1">
                    <img 
                      src={selectedAlbum.coverImage} 
                      alt={selectedAlbum.title} 
                      className="w-full h-auto max-h-[320px] object-contain rounded-xl" 
                    />
                    <div className="absolute top-3 left-3 z-10">
                      <span className={`px-2.5 py-1 text-[9px] font-bold rounded-lg uppercase tracking-wider ${getCategoryStyles(selectedAlbum.category)}`}>
                        {selectedAlbum.category}
                      </span>
                    </div>
                  </div>

                  {/* Details / Description Column */}
                  <div className="md:col-span-7 space-y-4 pt-1 pr-4">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                      {selectedAlbum.date}
                    </span>
                    
                    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight leading-snug">{selectedAlbum.title}</h3>
                    
                    <div className="h-0.5 w-12 bg-[#2563EB] rounded-full"></div>
                    
                    <p className="text-xs text-slate-500 font-medium leading-relaxed whitespace-pre-wrap">
                      {selectedAlbum.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Row: Google Drive Album Photos Link */}
                <div className="pt-6 border-t border-slate-100">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-100/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-800 tracking-tight">Event Photo Gallery</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">High-resolution event photos & media stored on Google Drive</p>
                      </div>
                    </div>

                    {selectedAlbum.driveLink ? (
                      <a 
                        href={selectedAlbum.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 hover:shadow-lg shrink-0"
                      >
                        <span>Click here to view album photos</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 bg-white px-4 py-2 rounded-xl border">
                        No Drive link attached
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= FULLSCREEN LIGHTBOX MODAL ================= */}
      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-5 right-5 text-white/80 hover:text-white p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <X className="h-6 w-6" />
            </button>
            
            <motion.img 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              src={selectedImage} 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" 
              alt="Fullscreen preview" 
            />
          </div>
        )}
      </AnimatePresence>

      {/* ================= CALL TO ACTION SECTION ================= */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 mb-12">
        <div className="bg-gradient-to-r from-[#2563EB] to-blue-600 rounded-[28px] p-10 md:p-14 text-center text-white border border-blue-700 shadow-xl relative overflow-hidden">
          {/* Subtle decoration elements */}
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
                <button className="rounded-full px-6 py-2.5 font-bold border border-white/30 bg-white/10 hover:bg-white/20 hover:scale-102 text-white transition-all text-sm flex items-center gap-1">
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
