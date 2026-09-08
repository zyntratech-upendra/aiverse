import React, { useState, useRef, useEffect } from "react";
import { Clock, X, Check } from "lucide-react";

interface TimePickerProps {
  value: string; // "HH:MM" 24h format or "hh:mm AM/PM"
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  placeholder = "Select time...",
  className = "",
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"hours" | "minutes">("hours");
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse time into 12-hour components: hour (1-12), minute (0-59), period ("AM" | "PM")
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour: 9, minute: 0, period: "AM" as const };
    
    // Check if format is "hh:mm AM/PM" or "HH:MM"
    if (timeStr.includes("AM") || timeStr.includes("PM")) {
      const parts = timeStr.trim().split(" ");
      const period = parts[1]?.toUpperCase() === "PM" ? ("PM" as const) : ("AM" as const);
      const [h, m] = (parts[0] || "09:00").split(":").map(Number);
      return { hour: h || 12, minute: m || 0, period };
    } else if (timeStr.includes(":")) {
      const [h24, m] = timeStr.split(":").map(Number);
      let period: "AM" | "PM" = "AM";
      let hour = h24 || 0;
      if (hour >= 12) {
        period = "PM";
        if (hour > 12) hour -= 12;
      }
      if (hour === 0) hour = 12;
      return { hour, minute: m || 0, period };
    }
    return { hour: 9, minute: 0, period: "AM" as const };
  };

  const parsed = parseTime(value);
  const [selectedHour, setSelectedHour] = useState<number>(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState<number>(parsed.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);

  useEffect(() => {
    if (value) {
      const p = parseTime(value);
      setSelectedHour(p.hour);
      setSelectedMinute(p.minute);
      setPeriod(p.period);
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

  const emitChange = (h: number, m: number, p: "AM" | "PM") => {
    const formattedHour = String(h).padStart(2, "0");
    const formattedMinute = String(m).padStart(2, "0");
    // Emit "hh:mm AM/PM" format
    onChange(`${formattedHour}:${formattedMinute} ${p}`);
  };

  const handleHourSelect = (h: number) => {
    setSelectedHour(h);
    emitChange(h, selectedMinute, period);
    setMode("minutes"); // Switch to minutes selection after picking hour
  };

  const handleMinuteSelect = (m: number) => {
    setSelectedMinute(m);
    emitChange(selectedHour, m, period);
  };

  const handlePeriodToggle = (newPeriod: "AM" | "PM") => {
    setPeriod(newPeriod);
    emitChange(selectedHour, selectedMinute, newPeriod);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const handleNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const p: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;

    setSelectedHour(h);
    setSelectedMinute(m);
    setPeriod(p);
    emitChange(h, m, p);
    setIsOpen(false);
  };

  // Clock Dial Geometry
  const RADIUS = 76; // Radius in px for clock numbers position

  const getPositionStyle = (index: number, total: number = 12) => {
    const angleDeg = index * (360 / total) - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = Math.round(RADIUS * Math.cos(angleRad));
    const y = Math.round(RADIUS * Math.sin(angleRad));
    return {
      transform: `translate(${x}px, ${y}px)`
    };
  };

  // Calculate clock hand angle
  const getHandAngle = () => {
    if (mode === "hours") {
      return (selectedHour % 12) * 30; // 360 / 12 = 30 deg per hour
    } else {
      return selectedMinute * 6; // 360 / 60 = 6 deg per minute
    }
  };

  const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Time Input Trigger Button */}
      <div
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-slate-200 rounded-2xl flex items-center justify-between bg-slate-50/30 hover:bg-white focus-within:bg-white transition-all cursor-pointer select-none group ${
          isOpen ? "border-[#2563EB] ring-2 ring-[#2563EB]/15 bg-white shadow-md shadow-blue-500/5" : ""
        } ${className}`}
      >
        <span className={`font-medium text-sm ${value ? "text-slate-800 font-semibold" : "text-slate-400"}`}>
          {value || placeholder}
        </span>

        <div className="flex items-center gap-1 text-slate-400 group-hover:text-[#2563EB] transition-colors">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors mr-0.5"
              title="Clear time"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="w-7 h-7 rounded-xl bg-blue-50/60 flex items-center justify-center text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white transition-all">
            <Clock className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Popover Clock Selector Modal */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-3xl border border-slate-100 shadow-[0_15px_40px_rgba(37,99,235,0.14)] p-4 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center select-none">
          {/* Header Time Display & AM/PM Toggle */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode("hours")}
                className={`text-2xl font-extrabold px-2.5 py-1 rounded-2xl transition-all ${
                  mode === "hours"
                    ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/25 scale-105"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {String(selectedHour).padStart(2, "0")}
              </button>

              <span className="text-xl font-extrabold text-slate-400 animate-pulse">:</span>

              <button
                type="button"
                onClick={() => setMode("minutes")}
                className={`text-2xl font-extrabold px-2.5 py-1 rounded-2xl transition-all ${
                  mode === "minutes"
                    ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/25 scale-105"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {String(selectedMinute).padStart(2, "0")}
              </button>
            </div>

            {/* AM / PM Segmented Control */}
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 border border-slate-200/50">
              <button
                type="button"
                onClick={() => handlePeriodToggle("AM")}
                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all ${
                  period === "AM"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handlePeriodToggle("PM")}
                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all ${
                  period === "PM"
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Mode Sub-label */}
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Select {mode === "hours" ? "Hour" : "Minute"}
          </div>

          {/* Circular Analog Clock Face */}
          <div className="relative w-52 h-52 rounded-full border border-slate-100 bg-slate-50/60 shadow-inner mx-auto flex items-center justify-center">
            {/* Center Pivot Point */}
            <div className="absolute top-1/2 left-1/2 w-3.5 h-3.5 rounded-full bg-[#2563EB] z-30 shadow-md shadow-blue-600/30 -ml-[7px] -mt-[7px]" />

            {/* Clock Hand Pointer Line & Tip Badge */}
            <div
              className="absolute top-1/2 left-1/2 w-0.5 bg-[#2563EB] origin-bottom transition-all duration-200 z-10 -ml-[1px]"
              style={{
                height: "76px",
                marginTop: "-76px",
                transform: `rotate(${getHandAngle()}deg)`
              }}
            >
              {/* Hand Tip Circle Endpoint */}
              <div className="w-8 h-8 rounded-full bg-[#2563EB] -ml-[15px] -mt-[16px] shadow-md shadow-blue-500/40 flex items-center justify-center" />
            </div>

            {/* Clock Numbers Placement */}
            {mode === "hours"
              ? HOURS.map((h, i) => {
                  const isSelected = selectedHour === h;
                  return (
                    <button
                      key={`hour-${h}`}
                      type="button"
                      onClick={() => handleHourSelect(h)}
                      style={getPositionStyle(i, 12)}
                      className={`absolute w-8 h-8 rounded-full text-xs font-extrabold flex items-center justify-center transition-all z-20 ${
                        isSelected
                          ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/35 scale-110"
                          : "text-slate-700 hover:bg-blue-100 hover:text-[#2563EB]"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })
              : MINUTES.map((m, i) => {
                  const isSelected = selectedMinute === m;
                  return (
                    <button
                      key={`minute-${m}`}
                      type="button"
                      onClick={() => handleMinuteSelect(m)}
                      style={getPositionStyle(i, 12)}
                      className={`absolute w-8 h-8 rounded-full text-xs font-extrabold flex items-center justify-center transition-all z-20 ${
                        isSelected
                          ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/35 scale-110"
                          : "text-slate-700 hover:bg-blue-100 hover:text-[#2563EB]"
                      }`}
                    >
                      {String(m).padStart(2, "0")}
                    </button>
                  );
                })}
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {["09:00 AM", "10:30 AM", "02:00 PM", "05:00 PM"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onChange(preset);
                  const p = parseTime(preset);
                  setSelectedHour(p.hour);
                  setSelectedMinute(p.minute);
                  setPeriod(p.period);
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-[#2563EB] text-[10px] font-bold text-slate-600 rounded-lg transition-all"
              >
                {preset.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleNow}
              className="text-xs font-bold text-[#2563EB] hover:underline"
            >
              Current Time
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              Set Time
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePicker;
