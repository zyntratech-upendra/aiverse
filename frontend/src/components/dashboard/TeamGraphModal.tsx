import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Users, 
  Network, 
  ArrowLeft, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  GripVertical, 
  Save, 
  Check, 
  RotateCcw, 
  Search,
  MoveHorizontal,
  Plus
} from "lucide-react";
import type { UserItem } from "../../pages/faculty/UserManagementPage";
import { updateSettings, updateUser, fetchSettings } from "../../services/apiClient";
import { dataCache } from "../../utils/dataCache";

interface TeamGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserItem[];
  availableRoles?: string[];
  onUsersUpdated?: () => void;
}

const DEFAULT_MODAL_ROLES = [
  "Faculty Coordinators",
  "Club Organizers",
  "Technical and Web Dev",
  "Design",
  "Content and Media",
  "Photography",
  "Videography",
  "Logistics and Operations",
  "PR and HR",
  "Event Management"
];

// Helper to determine the best initial role column for a user
const mapUserToInitialRole = (user: UserItem, rolesList: string[]): string => {
  const role = (user.role || "").toLowerCase().trim();
  const pos = (user.position || "").toLowerCase().trim();
  const combined = `${pos} ${role}`.toLowerCase();

  // 1. Faculty / Staff
  if (
    combined.includes("faculty") || 
    combined.includes("convener") || 
    combined.includes("conviner") ||
    combined.includes("advisor") || 
    combined.includes("staff")
  ) {
    return "Faculty Coordinators";
  }

  // 2. Club Organizers (leadership)
  if (
    role === "organizer" ||
    role === "co-organizer" ||
    role === "secretary" ||
    role === "facilitator" ||
    combined.includes("co-organizer") ||
    combined.includes("co organizer") ||
    combined.includes("secretary") ||
    combined.includes("facilitator") ||
    combined.includes("lead organizer") ||
    (combined.includes("organizer") && !combined.includes("event"))
  ) {
    return "Club Organizers";
  }

  // 3. Technical and Web Dev
  if (
    combined.includes("technical") ||
    combined.includes("web dev") ||
    combined.includes("wed dev") ||
    combined.includes("web developer") ||
    combined.includes("web app developer") ||
    combined.includes("software")
  ) {
    return "Technical and Web Dev";
  }

  // 4. Design
  if (combined.includes("design") || combined.includes("ui") || combined.includes("ux")) {
    return "Design";
  }

  // 5. Photography / Videography
  if (combined.includes("photo") && rolesList.includes("Photography")) {
    return "Photography";
  }
  if (combined.includes("video") && rolesList.includes("Videography")) {
    return "Videography";
  }

  // 6. Content and Media
  if (combined.includes("content") || combined.includes("media")) {
    return "Content and Media";
  }

  // 7. Match any existing role directly
  for (const r of rolesList) {
    if (role === r.toLowerCase() || combined.includes(r.toLowerCase())) {
      return r;
    }
  }

  return rolesList[0] || "General";
};

export const TeamGraphModal: React.FC<TeamGraphModalProps> = ({ 
  isOpen, 
  onClose, 
  users, 
  availableRoles,
  onUsersUpdated 
}) => {
  const [roles, setRoles] = useState<string[]>([]);
  const [membersByRole, setMembersByRole] = useState<Record<string, UserItem[]>>({});
  const [initialStateSnapshot, setInitialStateSnapshot] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [showAddRoleInput, setShowAddRoleInput] = useState(false);

  // Drag state
  const [draggingRoleIdx, setDraggingRoleIdx] = useState<number | null>(null);
  const [draggedMember, setDraggedMember] = useState<{ member: UserItem; sourceRole: string } | null>(null);
  const [dragOverRole, setDragOverRole] = useState<string | null>(null);

  // Initialize roles and members grouping on open
  useEffect(() => {
    if (!isOpen) return;

    const initData = async () => {
      try {
        let loadedRoles: string[] = [];
        
        // 1. Fetch settings from portal_config
        const configData = await fetchSettings("portal_config");
        if (configData && Array.isArray(configData.roleOrder) && configData.roleOrder.length > 0) {
          loadedRoles = configData.roleOrder;
        } else if (configData && Array.isArray(configData.availableRoles) && configData.availableRoles.length > 0) {
          loadedRoles = configData.availableRoles;
        } else if (availableRoles && availableRoles.length > 0) {
          loadedRoles = availableRoles;
        } else {
          loadedRoles = DEFAULT_MODAL_ROLES;
        }

        // Clean and normalize roles
        const cleanedRoles: string[] = [];
        const seen = new Set<string>();

        // Ensure Faculty Coordinators & Club Organizers are top
        const standardHeaders = ["Faculty Coordinators", "Club Organizers", "Technical and Web Dev"];
        standardHeaders.forEach(sh => {
          if (!seen.has(sh.toLowerCase())) {
            cleanedRoles.push(sh);
            seen.add(sh.toLowerCase());
          }
        });

        loadedRoles.forEach(r => {
          const rTrim = (r || "").trim();
          const rLower = rTrim.toLowerCase();
          // Skip outdated duplicates / system items
          if (!rTrim || rLower === "convener" || rLower === "conviner" || rLower === "staff member" || rLower === "faculty coordinator") return;
          if (rLower === "technical" || rLower === "wed dev" || rLower === "web dev") return;
          if (rLower === "organizer" || rLower === "co-organizer" || rLower === "secretary" || rLower === "facilitator") return;

          if (!seen.has(rLower)) {
            cleanedRoles.push(rTrim);
            seen.add(rLower);
          }
        });

        // Add remaining default roles if not present
        DEFAULT_MODAL_ROLES.forEach(dr => {
          if (!seen.has(dr.toLowerCase())) {
            cleanedRoles.push(dr);
            seen.add(dr.toLowerCase());
          }
        });

        // 2. Group members into roles
        const initialGroups: Record<string, UserItem[]> = {};
        cleanedRoles.forEach(r => {
          initialGroups[r] = [];
        });

        users.forEach(u => {
          const targetRole = mapUserToInitialRole(u, cleanedRoles);
          if (!initialGroups[targetRole]) {
            initialGroups[targetRole] = [];
          }
          initialGroups[targetRole].push({ ...u });
        });

        // Sort members in each column: Leads first, then Co-Leads, then Others
        Object.keys(initialGroups).forEach(roleKey => {
          initialGroups[roleKey].sort((a, b) => {
            const posA = (a.position || a.role || "").toLowerCase();
            const posB = (b.position || b.role || "").toLowerCase();
            const rankA = posA.includes("lead") && !posA.includes("co-") ? 1 : posA.includes("co-lead") ? 2 : 3;
            const rankB = posB.includes("lead") && !posB.includes("co-") ? 1 : posB.includes("co-lead") ? 2 : 3;
            if (rankA !== rankB) return rankA - rankB;
            return (a.name || "").localeCompare(b.name || "");
          });
        });

        setRoles(cleanedRoles);
        setMembersByRole(initialGroups);
        setInitialStateSnapshot(JSON.stringify({ roles: cleanedRoles, members: initialGroups }));
      } catch (err) {
        console.error("Error initializing Team Graph Modal:", err);
      }
    };

    initData();
  }, [isOpen, users, availableRoles]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialStateSnapshot) return false;
    const current = JSON.stringify({ roles, members: membersByRole });
    return current !== initialStateSnapshot;
  }, [roles, membersByRole, initialStateSnapshot]);

  // ==========================================
  // Role Column Moving & Reordering
  // ==========================================
  const moveRoleLeft = (index: number) => {
    if (index <= 0) return;
    setRoles(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const moveRoleRight = (index: number) => {
    if (index >= roles.length - 1) return;
    setRoles(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleRoleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingRoleIdx(index);
    e.dataTransfer.setData("text/plain", `role:${index}`);
  };

  const handleRoleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggingRoleIdx === null || draggingRoleIdx === targetIndex) return;

    setRoles(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggingRoleIdx, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggingRoleIdx(null);
  };

  // ==========================================
  // Member Card Moving (Within & Between Roles)
  // ==========================================
  const moveMemberWithinRole = (role: string, memberIdx: number, direction: "up" | "down") => {
    const list = membersByRole[role];
    if (!list) return;
    const targetIdx = direction === "up" ? memberIdx - 1 : memberIdx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const nextList = [...list];
    const temp = nextList[memberIdx];
    nextList[memberIdx] = nextList[targetIdx];
    nextList[targetIdx] = temp;

    setMembersByRole(prev => ({
      ...prev,
      [role]: nextList
    }));
  };

  const moveMemberToRole = (memberId: string, currentRole: string, targetRole: string) => {
    if (currentRole === targetRole) return;
    const sourceList = membersByRole[currentRole] || [];
    const memberToMove = sourceList.find(m => (m.id || m._id) === memberId);
    if (!memberToMove) return;

    const newMember: UserItem = {
      ...memberToMove,
      role: targetRole as any
    };

    setMembersByRole(prev => ({
      ...prev,
      [currentRole]: (prev[currentRole] || []).filter(m => (m.id || m._id) !== memberId),
      [targetRole]: [...(prev[targetRole] || []), newMember]
    }));
  };

  const handleMemberDragStart = (e: React.DragEvent, member: UserItem, sourceRole: string) => {
    e.stopPropagation();
    setDraggedMember({ member, sourceRole });
    e.dataTransfer.setData("text/plain", `member:${member.id || member._id}:${sourceRole}`);
  };

  const handleMemberDropOnRole = (e: React.DragEvent, targetRole: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRole(null);

    if (!draggedMember) return;
    const { member, sourceRole } = draggedMember;

    if (sourceRole === targetRole) {
      setDraggedMember(null);
      return;
    }

    moveMemberToRole(member.id || member._id || "", sourceRole, targetRole);
    setDraggedMember(null);
  };

  // Add custom role column
  const handleAddRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    if (roles.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg("Role already exists in graph.");
      return;
    }

    setRoles(prev => [...prev, trimmed]);
    setMembersByRole(prev => ({ ...prev, [trimmed]: [] }));
    setNewRoleName("");
    setShowAddRoleInput(false);
    setErrorMsg("");
  };

  // Save changes to backend and invalidate public team cache
  const handleSaveChanges = async () => {
    setIsSaving(true);
    setErrorMsg("");
    setSaveSuccess(false);

    try {
      // 1. Save ordered roles to settings (portal_config)
      await updateSettings("portal_config", {
        availableRoles: roles,
        roleOrder: roles
      });

      // 2. Identify users whose role or order changed and update them
      const updatePromises: Promise<any>[] = [];

      roles.forEach(roleName => {
        const roleMembers = membersByRole[roleName] || [];
        roleMembers.forEach((member, index) => {
          const mId = member.id || member._id;
          if (!mId) return;

          // Determine clean role string for backend
          let dbRole = roleName;
          if (roleName === "Faculty Coordinators") {
            const combined = `${member.position || ""} ${member.role || ""}`.toLowerCase();
            dbRole = combined.includes("staff") ? "Staff Member" : "Faculty Coordinator";
          } else if (roleName === "Club Organizers") {
            const combined = `${member.position || ""} ${member.role || ""}`.toLowerCase();
            if (combined.includes("secretary")) dbRole = "Secretary";
            else if (combined.includes("facilitator")) dbRole = "Facilitator";
            else if (combined.includes("co-organizer") || combined.includes("co organizer")) dbRole = "Co-Organizer";
            else dbRole = "Organizer";
          }

          updatePromises.push(
            updateUser(mId, {
              role: dbRole,
              position: member.position || member.sub_role || "",
              order: index + 1
            }).catch(e => console.warn(`Failed updating user ${mId}:`, e))
          );
        });
      });

      await Promise.allSettled(updatePromises);

      // 3. Invalidate client caches
      dataCache.remove("public_team");
      dataCache.remove("portal_config");

      // 4. Update snapshot & notify
      setInitialStateSnapshot(JSON.stringify({ roles, members: membersByRole }));
      setSaveSuccess(true);
      onUsersUpdated?.();

      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    } catch (err: any) {
      console.error("Error saving team roles:", err);
      setErrorMsg(err.message || "Failed to save team roles.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!initialStateSnapshot) return;
    try {
      const parsed = JSON.parse(initialStateSnapshot);
      setRoles(parsed.roles);
      setMembersByRole(parsed.members);
      setErrorMsg("");
    } catch {}
  };

  if (!isOpen) return null;

  const totalMembersInGraph = Object.values(membersByRole).reduce((sum, list) => sum + list.length, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 lg:p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-50 w-full max-w-[96vw] h-[92vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header Bar */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
          
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-inner shrink-0">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Team Roles Graph</h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                  {roles.length} Roles • {totalMembersInGraph} Members
                </span>
                {hasUnsavedChanges && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                <MoveHorizontal className="h-3.5 w-3.5 text-blue-500" />
                Movable hierarchy — rearrange role columns & members. Changes sync live to the public team page.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Search filter */}
            <div className="relative hidden md:block">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Find member..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 w-44 transition-all"
              />
            </div>

            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Reset to loaded state"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving || !hasUnsavedChanges}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                hasUnsavedChanges 
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:scale-[1.02]" 
                  : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Feedback banners */}
        {saveSuccess && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-emerald-800 text-xs font-bold animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Team roles and members successfully saved! The public team page is now updated.</span>
            </div>
            <button onClick={() => setSaveSuccess(false)} className="text-emerald-500 hover:text-emerald-800">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-rose-800 text-xs font-bold">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-rose-500 hover:text-rose-800">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Horizontal Kanban Board */}
        <div className="flex-1 p-4 sm:p-6 overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-100/60">
          <div className="flex gap-5 h-full items-start min-w-max pb-4">
            
            {roles.map((roleName, roleIdx) => {
              const members = membersByRole[roleName] || [];
              const filteredMembers = searchQuery.trim() 
                ? members.filter(m => (m.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (m.email || "").toLowerCase().includes(searchQuery.toLowerCase()))
                : members;

              const isDragOver = dragOverRole === roleName;

              return (
                <div
                  key={roleName}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverRole !== roleName) setDragOverRole(roleName);
                  }}
                  onDragLeave={() => {
                    if (dragOverRole === roleName) setDragOverRole(null);
                  }}
                  onDrop={(e) => handleMemberDropOnRole(e, roleName)}
                  className={`w-[290px] sm:w-[320px] flex flex-col h-full rounded-2xl sm:rounded-3xl border transition-all duration-200 shadow-xs ${
                    isDragOver 
                      ? "bg-blue-50/90 border-blue-400 ring-2 ring-blue-300 shadow-lg scale-[1.01]" 
                      : "bg-white border-slate-200/90"
                  }`}
                >
                  
                  {/* Column Header (Movable Role) */}
                  <div 
                    draggable
                    onDragStart={(e) => handleRoleDragStart(e, roleIdx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleRoleDrop(e, roleIdx)}
                    className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-gradient-to-b from-slate-50 to-white rounded-t-2xl sm:rounded-t-3xl cursor-grab active:cursor-grabbing group select-none"
                    title="Drag to reorder role position"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-slate-400 group-hover:text-blue-600 transition-colors">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-800 tracking-tight truncate" title={roleName}>
                          {roleName}
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Position #{roleIdx + 1}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {members.length}
                      </span>
                      
                      {/* Move Column Left */}
                      <button
                        type="button"
                        onClick={() => moveRoleLeft(roleIdx)}
                        disabled={roleIdx === 0}
                        className="p-1 rounded-lg hover:bg-slate-200 disabled:opacity-30 text-slate-500 disabled:cursor-not-allowed transition-colors"
                        title="Move role left"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      
                      {/* Move Column Right */}
                      <button
                        type="button"
                        onClick={() => moveRoleRight(roleIdx)}
                        disabled={roleIdx === roles.length - 1}
                        className="p-1 rounded-lg hover:bg-slate-200 disabled:opacity-30 text-slate-500 disabled:cursor-not-allowed transition-colors"
                        title="Move role right"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Column Body - Droppable Member Cards List */}
                  <div className="p-3 flex-1 overflow-y-auto space-y-2.5 custom-scrollbar">
                    {filteredMembers.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl text-center p-3 text-slate-400">
                        <Users className="h-6 w-6 mb-1 text-slate-300" />
                        <span className="text-xs font-semibold">No members in this role</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Drag a member card here</span>
                      </div>
                    ) : (
                      filteredMembers.map((member, memberIdx) => {
                        const mId = member.id || member._id || `${member.name}-${memberIdx}`;
                        const initials = member.name
                          ? member.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
                          : "U";

                        const posText = member.position || member.sub_role || (roleName === "Faculty Coordinators" ? "Faculty" : "Member");

                        return (
                          <div
                            key={mId}
                            draggable
                            onDragStart={(e) => handleMemberDragStart(e, member, roleName)}
                            className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing group/card select-none"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="text-slate-300 group-hover/card:text-blue-500 mt-1">
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>

                              {/* Member Avatar */}
                              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center shadow-inner">
                                {member.image && member.image.startsWith("http") ? (
                                  <img 
                                    src={member.image} 
                                    alt={member.name} 
                                    className="w-full h-full object-cover object-top" 
                                  />
                                ) : (
                                  <span className="text-xs font-black text-blue-600">{initials}</span>
                                )}
                              </div>

                              {/* Member Info */}
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-extrabold text-slate-900 truncate leading-tight group-hover/card:text-blue-600 transition-colors" title={member.name}>
                                  {member.name}
                                </h4>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5" title={member.email}>
                                  {member.email}
                                </p>
                                
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100/80 truncate max-w-[140px]">
                                    {posText}
                                  </span>

                                  {member.status && (
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                                      member.status.toLowerCase() === "active" 
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                        : "bg-slate-100 text-slate-500"
                                    }`}>
                                      {member.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Card Quick Actions: Move Up/Down & Move to Role */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[10px]">
                              
                              {/* Reorder in Column Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveMemberWithinRole(roleName, memberIdx, "up")}
                                  disabled={memberIdx === 0}
                                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-500 transition-colors cursor-pointer"
                                  title="Move up in order"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveMemberWithinRole(roleName, memberIdx, "down")}
                                  disabled={memberIdx === filteredMembers.length - 1}
                                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-500 transition-colors cursor-pointer"
                                  title="Move down in order"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>

                              {/* Quick Move To Role Dropdown */}
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-semibold text-slate-400">Move to:</span>
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      moveMemberToRole(mId, roleName, e.target.value);
                                    }
                                  }}
                                  className="text-[10px] font-bold text-blue-600 bg-blue-50/80 hover:bg-blue-100 border border-blue-100 rounded-lg px-1.5 py-0.5 focus:outline-none cursor-pointer"
                                >
                                  <option value="" disabled>Select...</option>
                                  {roles.filter(r => r !== roleName).map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>

                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Drop footer hint */}
                  <div className="px-3 py-2 bg-slate-50 rounded-b-2xl sm:rounded-b-3xl border-t border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Drag members here to assign
                    </span>
                  </div>

                </div>
              );
            })}

            {/* Add New Role Column */}
            <div className="w-[260px] shrink-0 rounded-3xl border-2 border-dashed border-slate-300 p-4 flex flex-col justify-center items-center text-center bg-white/60 hover:bg-white transition-all min-h-[300px]">
              {showAddRoleInput ? (
                <div className="w-full space-y-3">
                  <div className="text-xs font-bold text-slate-700">Add New Team Role</div>
                  <input
                    type="text"
                    placeholder="e.g. AI Research"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleAddRole();
                      if (e.key === "Escape") setShowAddRoleInput(false);
                    }}
                    autoFocus
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddRole}
                      className="flex-1 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddRoleInput(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddRoleInput(true)}
                  className="flex flex-col items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 border border-slate-200 transition-all">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold">Add New Role</span>
                </button>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default TeamGraphModal;
