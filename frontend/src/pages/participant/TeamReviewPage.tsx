import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Key, 
  Users, 
  Upload, 
  BarChart2, 
  LogOut, 
  Bell, 
  Info, 
  Mail, 
  Phone, 
  Building2, 
  Cpu, 
  ArrowRight,
  ShieldCheck,
  Star,
  Edit3,
  X,
  Plus,
  Trash2,
  Check,
  Loader2
} from "lucide-react";
import SEO from "../../components/layout/SEO";
import { db } from "../../config/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { fetchRegistrations } from "../../services/apiClient";

interface TeamMember {
  name: string;
  role: string;
  rollNo: string;
  email: string;
  phone: string;
}

interface TeamData {
  docId?: string;
  teamName: string;
  teamId: string;
  status: string;
  institution: string;
  projectTrack: string;
  leader: {
    name: string;
    email: string;
    rollNo: string;
    phone: string;
  };
  members: TeamMember[];
}

interface TeamReviewPageProps {
  embedded?: boolean;
  onConfirm?: () => void;
}

export const TeamReviewPage: React.FC<TeamReviewPageProps> = ({ embedded = false, onConfirm }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Helper for generating initials dynamically
  const getInitials = (name: string) => {
    if (!name) return "TP";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // State initialized with clean structure
  const [teamData, setTeamData] = useState<TeamData>({
    teamName: "",
    teamId: "",
    status: "Registered",
    institution: "",
    projectTrack: "",
    leader: {
      name: "",
      email: "",
      rollNo: "",
      phone: ""
    },
    members: []
  });

  // Edit Modal Form State
  const [editForm, setEditForm] = useState<TeamData>(teamData);

  // Load Real Data from Firestore registrations & users collections matching assigned email
  useEffect(() => {
    const fetchRealTeamData = async () => {
      setLoading(true);
      const cleanEmail = user?.email?.toLowerCase().trim() || "";

      try {
        // 1. Check User Document in Firestore
        let userDocData: any = null;
        if (user?.uid && !user.uid.startsWith("mock-uid")) {
          const uSnap = await getDoc(doc(db, "users", user.uid));
          if (uSnap.exists()) {
            userDocData = uSnap.data();
          }
        }

        // 2. Query Registrations Collection via backend
        let allRegs: any[] = [];
        try {
          const regs = await fetchRegistrations();
          if (Array.isArray(regs)) {
            allRegs = regs.map((r: any) => ({ id: r.id || r._id || "", ...r }));
          }
        } catch (e) {
          console.warn("Failed to fetch registrations via API, falling back to empty list:", e);
          allRegs = [];
        }

        let targetReg: any = null;

        if (allRegs.length > 0) {
          // Rank 0: Match by registrationId stored in user profile (exact link)
          if (!targetReg && user?.registrationId) {
            targetReg = allRegs.find((r) => r.id === user.registrationId);
          }

          // Rank 1: Match by exact assigned email in teamLeadEmail, teamEmail, or members array
          if (!targetReg && cleanEmail) {
            targetReg = allRegs.find((r) => {
              const leadEmail = (r.teamLeadEmail || "").toLowerCase().trim();
              const tEmail = (r.teamEmail || "").toLowerCase().trim();
              if (leadEmail === cleanEmail) return true;
              if (tEmail === cleanEmail) return true;
              if (Array.isArray(r.members) && r.members.some((m: any) => m.email?.toLowerCase().trim() === cleanEmail)) return true;
              return false;
            });
          }

          // Rank 2: Match by userDocData teamName or user.teamName (if specific)
          if (!targetReg) {
            const teamNameToMatch = userDocData?.teamName || user?.teamName;
            if (teamNameToMatch) {
              const tn = teamNameToMatch.toLowerCase().trim();
              if (tn !== "team alpha-9" && tn !== "my team") {
                targetReg = allRegs.find((r) => (r.groupName || "").toLowerCase().trim() === tn);
              }
            }
          }

          // Rank 3: Match by userDocData eventTitle (only if single registration for that event)
          if (!targetReg && userDocData?.eventTitle) {
            const eventMatches = allRegs.filter((r) => (r.eventTitle || "").toLowerCase().trim() === userDocData.eventTitle.toLowerCase().trim());
            if (eventMatches.length === 1) {
              targetReg = eventMatches[0];
            }
          }

          // NO fallback to random team — only show the participant's own team
        }

        if (targetReg) {
          const targetRegId = targetReg.id;
          const loadedTeamName = targetReg.groupName || userDocData?.teamName || user?.teamName || "alphaa";
          const loadedTeamId = targetRegId ? `AV-${targetRegId.substring(0, 6).toUpperCase()}` : "AV-REG01";
          const loadedInstitution = targetReg.branch ? `${targetReg.branch} Department` : (targetReg.institution || "Computer Science & Engineering");
          const loadedTrack = targetReg.eventTitle || "test hackthon";

          let leaderInfo = {
            name: targetReg.teamLeadName || "Team Lead",
            email: targetReg.teamLeadEmail || cleanEmail || "",
            rollNo: targetReg.teamLeadStudentId || "",
            phone: targetReg.phoneNumber || targetReg.teamLeadPhone || ""
          };

          let loadedMembers: TeamMember[] = [];

          if (Array.isArray(targetReg.members) && targetReg.members.length > 0) {
            // Check if the members array contains an explicit leader entry
            const leaderIndex = targetReg.members.findIndex((m: any) => {
              const r = (m.role || "").toLowerCase().trim();
              return r === "leader" || r === "team lead" || r === "lead" || m.isLead === true;
            });

            if (leaderIndex !== -1) {
              const leaderMember = targetReg.members[leaderIndex];
              leaderInfo = {
                name: leaderMember.name || leaderInfo.name,
                email: leaderMember.email || leaderInfo.email,
                rollNo: leaderMember.studentId || leaderMember.rollNo || leaderInfo.rollNo,
                phone: leaderMember.phoneNumber || leaderMember.phone || leaderInfo.phone
              };

              // All other entries in the array (except the one at leaderIndex) are teammates!
              loadedMembers = targetReg.members
                .filter((_m: any, idx: number) => idx !== leaderIndex)
                .map((m: any) => ({
                  name: m.name || "Team Member",
                  role: m.role || "Developer",
                  rollNo: m.studentId || m.rollNo || "N/A",
                  email: m.email || "N/A",
                  phone: m.phoneNumber || m.phone || "N/A"
                }));
            } else {
              // The members array contains ONLY additional teammates (or leader is not in members array)
              // If the first member matches the leader exactly by name & studentId, exclude it; otherwise include all
              const isFirstMemberLeader = 
                targetReg.members.length > 1 &&
                targetReg.members[0].name === leaderInfo.name &&
                (targetReg.members[0].studentId === leaderInfo.rollNo || targetReg.members[0].rollNo === leaderInfo.rollNo);

              const membersToMap = isFirstMemberLeader ? targetReg.members.slice(1) : targetReg.members;

              loadedMembers = membersToMap.map((m: any) => ({
                name: m.name || "Team Member",
                role: m.role || "Developer",
                rollNo: m.studentId || m.rollNo || "N/A",
                email: m.email || "N/A",
                phone: m.phoneNumber || m.phone || "N/A"
              }));
            }
          }

          const freshTeamData: TeamData = {
            docId: targetRegId,
            teamName: loadedTeamName,
            teamId: loadedTeamId,
            status: targetReg.status || "Registered",
            institution: loadedInstitution,
            projectTrack: loadedTrack,
            leader: leaderInfo,
            members: loadedMembers
          };

          setTeamData(freshTeamData);
          setEditForm(freshTeamData);
        } else {
          // If Firestore has 0 registrations in database
          const defaultTeamData: TeamData = {
            teamName: userDocData?.teamName || user?.teamName || "My Team",
            teamId: user?.uid ? `AV-${user.uid.substring(0, 6).toUpperCase()}` : "AV-REG",
            status: "Registered",
            institution: userDocData?.institution || "Not Specified",
            projectTrack: userDocData?.eventTitle || "General Track",
            leader: {
              name: userDocData?.name || user?.name || "Participant",
              email: cleanEmail,
              rollNo: userDocData?.studentId || "",
              phone: userDocData?.phoneNumber || ""
            },
            members: []
          };
          setTeamData(defaultTeamData);
          setEditForm(defaultTeamData);
        }
      } catch (err) {
        console.error("Error fetching database team data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRealTeamData();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleOpenEditModal = () => {
    setEditForm(JSON.parse(JSON.stringify(teamData)));
    setShowEditModal(true);
  };

  const handleLeaderChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      leader: {
        ...prev.leader,
        [field]: value
      }
    }));
  };

  const handleMemberChange = (index: number, field: string, value: string) => {
    const updatedMembers = [...editForm.members];
    updatedMembers[index] = {
      ...updatedMembers[index],
      [field]: value
    };
    setEditForm(prev => ({ ...prev, members: updatedMembers }));
  };

  const handleAddMember = () => {
    const newMember: TeamMember = {
      name: "",
      role: "Developer",
      rollNo: "",
      email: "",
      phone: ""
    };
    setEditForm(prev => ({ ...prev, members: [...prev.members, newMember] }));
  };

  const handleRemoveMember = (index: number) => {
    const updated = editForm.members.filter((_, i) => i !== index);
    setEditForm(prev => ({ ...prev, members: updated }));
  };

  const handleSaveTeamDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (user?.email) {
        const cleanEmail = user.email.toLowerCase().trim();
        const docId = user.uid && !user.uid.startsWith("mock-uid") 
          ? user.uid 
          : cleanEmail.replace(/[^a-z0-9]/g, '_');

        const userDocRef = doc(db, "users", docId);
        await setDoc(userDocRef, {
          teamName: editForm.teamName,
          institution: editForm.institution,
          eventTitle: editForm.projectTrack,
          teamLeadName: editForm.leader.name,
          teamLeadEmail: editForm.leader.email,
          studentId: editForm.leader.rollNo,
          phoneNumber: editForm.leader.phone,
          members: editForm.members,
          updatedAt: Date.now()
        }, { merge: true });
      }

      if (editForm.docId) {
        const regRef = doc(db, "registrations", editForm.docId);
        const updatedMembersPayload = [
          {
            name: editForm.leader.name,
            studentId: editForm.leader.rollNo,
            email: editForm.leader.email,
            role: "LEADER"
          },
          ...editForm.members.map(m => ({
            name: m.name,
            studentId: m.rollNo,
            email: m.email,
            role: m.role || "DEVELOPER"
          }))
        ];

        await updateDoc(regRef, {
          groupName: editForm.teamName,
          eventTitle: editForm.projectTrack,
          teamLeadName: editForm.leader.name,
          teamLeadEmail: editForm.leader.email,
          teamLeadStudentId: editForm.leader.rollNo,
          phoneNumber: editForm.leader.phone,
          members: updatedMembersPayload,
          updatedAt: Date.now()
        });
      }

      setTeamData(editForm);
      setShowEditModal(false);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 4000);
    } catch (err) {
      console.error("Failed to save team details to Firestore:", err);
      alert("Failed to save team changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderContentArea = () => (
    <div className="space-y-8">
      {/* Toast Notification */}
      {saveSuccessNotice && (
        <div className="bg-emerald-500 text-white font-semibold text-sm px-6 py-3.5 rounded-2xl shadow-lg flex items-center gap-3 animate-fade-in">
          <Check className="w-5 h-5 text-white" />
          <span>Team details updated and saved successfully!</span>
        </div>
      )}

      {/* Page Title & Description */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Review Your Team
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1.5">
          Please verify your team information before continuing to the project submission.
        </p>
      </div>

      {/* Team Overview Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-[#0F172A]">{teamData.teamName || "Unnamed Team"}</h2>
            <span className="bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-xs px-3.5 py-1 rounded-full">
              {teamData.status}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span className="bg-[#0F172A] text-blue-300 font-mono text-[11px] px-2 py-0.5 rounded font-bold border border-slate-800">
              ID: {teamData.teamId || "N/A"}
            </span>
            <span className="text-slate-300">•</span>
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>{teamData.institution || "Not Specified"}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 self-end md:self-auto">
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              PROJECT TRACK
            </span>
            <span className="text-sm font-bold text-[#0F172A] mt-0.5 block">
              {teamData.projectTrack || "General Track"}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 border border-blue-100">
            <Cpu className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Team Section Headers & Cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Header */}
          <div className="md:col-span-1">
            <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              TEAM LEADER
            </span>
          </div>

          {/* Right Header */}
          <div className="md:col-span-2">
            <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              TEAM MEMBERS ({teamData.members.length})
            </span>
          </div>
        </div>

        {/* Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Leader Card */}
          <div className="bg-white border-2 border-blue-500/30 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between items-center text-center relative h-[360px]">
            
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-[10px] px-3.5 py-1 rounded-full flex items-center gap-1 absolute top-4 right-4 shadow-sm shadow-blue-500/25">
              <Star className="w-3 h-3 fill-current text-amber-300" /> Leader
            </span>

            <div className="mt-2 flex flex-col items-center">
              {/* Styled Initials Avatar */}
              <div className="w-24 h-24 rounded-full border-4 border-blue-100 bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-black text-2xl shadow-sm mx-auto ring-2 ring-blue-500/20">
                <span>{getInitials(teamData.leader.name)}</span>
              </div>
              
              <h3 className="text-lg font-extrabold text-[#0F172A] mt-3 leading-snug">
                {teamData.leader.name || "Leader"}
              </h3>
              <p className="text-xs font-bold text-blue-600 mt-0.5">
                {teamData.leader.rollNo || "No Roll No"}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 w-full text-left space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate font-medium">{teamData.leader.email || "No Email"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium">{teamData.leader.phone || "No Phone"}</span>
              </div>
            </div>

          </div>

          {/* Real Team Members Cards */}
          {teamData.members.length > 0 ? (
            teamData.members.map((member, idx) => (
              <div key={idx} className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[360px]">
                <div className="flex items-start gap-4">
                  {/* Member Initials Avatar */}
                  <div className="w-14 h-14 rounded-full bg-slate-100 text-[#0F172A] font-bold flex items-center justify-center text-sm border border-slate-200 shrink-0 shadow-xs">
                    <span>{getInitials(member.name)}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-[#0F172A]">{member.name || `Member ${idx + 1}`}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{member.role || "Developer"}</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 w-full text-left space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Roll No</span>
                    <span className="font-bold text-[#0F172A]">{member.rollNo || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate pt-1 border-t border-slate-200/60">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-medium">{member.email || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{member.phone || "N/A"}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-2 bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-center flex flex-col items-center justify-center space-y-3 min-h-[360px]">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#0F172A]">No Additional Teammates Added</h4>
                <p className="text-xs text-slate-500 font-medium mt-1 max-w-sm mx-auto">
                  You are registered as a solo participant or haven't listed teammates yet. Click below to add your team members.
                </p>
              </div>
              <button
                onClick={handleOpenEditModal}
                className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 mt-2 cursor-pointer border border-blue-200/60"
              >
                <Plus className="w-4 h-4" /> Add Team Members
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Footer Notice & Action Bar */}
      <div className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium max-w-xl">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Info className="w-4 h-4 text-blue-600" />
          </div>
          <span>
            Please verify that all team information is correct. Any changes required must be made before continuing to project submission.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleOpenEditModal}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 py-3 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Edit3 className="w-4 h-4 text-slate-500" />
            <span>Edit Team Details</span>
          </button>

          <button
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              } else {
                navigate("/participant/dashboard");
              }
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Confirm & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );

  const renderEditModal = () => (
    showEditModal && (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative border border-slate-100 max-h-[90vh] overflow-y-auto text-left">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Edit Team Details</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Update team members, roles, and contact details.</p>
            </div>
            <button 
              onClick={() => setShowEditModal(false)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveTeamDetails} className="space-y-6">
            
            {/* General Team Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Team Name</label>
                <input 
                  type="text" 
                  value={editForm.teamName} 
                  onChange={(e) => setEditForm({ ...editForm, teamName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-hidden focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Institution / Department</label>
                <input 
                  type="text" 
                  value={editForm.institution} 
                  onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-hidden focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Leader Info */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold text-blue-700 uppercase block tracking-wider">Team Leader Details</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">Leader Name</label>
                  <input 
                    type="text" 
                    value={editForm.leader.name} 
                    onChange={(e) => handleLeaderChange("name", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">Roll No / ID</label>
                  <input 
                    type="text" 
                    value={editForm.leader.rollNo} 
                    onChange={(e) => handleLeaderChange("rollNo", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">Email</label>
                  <input 
                    type="email" 
                    value={editForm.leader.email} 
                    onChange={(e) => handleLeaderChange("email", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">Phone</label>
                  <input 
                    type="text" 
                    value={editForm.leader.phone} 
                    onChange={(e) => handleLeaderChange("phone", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Teammates List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Team Members</span>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Member
                </button>
              </div>

              {editForm.members.map((member, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Member #{idx + 1}</span>
                    <button 
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">Full Name</label>
                      <input 
                        type="text" 
                        value={member.name} 
                        onChange={(e) => handleMemberChange(idx, "name", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">Role in Team</label>
                      <input 
                        type="text" 
                        value={member.role} 
                        onChange={(e) => handleMemberChange(idx, "role", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">Roll No / Student ID</label>
                      <input 
                        type="text" 
                        value={member.rollNo} 
                        onChange={(e) => handleMemberChange(idx, "rollNo", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">Email Address</label>
                      <input 
                        type="email" 
                        value={member.email} 
                        onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600">Phone Number</label>
                      <input 
                        type="text" 
                        value={member.phone} 
                        onChange={(e) => handleMemberChange(idx, "phone", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#2563EB] text-white font-bold text-xs hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-500/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Team Details</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    )
  );

  if (embedded) {
    return (
      <div className="space-y-8 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading team information...</p>
          </div>
        ) : (
          renderContentArea()
        )}
        {renderEditModal()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-800 antialiased selection:bg-blue-500/20 selection:text-blue-600 relative">
      <SEO 
        title="Review Your Team - AI Verse Participant Portal" 
        description="Verify your real team details before project submission."
      />

      {/* Standalone Left Sidebar - Modern Clean Light Theme */}
      <aside className="w-64 border-r border-slate-200/90 bg-white flex flex-col justify-between shrink-0 p-6 z-20 shadow-xs">
        <div className="space-y-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img src="/ai_verse.png" alt="AI Verse Logo" className="w-9 h-9 rounded-xl object-contain shadow-sm shadow-blue-500/20 ring-1 ring-slate-200" />
            </div>
            <div>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight font-sans block leading-none">
                AI Verse
              </span>
              <span className="text-[10px] text-blue-600 font-bold tracking-wider block mt-1 uppercase">
                Participant Portal
              </span>
            </div>
          </Link>

          <nav className="space-y-1.5">
            <button
              onClick={() => navigate("/participant/dashboard")}
              className="w-full px-4 py-3 rounded-2xl flex items-center gap-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-all text-left cursor-pointer"
            >
              <LayoutDashboard className="w-5 h-5 text-slate-500" />
              Dashboard
            </button>

            <button
              onClick={() => navigate("/participant/set-password")}
              className="w-full px-4 py-3 rounded-2xl flex items-center gap-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-all text-left cursor-pointer"
            >
              <Key className="w-5 h-5 text-slate-500" />
              Set Password
            </button>

            <button
              className="w-full px-4 py-3 rounded-2xl flex items-center gap-3.5 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-500/30 text-left cursor-pointer"
            >
              <Users className="w-5 h-5 text-white" />
              Review Team
            </button>

            <button
              onClick={() => navigate("/participant/dashboard")}
              className="w-full px-4 py-3 rounded-2xl flex items-center gap-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-all text-left cursor-pointer"
            >
              <Upload className="w-5 h-5 text-slate-500" />
              Project Submission
            </button>

            <button
              onClick={() => navigate("/participant/dashboard")}
              className="w-full px-4 py-3 rounded-2xl flex items-center gap-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-all text-left cursor-pointer"
            >
              <BarChart2 className="w-5 h-5 text-slate-500" />
              Submission Status
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:text-red-600 font-semibold text-sm transition-colors text-left cursor-pointer rounded-xl hover:bg-red-50"
          >
            <LogOut className="w-5 h-5 text-slate-500 hover:text-red-600" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col bg-[#F4F7FC]">
        <header className="h-16 px-8 border-b border-slate-200/60 bg-white flex items-center justify-between sticky top-0 z-10 shadow-xs">
          <div className="flex items-center gap-2.5 text-[#0F172A] font-bold text-xs">
            <Users className="w-4 h-4 text-blue-600" />
            <span>{loading ? "Loading Team..." : (teamData.teamName || "Unnamed Team")}</span>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-700 rounded-xl relative transition-colors cursor-pointer">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm ring-2 ring-white">
              <span>{getInitials(teamData.leader.name)}</span>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading team information...</p>
          </div>
        ) : (
          <main className="p-8 space-y-8 max-w-6xl w-full mx-auto overflow-y-auto">
            {renderContentArea()}
          </main>
        )}
      </div>

      {renderEditModal()}
    </div>
  );
};

export default TeamReviewPage;
