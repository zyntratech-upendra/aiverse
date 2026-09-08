import React from "react";

interface LoaderProps {
  variant?: "spinner" | "skeleton" | "card" | "shimmer";
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  variant = "spinner",
  className = "",
}) => {
  if (variant === "spinner") {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg className="animate-spin h-8 w-8 text-aether-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`bg-white border border-slate-100 rounded-card p-6 space-y-4 animate-pulse ${className}`}>
        <div className="h-48 bg-slate-100 rounded-xl w-full"></div>
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="h-6 bg-slate-200 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-slate-150 rounded w-full"></div>
          <div className="h-3 bg-slate-150 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  // Generic text list skeleton
  return (
    <div className={`space-y-4 animate-pulse ${className}`}>
      <div className="h-6 bg-slate-200 rounded w-1/3"></div>
      <div className="space-y-2">
        <div className="h-4 bg-slate-100 rounded w-full"></div>
        <div className="h-4 bg-slate-100 rounded w-5/6"></div>
        <div className="h-4 bg-slate-100 rounded w-4/5"></div>
      </div>
    </div>
  );
};

export default Loader;
