import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Mail,
  Users,
  Sparkles,
  ArrowRight
} from "lucide-react";
import Button from "../../components/ui/Button";
import SEO from "../../components/layout/SEO";
import { db } from "../../config/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { userService } from "../../services/userService";
import { formatRoleLabel } from "../faculty/UserManagementPage";
import { dataCache } from "../../utils/dataCache";

// Import local assets
import heroImg from "../../assets/images/aether_hero.png";

const GithubIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.008.069-.008 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
  </svg>
);

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

interface MemberData {
  id?: string;
  name: string;
  email?: string;
  personal_email?: string;
  role: string;
  position?: string;
  roleType?: string;
  image: string;
  bio?: string;
  github?: string;
  linkedin?: string;
  phone?: string;
}

const DEFAULT_ROLE_HIERARCHY = [
  "Faculty Coordinators",
  "Student Leads",
  "Technical",
  "Design",
  "Content and Media",
  "Video and Photography",
  "Logistics and Operations",
  "PR and HR",
  "Event Management",
  "Student Organizers",
  "Volunteers"
];

// System administrative accounts to exclude
const EXCLUDED_SYSTEM_EMAILS = [
  "admin@aiverse.in",
  "facultycoordinator@aiverse.in",
  "studentorganizer@aiverse.in",
  "jurry@aiverse.in",
  "jury@aiverse.in",
  "participant@aiverse.in"
];

const BLANK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394A3B8'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const TeamPage: React.FC = () => {
  const [dbMembers, setDbMembers] = useState<MemberData[]>(() => dataCache.get<MemberData[]>("public_team") || []);
  const [configuredRoles, setConfiguredRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(() => !dataCache.get<MemberData[]>("public_team"));

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        // Run all queries in parallel
        const [configRes, supaRes, usersRes, orgsRes] = await Promise.allSettled([
          getDoc(doc(db, "settings", "portal_config")),
          userService.getUsers(),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "organizers"))
        ]);

        // Process config roles
        if (configRes.status === "fulfilled" && configRes.value.exists()) {
          const configData = configRes.value.data();
          if (configData.availableRoles && Array.isArray(configData.availableRoles) && configData.availableRoles.length > 0) {
            setConfiguredRoles(configData.availableRoles);
          }
        }

        const combinedList: any[] = [];
        const seenEmails = new Set<string>();

        // 1. Process Supabase users
        if (supaRes.status === "fulfilled" && Array.isArray(supaRes.value)) {
          supaRes.value.forEach((u) => {
            const email = (u.email || "").toLowerCase().trim();
            if (email) seenEmails.add(email);
            combinedList.push({
              id: u.id,
              name: u.name || u.display_name || "Unnamed Member",
              email: u.email || "",
              personal_email: u.personal_email || "",
              role: u.role || "Student Member",
              position: u.position || u.role || "",
              roleType: u.role || "Organizer",
              status: u.status || "Active",
              image: u.image || "",
              bio: u.bio || "",
              linkedin: u.linkedin || "",
              github: u.github || "",
              phone: u.phone || ""
            });
          });
        }

        // 2. Process Firestore users
        if (usersRes.status === "fulfilled") {
          usersRes.value.forEach((docSnap) => {
            const data = docSnap.data();
            const email = (data.email || "").toLowerCase().trim();
            if (email && seenEmails.has(email)) {
              const idx = combinedList.findIndex(item => (item.email || "").toLowerCase().trim() === email);
              if (idx >= 0) {
                combinedList[idx] = {
                  ...combinedList[idx],
                  image: combinedList[idx].image || data.image || "",
                  bio: combinedList[idx].bio || data.bio || "",
                  linkedin: combinedList[idx].linkedin || data.linkedin || "",
                  github: combinedList[idx].github || data.github || "",
                  position: combinedList[idx].position || data.position || data.role || "",
                };
              }
            } else if (email) {
              seenEmails.add(email);
              combinedList.push({
                id: docSnap.id,
                name: data.name || data.displayName || data.teamLeadName || "Unnamed Member",
                email: data.email || "",
                personal_email: data.personal_email || data.personalEmail || "",
                role: data.role || "Student Member",
                position: data.position || data.role || "",
                roleType: data.roleType || data.role || "Organizer",
                status: data.status || "Active",
                image: data.image || "",
                bio: data.bio || "",
                linkedin: data.linkedin || "",
                github: data.github || "",
                phone: data.phone || ""
              });
            }
          });
        }

        // 3. Process Firestore organizers
        if (orgsRes.status === "fulfilled") {
          orgsRes.value.forEach((docSnap) => {
            const data = docSnap.data();
            const email = (data.email || "").toLowerCase().trim();
            if (email && seenEmails.has(email)) {
              const idx = combinedList.findIndex(item => (item.email || "").toLowerCase().trim() === email);
              if (idx >= 0) {
                combinedList[idx] = {
                  ...combinedList[idx],
                  image: combinedList[idx].image || data.image || "",
                  bio: combinedList[idx].bio || data.bio || "",
                  linkedin: combinedList[idx].linkedin || data.linkedin || "",
                  github: combinedList[idx].github || data.github || "",
                  position: combinedList[idx].position || data.position || data.roleType || "",
                };
              }
            } else if (email) {
              seenEmails.add(email);
              combinedList.push({
                id: docSnap.id,
                name: data.name || data.displayName || "Unnamed Member",
                email: data.email || "",
                personal_email: data.personal_email || data.personalEmail || "",
                role: data.role || data.roleType || "Organizer",
                position: data.position || data.roleType || "",
                roleType: data.roleType || data.role || "Organizer",
                status: data.status || "Active",
                image: data.image || "",
                bio: data.bio || "",
                linkedin: data.linkedin || "",
                github: data.github || "",
                phone: data.phone || ""
              });
            }
          });
        }

        // 4. Filter out excluded system accounts and participant accounts
        const validMembers = combinedList.filter((m) => {
          const email = (m.email || "").toLowerCase().trim();
          const name = (m.name || "").toLowerCase().trim();
          const role = (m.role || "").toLowerCase().trim();
          const pos = (m.position || "").toLowerCase().trim();
          const roleType = (m.roleType || "").toLowerCase().trim();
          const status = (m.status || "Active").toLowerCase().trim();

          if (EXCLUDED_SYSTEM_EMAILS.includes(email)) return false;
          if (name === "system admin" || name === "jury evaluator" || name === "jury panelist") return false;
          if (role === "system admin" || role === "jury evaluator") return false;
          if (status === "deactivated") return false;

          // Exclude all participants & event team accounts from the public team page
          if (
            role === "participant" || 
            pos === "participant" || 
            roleType === "participant" ||
            role.includes("participant") || 
            pos.includes("participant") || 
            roleType.includes("participant") || 
            email.includes("participant") ||
            email.startsWith("team")
          ) {
            return false;
          }

          return true;
        });

        setDbMembers(validMembers);
        dataCache.set("public_team", validMembers);
      } catch (err) {
        console.error("Error fetching team members:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  // Check if a member belongs to Club Organizers leadership group
  const isClubOrganizer = (member: MemberData): boolean => {
    const mRole = (member.role || "").toLowerCase().trim();
    const mPos = (member.position || "").toLowerCase().trim();
    const mType = (member.roleType || "").toLowerCase().trim();
    const combined = `${mPos} ${mRole} ${mType}`.toLowerCase().trim();

    // Faculty members belong to faculty coordinators section
    if (combined.includes("faculty") || combined.includes("convener") || combined.includes("advisor")) {
      return false;
    }

    return (
      mRole === "organizer" ||
      mPos === "organizer" ||
      mRole === "co-organizer" ||
      mPos === "co-organizer" ||
      mRole === "secretary" ||
      mPos === "secretary" ||
      mRole === "facilitator" ||
      mPos === "facilitator" ||
      combined.includes("co-organizer") ||
      combined.includes("co organizer") ||
      combined.includes("secretary") ||
      combined.includes("facilitator") ||
      combined.includes("lead organizer") ||
      combined.includes("student organizer") ||
      (combined.includes("organizer") && !combined.includes("event manager") && !combined.includes("event management"))
    );
  };

  // Rank within Club Organizers: 1. Organizer -> 2. Co-Organizer -> 3. Secretary -> 4. Facilitator
  const getOrganizerRank = (member: MemberData): number => {
    const combined = `${member.position || ""} ${member.role || ""} ${member.roleType || ""}`.toLowerCase().trim();
    if (combined.includes("lead organizer") || (combined.includes("organizer") && !combined.includes("co-") && !combined.includes("co "))) return 1;
    if (combined.includes("co-organizer") || combined.includes("co organizer")) return 2;
    if (combined.includes("secretary")) return 3;
    if (combined.includes("facilitator")) return 4;
    return 5;
  };

  // Rank within any department / role: 1. Lead -> 2. Co-Lead -> 3. Associate -> 4. Other/Member
  const getSubRoleRank = (member: MemberData): number => {
    const pos = (member.position || "").toLowerCase().trim();
    const role = (member.role || "").toLowerCase().trim();
    const roleType = (member.roleType || "").toLowerCase().trim();

    // Priority 1: Direct exact match on position/sub_role
    if (pos === "lead" || pos === "head" || pos === "student lead" || pos === "team lead") return 1;
    if (pos === "co-lead" || pos === "co lead" || pos === "colead" || pos === "co-head" || pos === "co head" || pos === "vice lead" || pos === "vice-lead") return 2;
    if (pos === "associate" || pos === "assoc" || pos === "associate lead" || pos === "core member") return 3;

    // Priority 2: Check full combined string
    const combined = `${pos} ${role} ${roleType}`.toLowerCase().trim();

    // Co-Lead must precede generic 'lead'
    if (
      combined.includes("co-lead") || 
      combined.includes("co lead") || 
      combined.includes("colead") || 
      combined.includes("co-head") || 
      combined.includes("co head") || 
      combined.includes("vice lead") ||
      combined.includes("vice-lead")
    ) {
      return 2;
    }

    if (
      combined.includes("lead") || 
      combined.includes("head") || 
      combined.includes("president") || 
      combined.includes("convener")
    ) {
      return 1;
    }

    if (
      combined.includes("associate") || 
      combined.includes("assoc") || 
      combined.includes("executive")
    ) {
      return 3;
    }

    return 4;
  };

  const compareMembersByRank = (a: MemberData, b: MemberData): number => {
    const rankA = getSubRoleRank(a);
    const rankB = getSubRoleRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return (a.name || "").localeCompare(b.name || "");
  };

  // Intelligent member-to-role matching for other departments
  const matchMemberToRole = (member: MemberData, targetRole: string): boolean => {
    const mRole = (member.role || "").toLowerCase().trim();
    const mPos = (member.position || "").toLowerCase().trim();
    const mType = (member.roleType || "").toLowerCase().trim();
    const combined = `${mPos} ${mRole} ${mType}`.toLowerCase().trim();
    const target = targetRole.toLowerCase().trim();

    // Exact matches
    if (mRole === target || mPos === target || mType === target) return true;
    if (combined === target) return true;

    // Direct containment
    if (combined.includes(target) || target.includes(mRole) || target.includes(mPos)) return true;

    // Normalized punctuation/space stripped matching
    const targetNorm = target.replace(/[^a-z0-9]/g, "");
    const combinedNorm = combined.replace(/[^a-z0-9]/g, "");
    if (combinedNorm.includes(targetNorm) || targetNorm.includes(combinedNorm)) return true;

    // Token overlap matching
    const tokens = target.split(/[\s&,/+_-]+/).filter(t => t.length > 2 && !["and", "the", "for", "with"].includes(t));
    if (tokens.length > 0) {
      const matches = tokens.filter(t => combined.includes(t));
      if (matches.length === tokens.length || matches.length >= Math.ceil(tokens.length * 0.7)) {
        return true;
      }
    }

    return false;
  };

  // Group members with "Club Organizers" at the very starting of the page
  const groupedSections = useMemo(() => {
    const activeRolesList = configuredRoles.length > 0 ? configuredRoles : DEFAULT_ROLE_HIERARCHY;
    const assignedMemberIds = new Set<string>();
    const activeSections: Array<{ definition: { id: string; title: string; order: number }; members: MemberData[] }> = [];

    // =========================================================================
    // STEP 1: Faculty Coordinators (if present in members)
    // =========================================================================
    const facultyMembers = dbMembers.filter(m => {
      const combined = `${m.position || ""} ${m.role || ""} ${m.roleType || ""}`.toLowerCase();
      return combined.includes("faculty") || combined.includes("convener") || combined.includes("advisor");
    });

    if (facultyMembers.length > 0) {
      facultyMembers.sort(compareMembersByRank);
      facultyMembers.forEach(m => assignedMemberIds.add(m.id || m.email || `${m.name}-${m.role}`));
      activeSections.push({
        definition: {
          id: "faculty-coordinators",
          title: "Faculty Coordinators",
          order: 1
        },
        members: facultyMembers
      });
    }

    // =========================================================================
    // STEP 2: CLUB ORGANIZERS (Organizer, Co-Organizer, Secretary, Facilitator)
    // Displayed at the starting / top of the public team page
    // =========================================================================
    const clubOrganizersList = dbMembers.filter(m => {
      const memId = m.id || m.email || `${m.name}-${m.role}`;
      if (assignedMemberIds.has(memId)) return false;
      return isClubOrganizer(m);
    });

    if (clubOrganizersList.length > 0) {
      // Sort inside Club Organizers by hierarchy: Organizer -> Co-Organizer -> Secretary -> Facilitator
      clubOrganizersList.sort((a, b) => getOrganizerRank(a) - getOrganizerRank(b));
      clubOrganizersList.forEach(m => assignedMemberIds.add(m.id || m.email || `${m.name}-${m.role}`));

      activeSections.push({
        definition: {
          id: "club-organizers",
          title: "Club Organizers",
          order: 2
        },
        members: clubOrganizersList
      });
    }

    // =========================================================================
    // STEP 3: Department Roles in Configured Hierarchy Order
    // (Excluding individual leadership titles that are already in Club Organizers)
    // =========================================================================
    const leadershipRoleKeywords = ["organizer", "co-organizer", "co organizer", "secretary", "facilitator", "club organizer", "club organizers", "faculty coordinator", "faculty coordinators"];

    const departmentRoles = activeRolesList.filter(roleName => {
      const rLower = roleName.toLowerCase().trim();
      return !leadershipRoleKeywords.includes(rLower);
    });

    let currentOrder = 3;
    departmentRoles.forEach(roleName => {
      const groupMembers: MemberData[] = [];

      dbMembers.forEach(member => {
        const memId = member.id || member.email || `${member.name}-${member.role}`;
        if (!assignedMemberIds.has(memId)) {
          if (matchMemberToRole(member, roleName)) {
            groupMembers.push(member);
            assignedMemberIds.add(memId);
          }
        }
      });

      if (groupMembers.length > 0) {
        // Sort inside each department by Sub-Role hierarchy: Lead (1) -> Co-Lead (2) -> Associate (3) -> Other (4)
        groupMembers.sort(compareMembersByRank);

        activeSections.push({
          definition: {
            id: roleName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            title: roleName,
            order: currentOrder++
          },
          members: groupMembers
        });
      }
    });

    // =========================================================================
    // STEP 4: Unassigned / Additional Team Members
    // =========================================================================
    const unassignedMembers = dbMembers.filter(member => {
      const memId = member.id || member.email || `${member.name}-${member.role}`;
      return !assignedMemberIds.has(memId);
    });

    if (unassignedMembers.length > 0) {
      unassignedMembers.sort(compareMembersByRank);
      activeSections.push({
        definition: {
          id: "other-members",
          title: "Additional Team Members",
          order: 999
        },
        members: unassignedMembers
      });
    }

    return activeSections;
  }, [dbMembers, configuredRoles]);

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-800">
      <SEO 
        title="Team - The Minds Behind AI Verse | VIT Bhimavaram" 
        description="Meet the student leaders, technical developers, designers, and organizers powering AI Verse at Vishnu Institute of Technology, Bhimavaram."
      />
      
      {/* ================= HERO SECTION ================= */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-slate-950 text-white rounded-b-[36px] shadow-lg border-b border-slate-800/80">
        <div className="absolute inset-0 overflow-hidden rounded-b-[36px] -z-10">
          <img 
            src={heroImg} 
            alt="Background" 
            className="w-full h-full object-cover opacity-20 object-center"
          />
          <div className="absolute inset-0 bg-slate-950/85"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span>AI Verse Club • VIT Bhimavaram</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Our Team
          </h1>

          <p className="max-w-xl mx-auto text-slate-300 text-sm sm:text-base font-normal leading-relaxed">
            The builders, developers, designers, and organizers powering AI Verse.
          </p>
        </div>
      </section>

      {/* Loading state indicator */}
      {loading && (
        <div className="py-24 text-center">
          <div className="w-10 h-10 rounded-full border-3 border-slate-200 border-t-blue-600 animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading team members...</p>
        </div>
      )}

      {/* ================= ROLE-WISE SECTIONS ================= */}
      {!loading && groupedSections.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
          {groupedSections.map((section) => {
            const { definition, members } = section;

            return (
              <section key={definition.id} id={definition.id} className="text-left">
                {/* Clean, Simple Role Header */}
                <div className="flex items-center justify-between gap-3 mb-4 sm:mb-8 pb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {definition.title}
                    </h2>
                    <span className="text-[11px] sm:text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 sm:px-2.5 py-0.5 rounded-full">
                      {members.length}
                    </span>
                  </div>

                  {members.length > 1 && (
                    <span className="sm:hidden text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded-md">
                      Swipe &rarr;
                    </span>
                  )}
                </div>

                {/* Team Cards: Compact Horizontal Side-Scroll on Mobile, Responsive Grid on Desktop */}
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-7 pb-4 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {members.map((member, idx) => {
                    const formattedRole = formatRoleLabel(member.position || member.role || member.roleType || "Member");

                    return (
                      <div
                        key={member.id || idx}
                        className="w-[190px] xs:w-[210px] sm:w-auto shrink-0 sm:shrink snap-start bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-xl hover:border-blue-200 hover:-translate-y-1.5 transition-all duration-300 group"
                      >
                        <div>
                          {/* Profile Image Frame (Compact on Mobile) */}
                          <div className="w-full aspect-[1/1] sm:aspect-[4/4.2] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 border border-slate-100/80 shadow-2xs relative mb-2.5 sm:mb-4">
                            <img 
                              src={member.image || BLANK_AVATAR} 
                              alt={member.name} 
                              className={`w-full h-full ${
                                member.image ? 'object-cover object-top group-hover:scale-105' : 'object-contain p-6 sm:p-8'
                              } transition-transform duration-500`} 
                            />
                          </div>

                          {/* Member Details */}
                          <div className="space-y-1 sm:space-y-1.5 px-0.5 sm:px-1">
                            <h3 className="text-sm sm:text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1 sm:line-clamp-2">
                              {member.name}
                            </h3>
                            
                            <div>
                              <span className="inline-block text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50/80 border border-blue-100/70 px-2 sm:px-2.5 py-0.5 rounded-full line-clamp-1">
                                {formattedRole}
                              </span>
                            </div>

                            {member.bio && (
                              <p className="text-[11px] sm:text-xs text-slate-500 pt-0.5 sm:pt-1 line-clamp-2 leading-relaxed font-normal">
                                {member.bio}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Social & Contact Buttons */}
                        <div className="pt-2.5 mt-2.5 sm:pt-4 sm:mt-4 border-t border-slate-100 flex items-center justify-between px-0.5 sm:px-1">
                          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">Connect</span>
                          
                          <div className="flex items-center gap-1 sm:gap-1.5 text-slate-400">
                            {member.github && (
                              <a 
                                href={member.github} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-50 hover:bg-slate-900 hover:text-white transition-all shadow-2xs" 
                                title="GitHub"
                              >
                                <GithubIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </a>
                            )}
                            {member.linkedin && (
                              <a 
                                href={member.linkedin} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-50 hover:bg-blue-600 hover:text-white transition-all shadow-2xs" 
                                title="LinkedIn"
                              >
                                <LinkedinIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </a>
                            )}
                            {member.email && (
                              <a 
                                href={`mailto:${member.email}`} 
                                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-50 hover:bg-sky-500 hover:text-white transition-all shadow-2xs" 
                                title="Email"
                              >
                                <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && dbMembers.length === 0 && (
        <div className="py-24 text-center max-w-sm mx-auto px-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Members Added Yet</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Active team members will appear here grouped by their role.
          </p>
        </div>
      )}

      {/* ================= BOTTOM CTA ================= */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            Join AI Verse
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Want to Shape the Future with Us?
          </h2>
          
          <p className="text-slate-500 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
            If you are passionate about Artificial Intelligence, workshops, and hackathons, join our active community.
          </p>
          
          <div className="pt-2">
            <Link to="/contact">
              <Button variant="gradient" className="rounded-2xl px-7 py-3 font-bold text-xs inline-flex items-center gap-2">
                <span>Contact Our Team</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

export default TeamPage;
