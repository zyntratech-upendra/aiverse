import React, { useState } from "react";
import SEO from "../../components/layout/SEO";
import { 
  Megaphone, 
  Pin, 
  Plus, 
  SlidersHorizontal, 
  Trash2, 
  Edit2, 
  X, 
  Clock, 
  FileText, 
  Image, 
  CloudUpload,
  ChevronRight,
  MoreVertical
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  dateText: string;
  status: "Published" | "Draft" | "Pinned";
  author: string;
}

interface WebSection {
  id: string;
  name: string;
  lastUpdated: string;
}

interface ResourceItem {
  id: string;
  name: string;
  size: string;
  type: string;
}

const ContentManagementPage: React.FC = () => {
  // Mock State for Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: "1",
      title: "AI Winter Research Symposium 2024",
      dateText: "Posted 2 days ago",
      status: "Published",
      author: "Aris Thorne"
    },
    {
      id: "2",
      title: "New Undergraduate Fellowship Grant",
      dateText: "Last edited 5 hours ago",
      status: "Draft",
      author: "Sarah Jenkins"
    },
    {
      id: "3",
      title: "Updated Safety Protocols for Neural Labs",
      dateText: "Pinned Announcement",
      status: "Pinned",
      author: "System Admin"
    }
  ]);

  // Mock State for Website Sections
  const [webSections, setWebSections] = useState<WebSection[]>([
    { id: "1", name: "Home Page", lastUpdated: "Oct 14" },
    { id: "2", name: "About Us", lastUpdated: "Sep 28" },
    { id: "3", name: "The Team", lastUpdated: "Oct 02" }
  ]);

  // Mock State for Resources
  const [resources] = useState<ResourceItem[]>([
    { id: "1", name: "Whitepaper_AI_Ethics.pdf", size: "4.2 MB", type: "Research" },
    { id: "2", name: "Annual_Report_2025.pdf", size: "6.8 MB", type: "Report" }
  ]);

  // States
  const [activeTab, setActiveTab] = useState<"Announcements" | "Website Sections" | "Resource Library" | "SEO & Metadata">("Announcements");
  
  // Create Announcement Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState<"Published" | "Draft">("Published");
  const [newAuthor, setNewAuthor] = useState("Aris Thorne");

  // Create Section Modal State
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  // Handlers
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    const newAnn: Announcement = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: newTitle,
      dateText: "Just now",
      status: newStatus,
      author: newAuthor
    };

    setAnnouncements([newAnn, ...announcements]);
    setNewTitle("");
    setIsCreateModalOpen(false);
  };

  const handleTogglePin = (id: string) => {
    setAnnouncements(announcements.map(ann => {
      if (ann.id === id) {
        const nextStatus = ann.status === "Pinned" ? "Published" : "Pinned";
        return { 
          ...ann, 
          status: nextStatus,
          dateText: nextStatus === "Pinned" ? "Pinned Announcement" : "Posted just now"
        };
      }
      return ann;
    }));
  };

  const handleDeleteAnnouncement = (id: string) => {
    setAnnouncements(announcements.filter(ann => ann.id !== id));
  };

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName) return;

    const newSec: WebSection = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: newSectionName,
      lastUpdated: "Just now"
    };

    setWebSections([...webSections, newSec]);
    setNewSectionName("");
    setIsSectionModalOpen(false);
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      <SEO 
        title="Content Management - Faculty Portal" 
        description="Oversee and update the public website content, announcements, and featured media."
      />

      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Content Management</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl font-medium leading-relaxed">
            Oversee and update the public website content, announcements, and featured media.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center">
          <button
            onClick={() => alert("Launching Media Manager...")}
            className="flex items-center gap-2 justify-center px-4 py-2 border border-blue-200 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-all text-xs whitespace-nowrap bg-white"
          >
            <CloudUpload className="h-4 w-4" />
            Media Manager
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 justify-center px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl shadow-md shadow-blue-600/10 hover:shadow-lg transition-all text-xs whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Create Announcement
          </button>
        </div>
      </div>

      {/* ================= METRICS CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Announcements */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border-l-4 border-l-blue-500 flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <Megaphone className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-0.5">
              +12%
            </span>
          </div>
          <div className="mt-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Announcements</span>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">142</h3>
          </div>
        </div>

        {/* Pinned Posts */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border-l-4 border-l-amber-500 flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
              <Pin className="h-4.5 w-4.5 rotate-45" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pinned Posts</span>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">8</h3>
          </div>
        </div>

        {/* Gallery Items */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border-l-4 border-l-emerald-500 flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <Image className="h-4.5 w-4.5" />
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100/30">
              Active
            </span>
          </div>
          <div className="mt-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Gallery Items</span>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">54</h3>
          </div>
        </div>

        {/* Draft Content */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border-l-4 border-l-slate-400 flex flex-col justify-between text-left group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
              <FileText className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Draft Content</span>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">12</h3>
          </div>
        </div>
      </div>

      {/* ================= TABS ================= */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap -mb-px gap-6 text-left">
          {(["Announcements", "Website Sections", "Resource Library", "SEO & Metadata"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-xs font-bold transition-all border-b-2 select-none whitespace-nowrap
                ${activeTab === tab 
                  ? "border-[#2563EB] text-[#2563EB] font-black" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ================= TAB CONTENT GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Main announcements table or selected tab settings (65% / 8 grid cols) */}
        <div className="lg:col-span-8 space-y-6 text-left">
          
          {activeTab === "Announcements" && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800 tracking-tight">Recent Announcements</h3>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <button onClick={() => alert("Open filters...")} className="p-1.5 hover:bg-slate-100 rounded-lg hover:text-slate-600 transition-colors">
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Announcements Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/70 text-[9px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100">
                    <tr>
                      <th scope="col" className="px-6 py-3">Title</th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3">Author</th>
                      <th scope="col" className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {announcements.map(ann => (
                      <tr key={ann.id} className="hover:bg-slate-50/40 transition-colors">
                        {/* Title & Date */}
                        <td className="px-6 py-3.5">
                          <div className="font-bold text-slate-800 text-xs leading-normal">{ann.title}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{ann.dateText}</div>
                        </td>

                        {/* Status badge */}
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          {ann.status === "Published" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/30">
                              <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                              Published
                            </span>
                          )}
                          {ann.status === "Draft" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200/50">
                              <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                              Draft
                            </span>
                          )}
                          {ann.status === "Pinned" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#FEF3C7] text-[#D97706] border border-amber-200/30">
                              <span className="w-1 h-1 rounded-full bg-[#D97706]"></span>
                              Pinned
                            </span>
                          )}
                        </td>

                        {/* Author */}
                        <td className="px-6 py-3.5 whitespace-nowrap font-medium text-slate-500 text-xs">
                          {ann.author}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3.5 whitespace-nowrap text-right text-xs font-semibold">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleTogglePin(ann.id)}
                              className={`p-1 rounded-lg border transition-all
                                ${ann.status === "Pinned"
                                  ? "bg-amber-50 border-amber-200 text-[#D97706]"
                                  : "border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                }`}
                              title={ann.status === "Pinned" ? "Unpin Post" : "Pin Post"}
                            >
                              <Pin className="h-3.5 w-3.5 rotate-45" />
                            </button>
                            <button
                              onClick={() => alert(`Edit feature coming soon...`)}
                              className="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                              title="Edit Announcement"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                              title="Delete Post"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* View all button */}
              <div className="p-4 border-t border-slate-100 text-center">
                <button
                  onClick={() => alert("Displaying all announcements...")}
                  className="text-xs font-bold text-[#2563EB] hover:text-blue-700 transition-colors"
                >
                  View All Announcements
                </button>
              </div>
            </div>
          )}

          {activeTab === "Website Sections" && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800 tracking-tight mb-2">Web Content Sections</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Directly configure components and layouts rendering on the public pages.
              </p>
              
              <div className="divide-y divide-slate-100">
                {webSections.map(sec => (
                  <div key={sec.id} className="py-3.5 flex items-center justify-between group cursor-pointer hover:bg-slate-50/50 rounded-xl px-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{sec.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Last updated {sec.lastUpdated}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Resource Library" && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800 tracking-tight mb-2">Uploaded Files & Assets</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Static documents, brochures, curriculum guides and event materials library.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {resources.map(res => (
                  <div key={res.id} className="p-4 border border-slate-150 rounded-2xl flex items-center justify-between bg-slate-50/50 hover:bg-white transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl">
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 max-w-[140px] truncate">{res.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">{res.size} • {res.type}</p>
                      </div>
                    </div>
                    <button className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "SEO & Metadata" && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800 tracking-tight mb-2">Search Engine Optimization</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Configure primary indexing parameters and social media cards previews.
              </p>
              
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Global Site Suffix</label>
                  <input
                    type="text"
                    defaultValue="AI Verse"
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description Meta Template</label>
                  <textarea
                    rows={3}
                    defaultValue="Discover AI Verse - a premium academic community driving the future of artificial intelligence through collaborative learning, research, and hackathons."
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-850"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Website sections list & Resources (35% / 4 grid cols) */}
        <div className="lg:col-span-4 space-y-6 text-left">
          
          {/* Website Sections Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight mb-1">Website Sections</h3>
            <p className="text-[10px] text-slate-400 font-medium mb-4">Click to configure active sections</p>

            <div className="space-y-3">
              {webSections.map(sec => (
                <div 
                  key={sec.id}
                  onClick={() => setActiveTab("Website Sections")}
                  className="flex items-center justify-between p-3 border border-slate-100 hover:border-blue-200 rounded-2xl hover:bg-blue-50/20 cursor-pointer transition-all group"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-none">{sec.name}</h4>
                    <span className="text-[9px] text-slate-400 mt-1.5 inline-block">
                      <Clock className="h-2.5 w-2.5 inline-block mr-1 -mt-0.5" />
                      Last updated {sec.lastUpdated}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              ))}

              <button
                onClick={() => setIsSectionModalOpen(true)}
                className="w-full mt-2 py-2.5 text-center text-xs font-bold border border-dashed border-slate-250 hover:border-slate-350 rounded-xl text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50/50 transition-all select-none"
              >
                + Add Custom Section
              </button>
            </div>
          </div>

          {/* Resource Library Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight mb-1">Resource Library</h3>
            <p className="text-[10px] text-slate-400 font-medium mb-4">Manage 24 active research assets</p>

            <div className="space-y-3">
              {resources.slice(0, 1).map(res => (
                <div key={res.id} className="p-3 border border-slate-100 rounded-2xl flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <div className="leading-tight">
                      <h4 className="text-xs font-bold text-slate-800 max-w-[110px] truncate">{res.name}</h4>
                      <span className="text-[9px] text-slate-400 font-medium">{res.size} • {res.type}</span>
                    </div>
                  </div>
                  <button className="p-1 text-slate-450 hover:text-slate-650 rounded-lg">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => setActiveTab("Resource Library")}
                className="w-full mt-2 py-2 text-center text-xs font-bold border border-slate-205 hover:border-slate-305 rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-all select-none"
              >
                Manage Library
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ================= CREATE ANNOUNCEMENT MODAL ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800">
                <Megaphone className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold">Create Announcement</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAnnouncement} className="p-6 space-y-4 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Announcement Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Winter Research Symposium 2024"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as "Published" | "Draft")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800 cursor-pointer"
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Author</label>
                  <input
                    type="text"
                    required
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
                >
                  Create Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD WEB SECTION MODAL ================= */}
      {isSectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800">
                <Plus className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold">Add Custom Section</h3>
              </div>
              <button
                onClick={() => setIsSectionModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSection} className="p-6 space-y-4 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gallery Events Section"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-800"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
                >
                  Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentManagementPage;
