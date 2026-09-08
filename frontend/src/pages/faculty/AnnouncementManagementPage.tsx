import React, { useState, useMemo, useEffect } from "react";
import SEO from "../../components/layout/SEO";
import Button from "../../components/ui/Button";
import { db } from "../../config/firebase";
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { 
  Megaphone, 
  Radio, 
  Pin, 
  TrendingUp, 
  Plus, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Bell, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  SlidersHorizontal,
  Info,
  Send
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AnnouncementItem {
  id: string;
  title: string;
  category: "EVENT" | "CLUB UPDATE" | "URGENT" | "ACADEMIC";
  status: "Pinned" | "Published" | "Scheduled" | "Draft";
  date: string;
  reach: number;
}

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "info" | "warning";
}

const AnnouncementManagementPage: React.FC = () => {
  // Global stats state
  const [totalAnnouncements, setTotalAnnouncements] = useState(42);
  const [activeBroadcasts, setActiveBroadcasts] = useState(12);
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const [avgEngagement] = useState(88);
  const [toastQueue, setToastQueue] = useState<ToastMessage[]>([]);
  
  // Interactive UI states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [isAdvisoryVisible, setIsAdvisoryVisible] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [hoveredChartPoint, setHoveredChartPoint] = useState<{ day: string; value: number } | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<AnnouncementItem["category"]>("EVENT");
  const [formStatus, setFormStatus] = useState<AnnouncementItem["status"]>("Published");
  const [formReach, setFormReach] = useState(1500);

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  // Fetch announcements from Firestore on mount
  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "announcements"));
        const list: AnnouncementItem[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            title: data.title || "",
            category: data.category || "EVENT",
            status: data.status || "Published",
            date: data.date || "",
            reach: data.reach || 0
          });
        });
        setAnnouncements(list);
        setTotalAnnouncements(list.length);
      } catch (err) {
        console.error("Error reading announcements from Firestore:", err);
        addToast("Failed to fetch announcements from Firestore. Using fallback.", "warning");
      }
    };
    
    loadAnnouncements();
  }, []);

  // Toast helper
  const addToast = (text: string, type: ToastMessage["type"] = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToastQueue(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToastQueue(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Derive stats dynamically based on lists
  const pinnedCount = useMemo(() => {
    return announcements.filter(a => a.status === "Pinned").length;
  }, [announcements]);

  // Toggle Broadcast switch
  const handleToggleBroadcast = () => {
    const nextState = !broadcastEnabled;
    setBroadcastEnabled(nextState);
    setActiveBroadcasts(prev => (nextState ? prev + 1 : prev - 1));
    addToast(
      nextState ? "Live Broadcast system enabled." : "Live Broadcast system paused.",
      nextState ? "success" : "warning"
    );
  };

  // Filter announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategoryFilter === "ALL" || item.category === selectedCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [announcements, searchQuery, selectedCategoryFilter]);

  // Pagination config
  const itemsPerPage = 4;
  const totalPages = Math.ceil(filteredAnnouncements.length / itemsPerPage) || 1;
  const paginatedAnnouncements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAnnouncements.slice(start, start + itemsPerPage);
  }, [filteredAnnouncements, currentPage]);

  // Adjust page number if filters shrink content list
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Form submit - Create new announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      addToast("Title is required", "warning");
      return;
    }

    const newDateStr = formStatus === "Scheduled" 
      ? `For ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : formStatus === "Draft" 
        ? "Saved just now" 
        : `Published ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const newPayload = {
      title: formTitle,
      category: formCategory,
      status: formStatus,
      date: newDateStr,
      reach: formStatus === "Published" || formStatus === "Pinned" ? formReach : 0,
      createdAt: Date.now()
    };

    addToast("Saving announcement to database...", "info");
    
    try {
      const docRef = await addDoc(collection(db, "announcements"), newPayload);
      const newItem: AnnouncementItem = {
        id: docRef.id,
        ...newPayload
      };

      setAnnouncements(prev => [newItem, ...prev]);
      setTotalAnnouncements(prev => prev + 1);
      if (formStatus === "Published" || formStatus === "Pinned") {
        setActiveBroadcasts(prev => prev + 1);
      }
      
      // Clear and Close
      setFormTitle("");
      setFormCategory("EVENT");
      setFormStatus("Published");
      setFormReach(1500);
      setIsCreateModalOpen(false);
      setCurrentPage(1);

      addToast(`Announcement "${formTitle}" created successfully!`);
    } catch (err) {
      console.error("Error saving announcement to Firestore:", err);
      addToast("Failed to save announcement to Firestore.", "warning");
    }
  };

  // Toggle Pinned status
  const handleTogglePin = async (id: string) => {
    const itemToToggle = announcements.find(a => a.id === id);
    if (!itemToToggle) return;

    const wasPinned = itemToToggle.status === "Pinned";
    const nextStatus = wasPinned ? "Published" : "Pinned";

    try {
      const docRef = doc(db, "announcements", id);
      await updateDoc(docRef, { status: nextStatus });

      setAnnouncements(prev => prev.map(item => {
        if (item.id === id) {
          addToast(
            wasPinned ? `Unpinned "${item.title}"` : `Pinned "${item.title}" to top of dashboard.`,
            wasPinned ? "info" : "success"
          );
          return { ...item, status: nextStatus };
        }
        return item;
      }));
    } catch (err) {
      console.error("Error updating pin status in Firestore:", err);
      addToast("Failed to update status in database.", "warning");
    }
  };

  // Delete item
  const handleDeleteAnnouncement = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete the announcement "${title}"?`)) {
      try {
        const docRef = doc(db, "announcements", id);
        await deleteDoc(docRef);
        
        setAnnouncements(prev => prev.filter(item => item.id !== id));
        setTotalAnnouncements(prev => Math.max(0, prev - 1));
        addToast(`Announcement "${title}" removed successfully.`);
      } catch (err) {
        console.error("Error deleting announcement from Firestore:", err);
        addToast("Failed to delete announcement from database.", "warning");
      }
    }
  };

  // Simulate Export Log
  const handleExportLog = () => {
    setIsExporting(true);
    addToast("Exporting announcements logs as CSV...", "info");
    
    setTimeout(() => {
      setIsExporting(false);
      addToast("Log export completed! Downloaded announcements_report.csv");
    }, 1500);
  };

  // Highlight row callback from priority list
  const handlePriorityItemClick = (titleKeyword: string) => {
    const matchedItem = announcements.find(a => a.title.toLowerCase().includes(titleKeyword.toLowerCase()));
    if (matchedItem) {
      // Find what page this item resides on
      const matchedIdx = filteredAnnouncements.findIndex(a => a.id === matchedItem.id);
      if (matchedIdx !== -1) {
        const targetPage = Math.floor(matchedIdx / itemsPerPage) + 1;
        setCurrentPage(targetPage);
        setHighlightedRowId(matchedItem.id);
        
        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightedRowId(null);
        }, 3000);

        addToast(`Highlighted matching announcement: "${matchedItem.title}"`, "info");
      }
    }
  };

  // SVG Chart weekly reach pulse data
  const chartPoints = [
    { day: "Mon", value: 800, x: 40, y: 160 },
    { day: "Tue", value: 1400, x: 90, y: 130 },
    { day: "Wed", value: 2400, x: 140, y: 80 },
    { day: "Thu", value: 1900, x: 190, y: 105 },
    { day: "Fri", value: 2900, x: 240, y: 55 },
    { day: "Sat", value: 1200, x: 290, y: 140 },
    { day: "Sun", value: 1800, x: 340, y: 110 }
  ];

  return (
    <div className="space-y-6 text-left relative">
      <SEO 
        title="Announcement Management - Admin Portal" 
        description="Supervise club bulletins, schedule events updates, customize broadcast channels, and view user reach pulse statistics." 
        keywords="AI Verse Announcement Management, Broadcast System, Priority Bulletins"
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
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <span>Content</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-blue-600 font-bold">Announcements</span>
      </div>

      {/* Header section with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight font-sans">Announcement Management</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Manage club-wide broadcasts, pin urgent updates, and monitor communication reach across the student body and faculty network.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button 
            variant="outline" 
            size="md" 
            onClick={handleExportLog}
            isLoading={isExporting}
            className="flex items-center gap-2 border-slate-200 bg-white hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Log
          </Button>
          <Button 
            variant="primary" 
            size="md" 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Create New Announcement
          </Button>
        </div>
      </div>

      {/* Row of 4 Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: TOTAL ANNOUNCEMENTS */}
        <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card flex flex-col justify-between h-[130px] border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <Megaphone className="h-5.5 w-5.5 text-blue-600" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold">+3 this month</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Announcements</span>
            <span className="text-2xl font-black text-slate-800 leading-none">{totalAnnouncements}</span>
          </div>
        </div>

        {/* Card 2: ACTIVE BROADCASTS with toggle switch */}
        <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card flex flex-col justify-between h-[130px] border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-teal-50 rounded-xl">
              <Radio className={`h-5.5 w-5.5 ${broadcastEnabled ? "text-teal-600 animate-pulse" : "text-slate-400"}`} />
            </div>
            
            {/* Custom slide toggle switch */}
            <button 
              type="button"
              onClick={handleToggleBroadcast}
              className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors outline-none
                ${broadcastEnabled ? "bg-[#2563EB]" : "bg-slate-300"}`}
            >
              <div 
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200
                  ${broadcastEnabled ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Broadcasts</span>
            <span className="text-2xl font-black text-slate-800 leading-none">{activeBroadcasts}</span>
          </div>
        </div>

        {/* Card 3: URGENT / PINNED */}
        <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card flex flex-col justify-between h-[130px] border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-rose-50 rounded-xl">
              <Pin className="h-5.5 w-5.5 text-rose-500" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold">Important</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Urgent / Pinned</span>
            <span className="text-2xl font-black text-slate-800 leading-none">
              {pinnedCount < 10 ? `0${pinnedCount}` : pinnedCount}
            </span>
          </div>
        </div>

        {/* Card 4: AVG. ENGAGEMENT */}
        <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card flex flex-col justify-between h-[130px] border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <TrendingUp className="h-5.5 w-5.5 text-emerald-600" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold">High Reach</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg. Engagement</span>
            <span className="text-2xl font-black text-slate-800 leading-none">
              {avgEngagement}% <span className="text-xs text-slate-400 font-bold normal-case">Reach</span>
            </span>
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Announcement Directory Table (8 / 12) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card">
            
            {/* Announcement Directory Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Announcement Directory</h2>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search announcements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all"
                  />
                </div>

                {/* Category Dropdown Filter */}
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-500">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 mr-1.5" />
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="bg-transparent border-none outline-none pr-4 text-slate-600 font-bold cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="EVENT">Event</option>
                    <option value="CLUB UPDATE">Club Update</option>
                    <option value="URGENT">Urgent</option>
                    <option value="ACADEMIC">Academic</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Announcements Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pl-4">Title & Category</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Reach</th>
                    <th className="pb-3 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAnnouncements.map((item) => {
                    const isHighlighted = highlightedRowId === item.id;
                    return (
                      <tr 
                        key={item.id} 
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors group
                          ${isHighlighted ? "bg-blue-50/80 hover:bg-blue-50/80" : ""}`}
                      >
                        {/* Column 1: Title & Category */}
                        <td className="py-4.5 pl-4 text-left">
                          <div className="space-y-1.5 max-w-[260px] sm:max-w-xs">
                            <span className="font-bold text-slate-800 text-sm block leading-snug group-hover:text-blue-600 transition-colors">
                              {item.title}
                            </span>
                            <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-bold tracking-wider">
                              {item.category}
                            </span>
                          </div>
                        </td>

                        {/* Column 2: Status */}
                        <td className="py-4.5 text-xs font-semibold">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                              <span className={`w-2 h-2 rounded-full 
                                ${item.status === "Pinned" ? "bg-red-500 animate-pulse" : ""}
                                ${item.status === "Published" ? "bg-emerald-500" : ""}
                                ${item.status === "Scheduled" ? "bg-amber-400" : ""}
                                ${item.status === "Draft" ? "bg-slate-400" : ""}`}
                              />
                              <span>{item.status}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold block">{item.date}</span>
                          </div>
                        </td>

                        {/* Column 3: Reach Progress Bar */}
                        <td className="py-4.5">
                          <div className="space-y-1.5 text-xs font-semibold text-slate-500 max-w-[120px]">
                            {item.reach > 0 ? (
                              <>
                                <span className="text-slate-800 font-bold">
                                  {(item.reach / 1000).toFixed(1)}k <span className="text-[10px] font-semibold text-slate-400">users</span>
                                </span>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-blue-500 h-full rounded-full"
                                    style={{ width: `${(item.reach / 5000) * 100}%` }}
                                  />
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-300 font-bold text-center block">--</span>
                            )}
                          </div>
                        </td>

                        {/* Column 4: Actions */}
                        <td className="py-4.5 text-right pr-4">
                          <div className="flex items-center justify-end gap-3.5">
                            <button
                              onClick={() => handleTogglePin(item.id)}
                              className={`text-xs font-bold transition-colors 
                                ${item.status === "Pinned" ? "text-red-500 hover:text-red-700" : "text-blue-600 hover:text-blue-800"}`}
                              title={item.status === "Pinned" ? "Unpin Announcement" : "Pin Announcement"}
                            >
                              {item.status === "Pinned" ? "Unpin" : "Pin"}
                            </button>
                            <button
                              onClick={() => handleDeleteAnnouncement(item.id, item.title)}
                              className="text-slate-400 hover:text-red-500 p-1"
                              title="Delete Bulletin"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {filteredAnnouncements.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400 font-semibold text-sm">
                        No announcement entries match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredAnnouncements.length > 0 && (
              <div className="flex items-center justify-between pt-5 mt-4 border-t border-slate-50 text-xs font-semibold text-slate-400">
                <span>
                  Showing {Math.min(filteredAnnouncements.length, (currentPage - 1) * itemsPerPage + 1)}-
                  {Math.min(filteredAnnouncements.length, currentPage * itemsPerPage)} of {filteredAnnouncements.length} entries
                </span>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors
                        ${currentPage === page 
                          ? "bg-[#2563EB] text-white" 
                          : "border border-slate-200 hover:bg-slate-50 text-slate-600"}`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Weekly Reach Chart, Priority Queue, and System Advisory (4 / 12) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Widget 1: Weekly Reach Pulse line chart */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">Announcement Reach Pulse</h2>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </div>

            {/* Custom Interactive SVG Line Chart */}
            <div className="relative pt-2">
              <svg viewBox="0 0 380 200" className="w-full overflow-visible">
                {/* Horizontal Grid lines */}
                <line x1="30" y1="50" x2="360" y2="50" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="30" y1="100" x2="360" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="30" y1="150" x2="360" y2="150" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="30" y1="180" x2="360" y2="180" stroke="#cbd5e1" strokeWidth="1" />

                {/* Left Y-axis labels */}
                <text x="5" y="55" className="text-[10px] font-semibold text-slate-400 font-sans">3k</text>
                <text x="5" y="105" className="text-[10px] font-semibold text-slate-400 font-sans">2k</text>
                <text x="5" y="155" className="text-[10px] font-semibold text-slate-400 font-sans">1k</text>

                {/* Line graph gradient path fill */}
                <path
                  d="M 40 180 Q 90 130, 140 80 T 190 105 T 240 55 T 290 140 T 340 110 L 340 180 L 40 180 Z"
                  fill="url(#chart-grad)"
                  opacity="0.15"
                />

                {/* Line path definition */}
                <path
                  d="M 40 160 C 70 145, 80 130, 90 130 C 110 130, 120 80, 140 80 C 160 80, 170 105, 190 105 C 210 105, 220 55, 240 55 C 260 55, 270 140, 290 140 C 315 140, 325 110, 340 110"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Interactive dots representing coordinates */}
                {chartPoints.map((point) => (
                  <circle
                    key={point.day}
                    cx={point.x}
                    cy={point.y}
                    r={hoveredChartPoint?.day === point.day ? 6 : 4}
                    fill={hoveredChartPoint?.day === point.day ? "#2563EB" : "#FFFFFF"}
                    stroke="#2563EB"
                    strokeWidth={hoveredChartPoint?.day === point.day ? 3 : 2}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredChartPoint(point)}
                    onMouseLeave={() => setHoveredChartPoint(null)}
                  />
                ))}

                {/* X-axis Day labels */}
                {chartPoints.map((point) => (
                  <text
                    key={point.day}
                    x={point.x}
                    y="198"
                    textAnchor="middle"
                    className="text-[10px] font-bold text-slate-400 font-sans"
                  >
                    {point.day}
                  </text>
                ))}

                {/* Definitions */}
                <defs>
                  <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Tooltip for hover state */}
              <div className="absolute top-0 right-0 h-6 flex items-center">
                {hoveredChartPoint ? (
                  <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1.5 animate-in fade-in duration-100">
                    <span>{hoveredChartPoint.day}:</span>
                    <span className="text-blue-300">{hoveredChartPoint.value.toLocaleString()} reach</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold">Hover nodes for values</span>
                )}
              </div>
            </div>
          </div>

          {/* Widget 2: Priority Queue */}
          <div className="bg-white p-6 rounded-card border border-slate-100 shadow-card space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Priority Queue</h2>
              <button className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                View All
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Priority Item 1: Symposium */}
              <div 
                onClick={() => handlePriorityItemClick("Symposium")}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-blue-50/20 cursor-pointer transition-colors group"
              >
                <div className="p-2 bg-rose-50 rounded-xl text-rose-500 shrink-0 mt-0.5">
                  <Bell className="h-4.5 w-4.5" />
                </div>
                <div className="leading-tight flex-grow min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                    AI Symposium Registration Open
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Urgent - Due in 2 days
                  </p>
                </div>
              </div>

              {/* Priority Item 2: Hackathon */}
              <div 
                onClick={() => handlePriorityItemClick("Hackathon")}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-blue-50/20 cursor-pointer transition-colors group"
              >
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600 shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4.5 w-4.5" />
                </div>
                <div className="leading-tight flex-grow min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                    Neural Hackathon Winners
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Pinned - General Reach
                  </p>
                </div>
              </div>

              {/* Priority Item 3: Server Migration */}
              <div 
                onClick={() => handlePriorityItemClick("Maintenance")}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-blue-50/20 cursor-pointer transition-colors group"
              >
                <div className="p-2 bg-amber-50 rounded-xl text-amber-500 shrink-0 mt-0.5">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div className="leading-tight flex-grow min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                    Server Migration Schedule
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Scheduled for Oct 20
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Widget 3: System Advisory solid blue card */}
          {isAdvisoryVisible && (
            <motion.div 
              initial={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#2563EB] text-white p-6 rounded-card border border-blue-600 shadow-lg text-left space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <Info className="h-5 w-5 text-white/90 shrink-0" />
                <h3 className="text-sm font-bold tracking-wider uppercase text-white/90 font-sans">
                  System Advisory
                </h3>
              </div>
              <p className="text-xs font-semibold text-blue-50 leading-relaxed">
                Faculty dashboard undergoing scheduled maintenance on Oct 25 at 02:00 UTC. Announcement posting will be temporarily paused.
              </p>
              <div className="flex items-center justify-between text-[10px] font-bold text-blue-100 pt-2 border-t border-white/10">
                <span>Updated: Today at 09:12 AM</span>
                <button 
                  onClick={() => {
                    setIsAdvisoryVisible(false);
                    addToast("System advisory dismissed.", "info");
                  }}
                  className="underline hover:text-white transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}

        </div>

      </div>

      {/* CREATE NEW ANNOUNCEMENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => setIsCreateModalOpen(false)}
          />
          
          <div className="bg-white rounded-card shadow-xl border border-slate-100 max-w-md w-full relative z-10 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 text-blue-600">
              <Megaphone className="h-5.5 w-5.5" />
              <h3 className="text-xl font-bold text-slate-800 font-sans">Create Announcement</h3>
            </div>
            <p className="text-slate-500 text-xs mt-1 font-medium">Broadcast news, events, or alerts to the community.</p>

            <form onSubmit={handleCreateAnnouncement} className="mt-6 space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bulletin Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Symposium Registration Open"
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
                    onChange={(e) => setFormCategory(e.target.value as AnnouncementItem["category"])}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700"
                  >
                    <option value="EVENT">Event</option>
                    <option value="CLUB UPDATE">Club Update</option>
                    <option value="URGENT">Urgent</option>
                    <option value="ACADEMIC">Academic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Initial Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AnnouncementItem["status"])}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700"
                  >
                    <option value="Published">Published</option>
                    <option value="Pinned">Pinned</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              {(formStatus === "Published" || formStatus === "Pinned") && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Reach (Simulated Users)</label>
                  <input
                    type="number"
                    min={100}
                    max={5000}
                    value={formReach}
                    onChange={(e) => setFormReach(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700"
                  />
                </div>
              )}

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
                  className="bg-[#2563EB] text-white hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish Bulletin
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AnnouncementManagementPage;
