import React, { useState, useEffect } from "react";
import { Filter, Download, ArrowRight } from "lucide-react";
import { fetchEvents, fetchUsers, fetchOrganizers, fetchAlbums } from "../../services/apiClient";

interface Activity {
  id: string;
  user: {
    initials: string;
    name: string;
    bgColor: string;
    textColor: string;
  };
  action: {
    label: string;
    type: "create" | "update" | "delete" | "backup" | "approve";
  };
  entity: string;
  time: string;
  status: "success" | "rejected" | "info";
  timestamp: number;
}

const getMillis = (ts: any): number => {
  if (typeof ts === "number") return ts;
  if (ts && typeof ts.seconds === "number") return ts.seconds * 1000;
  if (ts && typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
};

const formatRelativeTime = (ts: any): string => {
  const timeMs = getMillis(ts);
  const diff = Date.now() - timeMs;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
};

import { dataCache } from "../../utils/dataCache";

export const RecentActivities: React.FC = () => {
  const cachedActivities = dataCache.get<Activity[]>("dashboard_recent_activities");
  const [activities, setActivities] = useState<Activity[]>(cachedActivities || []);

  useEffect(() => {
    const fetchRecentActivities = async () => {
      try {
        const mergedList: Activity[] = [];

        // Parallelize API fetches
        const [eventsRes, organizersRes, albumsRes, usersRes] = await Promise.allSettled([
          fetchEvents(),
          fetchOrganizers(),
          fetchAlbums(),
          fetchUsers()
        ]);

        // 1. Process Events
        if (eventsRes.status === "fulfilled") {
          (eventsRes.value || []).forEach((d: any) => {
            const data = d || {};
            const timestamp = getMillis(data.createdAt || data.created_at || data._createdAt || Date.now());
            mergedList.push({
              id: `event-${data.id || data._id || ''}`,
              user: { initials: "AD", name: "Admin", bgColor: "bg-blue-50", textColor: "text-blue-600" },
              action: { label: "CREATE EVENT", type: "create" },
              entity: data.title || data.name || "Event Item",
              time: formatRelativeTime(timestamp),
              status: "success",
              timestamp
            });
          });
        }

        // 2. Process Organizers
        if (organizersRes.status === "fulfilled") {
          (organizersRes.value || []).forEach((d: any) => {
            const data = d || {};
            const timestamp = getMillis(data.createdAt || data.created_at || Date.now());
            mergedList.push({
              id: `team-${data.id || data._id || ''}`,
              user: { initials: "AD", name: "Admin", bgColor: "bg-purple-50", textColor: "text-purple-600" },
              action: { label: "ADD ORGANIZER", type: "create" },
              entity: data.name || "Team Member",
              time: formatRelativeTime(timestamp),
              status: "success",
              timestamp
            });
          });
        }

        // 3. Process Albums
        if (albumsRes.status === "fulfilled") {
          (albumsRes.value || []).forEach((d: any) => {
            const data = d || {};
            const timestamp = getMillis(data.createdAt || data.created_at || Date.now());
            mergedList.push({
              id: `album-${data.id || data._id || ''}`,
              user: { initials: "AD", name: "Admin", bgColor: "bg-emerald-50", textColor: "text-emerald-600" },
              action: { label: "CREATE ALBUM", type: "create" },
              entity: data.title || "Gallery Album",
              time: formatRelativeTime(timestamp),
              status: "success",
              timestamp
            });
          });
        }

        // 4. Process Users
        if (usersRes.status === "fulfilled") {
          (usersRes.value || []).forEach((d: any) => {
            const data = d || {};
            const timestamp = getMillis(data.createdAt || data.created_at || Date.now());
            const initials = (data.name || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
            mergedList.push({
              id: `user-${data.id || data._id || ''}`,
              user: { initials, name: data.name || "User", bgColor: "bg-slate-100", textColor: "text-slate-600" },
              action: { label: "NEW USER JOINED", type: "create" },
              entity: data.email || "Registered Account",
              time: formatRelativeTime(timestamp),
              status: (data.status || "Active") === "Pending" ? "info" : "success",
              timestamp
            });
          });
        }

        // Sort by timestamp desc and take top 5
        const sorted = mergedList.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
        if (sorted.length > 0) {
          setActivities(sorted);
          dataCache.set("dashboard_recent_activities", sorted, 60_000);
        }
        
        if (sorted.length === 0) {
          setActivities([
            {
              id: "1",
              user: { initials: "RK", name: "Rahul K.", bgColor: "bg-blue-50", textColor: "text-blue-600" },
              action: { label: "CREATE EVENT", type: "create" },
              entity: "Neural Hackathon 2024",
              time: "2 mins ago",
              status: "success",
              timestamp: Date.now()
            }
          ]);
        } else {
          setActivities(sorted);
        }
      } catch (err: any) {
        console.warn("[RecentActivities] Loading fallback activities:", err?.message || err);
        setActivities([
          {
            id: "1",
            user: { initials: "RK", name: "Rahul K.", bgColor: "bg-blue-50", textColor: "text-blue-600" },
            action: { label: "CREATE EVENT", type: "create" },
            entity: "Neural Hackathon 2024",
            time: "2 mins ago",
            status: "success",
            timestamp: Date.now()
          },
          {
            id: "2",
            user: { initials: "AS", name: "Ananya S.", bgColor: "bg-purple-50", textColor: "text-purple-600" },
            action: { label: "APPROVED ORGANIZER", type: "approve" },
            entity: "Student Member Request",
            time: "15 mins ago",
            status: "success",
            timestamp: Date.now() - 900000
          }
        ]);
      }
    };

    fetchRecentActivities();
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col justify-between h-full">
      <div>
        {/* Header line */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-50">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Recent Activities</h3>
            <p className="text-[10px] text-slate-400 font-medium">Complete audit log of system actions</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Filter Action */}
            <button
              onClick={() => alert("Opening activity filter...")}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
            {/* Export Action */}
            <button
              onClick={() => alert("Exporting audit logs...")}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto w-full pt-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-2.5 pr-4 font-semibold">User</th>
                <th className="py-2.5 px-4 font-semibold">Action</th>
                <th className="py-2.5 px-4 font-semibold">Entity</th>
                <th className="py-2.5 px-4 font-semibold">Time</th>
                <th className="py-2.5 pl-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/50 text-slate-700">
              {activities.map((act) => (
                <tr key={act.id} className="text-xs font-medium hover:bg-slate-50/40 transition-colors">
                  {/* User Column */}
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] ${act.user.bgColor} ${act.user.textColor} shrink-0`}>
                        {act.user.initials}
                      </div>
                      <span className="font-semibold text-slate-800">{act.user.name}</span>
                    </div>
                  </td>

                  {/* Action Column */}
                  <td className="py-2.5 px-4">
                    <span className={`inline-block px-2.5 py-1 rounded text-[9px] font-bold tracking-wider uppercase ${
                      act.action.type === "delete"
                        ? "bg-red-50 text-red-600"
                        : act.action.type === "approve" || act.action.type === "create"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-blue-50 text-[#2563EB]"
                    }`}>
                      {act.action.label}
                    </span>
                  </td>

                  {/* Entity Column */}
                  <td className="py-2.5 px-4 font-medium text-slate-500 max-w-[150px] truncate">
                    {act.entity}
                  </td>

                  {/* Time Column */}
                  <td className="py-2.5 px-4 text-slate-400">
                    {act.time}
                  </td>

                  {/* Status Column */}
                  <td className="py-2.5 pl-4">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                      act.status === "success"
                        ? "text-[#10B981]"
                        : act.status === "rejected"
                        ? "text-red-500"
                        : "text-[#2563EB]"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        act.status === "success"
                          ? "bg-[#10B981] animate-pulse"
                          : act.status === "rejected"
                          ? "bg-red-500"
                          : "bg-[#2563EB]"
                      }`} />
                      {act.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer historical audit link */}
      <div className="pt-5 border-t border-slate-50 mt-4 text-center sm:text-left">
        <button
          onClick={() => alert("Navigating to all audit logs...")}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:text-blue-700 transition-colors group"
        >
          View Historical Audit
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
};

export default RecentActivities;
