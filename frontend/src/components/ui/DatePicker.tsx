import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD format or display format
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "Select date...",
  className = "",
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial date or default to current date
  const parseDate = (valStr: string): Date => {
    if (!valStr) return new Date();
    const parsed = new Date(valStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const currentDateObj = parseDate(value);
  const [viewYear, setViewYear] = useState<number>(currentDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(currentDateObj.getMonth());

  // Update view when value changes
  useEffect(() => {
    if (value) {
      const d = parseDate(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateString = `${viewYear}-${formattedMonth}-${formattedDay}`;
    onChange(dateString);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const formattedMonth = String(today.getMonth() + 1).padStart(2, "0");
    const formattedDay = String(today.getDate()).padStart(2, "0");
    const dateString = `${today.getFullYear()}-${formattedMonth}-${formattedDay}`;
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(dateString);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  // Days in month calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Helper to format display date (e.g., 15-Aug-2026)
  const formatDisplay = (valStr: string) => {
    if (!valStr) return "";
    const d = new Date(valStr);
    if (isNaN(d.getTime())) return valStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = MONTH_NAMES[d.getMonth()].slice(0, 3);
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const todayObj = new Date();
  const isToday = (day: number) => 
    todayObj.getFullYear() === viewYear &&
    todayObj.getMonth() === viewMonth &&
    todayObj.getDate() === day;

  const isSelected = (day: number) => {
    if (!value) return false;
    const valD = new Date(value);
    return (
      !isNaN(valD.getTime()) &&
      valD.getFullYear() === viewYear &&
      valD.getMonth() === viewMonth &&
      valD.getDate() === day
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Date Input Button */}
      <div
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-slate-200 rounded-2xl flex items-center justify-between bg-slate-50/30 hover:bg-white focus-within:bg-white transition-all cursor-pointer select-none group ${
          isOpen ? "border-[#2563EB] ring-2 ring-[#2563EB]/15 bg-white shadow-md shadow-blue-500/5" : ""
        } ${className}`}
      >
        <span className={`font-medium text-sm ${value ? "text-slate-800 font-semibold" : "text-slate-400"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>

        <div className="flex items-center gap-1 text-slate-400 group-hover:text-[#2563EB] transition-colors">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors mr-0.5"
              title="Clear date"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="w-7 h-7 rounded-xl bg-blue-50/60 flex items-center justify-center text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white transition-all">
            <CalendarIcon className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Popover Calendar Modal */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-3xl border border-slate-100 shadow-[0_15px_40px_rgba(37,99,235,0.14)] p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150 text-left">
          {/* Calendar Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-slate-800 tracking-tight">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-blue-50 text-slate-500 hover:text-[#2563EB] transition-all"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl hover:bg-blue-50 text-slate-500 hover:text-[#2563EB] transition-all"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center">
            {DAYS_OF_WEEK.map((d, i) => (
              <span key={i} className="text-[11px] font-bold text-slate-400 uppercase py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank cells for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-8 w-8" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const selected = isSelected(dayNum);
              const today = isToday(dayNum);

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-8 w-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all mx-auto ${
                    selected
                      ? "bg-gradient-to-r from-[#2563EB] to-indigo-600 text-white font-extrabold shadow-md shadow-blue-500/30 scale-105"
                      : today
                      ? "border border-[#2563EB] text-[#2563EB] font-bold bg-blue-50/50 hover:bg-[#2563EB] hover:text-white"
                      : "text-slate-700 hover:bg-blue-50 hover:text-[#2563EB]"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={handleSelectToday}
              className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-bold text-[11px] rounded-xl transition-all"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
