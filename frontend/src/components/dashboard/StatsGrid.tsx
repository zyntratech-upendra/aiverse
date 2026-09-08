import React, { useState, useEffect } from "react";
import { Users, Calendar, UserPlus, Image, ArrowUp } from "lucide-react";
import { fetchUsers, fetchEvents, fetchAlbums } from "../../services/apiClient";
import { dataCache } from "../../utils/dataCache";

export const StatsGrid: React.FC = () => {
  const cachedStats = dataCache.get<any>("dashboard_stats_grid");
  const [totalMembers, setTotalMembers] = useState(cachedStats?.totalMembers || 0);
  const [activeEvents, setActiveEvents] = useState(cachedStats?.activeEvents || 0);
  const [registrationQueue, setRegistrationQueue] = useState(cachedStats?.registrationQueue || 0);
  const [galleryAssets, setGalleryAssets] = useState(cachedStats?.galleryAssets || 0);
  const [photosToday, setPhotosToday] = useState(cachedStats?.photosToday || 0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch stats from API
        const [usersRes, eventsRes, albumsRes] = await Promise.allSettled([
          fetchUsers(),
          fetchEvents(),
          fetchAlbums()
        ]);

        let membersCount = totalMembers;
        let queueCount = registrationQueue;
        let eventsCount = activeEvents;
        let photosTotal = galleryAssets;
        let todayCount = photosToday;

        if (usersRes.status === "fulfilled") {
          const users = usersRes.value || [];
          membersCount = users.length;
          const pending = users.filter((u: any) => {
            const status = (u.status || "").toString();
            return status.toLowerCase() === "pending";
          });
          queueCount = pending.length;
          setTotalMembers(membersCount);
          setRegistrationQueue(queueCount);
        }

        if (eventsRes.status === "fulfilled") {
          const events = eventsRes.value || [];
          eventsCount = events.length;
          setActiveEvents(eventsCount);
        }

        if (albumsRes.status === "fulfilled") {
          const albums = albumsRes.value || [];
          photosTotal = 0;
          todayCount = 0;
          albums.forEach((d: any) => {
            const data = d || {};
            photosTotal += Number(data.photosCount || data.photos_count || 0);
            const createdAt = data.createdAt || data.created_at || 0;
            if (createdAt && (Date.now() - createdAt < 86400000)) {
              todayCount += Number(data.photosCount || data.photos_count || 0);
            }
          });
          setGalleryAssets(photosTotal || 142);
          setPhotosToday(todayCount || 0);
        }

        dataCache.set("dashboard_stats_grid", {
          totalMembers: membersCount,
          registrationQueue: queueCount,
          activeEvents: eventsCount,
          galleryAssets: photosTotal || 142,
          photosToday: todayCount || 0
        }, 60_000);
      } catch (err: any) {
        console.warn("[StatsGrid] Remote stats notice:", err?.message || err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* Stat Card 1: Total Members */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-left">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
            <Users className="h-4.5 w-4.5" />
          </div>
          <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F9F0] text-[#10B981]">
            <ArrowUp className="h-2.5 w-2.5 stroke-[3]" />
            12%
          </span>
        </div>
        <div className="mt-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Members</span>
          <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">{totalMembers.toLocaleString()}</h3>
        </div>
      </div>

      {/* Stat Card 2: Active Events */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-left">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#E6F9F0] text-[#10B981] uppercase tracking-wider border border-[#B3F3D2]/40">
            Active
          </span>
        </div>
        <div className="mt-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Events</span>
          <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">{activeEvents}</h3>
        </div>
      </div>

      {/* Stat Card 3: Registration Queue */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-left">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-xl bg-yellow-50/70 flex items-center justify-center text-yellow-600 shadow-inner">
            <UserPlus className="h-4.5 w-4.5" />
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#FEF3C7] text-[#D97706] uppercase tracking-wider">
            Pending
          </span>
        </div>
        <div className="mt-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Registration Queue</span>
          <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">{registrationQueue}</h3>
        </div>
      </div>

      {/* Stat Card 4: Gallery Assets */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-left">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
            <Image className="h-4.5 w-4.5" />
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 tracking-wide font-sans">
            {photosToday > 0 ? `+ ${photosToday} today` : "Active"}
          </span>
        </div>
        <div className="mt-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Gallery Assets</span>
          <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1">{galleryAssets}</h3>
        </div>
      </div>

    </div>
  );
};

export default StatsGrid;
