import React, { useState, useMemo, useEffect } from "react";
import SEO from "../../components/layout/SEO";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { fetchAlbums } from "../../services/apiClient";
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { 
  Folder, 
  Image as ImageIcon, 
  Clock, 
  Search, 
  LayoutGrid, 
  List, 
  Plus, 
  Upload, 
  X, 
  Sparkles, 
  Trash2, 
  CheckCircle,
  ArrowLeft,
  Save,
  Info,
  Settings as SettingsIcon,
  Bell,
  Link as LinkIcon,
  ExternalLink,
  Pencil,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Import local assets
import galleryLab from "../../assets/images/gallery_lab.png";
import gallerySymposium from "../../assets/images/gallery_symposium.png";
import galleryVr from "../../assets/images/gallery_vr.png";
import galleryCoding from "../../assets/images/gallery_coding.png";
import galleryCoworking from "../../assets/images/gallery_coworking.png";
import galleryCollab from "../../assets/images/gallery_collab.png";
import hackathonImg from "../../assets/images/hackathon.png";
import seminarImg from "../../assets/images/seminar.png";
import sparkImg from "../../assets/images/spark.png";

interface AlbumItem {
  id: string;
  title: string;
  photosCount: number;
  date: string;
  status: "Published" | "Draft";
  coverImage: string;
  category: "Workshops" | "Hackathons" | "Symposiums" | "Socials";
  createdAt?: number;
}

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "info" | "warning";
}

const GalleryManagementPage: React.FC = () => {
  // Page stats states
  const [toastQueue, setToastQueue] = useState<ToastMessage[]>([]);

  const [albums, setAlbums] = useState<AlbumItem[]>([]);

  const totalImages = useMemo(() => {
    return albums.reduce((sum, a) => sum + (a.photosCount || 0), 0);
  }, [albums]);

  const recentUploads = useMemo(() => {
    return albums
      .filter(a => {
        const created = a.createdAt || 0;
        return (Date.now() - created) < 604800000;
      })
      .reduce((sum, a) => sum + (a.photosCount || 0), 0);
  }, [albums]);

  const resolveAlbumCover = (data: any) => {
    if (data?.bannerImage && typeof data.bannerImage === "string" && data.bannerImage.trim() !== "") {
      return data.bannerImage;
    }
    if (data?.coverImage && typeof data.coverImage === "string" && (data.coverImage.startsWith("data:") || data.coverImage.startsWith("http") || data.coverImage.startsWith("/"))) {
      return data.coverImage;
    }
    if (data?.coverImage === "galleryCoding") return galleryCoding;
    if (data?.coverImage === "gallerySymposium") return gallerySymposium;
    if (data?.coverImage === "galleryCoworking") return galleryCoworking;
    if (data?.coverImage === "galleryCollab") return galleryCollab;
    if (data?.coverImage === "galleryVr") return galleryVr;
    if (data?.category === "Hackathons") return galleryCoding;
    if (data?.category === "Symposiums") return gallerySymposium;
    if (data?.category === "Socials") return galleryCoworking;
    return galleryLab;
  };

  // Fetch albums from Firestore on mount
  useEffect(() => {
    const loadAlbums = async () => {
      try {
        const querySnapshot = await fetchAlbums();
        const list: AlbumItem[] = [];
        (querySnapshot || []).forEach((doc: any) => {
          const data = doc || {};

          list.push({
            id: doc.id || doc._id || "",
            title: data.title || "",
            photosCount: data.photosCount || data.photos_count || 0,
            date: data.date || "",
            status: data.status || "Published",
            coverImage: resolveAlbumCover(data),
            category: data.category || "Workshops",
            createdAt: data.createdAt || data.created_at || Date.now()
          });
        });
        setAlbums(list);
      } catch (err) {
        console.error("Error loading albums from backend:", err);
        addToast("Failed to load albums from backend.", "warning");
      }
    };

    loadAlbums();
  }, []);


  // Interactive UI states
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  // New Album Form state
  const [formTitle, setFormTitle] = useState("");
  const [formStatus, setFormStatus] = useState<"Published" | "Draft">("Published");
  const [formCategory, setFormCategory] = useState<AlbumItem["category"]>("Workshops");
  const [formDate, setFormDate] = useState("");

  // Upload Form state
  const [uploadAlbumId, setUploadAlbumId] = useState(albums[0]?.id || "1");
  const [selectedFileCount, setSelectedFileCount] = useState(0);

  // New Album Full Page View states
  const [showCreateAlbumView, setShowCreateAlbumView] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [deleteConfirmAlbum, setDeleteConfirmAlbum] = useState<{ id: string; title: string } | null>(null);

  const [albumTitle, setAlbumTitle] = useState("");
  const [albumCategory, setAlbumCategory] = useState("Workshops");
  const [albumDescription, setAlbumDescription] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [isPublicVisible, setIsPublicVisible] = useState(true);
  const [isFeaturedOnHome, setIsFeaturedOnHome] = useState(false);
  const [isCommentsEnabled, setIsCommentsEnabled] = useState(true);
  const [searchTags, setSearchTags] = useState<string[]>(["Symposium", "AI Lab"]);
  const [newTagText, setNewTagText] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<{ name: string; size: string; preview: string }[]>([]);

  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  const handleOpenEditAlbum = (album: AlbumItem) => {
    setEditingAlbumId(album.id);
    setAlbumTitle(album.title || "");
    setAlbumCategory(album.category || "Workshops");
    setAlbumDescription((album as any).description || "");
    setDriveLink((album as any).driveLink || "");
    setBannerImage(album.coverImage || (album as any).bannerImage || "");
    setFormStatus(album.status);
    setShowCreateAlbumView(true);
  };

  const compressImage = (base64Str: string, maxWidth = 500, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  const handleSaveAlbum = async (status: "Published" | "Draft") => {
    if (!albumTitle.trim()) {
      addToast("Album title is required!", "warning");
      return;
    }

    let coverName = "galleryLab";
    if (albumCategory === "Hackathons") {
      coverName = "galleryCoding";
    } else if (albumCategory === "Symposiums" || albumCategory === "Symposium") {
      coverName = "gallerySymposium";
    } else if (albumCategory === "Socials") {
      coverName = "galleryCoworking";
    }

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    addToast("Compressing gallery images...", "info");
    const compressedImages = await Promise.all(
      selectedPhotos.map(photo => compressImage(photo.preview))
    );

    const payload = {
      title: albumTitle,
      photosCount: selectedPhotos.length || 12,
      date: dateStr,
      status: status,
      coverImage: bannerImage || coverName,
      category: albumCategory,
      description: albumDescription,
      driveLink: driveLink,
      bannerImage: bannerImage,
      isPublic: isPublicVisible,
      isFeatured: isFeaturedOnHome,
      allowComments: isCommentsEnabled,
      tags: searchTags,
      images: compressedImages,
      createdAt: Date.now()
    };

    addToast("Saving album to Firestore...", "info");

      try {
        if (editingAlbumId) {
          await updateDoc(doc(db, "albums", editingAlbumId), payload);
          addToast("Album updated successfully!", "success");
        } else {
          await addDoc(collection(db, "albums"), payload);
          addToast("Album created successfully!", "success");
        }
        
        const updated = await fetchAlbums();
        const list: AlbumItem[] = [];
        (updated || []).forEach((docSnap: any) => {
          const data = docSnap || {};

          list.push({
            id: docSnap.id || docSnap._id || "",
            title: data.title || "",
            photosCount: data.photosCount || data.photos_count || 0,
            date: data.date || "",
            status: data.status || "Published",
            coverImage: resolveAlbumCover(data),
            category: data.category || "Workshops",
            createdAt: data.createdAt || data.created_at || Date.now()
          });
        });
        setAlbums(list);

      setAlbumTitle("");
      setAlbumDescription("");
      setDriveLink("");
      setBannerImage("");
      setSelectedPhotos([]);
      setEditingAlbumId(null);
      setShowCreateAlbumView(false);
    } catch (err) {
      console.error("Error saving album:", err);
      addToast("Failed to save album.", "warning");
    }
  };

  // Mock library of recently uploaded files (lightbox view)
  const [recentImages, setRecentImages] = useState([
    { id: "r1", url: hackathonImg, name: "hackathon_group.png", size: "2.4 MB", date: "Jul 06, 2026" },
    { id: "r2", url: galleryCoworking, name: "coworking_team.png", size: "1.8 MB", date: "Jul 05, 2026" },
    { id: "r3", url: galleryVr, name: "vr_demo.png", size: "3.1 MB", date: "Jul 05, 2026" },
    { id: "r4", url: galleryCollab, name: "collab_brainstorm.png", size: "1.2 MB", date: "Jul 04, 2026" },
    { id: "r5", url: galleryLab, name: "lab_testing.png", size: "2.9 MB", date: "Jul 04, 2026" },
    { id: "r6", url: sparkImg, name: "spark_workshop.png", size: "1.5 MB", date: "Jul 03, 2026" },
    { id: "r7", url: seminarImg, name: "seminar_audience.png", size: "4.0 MB", date: "Jul 03, 2026" },
  ]);

  // AI tag state
  const [tags, setTags] = useState([
    { name: "Workshop", count: 18, active: true },
    { name: "Hardware", count: 24, active: true },
    { name: "Coding", count: 32, active: false },
    { name: "Symposium", count: 12, active: false },
  ]);
  const [newTagInput, setNewTagInput] = useState("");

  // Toast trigger helper
  const addToast = (text: string, type: ToastMessage["type"] = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToastQueue(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToastQueue(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Filter logic
  const filteredAlbums = useMemo(() => {
    return albums.filter(album =>
      album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [albums, searchQuery]);

  // Form submit - Create new album
  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      addToast("Album title is required!", "warning");
      return;
    }

    let coverName = "galleryLab";
    let cover = galleryLab;
    if (formCategory === "Hackathons") {
      coverName = "galleryCoding";
      cover = galleryCoding;
    } else if (formCategory === "Symposiums") {
      coverName = "gallerySymposium";
      cover = gallerySymposium;
    } else if (formCategory === "Socials") {
      coverName = "galleryCoworking";
      cover = galleryCoworking;
    }

    const dateStr = formDate 
      ? new Date(formDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
      : "Just now";

    const payload = {
      title: formTitle,
      photosCount: 0,
      date: dateStr,
      status: formStatus,
      coverImage: coverName,
      category: formCategory,
      createdAt: Date.now()
    };

    addToast("Saving album to Firestore...", "info");

    try {
      const docRef = await addDoc(collection(db, "albums"), payload);
      const newAlbumItem: AlbumItem = {
        id: docRef.id,
        title: formTitle,
        photosCount: 0,
        date: dateStr,
        status: formStatus,
        coverImage: cover,
        category: formCategory
      };

      setAlbums(prev => [newAlbumItem, ...prev]);
      setIsCreateModalOpen(false);
      
      setFormTitle("");
      setFormStatus("Published");
      setFormCategory("Workshops");
      setFormDate("");

      addToast(`Album "${formTitle}" created successfully!`);
    } catch (err) {
      console.error("Error saving album to Firestore:", err);
      addToast("Failed to create album in Firestore.", "warning");
    }
  };

  // Form submit - Upload Images
  const handleUploadImages = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFileCount <= 0) {
      addToast("Please select at least 1 image to upload", "warning");
      return;
    }

    addToast("Updating album counts in Firestore...", "info");

    try {
      const targetAlbum = albums.find(a => a.id === uploadAlbumId);
      if (targetAlbum) {
        const docRef = doc(db, "albums", uploadAlbumId);
        await updateDoc(docRef, { photosCount: targetAlbum.photosCount + selectedFileCount });

        setAlbums(prev => prev.map(alb => {
          if (alb.id === uploadAlbumId) {
            return { ...alb, photosCount: alb.photosCount + selectedFileCount };
          }
          return alb;
        }));
      }

      setIsUploadModalOpen(false);
      setSelectedFileCount(0);
      addToast(`Successfully uploaded ${selectedFileCount} images!`);
    } catch (err) {
      console.error("Error updating image count in Firestore:", err);
      addToast("Failed to upload image metadata to Firestore.", "warning");
    }
  };

  // Simulate file selection
  const simulateFileSelection = () => {
    const randomCount = Math.floor(Math.random() * 5) + 1;
    setSelectedFileCount(randomCount);
    addToast(`Selected ${randomCount} files for upload`, "info");
  };

  // Toggle album status
  const toggleAlbumStatus = async (id: string) => {
    const targetAlbum = albums.find(a => a.id === id);
    if (!targetAlbum) return;

    const nextStatus = targetAlbum.status === "Published" ? "Draft" : "Published";

    try {
      const docRef = doc(db, "albums", id);
      await updateDoc(docRef, { status: nextStatus });

      setAlbums(prev => prev.map(alb => {
        if (alb.id === id) {
          addToast(`"${alb.title}" status changed to ${nextStatus.toUpperCase()}`);
          return { ...alb, status: nextStatus };
        }
        return alb;
      }));
    } catch (err) {
      console.error("Error toggling status in Firestore:", err);
      addToast("Failed to update status in Firestore.", "warning");
    }
  };

  // Trigger delete confirmation modal
  const handleDeleteAlbum = (id: string, title: string) => {
    setDeleteConfirmAlbum({ id, title });
  };

  // Confirm delete action
  const confirmDeleteAlbum = async () => {
    if (!deleteConfirmAlbum) return;
    const { id, title } = deleteConfirmAlbum;

    try {
      const docRef = doc(db, "albums", id);
      await deleteDoc(docRef);

      setAlbums(prev => prev.filter(alb => alb.id !== id));
      addToast(`Album "${title}" deleted from gallery directory.`, "success");
    } catch (err) {
      console.error("Error deleting album from Firestore:", err);
      addToast("Failed to delete album from Firestore.", "warning");
    } finally {
      setDeleteConfirmAlbum(null);
    }
  };



  // Add AI tag
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    if (tags.some(t => t.name.toLowerCase() === newTagInput.trim().toLowerCase())) {
      addToast("Tag already exists", "warning");
      return;
    }
    setTags(prev => [...prev, { name: newTagInput.trim(), count: 0, active: true }]);
    setNewTagInput("");
    addToast(`Added tag "${newTagInput.trim()}"`);
  };

  // Toggle Tag Activity
  const toggleTag = (name: string) => {
    setTags(prev => prev.map(t => {
      if (t.name === name) return { ...t, active: !t.active };
      return t;
    }));
  };

  if (showCreateAlbumView) {
    return (
      <div className="space-y-6 text-left relative">
        <SEO 
          title="Create New Album - Gallery Portal" 
          description="Draft and configure a new visual album for Azure Intelligence."
        />

        {/* Toast Notification Container */}
        <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm">
          <AnimatePresence>
            {toastQueue.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className={`p-4 rounded-xl shadow-lg flex items-center gap-3 border text-sm font-semibold 
                  ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : ""}
                  ${toast.type === "info" ? "bg-blue-50 border-blue-200 text-blue-800" : ""}
                  ${toast.type === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : ""}`}
              >
                <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{toast.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="space-y-6 text-left animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Creation Header bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowCreateAlbumView(false)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center text-slate-450 hover:text-slate-700 shadow-sm"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Create New Album</h1>
                <p className="text-[10px] text-slate-450 font-bold tracking-wider mt-1.5 uppercase">
                  Drafting: <span className="text-slate-700 normal-case font-extrabold">{albumTitle || "Untitled Album"}</span> • Last saved Just now
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="relative hidden md:block">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  disabled
                  placeholder="Search faculty assets..."
                  className="pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 w-56 font-semibold"
                />
              </div>

              <button className="p-2 text-slate-450 hover:text-slate-600 bg-white rounded-xl border border-slate-200 shadow-sm relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              </button>

              <button 
                onClick={() => handleSaveAlbum("Draft")}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-sm shadow-blue-600/10 hover:shadow transition-all"
              >
                <Save className="h-4 w-4" />
                Save Album
              </button>
            </div>
          </div>

          {/* Creation Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left side: Album Details & Image Dropzone */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Card 1: Album Details */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-50">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Info className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Album Details</h3>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Album Title</label>
                      <input 
                        type="text"
                        placeholder="e.g. Winter Symposium 2026"
                        value={albumTitle}
                        onChange={(e) => setAlbumTitle(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Event Category</label>
                      <select 
                        value={albumCategory}
                        onChange={(e) => setAlbumCategory(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800"
                      >
                        <option value="Workshops">Workshops</option>
                        <option value="Hackathons">Hackathons</option>
                        <option value="Symposiums">Symposiums</option>
                        <option value="Socials">Socials</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Album Description</label>
                    <textarea 
                      placeholder="Briefly describe the context and objectives of this media album..."
                      value={albumDescription}
                      onChange={(e) => setAlbumDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 placeholder-slate-400 resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Card 2: Google Drive Link card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <LinkIcon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">Google Drive Link</h3>
                  </div>
                  <span className="text-[9px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-lg tracking-wider uppercase">
                    Cloud Link
                  </span>
                </div>

                <div className="pt-1 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Google Drive Folder or File Link
                    </label>
                    <div className="relative flex items-center">
                      <ExternalLink className="absolute left-4 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input 
                        type="url"
                        placeholder="https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9..."
                        value={driveLink}
                        onChange={(e) => setDriveLink(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 placeholder-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Status Banner / Sharing Guidance */}
                  {driveLink ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/50 flex items-center justify-between gap-3 text-emerald-800 text-xs font-semibold">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="truncate">Google Drive link attached successfully</span>
                      </div>
                      <a 
                        href={driveLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-extrabold underline text-emerald-700 hover:text-emerald-900 shrink-0"
                      >
                        Test Link
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/80 flex items-start gap-3 text-slate-500 text-xs font-medium">
                      <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-700">How to share your Google Drive link:</p>
                        <ol className="list-decimal list-inside text-[11px] space-y-0.5 text-slate-500 font-normal">
                          <li>Open your folder in Google Drive and click <strong>Share</strong>.</li>
                          <li>Set general access permission to <strong>"Anyone with the link"</strong>.</li>
                          <li>Copy the link and paste it into the input field above.</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Upload Event Banner card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">Upload Event Banner</h3>
                  </div>
                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-lg tracking-wider uppercase">
                    Cover Banner
                  </span>
                </div>

                <div className="pt-1 space-y-4">
                  {bannerImage ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                      <img 
                        src={bannerImage} 
                        alt="Event Banner Preview" 
                        className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex items-center justify-center gap-3">
                        <button 
                          type="button"
                          onClick={() => bannerInputRef.current?.click()}
                          className="px-3.5 py-2 bg-white text-slate-800 rounded-xl text-xs font-bold shadow-md hover:bg-slate-50 transition-all flex items-center gap-1.5"
                        >
                          <Upload className="h-3.5 w-3.5 text-blue-600" />
                          Change Banner
                        </button>
                        <button 
                          type="button"
                          onClick={() => setBannerImage("")}
                          className="px-3.5 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-red-700 transition-all flex items-center gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => bannerInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          const file = e.dataTransfer.files[0];
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setBannerImage(reader.result as string);
                            addToast("Event banner uploaded successfully!", "success");
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer hover:bg-emerald-50/30 transition-all duration-300 flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-[#E6F9F0] text-[#10B981] flex items-center justify-center shadow-inner">
                        <Upload className="h-5 w-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-800 tracking-tight">Drag & drop event banner here</h4>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          or <span className="text-[#10B981] hover:underline font-bold">browse files</span> (PNG, JPG, WEBP recommended)
                        </p>
                      </div>
                    </div>
                  )}

                  <input 
                    type="file" 
                    accept="image/*"
                    ref={bannerInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setBannerImage(reader.result as string);
                          addToast("Event banner uploaded successfully!", "success");
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Right side: Gallery settings, tags, actions */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Card 3: Gallery Settings */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-50">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <SettingsIcon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">Gallery Settings</h3>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Public Visibility Toggle */}
                  <div className="flex items-center justify-between gap-4 p-1">
                    <div className="text-left leading-tight">
                      <h4 className="text-xs font-bold text-slate-800">Public Visibility</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Visible to all students & faculty</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsPublicVisible(!isPublicVisible)}
                      className={`w-10 h-5.5 rounded-full relative transition-colors focus:outline-none shrink-0
                        ${isPublicVisible ? "bg-[#2563EB]" : "bg-slate-200"}`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-0.75 left-0.75 transition-transform
                        ${isPublicVisible ? "translate-x-4.5" : ""}`}
                      ></span>
                    </button>
                  </div>

                  {/* Feature on Home Toggle */}
                  <div className="flex items-center justify-between gap-4 p-1">
                    <div className="text-left leading-tight">
                      <h4 className="text-xs font-bold text-slate-800">Feature on Home</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Promote in main dashboard feed</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsFeaturedOnHome(!isFeaturedOnHome)}
                      className={`w-10 h-5.5 rounded-full relative transition-colors focus:outline-none shrink-0
                        ${isFeaturedOnHome ? "bg-[#2563EB]" : "bg-slate-200"}`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-0.75 left-0.75 transition-transform
                        ${isFeaturedOnHome ? "translate-x-4.5" : ""}`}
                      ></span>
                    </button>
                  </div>

                  {/* Enable Comments Toggle */}
                  <div className="flex items-center justify-between gap-4 p-1">
                    <div className="text-left leading-tight">
                      <h4 className="text-xs font-bold text-slate-800">Enable Comments</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Allow community feedback</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsCommentsEnabled(!isCommentsEnabled)}
                      className={`w-10 h-5.5 rounded-full relative transition-colors focus:outline-none shrink-0
                        ${isCommentsEnabled ? "bg-[#2563EB]" : "bg-slate-200"}`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-0.75 left-0.75 transition-transform
                        ${isCommentsEnabled ? "translate-x-4.5" : ""}`}
                      ></span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 4: Search Tags */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-50">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search Tags</h3>
                </div>

                <div className="mt-4 space-y-4">
                  {/* Tag list */}
                  {searchTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {searchTags.map(tg => (
                        <span key={tg} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider">
                          {tg}
                          <button 
                            onClick={() => setSearchTags(prev => prev.filter(t => t !== tg))}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Add Tag row */}
                  <div className="relative flex items-center gap-2">
                    <input 
                      type="text"
                      placeholder="Add tag..."
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newTagText.trim() && !searchTags.includes(newTagText.trim())) {
                            setSearchTags(prev => [...prev, newTagText.trim()]);
                            setNewTagText("");
                          }
                        }
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 placeholder-slate-450"
                    />
                    <button 
                      onClick={() => {
                        if (newTagText.trim() && !searchTags.includes(newTagText.trim())) {
                          setSearchTags(prev => [...prev, newTagText.trim()]);
                          setNewTagText("");
                        }
                      }}
                      className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 shadow-inner"
                    >
                      <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons card */}
              <div className="space-y-2 pt-2">
                <button 
                  onClick={() => handleSaveAlbum("Published")}
                  className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-sm shadow-blue-600/10 hover:shadow-md"
                >
                  Create Album & Publish
                </button>

                <button 
                  onClick={() => setShowCreateAlbumView(false)}
                  className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-2xl text-xs font-bold transition-all bg-white"
                >
                  Discard Draft
                </button>
              </div>

            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left relative">
      <SEO 
        title="Gallery Management - Admin Portal" 
        description="Manage visuals, albums, event photography, symposium uploads, and media storage configurations." 
        keywords="AI Verse Faculty Gallery, Album Directory, Image Storage Optimization"
      />

      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toastQueue.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-4 rounded-xl shadow-lg flex items-center gap-3 border text-sm font-semibold 
                ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : ""}
                ${toast.type === "info" ? "bg-blue-50 border-blue-200 text-blue-800" : ""}
                ${toast.type === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : ""}`}
            >
              <CheckCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header section with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight font-sans">Gallery Management</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Manage visuals for events, symposiums, and faculty milestones.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="md" 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 border-slate-200 bg-white hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Upload Images
          </Button>
          <Button 
            variant="primary" 
            size="md" 
            onClick={() => setShowCreateAlbumView(true)}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Create New Album
          </Button>
        </div>
      </div>

      {/* Row of 4 Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: TOTAL ALBUMS */}
        <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card flex flex-col justify-between h-[130px]">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Folder className="h-6 w-6 text-[#2563EB]" />
            </div>
            <Badge variant="success" className="text-green-600 bg-green-50/50 border-green-100 font-bold">+12%</Badge>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Albums</span>
            <span className="text-2xl font-black text-slate-800 leading-none">{albums.length}</span>
          </div>
        </div>

        {/* Card 2: TOTAL IMAGES */}
        <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card flex flex-col justify-between h-[130px]">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-teal-50 rounded-xl">
              <ImageIcon className="h-6 w-6 text-teal-600" />
            </div>
            <Badge variant="success" className="text-green-600 bg-green-50/50 border-green-100 font-bold">+156</Badge>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Images</span>
            <span className="text-2xl font-black text-slate-800 leading-none">{totalImages.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 3: RECENT UPLOADS */}
        <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card flex flex-col justify-between h-[130px]">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-amber-50 rounded-xl">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping"></span>
              Active
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recent Uploads</span>
            <span className="text-2xl font-black text-slate-800 leading-none">
              {recentUploads} <span className="text-xs text-slate-400 font-bold normal-case">this week</span>
            </span>
          </div>
        </div>

        {/* Card 4: DRAFT ALBUMS */}
        <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card flex flex-col justify-between h-[130px]">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <Badge variant="gray" className="font-bold text-slate-500">
              Review
            </Badge>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Draft Albums</span>
            <span className="text-2xl font-black text-slate-800 leading-none">
              {albums.filter(a => a.status === "Draft").length} <span className="text-xs text-slate-400 font-bold normal-case">pending</span>
            </span>
          </div>
        </div>

      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Gallery Directory (12 / 12) */}
        <div className="lg:col-span-12 space-y-6">
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card">
            
            {/* Gallery Directory Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Gallery Directory</h2>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Filter albums..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all"
                  />
                </div>

                {/* View Toggles */}
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
                    title="Grid View"
                  >
                    <LayoutGrid className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
                    title="List View"
                  >
                    <List className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Grid vs List album presentation */}
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredAlbums.map((album) => (
                  <div 
                    key={album.id} 
                    className="group bg-white rounded-card overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col justify-between"
                  >
                    {/* Cover image container */}
                    <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                      <img 
                        src={album.coverImage} 
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      
                      {/* Publish / Draft Status Badge overlay */}
                      <button 
                        onClick={() => toggleAlbumStatus(album.id)}
                        className="absolute top-4 right-4 cursor-pointer focus:outline-none"
                      >
                        <Badge 
                          variant={album.status === "Published" ? "success" : "warning"}
                          className="shadow-sm font-bold uppercase tracking-wider text-[9px]"
                        >
                          {album.status}
                        </Badge>
                      </button>

                      {/* Cover Category tag overlay */}
                      <div className="absolute bottom-4 left-4">
                        <span className="px-2.5 py-1 bg-slate-900/70 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">
                          {album.category}
                        </span>
                      </div>
                    </div>

                    {/* Album Info */}
                    <div className="p-5 text-left flex-grow">
                      <h3 className="font-extrabold text-base text-slate-800 leading-snug group-hover:text-[#2563EB] transition-colors">
                        {album.title}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 mt-3">
                        <div className="flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>{album.photosCount} Photos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{album.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick action buttons footer */}
                    <div className="border-t border-slate-50 px-5 py-3.5 bg-slate-50/50 flex items-center justify-between">
                      <button 
                        onClick={() => toggleAlbumStatus(album.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Set to {album.status === "Published" ? "Draft" : "Publish"}
                      </button>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenEditAlbum(album)}
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"
                          title="Edit Album"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteAlbum(album.id, album.title)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"
                          title="Delete Album"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Dotted "Create New Album" card */}
                <div 
                  onClick={() => {
                    setEditingAlbumId(null);
                    setAlbumTitle("");
                    setAlbumDescription("");
                    setDriveLink("");
                    setBannerImage("");
                    setShowCreateAlbumView(true);
                  }}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-card flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-50/50 transition-all duration-300 min-h-[300px]"
                >
                  <div className="p-4 bg-slate-100 rounded-full group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-500 transition-colors">
                    <Plus className="h-8 w-8" />
                  </div>
                  <span className="mt-4 font-bold text-slate-700 text-sm">Create New Album</span>
                  <p className="text-slate-400 text-xs mt-1 text-center font-medium max-w-[200px]">
                    Create a blank canvas to organize your visual memories.
                  </p>
                </div>
              </div>
            ) : (
              /* List view presentation */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 pl-4">Album Name</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3 text-center">Status</th>
                      <th className="pb-3">Photos Count</th>
                      <th className="pb-3">Date Created</th>
                      <th className="pb-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlbums.map((album) => (
                      <tr 
                        key={album.id} 
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="py-4 pl-4 font-bold text-slate-800">
                          <div className="flex items-center gap-3">
                            <img src={album.coverImage} className="w-10 h-10 object-cover rounded-lg shrink-0 border" alt="" />
                            <span className="group-hover:text-[#2563EB] transition-colors">{album.title}</span>
                          </div>
                        </td>
                        <td className="py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{album.category}</td>
                        <td className="py-4 text-center">
                          <button 
                            onClick={() => toggleAlbumStatus(album.id)}
                            className="cursor-pointer focus:outline-none"
                          >
                            <Badge 
                              variant={album.status === "Published" ? "success" : "warning"}
                              className="font-bold uppercase tracking-wider text-[9px]"
                            >
                              {album.status}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-4 text-sm font-semibold text-slate-600">{album.photosCount} Photos</td>
                        <td className="py-4 text-sm font-semibold text-slate-500">{album.date}</td>
                        <td className="py-4 text-right pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleAlbumStatus(album.id)}
                              className="text-xs font-bold text-blue-600 hover:underline mr-2"
                            >
                              Toggle
                            </button>
                            <button
                              onClick={() => handleOpenEditAlbum(album)}
                              className="text-slate-400 hover:text-blue-600 p-1.5 hover:bg-slate-100 rounded-lg"
                              title="Edit Album"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAlbum(album.id, album.title)}
                              className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-slate-100 rounded-lg"
                              title="Delete Album"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAlbums.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold text-sm">
                          No albums match your filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>


      </div>

      {/* CREATE NEW ALBUM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
          
          <div className="bg-white rounded-card shadow-xl border border-slate-100 max-w-md w-full relative z-10 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-800">Create New Album</h3>
            <p className="text-slate-500 text-xs mt-1 font-medium">Add a new collection to hold event photos.</p>

            <form onSubmit={handleCreateAlbum} className="mt-6 space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Album Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Symposium 2026"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as AlbumItem["category"])}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  >
                    <option value="Workshops">Workshops</option>
                    <option value="Hackathons">Hackathons</option>
                    <option value="Symposiums">Symposiums</option>
                    <option value="Socials">Socials</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AlbumItem["status"])}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Album Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="border-slate-200"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary"
                  className="bg-[#2563EB] text-white hover:bg-blue-700"
                >
                  Create Album
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD IMAGES MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsUploadModalOpen(false)}></div>
          
          <div className="bg-white rounded-card shadow-xl border border-slate-100 max-w-md w-full relative z-10 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-800">Upload Images</h3>
            <p className="text-slate-500 text-xs mt-1 font-medium">Add photos to an existing gallery album.</p>

            <form onSubmit={handleUploadImages} className="mt-6 space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Destination Album</label>
                <select
                  value={uploadAlbumId}
                  onChange={(e) => setUploadAlbumId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                >
                  {albums.map(alb => (
                    <option key={alb.id} value={alb.id}>{alb.title}</option>
                  ))}
                </select>
              </div>

              {/* Upload Drag & Drop mock zone */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Files</label>
                <div 
                  onClick={simulateFileSelection}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-all space-y-2"
                >
                  <div className="p-3 bg-slate-100 rounded-full inline-block text-slate-400">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="font-bold text-sm text-slate-700">Click to choose image files</div>
                  <div className="text-slate-400 text-xs font-semibold">Supports PNG, JPG, WEBP (Max 10MB each)</div>
                </div>

                {selectedFileCount > 0 && (
                  <div className="mt-3 flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border">
                    <span className="font-bold text-slate-600">Selected {selectedFileCount} images ready</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedFileCount(0)}
                      className="text-red-500 font-bold hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsUploadModalOpen(false)}
                  className="border-slate-200"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary"
                  className="bg-[#2563EB] text-white hover:bg-blue-700"
                >
                  Upload & Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ALL RECENT UPLOADS MODAL (LIGHTBOX) */}
      {isViewAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsViewAllModalOpen(false)}></div>
          
          <div className="bg-white rounded-card shadow-xl border border-slate-100 max-w-3xl w-full relative z-10 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <button 
              onClick={() => setIsViewAllModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-800">Recently Uploaded Media</h3>
            <p className="text-slate-500 text-xs mt-1 font-medium">Browse and manage recent asset uploads.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6 overflow-y-auto flex-grow pr-1.5">
              {recentImages.map(img => (
                <div key={img.id} className="group relative bg-slate-50 rounded-xl border overflow-hidden h-32 flex flex-col justify-between">
                  <img src={img.url} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between text-left">
                    <span className="text-[10px] text-white/80 font-medium truncate block">{img.name}</span>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/60 font-bold">{img.size}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this photo?")) {
                            setRecentImages(prev => prev.filter(i => i.id !== img.id));
                            addToast("Image deleted.");
                          }
                        }}
                        className="text-red-400 hover:text-red-500 p-1 rounded hover:bg-white/10"
                        title="Delete Image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-6 border-t flex justify-end">
              <Button variant="outline" onClick={() => setIsViewAllModalOpen(false)} className="border-slate-200">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SMART ORGANIZING / REVIEW TAGS MODAL */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsTagModalOpen(false)}></div>
          
          <div className="bg-white rounded-card shadow-xl border border-slate-100 max-w-md w-full relative z-10 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsTagModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 text-blue-600">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-xl font-bold text-slate-800">Review AI Auto-Tags</h3>
            </div>
            <p className="text-slate-500 text-xs mt-1.5 font-medium leading-relaxed">
              AI analysis scans uploaded images and assigns searchable metadata categories. Review or toggle active tags below.
            </p>

            <form onSubmit={handleAddTag} className="mt-6 flex gap-2">
              <input
                type="text"
                placeholder="Add custom tag..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                className="flex-grow px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
              />
              <Button type="submit" variant="primary" size="sm" className="bg-[#2563EB] text-white">
                Add
              </Button>
            </form>

            <div className="mt-5 space-y-3.5 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Auto-Assigned Tags</span>
              
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2
                      ${tag.active 
                        ? "bg-blue-50 text-blue-700 border-blue-200 font-bold" 
                        : "bg-slate-50 text-slate-400 border-slate-200 line-through"
                      }`}
                  >
                    <span>{tag.name}</span>
                    {tag.count > 0 && <span className="bg-white/80 px-1 py-0.5 rounded text-[9px] font-bold">{tag.count}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsTagModalOpen(false)} className="border-slate-200">
                Cancel
              </Button>
              <Button 
                variant="primary" 
                className="bg-[#2563EB] text-white hover:bg-blue-700" 
                onClick={() => {
                  setIsTagModalOpen(false);
                  addToast("AI Auto-tags settings saved successfully.");
                }}
              >
                Approve & Save Tags
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={() => setDeleteConfirmAlbum(null)}
          ></div>
          
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full relative z-10 p-6 sm:p-7 text-center animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="h-6 w-6 stroke-[2.2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Delete Gallery Album?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-700">"{deleteConfirmAlbum.title}"</span> from the gallery directory? This action cannot be undone.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmAlbum(null)}
                className="w-full py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAlbum}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-600/20"
              >
                Delete Album
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GalleryManagementPage;
