import React, { useState, useMemo, useEffect, useRef } from "react";
import SEO from "../../components/layout/SEO";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
import { fetchAlbums, createAlbum, bulkCreateAlbums, updateAlbum, deleteAlbum, fetchEvents } from "../../services/apiClient";
import { dataCache } from "../../utils/dataCache";
import { 
  Image as ImageIcon, 
  Clock, 
  Search, 
  LayoutGrid, 
  List, 
  Plus, 
  Upload, 
  X, 
  Trash2, 
  CheckCircle, 
  Save, 
  Info, 
  Pencil, 
  AlertTriangle,
  Eye, 
  Calendar, 
  Layers, 
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Import local fallback assets
import galleryLab from "../../assets/images/gallery_lab.png";
import gallerySymposium from "../../assets/images/gallery_symposium.png";
import galleryVr from "../../assets/images/gallery_vr.png";
import galleryCoding from "../../assets/images/gallery_coding.png";
import galleryCoworking from "../../assets/images/gallery_coworking.png";
import galleryCollab from "../../assets/images/gallery_collab.png";

export interface GalleryPhotoItem {
  id: string;
  title: string;
  imageUrl: string;
  coverImage?: string;
  bannerImage?: string;
  category: "Workshops" | "Hackathons" | "Symposiums" | "Socials";
  date: string;
  status: "Published" | "Draft";
  caption?: string;
  description?: string;
  tags?: string[];
  eventId?: string;
  eventTitle?: string;
  createdAt?: number;
  size?: string;
}

export interface GalleryEventAlbum {
  groupKey: string;
  title: string;
  category: GalleryPhotoItem["category"];
  date: string;
  status: "Published" | "Draft";
  coverImage: string;
  photos: GalleryPhotoItem[];
  caption?: string;
  tags?: string[];
  eventId?: string;
  createdAt: number;
}

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "info" | "warning";
}

const CATEGORY_OPTIONS: Array<GalleryPhotoItem["category"]> = [
  "Workshops",
  "Hackathons",
  "Symposiums",
  "Socials"
];

export const GalleryManagementPage: React.FC = () => {
  const [photos, setPhotos] = useState<GalleryPhotoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastQueue, setToastQueue] = useState<ToastMessage[]>([]);

  // Events list for selector
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [isCustomEvent, setIsCustomEvent] = useState<boolean>(false);

  // Search, Filter & View Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [statusFilter] = useState<"All" | "Published" | "Draft">("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<GalleryEventAlbum | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhotoItem | null>(null);
  const [lightboxAlbum, setLightboxAlbum] = useState<GalleryEventAlbum | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryPhotoItem | null>(null);
  const [deleteConfirmAlbum, setDeleteConfirmAlbum] = useState<GalleryEventAlbum | null>(null);
  const [deleteConfirmPhoto, setDeleteConfirmPhoto] = useState<GalleryPhotoItem | null>(null);

  // Single / Batch Upload State
  const [pendingUploads, setPendingUploads] = useState<{
    id: string;
    file: File;
    name: string;
    size: string;
    preview: string;
    title: string;
    category: GalleryPhotoItem["category"];
    caption: string;
    date: string;
    status: "Published" | "Draft";
    tags: string[];
  }[]>([]);
  const [batchName, setBatchName] = useState("");
  const [batchCaption, setBatchCaption] = useState("");
  const [batchCategory, setBatchCategory] = useState<GalleryPhotoItem["category"]>("Workshops");
  const [batchStatus, setBatchStatus] = useState<"Published" | "Draft">("Published");
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBatchNameChange = (val: string) => {
    setBatchName(val);
    setPendingUploads((prev) =>
      prev.map((p, idx) => ({
        ...p,
        title: val.trim()
          ? prev.length > 1
            ? `${val.trim()} (${idx + 1})`
            : val.trim()
          : p.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      }))
    );
  };

  const handleEventSelectChange = (eventId: string) => {
    setSelectedEventId(eventId);
    if (eventId === "custom") {
      setIsCustomEvent(true);
      return;
    }

    if (!eventId) {
      setIsCustomEvent(false);
      handleBatchNameChange("");
      return;
    }

    setIsCustomEvent(false);
    const ev = eventsList.find((e) => (e.id || e._id) === eventId);
    if (ev) {
      const eventTitle = ev.title || ev.name || "";
      handleBatchNameChange(eventTitle);

      // Auto-map category if matching
      const evType = `${ev.type || ""} ${ev.category || ""}`.toLowerCase();
      let matchedCategory: GalleryPhotoItem["category"] = "Workshops";
      if (evType.includes("hackathon")) matchedCategory = "Hackathons";
      else if (evType.includes("symposium") || evType.includes("seminar") || evType.includes("talk") || evType.includes("conference")) matchedCategory = "Symposiums";
      else if (evType.includes("social") || evType.includes("meet") || evType.includes("network") || evType.includes("club")) matchedCategory = "Socials";
      else if (evType.includes("workshop") || evType.includes("bootcamp") || evType.includes("training") || evType.includes("quiz")) matchedCategory = "Workshops";

      setBatchCategory(matchedCategory);

      // Auto-set date if available
      if (ev.date) {
        const parsedDate = new Date(ev.date);
        let formattedDate = ev.date;
        if (!isNaN(parsedDate.getTime())) {
          const yyyyMmDd = parsedDate.toISOString().split("T")[0];
          setBatchDate(yyyyMmDd);
          formattedDate = parsedDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
        }
        setPendingUploads((prev) =>
          prev.map((p) => ({ ...p, category: matchedCategory, date: formattedDate }))
        );
      } else {
        setPendingUploads((prev) =>
          prev.map((p) => ({ ...p, category: matchedCategory }))
        );
      }
    }
  };

  // Edit Form State
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<GalleryPhotoItem["category"]>("Workshops");
  const [editCaption, setEditCaption] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"Published" | "Draft">("Published");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [editImagePreview, setEditImagePreview] = useState<string>("");
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Toast trigger helper
  const addToast = (text: string, type: ToastMessage["type"] = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToastQueue((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToastQueue((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Helper to resolve cover image
  const resolvePhotoUrl = (data: any) => {
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
    if (data?.coverImage === "galleryCoding" || data?.category === "Hackathons") return galleryCoding;
    if (data?.coverImage === "gallerySymposium" || data?.category === "Symposiums") return gallerySymposium;
    if (data?.coverImage === "galleryCoworking" || data?.category === "Socials") return galleryCoworking;
    if (data?.coverImage === "galleryCollab") return galleryCollab;
    if (data?.coverImage === "galleryVr") return galleryVr;
    return galleryLab;
  };

  // Load photos from backend
  const loadPhotos = async () => {
    setLoading(true);
    try {
      const data = await fetchAlbums();
      const list: GalleryPhotoItem[] = [];

      (data || []).forEach((item: any) => {
        const raw = item || {};
        const photoUrl = resolvePhotoUrl(raw);

        list.push({
          id: raw.id || raw._id || `${Date.now()}`,
          title: raw.title || "Untitled Photo",
          imageUrl: photoUrl,
          coverImage: photoUrl,
          bannerImage: photoUrl,
          category: (raw.category as any) || "Workshops",
          date: raw.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          status: (raw.status as any) || "Published",
          caption: raw.caption || raw.description || "",
          description: raw.description || raw.caption || "",
          tags: Array.isArray(raw.tags) ? raw.tags : [],
          eventId: raw.eventId || "",
          eventTitle: raw.eventTitle || "",
          createdAt: raw.createdAt || raw.created_at || Date.now()
        });
      });

      setPhotos(list);
    } catch (err) {
      console.error("Error loading photos:", err);
      addToast("Failed to load gallery photos from database.", "warning");
    } finally {
      setLoading(false);
    }
  };

  // Load events for selection dropdown
  const loadEvents = async () => {
    try {
      const data = await fetchEvents();
      if (Array.isArray(data)) {
        setEventsList(data);
      }
    } catch (err) {
      console.warn("Failed to load events for gallery selector:", err);
    }
  };

  useEffect(() => {
    loadPhotos();
    loadEvents();
  }, []);

  // Compression helper
  const compressImage = (base64Str: string, maxWidth = 1280, quality = 0.8): Promise<string> => {
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

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Format file size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Handle files selected for upload
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newPending: typeof pendingUploads = [];
    const dateFormatted = new Date(batchDate || Date.now()).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      const rawBase64 = await fileToBase64(file);
      const cleanName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      let initialTitle = cleanName || `Event Photo ${i + 1}`;
      if (batchName.trim()) {
        initialTitle = files.length > 1 ? `${batchName.trim()} (${i + 1})` : batchName.trim();
      }

      newPending.push({
        id: `upload-${Date.now()}-${i}`,
        file,
        name: file.name,
        size: formatBytes(file.size),
        preview: rawBase64,
        title: initialTitle,
        category: batchCategory,
        caption: batchCaption || "",
        date: dateFormatted,
        status: batchStatus,
        tags: [batchCategory]
      });
    }

    setPendingUploads((prev) => [...prev, ...newPending]);
    if (!isUploadModalOpen) setIsUploadModalOpen(true);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Remove pending file from upload queue
  const handleRemovePending = (id: string) => {
    setPendingUploads((prev) => prev.filter((p) => p.id !== id));
  };

  // Submit single/batch photos
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingUploads.length === 0) {
      addToast("Please select at least one image to upload", "warning");
      return;
    }

    if (!batchName.trim() && !isCustomEvent && !selectedEventId) {
      addToast("Please select an event or enter an event name", "warning");
      return;
    }

    setIsUploading(true);
    addToast(`Processing and compressing ${pendingUploads.length} ${pendingUploads.length === 1 ? "photo" : "photos"}...`, "info");

    try {
      // Compress and format items
      const itemsToUpload = await Promise.all(
        pendingUploads.map(async (p, idx) => {
          const compressed = await compressImage(p.preview);
          const cleanEventName = batchName.trim() || p.title.replace(/\s*\(\d+\)$/, "").replace(/\s*#\d+$/, "").trim();
          return {
            title: p.title.trim() || `Photo ${idx + 1}`,
            eventTitle: cleanEventName,
            eventId: selectedEventId && selectedEventId !== "custom" ? selectedEventId : undefined,
            imageUrl: compressed,
            coverImage: compressed,
            bannerImage: compressed,
            category: p.category || batchCategory,
            caption: p.caption || "",
            description: p.caption || "",
            date: p.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            status: p.status || batchStatus,
            tags: p.tags && p.tags.length > 0 ? p.tags : [p.category || batchCategory],
            photosCount: 1,
            images: [{ url: compressed, caption: p.caption || "", uploadedAt: Date.now() }],
            createdAt: Date.now()
          };
        })
      );

      if (itemsToUpload.length === 1) {
        await createAlbum(itemsToUpload[0]);
      } else {
        await bulkCreateAlbums(itemsToUpload);
      }

      dataCache.invalidate("public_gallery_photos");
      addToast(`Successfully uploaded ${itemsToUpload.length} ${itemsToUpload.length === 1 ? "photo" : "photos"}!`, "success");
      setPendingUploads([]);
      setIsUploadModalOpen(false);
      await loadPhotos();
    } catch (err) {
      console.error("Error uploading photos:", err);
      addToast("Failed to save photos to database.", "warning");
    } finally {
      setIsUploading(false);
    }
  };

  // Open Edit Modal for an Event Album
  const handleOpenEdit = (album: GalleryEventAlbum) => {
    setEditingAlbum(album);
    setEditingPhoto(album.photos[0] || null);
    setEditTitle(album.title || "");
    setEditCategory(album.category || "Workshops");
    setEditCaption(album.caption || "");
    setEditDate(album.date || "");
    setEditStatus(album.status || "Published");
    setEditTags(album.tags || [album.category || "Workshops"]);
    setEditImagePreview(album.coverImage);
    setIsEditModalOpen(true);
  };

  // Handle Edit Image Replacement
  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    const compressed = await compressImage(base64);
    setEditImagePreview(compressed);
  };

  // Save Edited Event Album
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum) return;

    if (!editTitle.trim()) {
      addToast("Event / Album title is required!", "warning");
      return;
    }

    const cleanEvent = editTitle.trim().replace(/\s*\(\d+\)$/, "").replace(/\s*#\d+$/, "").trim();
    addToast("Saving event updates...", "info");

    try {
      await Promise.all(
        editingAlbum.photos.map((p, idx) => {
          const payload = {
            title: editingAlbum.photos.length > 1 ? `${cleanEvent} (${idx + 1})` : cleanEvent,
            eventTitle: cleanEvent,
            category: editCategory,
            caption: editCaption.trim(),
            description: editCaption.trim(),
            date: editDate || p.date,
            status: editStatus,
            tags: editTags,
            imageUrl: idx === 0 && editImagePreview ? editImagePreview : p.imageUrl,
            coverImage: idx === 0 && editImagePreview ? editImagePreview : p.coverImage,
            bannerImage: idx === 0 && editImagePreview ? editImagePreview : p.bannerImage,
            updatedAt: Date.now()
          };
          return updateAlbum(p.id, payload);
        })
      );

      dataCache.invalidate("public_gallery_photos");
      await loadPhotos();
      setIsEditModalOpen(false);
      setEditingAlbum(null);
      setEditingPhoto(null);
      addToast("Event album updated successfully!", "success");
    } catch (err) {
      console.error("Error updating event album:", err);
      addToast("Failed to update event album.", "warning");
    }
  };

  // Toggle Publish / Draft status for all photos in an event album
  const handleToggleAlbumStatus = async (album: GalleryEventAlbum) => {
    const newStatus: "Published" | "Draft" = album.status === "Published" ? "Draft" : "Published";
    try {
      await Promise.all(album.photos.map((p) => updateAlbum(p.id, { status: newStatus })));
      dataCache.invalidate("public_gallery_photos");
      setPhotos((prev) =>
        prev.map((p) => (album.photos.some((ap) => ap.id === p.id) ? { ...p, status: newStatus } : p))
      );
      addToast(`"${album.title}" album marked as ${newStatus.toUpperCase()}`, "info");
    } catch (err) {
      console.error("Error updating status:", err);
      addToast("Failed to toggle status.", "warning");
    }
  };

  // Delete all photos belonging to an event album
  const handleDeleteAlbum = async () => {
    if (!deleteConfirmAlbum) return;
    try {
      await Promise.all(deleteConfirmAlbum.photos.map((p) => deleteAlbum(p.id)));
      dataCache.invalidate("public_gallery_photos");
      setPhotos((prev) => prev.filter((p) => !deleteConfirmAlbum.photos.some((dp) => dp.id === p.id)));
      addToast(`Event "${deleteConfirmAlbum.title}" (${deleteConfirmAlbum.photos.length} photos) deleted.`, "info");
      setDeleteConfirmAlbum(null);
    } catch (err) {
      console.error("Error deleting album:", err);
      addToast("Failed to delete event.", "warning");
    }
  };

  // Lightbox handlers
  const openLightbox = (album: GalleryEventAlbum, index = 0) => {
    setLightboxAlbum(album);
    setLightboxIndex(index);
    setLightboxPhoto(album.photos[index] || null);
  };

  const nextLightboxPhoto = () => {
    if (!lightboxAlbum || lightboxAlbum.photos.length <= 1) return;
    const nextIdx = (lightboxIndex + 1) % lightboxAlbum.photos.length;
    setLightboxIndex(nextIdx);
    setLightboxPhoto(lightboxAlbum.photos[nextIdx]);
  };

  const prevLightboxPhoto = () => {
    if (!lightboxAlbum || lightboxAlbum.photos.length <= 1) return;
    const prevIdx = (lightboxIndex - 1 + lightboxAlbum.photos.length) % lightboxAlbum.photos.length;
    setLightboxIndex(prevIdx);
    setLightboxPhoto(lightboxAlbum.photos[prevIdx]);
  };

  // Group photos by Event / Album Name
  const groupedAlbums = useMemo<GalleryEventAlbum[]>(() => {
    const groupMap = new Map<string, GalleryEventAlbum>();

    photos.forEach((photo) => {
      // Clean title: remove sequential markers like "(1)", "(2)", "#1", etc.
      const cleanTitle = (photo.eventTitle || photo.title)
        .replace(/\s*\(\d+\)$/, "")
        .replace(/\s*#\d+$/, "")
        .trim() || "Visual Moment";

      const groupKey = photo.eventId
        ? `event_${photo.eventId}`
        : `${cleanTitle.toLowerCase()}___${photo.category}___${photo.date}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          groupKey,
          title: cleanTitle,
          category: photo.category,
          date: photo.date,
          status: photo.status,
          coverImage: photo.imageUrl,
          photos: [photo],
          caption: photo.caption || photo.description || "",
          tags: photo.tags || [],
          eventId: photo.eventId,
          createdAt: photo.createdAt || 0
        });
      } else {
        const group = groupMap.get(groupKey)!;
        if (!group.photos.some((p) => p.id === photo.id)) {
          group.photos.push(photo);
        }
        if (photo.status === "Published") {
          group.status = "Published";
        }
        if (!group.caption && photo.caption) {
          group.caption = photo.caption;
        }
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [photos]);

  // Filtered event albums list
  const filteredAlbums = useMemo(() => {
    return groupedAlbums.filter((album) => {
      const matchesSearch =
        album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (album.caption && album.caption.toLowerCase().includes(searchQuery.toLowerCase())) ||
        album.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (album.tags && album.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))) ||
        album.photos.some(
          (p) =>
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.caption && p.caption.toLowerCase().includes(searchQuery.toLowerCase()))
        );

      const matchesCategory = selectedCategory === "All" || album.category === selectedCategory;
      const matchesStatus = statusFilter === "All" || album.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [groupedAlbums, searchQuery, selectedCategory, statusFilter]);

  // Statistics
  const totalAlbumsCount = groupedAlbums.length;
  const totalPhotosCount = photos.length;
  const publishedAlbumsCount = groupedAlbums.filter((a) => a.status === "Published").length;
  const draftsAlbumsCount = groupedAlbums.filter((a) => a.status === "Draft").length;
  const recentAlbumsCount = useMemo(() => {
    return groupedAlbums.filter((a) => {
      const created = a.createdAt || 0;
      return Date.now() - created < 604800000; // 7 days
    }).length;
  }, [groupedAlbums]);

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "Hackathons":
        return "bg-rose-50 text-rose-700 border-rose-200/80";
      case "Symposiums":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case "Socials":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200/80";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      <SEO
        title="Gallery Management | AI Verse Faculty Hub"
        description="Upload and manage event albums, symposium visual records, and community milestones."
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toastQueue.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 pointer-events-auto transition-all transform animate-in slide-in-from-bottom-3 ${
              toast.type === "success"
                ? "bg-slate-900 text-white border-slate-800"
                : toast.type === "warning"
                  ? "bg-amber-50 text-amber-900 border-amber-200"
                  : "bg-blue-50 text-blue-900 border-blue-200"
            }`}
          >
            {toast.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {toast.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
            {toast.type === "info" && <Info className="w-4 h-4 text-blue-500" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-black uppercase tracking-wider">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Event Album Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A]">
            Gallery Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Upload and organize photos grouped by events, workshops, and milestones.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadPhotos}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Refresh gallery albums"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <Button
            variant="gradient"
            onClick={() => {
              setPendingUploads([]);
              setSelectedEventId("");
              setIsCustomEvent(false);
              setBatchName("");
              setIsUploadModalOpen(true);
            }}
            className="rounded-2xl px-5 py-2.5 font-black text-xs shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Photo</span>
          </Button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Events</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A]">{totalAlbumsCount}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">{totalPhotosCount} total photos</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Published</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{publishedAlbumsCount}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Live on public gallery</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Recent Events</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600">{recentAlbumsCount}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">In the past 7 days</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Drafts</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{draftsAlbumsCount}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Unpublished albums</div>
        </div>
      </div>

      {/* Filter Toolbar & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
              selectedCategory === "All"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({groupedAlbums.length})
          </button>
          {CATEGORY_OPTIONS.map((cat) => {
            const count = groupedAlbums.filter((a) => a.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs font-black"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700 font-black"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Search & View Mode Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event title, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-7 py-1.5 text-xs font-bold text-[#0F172A] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-700"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "list" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-700"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Gallery Directory */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-200/80 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading gallery albums from database...</p>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 border border-dashed border-slate-300 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-black text-[#0F172A]">No Events Found</h3>
            <p className="text-xs text-slate-400 font-medium">
              {searchQuery || selectedCategory !== "All"
                ? "No gallery events match your current filter criteria."
                : "Your gallery is currently empty. Upload your first event photo now!"}
            </p>
          </div>
          <Button
            variant="gradient"
            onClick={() => {
              setPendingUploads([]);
              setSelectedEventId("");
              setIsCustomEvent(false);
              setBatchName("");
              setIsUploadModalOpen(true);
            }}
            className="rounded-xl px-5 py-2 text-xs font-black shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Upload Photo Now</span>
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW (Event Album Cards) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* Quick Upload Tile */}
          <div
            onClick={() => {
              setPendingUploads([]);
              setSelectedEventId("");
              setIsCustomEvent(false);
              setBatchName("");
              setIsUploadModalOpen(true);
            }}
            className="group rounded-3xl border-2 border-dashed border-slate-200 hover:border-blue-500/80 bg-slate-50/50 hover:bg-blue-50/20 p-6 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer min-h-[280px]"
          >
            <div className="w-12 h-12 rounded-2xl bg-white shadow-md border border-slate-200/80 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-[#0F172A] group-hover:text-blue-600 transition-colors">
              Add New Photo
            </h4>
            <p className="text-xs text-slate-400 font-medium max-w-[200px] mt-1">
              Upload single or multiple event photos directly
            </p>
          </div>

          {filteredAlbums.map((album) => {
            return (
              <div
                key={album.groupKey}
                className="group bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-blue-200 transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Photo Thumbnail with Photo Count */}
                  <div
                    className="relative aspect-[4/3] bg-slate-900 overflow-hidden cursor-pointer"
                    onClick={() => openLightbox(album, 0)}
                  >
                    <img
                      src={album.coverImage}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3.5" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-xs backdrop-blur-md ${getCategoryBadgeClass(
                          album.category
                        )}`}
                      >
                        {album.category}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-950/80 text-white border border-white/20 backdrop-blur-md flex items-center gap-1 shadow-xs">
                          <ImageIcon className="w-3 h-3 text-blue-400" />
                          <span>{album.photos.length}</span>
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAlbumStatus(album);
                          }}
                          className={`pointer-events-auto text-[10px] font-black uppercase px-2 py-0.5 rounded-full border cursor-pointer transition-all shadow-xs ${
                            album.status === "Published"
                              ? "bg-emerald-500 text-white border-emerald-400"
                              : "bg-amber-400 text-slate-900 border-amber-300"
                          }`}
                          title="Click to toggle Published / Draft"
                        >
                          {album.status}
                        </button>
                      </div>
                    </div>

                    {/* Quick Action Overlay on Hover */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openLightbox(album, 0);
                        }}
                        className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-xl shadow-md transition-transform hover:scale-110 cursor-pointer"
                        title="View All Photos"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(album);
                        }}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-transform hover:scale-110 cursor-pointer"
                        title="Edit Event Details"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmAlbum(album);
                        }}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-transform hover:scale-110 cursor-pointer"
                        title="Delete Event Album"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail preview strip if multiple photos */}
                  {album.photos.length > 1 && (
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-t border-slate-100 overflow-x-auto [scrollbar-width:none]">
                      {album.photos.slice(0, 5).map((p, idx) => (
                        <div
                          key={p.id || idx}
                          onClick={() => openLightbox(album, idx)}
                          className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-500 shrink-0 transition-all"
                          title={`View Photo ${idx + 1}`}
                        >
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {album.photos.length > 5 && (
                        <span className="text-[10px] font-black text-slate-500 pl-1">
                          +{album.photos.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Album Details */}
                  <div className="p-4 space-y-2">
                    <div className="space-y-1">
                      <h3
                        className="font-black text-sm text-[#0F172A] line-clamp-1 leading-snug hover:text-blue-600 cursor-pointer transition-colors"
                        onClick={() => openLightbox(album, 0)}
                        title={album.title}
                      >
                        {album.title}
                      </h3>
                      {album.caption && (
                        <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                          {album.caption}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {album.date}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(album)}
                      className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <span>•</span>
                    <button
                      onClick={() => setDeleteConfirmAlbum(album)}
                      className="text-red-500 hover:text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW (Table of Event Albums) */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200/80 select-none">
                <tr>
                  <th className="py-3.5 px-4">Cover & Photos</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Event Title & Caption</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredAlbums.map((album) => (
                  <tr key={album.groupKey} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          onClick={() => openLightbox(album, 0)}
                          className="w-14 h-11 rounded-xl bg-slate-900 overflow-hidden shadow-2xs cursor-pointer border border-slate-200 shrink-0"
                        >
                          <img
                            src={album.coverImage}
                            alt={album.title}
                            className="w-full h-full object-cover hover:scale-110 transition-transform"
                          />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          {album.photos.length} {album.photos.length === 1 ? "photo" : "photos"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5 max-w-md">
                        <div
                          onClick={() => openLightbox(album, 0)}
                          className="font-black text-[#0F172A] hover:text-blue-600 cursor-pointer transition-colors"
                        >
                          {album.title}
                        </div>
                        {album.caption && (
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {album.caption}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(
                          album.category
                        )}`}
                      >
                        {album.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {album.date}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleAlbumStatus(album)}
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border cursor-pointer transition-all ${
                          album.status === "Published"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        {album.status}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openLightbox(album, 0)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Preview All Photos"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(album)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Event"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmAlbum(album)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Event Album"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: UPLOAD PHOTOS (SINGLE & BATCH) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-8"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase">
                    <Upload className="w-3 h-3" />
                    <span>Upload Individual Visuals</span>
                  </div>
                  <h2 className="text-lg font-black text-[#0F172A]">
                    Upload Gallery Photos
                  </h2>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                {/* Drag and drop upload box */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
                    dragActive
                      ? "border-blue-500 bg-blue-50/60 scale-[1.01]"
                      : "border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/20"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-200/80 flex items-center justify-center text-blue-600 mx-auto mb-3">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-black text-[#0F172A]">
                    Click to browse or drag & drop photos here
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Supports PNG, JPG, JPEG, WEBP. Select 1 photo or multiple photos at once.
                  </p>
                </div>

                {/* Common Defaults for Uploads */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block">
                        Photo / Event Name *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextCustom = !isCustomEvent;
                          setIsCustomEvent(nextCustom);
                          if (nextCustom) {
                            setSelectedEventId("custom");
                          } else {
                            setSelectedEventId("");
                            handleBatchNameChange("");
                          }
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        {isCustomEvent ? "← Choose From Events Page" : "✍ Enter Custom Name"}
                      </button>
                    </div>

                    {!isCustomEvent ? (
                      <select
                        value={selectedEventId}
                        onChange={(e) => handleEventSelectChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs cursor-pointer"
                      >
                        <option value="">-- Select Event From Events Page --</option>
                        {eventsList.map((ev) => (
                          <option key={ev.id || ev._id} value={ev.id || ev._id}>
                            {ev.title || ev.name} {ev.type ? `[${ev.type}]` : ""} {ev.date ? `• ${ev.date}` : ""}
                          </option>
                        ))}
                        <option value="custom">✍ Other / Custom Event Name...</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={batchName}
                        onChange={(e) => handleBatchNameChange(e.target.value)}
                        placeholder="E.g. Code Slayer Hackathon 2026, AI Symposium, Student Project..."
                        autoFocus
                        className="w-full bg-white border border-blue-300 ring-2 ring-blue-500/10 rounded-xl px-3.5 py-2 text-xs font-bold text-[#0F172A] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                      />
                    )}

                    {selectedEventId && !isCustomEvent && batchName && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 font-medium bg-blue-50/80 border border-blue-200/60 px-2.5 py-1 rounded-lg">
                        <span className="text-blue-600 font-bold">Selected Event:</span>
                        <span className="truncate font-semibold">{batchName}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Category
                      </label>
                      <select
                        value={batchCategory}
                        onChange={(e) => {
                          const newCat = e.target.value as GalleryPhotoItem["category"];
                          setBatchCategory(newCat);
                          setPendingUploads((prev) =>
                            prev.map((p) => ({ ...p, category: newCat }))
                          );
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                      >
                        {CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Date
                      </label>
                      <DatePicker
                        value={batchDate}
                        onChange={(val) => {
                          setBatchDate(val);
                          let formatted = val;
                          if (val) {
                            const [y, m, d] = val.split("-").map(Number);
                            const parsedDate = new Date(y, m - 1, d);
                            if (!isNaN(parsedDate.getTime())) {
                              formatted = parsedDate.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric"
                              });
                            }
                          }
                          setPendingUploads((prev) =>
                            prev.map((p) => ({ ...p, date: formatted }))
                          );
                        }}
                        placeholder="Select event date"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Publish Status
                      </label>
                      <select
                        value={batchStatus}
                        onChange={(e) => {
                          const newSt = e.target.value as "Published" | "Draft";
                          setBatchStatus(newSt);
                          setPendingUploads((prev) =>
                            prev.map((p) => ({ ...p, status: newSt }))
                          );
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                      >
                        <option value="Published">Published (Public)</option>
                        <option value="Draft">Draft (Hidden)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                      Caption / Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={batchCaption}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBatchCaption(val);
                        setPendingUploads((prev) =>
                          prev.map((p) => ({ ...p, caption: val }))
                        );
                      }}
                      placeholder="Optional caption or note about this moment..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-medium text-[#0F172A] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Queue of Selected Photos */}
                {pendingUploads.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-[#0F172A]">
                      <span>Selected Photos ({pendingUploads.length})</span>
                      <button
                        type="button"
                        onClick={() => setPendingUploads([])}
                        className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {pendingUploads.map((p) => (
                        <div
                          key={p.id}
                          className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5"
                        >
                          <div className="w-14 h-14 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-200">
                            <img
                              src={p.preview}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <input
                              type="text"
                              value={p.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPendingUploads((prev) =>
                                  prev.map((item) =>
                                    item.id === p.id ? { ...item, title: val } : item
                                  )
                                );
                              }}
                              placeholder="Photo title / event name..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-black text-[#0F172A] outline-none focus:bg-white focus:border-blue-500"
                            />

                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                              <span>{p.size}</span>
                              <span>•</span>
                              <span className="text-blue-600 font-bold">{p.category}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePending(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove from queue"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <Button
                    variant="gradient"
                    type="submit"
                    disabled={isUploading || pendingUploads.length === 0}
                    className="px-6 py-2.5 text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>
                          Upload {pendingUploads.length > 0 ? `(${pendingUploads.length}) Photos` : "Photos"}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: EDIT PHOTO DETAILS */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isEditModalOpen && editingPhoto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-8"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Edit Photo Metadata
                  </span>
                  <h2 className="text-lg font-black text-[#0F172A]">
                    Edit Photo Details
                  </h2>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                {/* Photo Preview & Replacement */}
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div className="w-20 h-16 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                    <img
                      src={editImagePreview || editingPhoto.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs cursor-pointer hover:bg-slate-50 transition-all"
                    >
                      Replace Image File
                    </button>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageChange}
                      className="hidden"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">
                      PNG, JPG or WEBP up to 10MB
                    </p>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    Photo Title *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    placeholder="E.g. AI Symposium Keynote Address"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-[#0F172A] outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Category & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">
                      Category
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">
                      Visibility Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="Published">Published (Public)</option>
                      <option value="Draft">Draft (Hidden)</option>
                    </select>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    Event Date
                  </label>
                  <DatePicker
                    value={(() => {
                      if (!editDate) return "";
                      if (/^\d{4}-\d{2}-\d{2}$/.test(editDate)) return editDate;
                      const parsed = new Date(editDate);
                      if (!isNaN(parsed.getTime())) {
                        const y = parsed.getFullYear();
                        const m = String(parsed.getMonth() + 1).padStart(2, "0");
                        const d = String(parsed.getDate()).padStart(2, "0");
                        return `${y}-${m}-${d}`;
                      }
                      return editDate;
                    })()}
                    onChange={(val) => {
                      if (val) {
                        const [y, m, d] = val.split("-").map(Number);
                        const parsedDate = new Date(y, m - 1, d);
                        if (!isNaN(parsedDate.getTime())) {
                          setEditDate(
                            parsedDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })
                          );
                          return;
                        }
                      }
                      setEditDate(val);
                    }}
                    placeholder="Select event date"
                  />
                </div>

                {/* Caption */}
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    Caption / Description
                  </label>
                  <textarea
                    rows={3}
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Add context, speaker details, or team highlights..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-[#0F172A] outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    Tags
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newTagInput.trim() && !editTags.includes(newTagInput.trim())) {
                            setEditTags([...editTags, newTagInput.trim()]);
                            setNewTagInput("");
                          }
                        }
                      }}
                      placeholder="Add tag and press Enter..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0F172A] outline-none focus:bg-white focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newTagInput.trim() && !editTags.includes(newTagInput.trim())) {
                          setEditTags([...editTags, newTagInput.trim()]);
                          setNewTagInput("");
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {editTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => setEditTags(editTags.filter((t) => t !== tag))}
                          className="hover:text-red-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button
                    variant="gradient"
                    type="submit"
                    className="px-6 py-2.5 text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: LIGHTBOX / FULL IMAGE PREVIEW */}
      {/* ========================================================= */}
      <AnimatePresence>
        {(lightboxAlbum || lightboxPhoto) && (
          <div
            onClick={() => {
              setLightboxAlbum(null);
              setLightboxPhoto(null);
            }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[80] flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]"
            >
              {/* Top Controls */}
              <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between shrink-0 text-white">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(
                        lightboxAlbum?.category || lightboxPhoto?.category || "Workshops"
                      )}`}
                    >
                      {lightboxAlbum?.category || lightboxPhoto?.category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {lightboxAlbum?.date || lightboxPhoto?.date}
                    </span>
                    {lightboxAlbum && lightboxAlbum.photos.length > 1 && (
                      <span className="text-xs text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        Photo {lightboxIndex + 1} of {lightboxAlbum.photos.length}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-white">
                    {lightboxAlbum?.title || lightboxPhoto?.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {lightboxAlbum && (
                    <button
                      onClick={() => {
                        handleOpenEdit(lightboxAlbum);
                        setLightboxAlbum(null);
                        setLightboxPhoto(null);
                      }}
                      className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                      title="Edit Details"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setLightboxAlbum(null);
                      setLightboxPhoto(null);
                    }}
                    className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Full Image Container with Carousel Arrows */}
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden p-2 min-h-[300px]">
                {lightboxAlbum && lightboxAlbum.photos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        prevLightboxPhoto();
                      }}
                      className="absolute left-4 z-10 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/20 transition-all cursor-pointer shadow-xl hover:scale-110"
                      title="Previous Photo"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        nextLightboxPhoto();
                      }}
                      className="absolute right-4 z-10 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/20 transition-all cursor-pointer shadow-xl hover:scale-110"
                      title="Next Photo"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                <img
                  src={
                    lightboxAlbum
                      ? lightboxAlbum.photos[lightboxIndex]?.imageUrl || lightboxAlbum.coverImage
                      : lightboxPhoto?.imageUrl
                  }
                  alt={lightboxAlbum?.title || lightboxPhoto?.title}
                  className="max-h-[60vh] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-all duration-200"
                />
              </div>

              {/* Thumbnail selector strip in lightbox */}
              {lightboxAlbum && lightboxAlbum.photos.length > 1 && (
                <div className="p-2 bg-slate-950/90 border-t border-white/10 flex items-center justify-center gap-2 overflow-x-auto [scrollbar-width:none]">
                  {lightboxAlbum.photos.map((p, idx) => (
                    <button
                      key={p.id || idx}
                      onClick={() => {
                        setLightboxIndex(idx);
                        setLightboxPhoto(p);
                      }}
                      className={`w-12 h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                        lightboxIndex === idx
                          ? "border-blue-500 scale-105 shadow-md"
                          : "border-white/20 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Caption Footer */}
              {(lightboxAlbum?.caption || lightboxPhoto?.caption) && (
                <div className="p-4 bg-slate-950/95 border-t border-white/10 text-xs text-slate-300 font-medium">
                  {lightboxAlbum?.caption || lightboxPhoto?.caption}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION */}
      {/* ========================================================= */}
      <AnimatePresence>
        {(deleteConfirmAlbum || deleteConfirmPhoto) && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black text-[#0F172A]">Delete Event Album?</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Are you sure you want to permanently delete{" "}
                  <strong className="text-slate-800">
                    "{deleteConfirmAlbum?.title || deleteConfirmPhoto?.title}"
                  </strong>
                  {deleteConfirmAlbum && deleteConfirmAlbum.photos.length > 1
                    ? ` (${deleteConfirmAlbum.photos.length} photos)`
                    : ""}? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmAlbum(null);
                    setDeleteConfirmPhoto(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAlbum}
                  className="px-6 py-2.5 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GalleryManagementPage;
