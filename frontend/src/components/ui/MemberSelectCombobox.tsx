import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, User, Sparkles, UserCheck } from "lucide-react";

export interface MemberItem {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  role?: string;
  position?: string;
  image?: string;
  phone?: string;
  status?: string;
  teamName?: string;
  team_name?: string;
  registrationId?: string;
  registration_id?: string;
}

interface MemberSelectComboboxProps {
  value: string;
  onChange: (value: string, user?: MemberItem | null) => void;
  users: MemberItem[];
  placeholder?: string;
  label?: string;
  themeColor?: "purple" | "orange" | "indigo" | "blue" | "emerald";
  recommendedRole?: string | string[];
  roleFilter?: (user: MemberItem) => boolean;
  strictFilter?: boolean;
  headerTitle?: string;
  className?: string;
  id?: string;
}

const getInitials = (name: string): string => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getThemeStyles = (color: "purple" | "orange" | "indigo" | "blue" | "emerald" = "purple") => {
  switch (color) {
    case "purple":
      return {
        borderFocus: "focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20",
        badge: "bg-purple-50 text-purple-700 border-purple-200/60",
        avatarBg: "from-purple-500 to-indigo-600 text-white",
        highlight: "bg-purple-50/80 text-purple-900",
        check: "text-purple-600",
        btnActive: "bg-purple-600 hover:bg-purple-700 text-white",
        ringHover: "hover:border-purple-300",
        tag: "bg-purple-100/70 text-purple-700 border-purple-200/50",
        chip: "bg-purple-50 text-purple-700",
      };
    case "orange":
      return {
        borderFocus: "focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20",
        badge: "bg-orange-50 text-orange-700 border-orange-200/60",
        avatarBg: "from-orange-500 to-amber-600 text-white",
        highlight: "bg-orange-50/80 text-orange-900",
        check: "text-orange-600",
        btnActive: "bg-orange-600 hover:bg-orange-700 text-white",
        ringHover: "hover:border-orange-300",
        tag: "bg-orange-100/70 text-orange-700 border-orange-200/50",
        chip: "bg-orange-50 text-orange-700",
      };
    case "indigo":
      return {
        borderFocus: "focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
        avatarBg: "from-indigo-500 to-violet-600 text-white",
        highlight: "bg-indigo-50/80 text-indigo-900",
        check: "text-indigo-600",
        btnActive: "bg-indigo-600 hover:bg-indigo-700 text-white",
        ringHover: "hover:border-indigo-300",
        tag: "bg-indigo-100/70 text-indigo-700 border-indigo-200/50",
        chip: "bg-indigo-50 text-indigo-700",
      };
    case "emerald":
      return {
        borderFocus: "focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
        avatarBg: "from-emerald-500 to-teal-600 text-white",
        highlight: "bg-emerald-50/80 text-emerald-900",
        check: "text-emerald-600",
        btnActive: "bg-emerald-600 hover:bg-emerald-700 text-white",
        ringHover: "hover:border-emerald-300",
        tag: "bg-emerald-100/70 text-emerald-700 border-emerald-200/50",
        chip: "bg-emerald-50 text-emerald-700",
      };
    default:
      return {
        borderFocus: "focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20",
        badge: "bg-blue-50 text-blue-700 border-blue-200/60",
        avatarBg: "from-blue-500 to-cyan-600 text-white",
        highlight: "bg-blue-50/80 text-blue-900",
        check: "text-blue-600",
        btnActive: "bg-blue-600 hover:bg-blue-700 text-white",
        ringHover: "hover:border-blue-300",
        tag: "bg-blue-100/70 text-blue-700 border-blue-200/50",
        chip: "bg-blue-50 text-blue-700",
      };
  }
};

export const MemberSelectCombobox: React.FC<MemberSelectComboboxProps> = ({
  value,
  onChange,
  users = [],
  placeholder = "Select or search a member...",
  label,
  themeColor = "purple",
  recommendedRole,
  roleFilter,
  strictFilter = false,
  headerTitle,
  className = "",
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "recommended">("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const theme = getThemeStyles(themeColor);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Check if a member matches recommended/target role
  const isUserRecommended = (u: MemberItem): boolean => {
    if (roleFilter) return roleFilter(u);
    if (recommendedRole) {
      const roles = Array.isArray(recommendedRole) ? recommendedRole : [recommendedRole];
      const uRole = (u.role || "").toLowerCase();
      const uPos = (u.position || "").toLowerCase();
      return roles.some(r => {
        const lowerR = r.toLowerCase();
        return uRole.includes(lowerR) || uPos.includes(lowerR);
      });
    }
    return true;
  };

  // Base pool of eligible users (strictly filtered if strictFilter is true)
  const eligibleUsers = useMemo(() => {
    if (strictFilter && (roleFilter || recommendedRole)) {
      return users.filter(isUserRecommended);
    }
    return users;
  }, [users, strictFilter, roleFilter, recommendedRole]);

  // Find currently selected user object if any (prioritizing eligible list to avoid same-name collision)
  const selectedUser = useMemo(() => {
    if (!value) return null;
    const cleanVal = value.toLowerCase().trim();

    const findMatch = (list: MemberItem[]) => {
      // 1. Exact ID or Email match first
      const exactMatch = list.find(u => u.id === value || (u.email && u.email.toLowerCase().trim() === cleanVal));
      if (exactMatch) return exactMatch;

      // 2. Exact Name match
      return list.find(u => {
        const uName = (u.name || u.displayName || "").toLowerCase().trim();
        return uName === cleanVal;
      });
    };

    // First search in eligible users pool
    const matchInEligible = findMatch(eligibleUsers);
    if (matchInEligible) return matchInEligible;

    // Fallback to all users only if not in strict mode
    if (!strictFilter) {
      return findMatch(users) || null;
    }

    return null;
  }, [value, users, eligibleUsers, strictFilter]);

  // Filtered users based on search and active category tab
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let baseList = eligibleUsers;

    if (!strictFilter && activeCategory === "recommended" && (roleFilter || recommendedRole)) {
      baseList = eligibleUsers.filter(isUserRecommended);
    }

    if (!q) return baseList;

    return baseList.filter(u => {
      const name = (u.name || u.displayName || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const role = (u.role || "").toLowerCase();
      const position = (u.position || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q) || position.includes(q) || phone.includes(q);
    });
  }, [eligibleUsers, searchQuery, activeCategory, roleFilter, recommendedRole, strictFilter]);

  // Separate into recommended & others if on "all" tab, non-strict mode and no active search query
  const { recommendedList, otherList } = useMemo(() => {
    if (strictFilter || (!roleFilter && !recommendedRole)) {
      return { recommendedList: filteredUsers, otherList: [] };
    }
    if (searchQuery.trim()) {
      return { recommendedList: filteredUsers, otherList: [] };
    }
    const rec: MemberItem[] = [];
    const oth: MemberItem[] = [];
    filteredUsers.forEach(u => {
      if (isUserRecommended(u)) {
        rec.push(u);
      } else {
        oth.push(u);
      }
    });
    return { recommendedList: rec, otherList: oth };
  }, [filteredUsers, roleFilter, recommendedRole, searchQuery, strictFilter]);

  const handleSelectUser = (u: MemberItem) => {
    const selectedName = u.name || u.displayName || u.email || "";
    onChange(selectedName, u);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", null);
  };

  const handleApplyCustomQuery = () => {
    if (!searchQuery.trim()) return;
    onChange(searchQuery.trim(), null);
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef} id={id}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </label>
      )}

      {/* Main Trigger Field */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[46px] px-3.5 py-2 border border-slate-200 rounded-2xl bg-slate-50/40 hover:bg-white ${theme.ringHover} ${theme.borderFocus} transition-all cursor-pointer flex items-center justify-between gap-2.5 shadow-sm group`}
      >
        {selectedUser || value ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Avatar */}
            {selectedUser?.image ? (
              <img
                src={selectedUser.image}
                alt={selectedUser.name || value}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 shadow-xs"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-tr ${theme.avatarBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
              >
                {getInitials(selectedUser?.name || value)}
              </div>
            )}

            {/* Member Details */}
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-slate-800 truncate block">
                  {selectedUser?.name || selectedUser?.displayName || value}
                </span>
                {(selectedUser?.role || selectedUser?.position) && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.tag} shrink-0`}>
                    {selectedUser.position || selectedUser.role}
                  </span>
                )}
              </div>
              {selectedUser?.email && (
                <span className="text-[11px] text-slate-400 truncate block">
                  {selectedUser.email}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
            <User className="w-4 h-4 text-slate-350" />
            <span>{placeholder}</span>
          </div>
        )}

        {/* Action icons */}
        <div className="flex items-center gap-1.5 shrink-0 text-slate-400 group-hover:text-slate-600">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              className="w-6 h-6 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-slate-800" : ""}`}
          />
        </div>
      </div>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-150 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-100 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs only when strictFilter is FALSE */}
          {!strictFilter && (roleFilter || recommendedRole) && (
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  activeCategory === "all"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                All Members ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("recommended")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                  activeCategory === "recommended"
                    ? `${theme.btnActive}`
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Recommended
              </button>
            </div>
          )}

          {/* Strict Filter Header */}
          {strictFilter && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-0.5 flex items-center justify-between">
              <span>{headerTitle || "Eligible Members"} ({filteredUsers.length})</span>
            </div>
          )}

          {/* List of Users */}
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 overscroll-contain">
            {filteredUsers.length === 0 ? (
              <div className="py-6 px-3 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {searchQuery ? `No members found matching "${searchQuery}"` : "No members available."}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleApplyCustomQuery}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-colors ${theme.btnActive}`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Set &quot;{searchQuery}&quot; as Coordinator
                  </button>
                )}
              </div>
            ) : strictFilter || searchQuery.trim() || activeCategory === "recommended" ? (
              // Simple Flat List when in strict mode, searching or in Recommended tab
              filteredUsers.map((u) => {
                const isSelected =
                  (selectedUser && selectedUser.id === u.id) ||
                  (value && (value.toLowerCase() === (u.name || "").toLowerCase() || value.toLowerCase() === (u.email || "").toLowerCase()));

                return (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer group ${
                      isSelected ? theme.highlight : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {u.image ? (
                        <img
                          src={u.image}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-tr ${theme.avatarBg} flex items-center justify-center font-bold text-xs shrink-0`}
                        >
                          {getInitials(u.name || u.displayName || u.email || "")}
                        </div>
                      )}
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-slate-800 truncate block">
                            {u.name || u.displayName || "User"}
                          </span>
                          {(u.role || u.position) && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${theme.tag} shrink-0`}>
                              {u.position || u.role}
                            </span>
                          )}
                        </div>
                        {u.email && (
                          <span className="text-[11px] text-slate-400 truncate block">
                            {u.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className={`w-5 h-5 rounded-full bg-white shadow-xs flex items-center justify-center ${theme.check}`}>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // Sectioned List: Recommended First, then Others (Non-strict mode)
              <>
                {recommendedList.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-1 pb-0.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Recommended Coordinators ({recommendedList.length})
                    </div>
                    {recommendedList.map((u) => {
                      const isSelected =
                        (selectedUser && selectedUser.id === u.id) ||
                        (value && (value.toLowerCase() === (u.name || "").toLowerCase() || value.toLowerCase() === (u.email || "").toLowerCase()));

                      return (
                        <div
                          key={u.id}
                          onClick={() => handleSelectUser(u)}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer group ${
                            isSelected ? theme.highlight : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {u.image ? (
                              <img
                                src={u.image}
                                alt={u.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div
                                className={`w-8 h-8 rounded-full bg-gradient-to-tr ${theme.avatarBg} flex items-center justify-center font-bold text-xs shrink-0`}
                              >
                                {getInitials(u.name || u.displayName || u.email || "")}
                              </div>
                            )}
                            <div className="min-w-0 text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-slate-800 truncate block">
                                  {u.name || u.displayName || "User"}
                                </span>
                                {(u.role || u.position) && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${theme.tag} shrink-0`}>
                                    {u.position || u.role}
                                  </span>
                                )}
                              </div>
                              {u.email && (
                                <span className="text-[11px] text-slate-400 truncate block">
                                  {u.email}
                                </span>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <div className={`w-5 h-5 rounded-full bg-white shadow-xs flex items-center justify-center ${theme.check}`}>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {otherList.length > 0 && (
                  <div className="space-y-1 pt-1.5 border-t border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-0.5">
                      All Other Members ({otherList.length})
                    </div>
                    {otherList.map((u) => {
                      const isSelected =
                        (selectedUser && selectedUser.id === u.id) ||
                        (value && (value.toLowerCase() === (u.name || "").toLowerCase() || value.toLowerCase() === (u.email || "").toLowerCase()));

                      return (
                        <div
                          key={u.id}
                          onClick={() => handleSelectUser(u)}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer group ${
                            isSelected ? theme.highlight : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {u.image ? (
                              <img
                                src={u.image}
                                alt={u.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-400 to-slate-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {getInitials(u.name || u.displayName || u.email || "")}
                              </div>
                            )}
                            <div className="min-w-0 text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-slate-800 truncate block">
                                  {u.name || u.displayName || "User"}
                                </span>
                                {(u.role || u.position) && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                    {u.position || u.role}
                                  </span>
                                )}
                              </div>
                              {u.email && (
                                <span className="text-[11px] text-slate-400 truncate block">
                                  {u.email}
                                </span>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <div className={`w-5 h-5 rounded-full bg-white shadow-xs flex items-center justify-center ${theme.check}`}>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick Custom Input Action at the bottom when user has typed something */}
          {searchQuery && filteredUsers.length > 0 && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-1">
              <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                Or use custom name: <b>{searchQuery}</b>
              </span>
              <button
                type="button"
                onClick={handleApplyCustomQuery}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${theme.btnActive}`}
              >
                Use &quot;{searchQuery}&quot;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemberSelectCombobox;
