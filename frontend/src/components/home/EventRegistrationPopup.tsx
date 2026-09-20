import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  MapPin,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { formatRoundDateRange } from "../../utils/dateFormatter";

export interface OpenEventItem {
  id: string;
  title: string;
  type: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  image?: string;
  registrationDeadline?: string;
  registrationDeadlineTime?: string;
  isPaidEvent?: boolean;
  registrationFee?: number;
  pricingType?: "per_person" | "per_team";
  currentReg?: number;
  maxReg?: number;
}

interface EventRegistrationPopupProps {
  events: OpenEventItem[];
}

const EventRegistrationPopup: React.FC<EventRegistrationPopupProps> = ({ events }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (currentIndex >= events.length) {
      setCurrentIndex(0);
    }
  }, [events.length, currentIndex]);

  if (isDismissed || !events || events.length === 0) return null;

  const currentEvent = events[currentIndex] || events[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? events.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === events.length - 1 ? 0 : prev + 1));
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDismissed(true);
  };

  const formattedDate = formatRoundDateRange(
    currentEvent.startDate || currentEvent.date,
    currentEvent.endDate
  );

  return (
    <motion.aside
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 lg:right-8 z-40 w-[calc(100%-2rem)] max-w-[420px] sm:w-[420px] text-left pointer-events-auto"
      aria-label="Live Event Registration"
    >
      <div className="relative rounded-2xl bg-white/95 backdrop-blur-xl p-4 sm:p-5 border border-blue-100/90 shadow-[0_12px_40px_rgba(15,23,42,0.16)] hover:shadow-[0_16px_48px_rgba(37,99,235,0.2)] transition-all duration-300">
        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent pointer-events-none" />

        {/* Card Header: Live Badge, Category & Controls */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600">
              Registrations Open
            </span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {currentEvent.type || currentEvent.category || "Event"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {events.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-lg px-1.5 py-0.5">
                <button
                  onClick={handlePrev}
                  type="button"
                  className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                  title="Previous event"
                  aria-label="Previous event"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  {currentIndex + 1}/{events.length}
                </span>
                <button
                  onClick={handleNext}
                  type="button"
                  className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                  title="Next event"
                  aria-label="Next event"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close card"
              aria-label="Close card"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Event Body Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentEvent.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="pt-3 space-y-3"
          >
            {/* Title & Fee */}
            <div className="flex items-start justify-between gap-3">
              <Link
                to={`/events/${currentEvent.id}`}
                className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug tracking-tight hover:text-blue-600 transition-colors line-clamp-1"
                title={currentEvent.title}
              >
                {currentEvent.title}
              </Link>
              <span className="shrink-0 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                {currentEvent.isPaidEvent && currentEvent.registrationFee && currentEvent.registrationFee > 0
                  ? `₹${currentEvent.registrationFee}`
                  : "Free"}
              </span>
            </div>

            {/* Date & Location Chips */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 font-medium">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="font-semibold text-slate-700">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="truncate max-w-[190px] text-slate-600">
                  {currentEvent.location || "Campus Hub"}
                </span>
              </div>
            </div>

            {/* Actions: Register Now & View Details */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                to={`/events/${currentEvent.id}/register`}
                className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs hover:shadow-md hover:scale-[1.02] transition-all group"
              >
                <span>Register Now</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                to={`/events/${currentEvent.id}`}
                className="w-full flex items-center justify-center px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                View Details
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};

export default EventRegistrationPopup;
