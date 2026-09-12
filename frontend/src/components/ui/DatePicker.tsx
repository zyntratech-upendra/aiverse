import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD format or display format
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  minDate?: string;
  maxDate?: string;
  align?: "left" | "right";
  disabled?: boolean;
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
  id,
  minDate,
  maxDate,
  align = "left",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial date or default to current date
  const parseDate = (valStr: string): Date => {
    if (!valStr) return new Date();
    // Handle YYYY-MM-DD without UTC timezone drift
    if (/^\d{4}-\d{2}-\d{2}$/.test(valStr)) {
      const [y, m, d] = valStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
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

  const isDayDisabled = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateString = `${viewYear}-${formattedMonth}-${formattedDay}`;

    if (minDate && dateString < minDate) return true;
    if (maxDate && dateString > maxDate) return true;
    return false;
  };

  const handleSelectDay = (day: number) => {
    if (isDayDisabled(day)) return;
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
    
    if (minDate && dateString < minDate) return;
    if (maxDate && dateString > maxDate) return;

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

  // Helper to format display date (e.g., 11-Sep-2026 or 11 Sep 2026)
  const formatDisplay = (valStr: string) => {
    if (!valStr) return "";
    const d = parseDate(valStr);
    if (isNaN(d.getTime())) return valStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = MONTH_NAMES[d.getMonth()].slice(0, 3);
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const todayObj = new Date();
  const isToday = (day: number) => 
    todayObj.getFullYear() === viewYear &&
    todayObj.getMonth() === viewMonth &&
    todayObj.getDate() === day;

  const isSelected = (day: number) => {
    if (!value) return false;
    const valD = parseDate(value);
    return (
      !isNaN(valD.getTime()) &&
      valD.getFullYear() === viewYear &&
      valD.getMonth() === viewMonth &&
      valD.getDate() === day
    );
  };

  // Year options for dropdown: 5 years past to 10 years ahead
  const currentYearNow = new Date().getFullYear();
  const yearOptions = Array.from({ length: 15 }, (_, i) => currentYearNow - 2 + i);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Date Input Button */}
      <div
        id={id}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`w-full px-3 py-2 border border-slate-200 rounded-xl flex items-center justify-between bg-white hover:border-blue-400 focus-within:border-blue-500 transition-all cursor-pointer select-none group text-xs ${
          disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : ""
        } ${
          isOpen ? "border-[#2563EB] ring-2 ring-[#2563EB]/20 bg-white shadow-sm shadow-blue-500/10" : ""
        } ${className}`}
      >
        <span className={`font-bold ${value ? "text-slate-800" : "text-slate-400"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>

        <div className="flex items-center gap-1 text-slate-400 group-hover:text-[#2563EB] transition-colors">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-red-500 transition-colors mr-0.5"
              title="Clear date"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white transition-all">
            <CalendarIcon className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      {/* Popover Calendar Modal */}
      {isOpen && (
        <div 
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-2 z-[100] w-72 bg-white rounded-2xl border border-slate-200/90 shadow-[0_15px_35px_rgba(37,99,235,0.18)] p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150 text-left`}
        >
          {/* Calendar Header with Selectors & Arrows */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-[#2563EB] transition-all"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-[#2563EB] transition-all"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center">
            {DAYS_OF_WEEK.map((d, i) => (
              <span key={i} className="text-[10px] font-black text-slate-400 uppercase py-0.5">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank cells for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-7 w-7" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const selected = isSelected(dayNum);
              const today = isToday(dayNum);
              const disabledDay = isDayDisabled(dayNum);

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-7 w-7 rounded-lg text-xs flex items-center justify-center transition-all mx-auto ${
                    disabledDay
                      ? "text-slate-300 cursor-not-allowed bg-slate-50/50"
                      : selected
                      ? "bg-gradient-to-r from-[#2563EB] to-indigo-600 text-white font-black shadow-md shadow-blue-500/30 scale-105"
                      : today
                      ? "border border-[#2563EB] text-[#2563EB] font-bold bg-blue-50/60 hover:bg-[#2563EB] hover:text-white"
                      : "text-slate-700 font-semibold hover:bg-blue-50 hover:text-[#2563EB]"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
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
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-bold text-[11px] rounded-lg transition-all shadow-2xs"
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
