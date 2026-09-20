import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  X,
  Flame,
  ChevronLeft,
  ChevronRight,
  Ticket,
  Users,
  CheckCircle2
} from "lucide-react";
import Button from "../ui/Button";
import { formatEventDateRange } from "../../utils/dateFormatter";

// Fallback images
import sparkImg from "../../assets/images/spark.png";
import hackathonImg from "../../assets/images/hackathon.png";
import seminarImg from "../../assets/images/seminar.png";

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
  image: string;
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
  isOpen: boolean;
  onClose: () => void;
}

const EventRegistrationPopup: React.FC<EventRegistrationPopupProps> = ({
  events,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index if events array changes
  useEffect(() => {
    if (currentIndex >= events.length) {
      setCurrentIndex(0);
    }
  }, [events.length, currentIndex]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !events || events.length === 0) return null;

  const currentEvent = events[currentIndex] || events[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? events.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === events.length - 1 ? 0 : prev + 1));
  };

  const formattedDates = formatEventDateRange(
    currentEvent.startDate || currentEvent.date,
    currentEvent.endDate
  );

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative w-full max-w-lg bg-white rounded-3xl sm:rounded-[32px] shadow-[0_25px_60px_-15px_rgba(37,99,235,0.35)] border border-blue-100 overflow-hidden text-left z-10 my-auto"
        >
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-400/20 via-indigo-300/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-sky-400/15 via-blue-300/10 to-transparent rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

          {/* Top Banner Header */}
          <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-6 pt-5 pb-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-inner text-amber-300 animate-pulse">
                <Flame className="h-5 w-5 fill-amber-300" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-300/30">
                    Live Now
                  </span>
                  <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">
                    Registrations Open
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                  Don't Miss Out on the Action!
                </h3>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              type="button"
              className="rounded-full p-2 text-white/80 hover:text-white hover:bg-white/20 transition-all focus:outline-hidden cursor-pointer"
              title="Close modal"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {/* Multiple Events Navigator (if > 1) */}
            {events.length > 1 && (
              <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 rounded-xl px-3 py-1.5 text-xs text-blue-800 font-semibold">
                <span>
                  Showing Open Event {currentIndex + 1} of {events.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrev}
                    type="button"
                    className="p-1 rounded-md bg-white hover:bg-blue-100 text-blue-700 shadow-xs border border-blue-200 transition-colors cursor-pointer"
                    title="Previous event"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleNext}
                    type="button"
                    className="p-1 rounded-md bg-white hover:bg-blue-100 text-blue-700 shadow-xs border border-blue-200 transition-colors cursor-pointer"
                    title="Next event"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Event Showcase Card */}
            <div className="group relative rounded-2xl bg-gradient-to-b from-slate-50 to-blue-50/30 border border-slate-200/80 p-4 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* Event Thumbnail */}
                <div className="relative w-full sm:w-28 h-32 sm:h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60 shadow-inner">
                  <img
                    src={currentEvent.image || sparkImg}
                    alt={currentEvent.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.src = sparkImg;
                    }}
                  />
                  <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider bg-blue-600/90 backdrop-blur-xs text-white px-2 py-0.5 rounded shadow-sm">
                    {currentEvent.type || currentEvent.category || "Event"}
                  </span>
                </div>

                {/* Event Summary */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Registration Open
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {currentEvent.isPaidEvent && currentEvent.registrationFee && currentEvent.registrationFee > 0
                        ? `₹${currentEvent.registrationFee} ${currentEvent.pricingType === "per_team" ? "/ team" : "/ person"}`
                        : "Free"}
                    </span>
                  </div>

                  <h4 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug line-clamp-2">
                    {currentEvent.title}
                  </h4>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
                    {currentEvent.description || "Join us for an exciting technology hackathon and workshop series organized by AI Verse."}
                  </p>
                </div>
              </div>

              {/* Event Metadata Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-xs">
                  <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="truncate">{formattedDates}</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-xs">
                  <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                  <span className="truncate">{currentEvent.location || "Campus Hub / Offline"}</span>
                </div>
              </div>

              {/* Registration Deadline Alert (if specified) */}
              {currentEvent.registrationDeadline && (
                <div className="flex items-center gap-2 bg-amber-50/90 border border-amber-200/70 rounded-xl px-3 py-2 text-xs font-bold text-amber-800">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0 animate-pulse" />
                  <span className="truncate">
                    Registration Deadline: {currentEvent.registrationDeadline}
                    {currentEvent.registrationDeadlineTime ? ` at ${currentEvent.registrationDeadlineTime}` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to={`/events/${currentEvent.id}/register`}
                  onClick={onClose}
                  className="w-full"
                >
                  <Button
                    variant="gradient"
                    className="w-full justify-center rounded-2xl py-3 text-sm font-bold shadow-button hover:shadow-lg hover:scale-102 transition-all group"
                  >
                    <span>Register Now</span>
                    <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>

                <Link
                  to={`/events/${currentEvent.id}`}
                  onClick={onClose}
                  className="w-full"
                >
                  <Button
                    variant="secondary"
                    className="w-full justify-center rounded-2xl py-3 text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                  >
                    View Details
                  </Button>
                </Link>
              </div>

              {/* Dismiss / Browse All Events Footer */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 px-1">
                <Link
                  to="/events"
                  onClick={onClose}
                  className="font-semibold text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1"
                >
                  <span>Explore all events</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 font-medium transition-colors cursor-pointer"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default EventRegistrationPopup;
