import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export const GrowthAnalytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "activity">("overview");

  // X-axis coordinate mappings for the labels
  const dataPoints = [
    { label: "MON", x: 60 },
    { label: "TUE", x: 135 },
    { label: "WED", x: 210 },
    { label: "THU", x: 285 },
    { label: "FRI", x: 360 },
    { label: "SAT", x: 435 },
    { label: "SUN", x: 510 },
    { label: "MON", x: 585 },
    { label: "TUE", x: 660 },
    { label: "WED", x: 740 }
  ];

  // Curve definition
  // Line path (stroke)
  const linePath = "M 60 180 Q 97 170 135 140 T 210 135 T 285 155 T 360 110 T 435 85 T 510 115 T 585 70 T 660 65 T 740 30";
  // Closed fill path (area)
  const areaPath = `${linePath} L 740 200 L 60 200 Z`;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col justify-between">
      
      {/* Header controls row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Member Growth Analytics</h3>
          <p className="text-[10px] text-slate-400 font-medium">Engagement and registration trends</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Tabs switch */}
          <div className="bg-slate-100/70 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 select-none
                ${activeTab === "overview" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 select-none
                ${activeTab === "activity" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"}`}
            >
              Activity
            </button>
          </div>

          {/* Timeframe dropdown */}
          <button
            onClick={() => alert("Selecting analytics range...")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all select-none shadow-sm"
          >
            Last 30 Days
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* SVG Growth Chart Container */}
      <div className="w-full relative min-h-[220px] flex items-center justify-center pt-2">
        <svg 
          viewBox="0 0 800 240" 
          width="100%" 
          height="100%" 
          className="overflow-visible"
        >
          <defs>
            {/* Area gradient */}
            <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          <line x1="50" y1="30" x2="750" y2="30" stroke="#F1F5F9" strokeWidth="1" />
          <line x1="50" y1="80" x2="750" y2="80" stroke="#F1F5F9" strokeWidth="1" />
          <line x1="50" y1="130" x2="750" y2="130" stroke="#F1F5F9" strokeWidth="1" />
          <line x1="50" y1="180" x2="750" y2="180" stroke="#F1F5F9" strokeWidth="1" />
          <line x1="50" y1="200" x2="750" y2="200" stroke="#E2E8F0" strokeWidth="1.5" />

          {/* Area spline fill */}
          <path d={areaPath} fill="url(#growthGradient)" />

          {/* Area spline stroke line */}
          <path 
            d={linePath} 
            stroke="#2563EB" 
            strokeWidth="3.5" 
            fill="none" 
            strokeLinecap="round"
            className="drop-shadow-[0_4px_10px_rgba(37,99,235,0.18)]"
          />

          {/* Interaction Ticks / Dots on line */}
          <circle cx="740" cy="30" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" className="shadow-sm" />
          
          {/* Label elements along X-axis */}
          {dataPoints.map((dp, idx) => (
            <g key={idx}>
              {/* Very subtle vertical ticks */}
              <line x1={dp.x} y1="200" x2={dp.x} y2="205" stroke="#94A3B8" strokeWidth="1.5" />
              {/* Labels text */}
              <text 
                x={dp.x} 
                y="226" 
                textAnchor="middle" 
                className="text-[10px] font-bold text-slate-400 font-sans tracking-wide fill-current"
              >
                {dp.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

    </div>
  );
};

export default GrowthAnalytics;
