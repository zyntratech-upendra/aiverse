import React, { useState, useEffect } from "react";
import { db } from "../../config/firebase";
  import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import { sendResendEmail } from "../../utils/resendEmailService";
import { fetchContacts, updateContact, deleteContact as apiDeleteContact } from "../../services/apiClient";
import {
  Mail,
  Search,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  Download,
  Eye,
  X,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Copy,
  Check,
  Archive,
  Inbox
} from "lucide-react";
import SEO from "../../components/layout/SEO";

export interface ContactQuery {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: number;
  status?: "new" | "read" | "replied" | "archived";
  repliedAt?: number;
  replyMessage?: string;
}

const ContactInquiriesPage: React.FC = () => {
  const [inquiries, setInquiries] = useState<ContactQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInquiry, setSelectedInquiry] = useState<ContactQuery | null>(null);
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Reply modal state
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Polling-based fetch for contact queries
  useEffect(() => {
    setLoading(true);

    let poll: any = null;
    const load = async () => {
      try {
        const backendContacts = await fetchContacts();
        if (Array.isArray(backendContacts) && backendContacts.length > 0) {
          const list: ContactQuery[] = backendContacts.map((c: any) => ({
            id: c.id || c._id,
            name: c.name || "Anonymous",
            email: c.email || "",
            subject: c.subject || "(No Subject)",
            message: c.message || "",
            createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
            status: (c.status || "new").toLowerCase(),
            repliedAt: c.respondedAt || c.repliedAt,
            replyMessage: c.notes || c.replyMessage,
          }));
          setInquiries(list);
          setLoading(false);
          return;
        }
      } catch (err) {
        // Fallback to Firestore
      }

      try {
        const q = query(collection(db, "contact_queries"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const list: ContactQuery[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            name: data.name || "Anonymous",
            email: data.email || "",
            subject: data.subject || "(No Subject)",
            message: data.message || "",
            createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
            status: data.status || "new",
            repliedAt: data.repliedAt,
            replyMessage: data.replyMessage
          });
        });
        setInquiries(list);
      } catch (error) {
        console.error("Error loading contact queries:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
    poll = setInterval(load, 10000);
    return () => { if (poll) clearInterval(poll); };
  }, []);

  // Update status in Backend API & Firestore
  const handleUpdateStatus = async (id: string, newStatus: ContactQuery["status"]) => {
    try {
      await updateContact(id, { status: newStatus }).catch(() => {});
      const docRef = doc(db, "contact_queries", id);
      await updateDoc(docRef, { status: newStatus }).catch(() => {});
      
      setInquiries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      if (selectedInquiry && selectedInquiry.id === id) {
        setSelectedInquiry((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Delete single inquiry
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this contact message?")) return;
    try {
      await apiDeleteContact(id).catch(() => {});
      await deleteDoc(doc(db, "contact_queries", id)).catch(() => {});
      setInquiries((prev) => prev.filter((i) => i.id !== id));
      if (selectedInquiry?.id === id) setSelectedInquiry(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error("Error deleting inquiry:", err);
      alert("Failed to delete inquiry.");
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected message(s)? This cannot be undone.`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.delete(doc(db, "contact_queries", id));
      });
      await batch.commit();

      setInquiries((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      if (selectedInquiry && selectedIds.has(selectedInquiry.id)) {
        setSelectedInquiry(null);
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete selected inquiries.");
    }
  };

  // Bulk mark status
  const handleBulkMarkStatus = async (status: ContactQuery["status"]) => {
    if (selectedIds.size === 0) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.update(doc(db, "contact_queries", id), { status });
      });
      await batch.commit();

      setInquiries((prev) =>
        prev.map((i) => (selectedIds.has(i.id) ? { ...i, status } : i))
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk update status error:", err);
      alert("Failed to update selected inquiries.");
    }
  };

  // Open inquiry detail
  const handleOpenDetail = (inquiry: ContactQuery) => {
    setSelectedInquiry(inquiry);
    setReplySubject(`Re: ${inquiry.subject}`);
    setReplyBody("");
    setReplySuccess(false);
    setReplyError("");

    // Auto mark as read if it was 'new'
    if (inquiry.status === "new" || !inquiry.status) {
      handleUpdateStatus(inquiry.id, "read");
    }
  };

  // Send reply email
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !replyBody.trim()) return;

    setSendingReply(true);
    setReplyError("");
    try {
      const formattedHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px; color: #1e293b;">
          <div style="margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 12px;">
            <h2 style="color: #2563eb; margin: 0; font-size: 20px;">AI Verse VITB Team</h2>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Vishnu Institute of Technology, Bhimavaram</p>
          </div>
          <p style="font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>${selectedInquiry.name}</strong>,</p>
          <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #2563eb; margin: 16px 0; border-radius: 8px; font-size: 14px; line-height: 1.6;">
            ${replyBody.replace(/\n/g, "<br/>")}
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <div style="font-size: 12px; color: #94a3b8;">
            <p style="margin: 0;">In response to your query on: <em>"${selectedInquiry.subject}"</em></p>
            <blockquote style="margin: 8px 0; padding-left: 10px; border-left: 2px solid #cbd5e1; font-style: italic;">
              ${selectedInquiry.message}
            </blockquote>
            <p style="margin-top: 16px;">Warm regards,<br/><strong>AI Verse Management & Coordination Desk</strong></p>
          </div>
        </div>
      `;

      const res = await sendResendEmail({
        to: selectedInquiry.email,
        subject: replySubject.trim() || `Re: ${selectedInquiry.subject}`,
        html: formattedHtml,
        text: replyBody
      });

      if (res.success) {
        setReplySuccess(true);
        // Update status in Firestore
        const docRef = doc(db, "contact_queries", selectedInquiry.id);
        await updateDoc(docRef, {
          status: "replied",
          repliedAt: Date.now(),
          replyMessage: replyBody
        });

        setInquiries((prev) =>
          prev.map((item) =>
            item.id === selectedInquiry.id
              ? { ...item, status: "replied", repliedAt: Date.now(), replyMessage: replyBody }
              : item
          )
        );
        setSelectedInquiry((prev) =>
          prev ? { ...prev, status: "replied", repliedAt: Date.now(), replyMessage: replyBody } : null
        );
      } else {
        setReplyError(res.error || "Failed to deliver email. Please try again.");
      }
    } catch (err: any) {
      console.error("Error sending reply email:", err);
      setReplyError(err.message || "Failed to send reply email.");
    } finally {
      setSendingReply(false);
    }
  };

  // Copy email to clipboard
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (inquiries.length === 0) return;
    const headers = ["ID", "Name", "Email", "Subject", "Message", "Status", "Date Submitted", "Replied Date"];
    const rows = inquiries.map((i) => [
      `"${i.id}"`,
      `"${(i.name || "").replace(/"/g, '""')}"`,
      `"${(i.email || "").replace(/"/g, '""')}"`,
      `"${(i.subject || "").replace(/"/g, '""')}"`,
      `"${(i.message || "").replace(/"/g, '""')}"`,
      `"${i.status || "new"}"`,
      `"${new Date(i.createdAt).toLocaleString()}"`,
      `"${i.repliedAt ? new Date(i.repliedAt).toLocaleString() : ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contact_inquiries_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering
  const filteredInquiries = inquiries.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.subject.toLowerCase().includes(q) ||
      item.message.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "new" && (item.status === "new" || !item.status)) ||
      item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats calculation
  const totalCount = inquiries.length;
  const newCount = inquiries.filter((i) => i.status === "new" || !i.status).length;
  const repliedCount = inquiries.filter((i) => i.status === "replied").length;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCount = inquiries.filter((i) => i.createdAt >= oneWeekAgo).length;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `Today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 space-y-6">
      <SEO
        title="Contact Inquiries - Faculty Portal | AI Verse"
        description="Review and respond to inquiries submitted by public visitors on the AI Verse contact page."
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Inbox className="w-3.5 h-3.5" />
            <span>Public Inbox</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Contact Inquiries
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Review and respond to messages submitted by users through the public Contact page.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            disabled={inquiries.length === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Inquiries */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Inquiries</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalCount}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Unread / New */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Needs Response
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{newCount}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Replied */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Replied</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{repliedCount}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Past 7 Days</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{recentCount}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Area: Controls + List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Search and Filters Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by sender name, email, subject, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All Messages", count: inquiries.length },
              { id: "new", label: "Unread", count: newCount },
              { id: "read", label: "Read", count: inquiries.filter((i) => i.status === "read").length },
              { id: "replied", label: "Replied", count: repliedCount },
              { id: "archived", label: "Archived", count: inquiries.filter((i) => i.status === "archived").length }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/70"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    statusFilter === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Action Bar (if items selected) */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50/70 border-b border-blue-100 px-6 py-3 flex items-center justify-between gap-4 animate-in fade-in">
            <span className="text-xs font-bold text-blue-900">
              {selectedIds.size} message{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkMarkStatus("read")}
                className="px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 transition-colors"
              >
                Mark as Read
              </button>
              <button
                onClick={() => handleBulkMarkStatus("archived")}
                className="px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 transition-colors"
              >
                Archive
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Table / Inquiries List */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-bold text-slate-500">Loading inquiries from database...</p>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No contact messages found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchQuery
                ? `No messages matched "${searchQuery}". Try refining your search query.`
                : "Messages submitted on the public Contact page will appear here automatically."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredInquiries.length > 0 &&
                        filteredInquiries.every((i) => selectedIds.has(i.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(filteredInquiries.map((i) => i.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Sender</th>
                  <th className="px-4 py-3">Subject & Message Snippet</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInquiries.map((inquiry) => {
                  const isSelected = selectedIds.has(inquiry.id);
                  const isUnread = inquiry.status === "new" || !inquiry.status;

                  return (
                    <tr
                      key={inquiry.id}
                      onClick={() => handleOpenDetail(inquiry)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? "bg-blue-50/50 hover:bg-blue-50/80"
                          : isUnread
                          ? "bg-white font-semibold hover:bg-slate-50/80"
                          : "bg-slate-50/20 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="w-10 px-4 py-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(inquiry.id);
                            else next.delete(inquiry.id);
                            setSelectedIds(next);
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Sender Details */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isUnread
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {(inquiry.name || "A").charAt(0).toUpperCase()}
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-slate-900 font-bold text-xs flex items-center gap-1.5">
                              <span>{inquiry.name}</span>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium">
                              {inquiry.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Subject and Message snippet */}
                      <td className="px-4 py-4 max-w-xs sm:max-w-md">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-800 line-clamp-1">
                            {inquiry.subject}
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal line-clamp-1">
                            {inquiry.message}
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {inquiry.status === "replied" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                            <CheckCircle2 className="w-3 h-3" />
                            Replied
                          </span>
                        ) : inquiry.status === "archived" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">
                            <Archive className="w-3 h-3" />
                            Archived
                          </span>
                        ) : inquiry.status === "read" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-600 border border-blue-200/60">
                            <Eye className="w-3 h-3" />
                            Read
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            New
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-400 font-medium">
                        {formatDate(inquiry.createdAt)}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-4 py-4 whitespace-nowrap text-right text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenDetail(inquiry)}
                            title="View / Reply"
                            className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(inquiry.id)}
                            title="Delete"
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inquiry Detail & Reply Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                  {(selectedInquiry.name || "A").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {selectedInquiry.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                    <span>{selectedInquiry.email}</span>
                    <button
                      onClick={() => handleCopyEmail(selectedInquiry.email)}
                      title="Copy Email"
                      className="text-slate-400 hover:text-blue-600 p-0.5 transition-colors"
                    >
                      {copiedEmail ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Status Dropdown */}
                <select
                  value={selectedInquiry.status || "new"}
                  onChange={(e) =>
                    handleUpdateStatus(selectedInquiry.id, e.target.value as ContactQuery["status"])
                  }
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="replied">Replied</option>
                  <option value="archived">Archived</option>
                </select>

                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {/* Inquiry Meta & Content */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Subject
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Received: {formatDate(selectedInquiry.createdAt)}
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                  {selectedInquiry.subject}
                </h4>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/90 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedInquiry.message}
                </div>
              </div>

              {/* Prior Reply History if exists */}
              {selectedInquiry.replyMessage && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Previously Sent Reply
                    </span>
                    {selectedInquiry.repliedAt && (
                      <span className="text-[10px] text-emerald-600 font-medium">
                        {formatDate(selectedInquiry.repliedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">
                    {selectedInquiry.replyMessage}
                  </p>
                </div>
              )}

              {/* Reply Form */}
              <div className="pt-2 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                    Send Reply Email
                  </h4>
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent(
                      replySubject
                    )}`}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in Mail Client
                  </a>
                </div>

                {replySuccess ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-bold animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Reply delivered successfully to {selectedInquiry.email}!</span>
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="space-y-3">
                    {replyError && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{replyError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Reply Subject
                      </label>
                      <input
                        type="text"
                        required
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Message Body
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write your reply here. This will be formatted and emailed directly to the recipient..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white resize-none leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={sendingReply || !replyBody.trim()}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingReply ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending Email...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Reply</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => handleDelete(selectedInquiry.id)}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Inquiry</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="px-5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactInquiriesPage;
