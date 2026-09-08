import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "success" | "warning" | "danger" | "info" | "gray";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  className = "",
}) => {
  const baseStyle = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold select-none border";

  const variants = {
    primary: "bg-aether-blue-50 text-aether-blue-700 border-aether-blue-100",
    success: "bg-green-50 text-green-700 border-green-100",
    warning: "bg-yellow-50 text-yellow-700 border-yellow-100",
    danger: "bg-red-50 text-red-700 border-red-100",
    info: "bg-sky-50 text-sky-700 border-sky-100",
    gray: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <span className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
