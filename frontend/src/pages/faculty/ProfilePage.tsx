import React, { useState, useEffect, useRef } from "react";
import SEO from "../../components/layout/SEO";
import Button from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../config/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, 
  Edit3, 
  Users, 
  Lock, 
  Bell, 
  ShieldCheck, 
  ChevronRight, 
  BookOpen, 
  Check,
  CheckCircle2 
} from "lucide-react";


const ProfilePage: React.FC = () => {
  const { user } = useAuth();


  // Profile data state
  const [profile, setProfile] = useState({
    name: user?.name || "Dr. Sarah Chen",
    role: user?.role === "faculty" ? "Senior AI Researcher & Faculty Coordinator" : "Senior Coordinator",
    department: "Department of Computer Science & Artificial Intelligence",
    email: user?.email || "sarah.chen@azure.edu",
    phone: "+1 (555) 012-3456",
    office: "Turing Wing, Room 402B",
    timezone: "GMT -05:00 (EST)",
    bio: "Pioneering researcher in the field of Large Language Models and Neural Architecture. Over 15 years of experience in both academia and industry-leading labs. Currently focused on ethical AI frameworks and high-performance generative systems. Dedicated to mentoring the next generation of innovators in computational science.",
    image: ""
  });

  const [isEditing, setIsEditing] = useState(false);
  const [tempBio, setTempBio] = useState(profile.bio);
  const [tempPhone, setTempPhone] = useState(profile.phone);
  const [tempOffice, setTempOffice] = useState(profile.office);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setProfile(prev => ({ ...prev, image: base64 }));
        if (user?.uid) {
          try {
            const docRef = doc(db, "users", user.uid);
            await setDoc(docRef, { image: base64 }, { merge: true });
            addToast("Profile photo updated successfully!", "success");
          } catch (err) {
            console.error("Error saving photo:", err);
            addToast("Failed to save profile photo.", "error");
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Toast notifications state
  interface ToastMessage {
    id: string;
    text: string;
    type: "success" | "info" | "warning" | "error";
  }
  const [toastQueue, setToastQueue] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: ToastMessage["type"] = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToastQueue(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToastQueue(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Load profile from Firestore
  useEffect(() => {
    const loadProfileData = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const dbData = docSnap.data();
          const loadedProfile = {
            name: dbData.name || user.name || "Dr. Sarah Chen",
            role: dbData.role || (user.role === "faculty" ? "Senior AI Advisor & Faculty Coordinator" : "Senior Coordinator"),
            department: dbData.department || "Department of Computer Science & Artificial Intelligence",
            email: dbData.email || user.email || "sarah.chen@azure.edu",
            phone: dbData.phone || "+1 (555) 012-3456",
            office: dbData.office || "Turing Wing, Room 402B",
            timezone: dbData.timezone || "GMT -05:00 (EST)",
            bio: dbData.bio || "Pioneering researcher in the field of Large Language Models and Neural Architecture. Over 15 years of experience in both academia and industry-leading labs. Currently focused on ethical AI frameworks and high-performance generative systems. Dedicated to mentoring the next generation of innovators in computational science.",
            image: dbData.image || ""
          };
          
          setProfile(loadedProfile);
          setTempBio(loadedProfile.bio);
          setTempPhone(loadedProfile.phone);
          setTempOffice(loadedProfile.office);
        } else {
          // Document doesn't exist, create it with default profile information
          const defaultData = {
            name: user.name || "Dr. Sarah Chen",
            role: user.role === "faculty" ? "Faculty Advisor" : "Senior Coordinator",
            email: user.email,
            phone: "+1 (555) 012-3456",
            office: "Turing Wing, Room 402B",
            timezone: "GMT -05:00 (EST)",
            bio: "Pioneering researcher in the field of Large Language Models and Neural Architecture. Over 15 years of experience in both academia and industry-leading labs. Currently focused on ethical AI frameworks and high-performance generative systems. Dedicated to mentoring the next generation of innovators in computational science.",
            department: "Department of Computer Science & Artificial Intelligence"
          };
          await setDoc(docRef, defaultData, { merge: true });
        }
      } catch (err) {
        console.error("Error loading profile from Firestore:", err);
        addToast("Failed to load profile. Using local defaults.", "warning");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, [user]);

  // Handle Edit/Save Click
  const handleEditToggle = async () => {
    if (isEditing) {
      if (!user?.uid) {
        addToast("No active session. Changes could not be saved to the database.", "error");
        return;
      }
      setIsSaving(true);
      try {
        const docRef = doc(db, "users", user.uid);
        const updatedFields = {
          bio: tempBio,
          phone: tempPhone,
          office: tempOffice
        };
        
        await setDoc(docRef, updatedFields, { merge: true });
        
        setProfile(prev => ({
          ...prev,
          ...updatedFields
        }));
        
        addToast("Profile information updated successfully!", "success");
      } catch (err) {
        console.error("Error saving profile to Firestore:", err);
        addToast("Failed to save changes. Please try again.", "error");
      } finally {
        setIsSaving(false);
      }
    } else {
      setTempBio(profile.bio);
      setTempPhone(profile.phone);
      setTempOffice(profile.office);
    }
    setIsEditing(!isEditing);
  };

  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-[400px] flex items-center justify-center p-8 rounded-[32px] border border-slate-100">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#2563EB] border-t-transparent mx-auto"></div>
          <div className="text-slate-500 font-extrabold text-xs uppercase tracking-widest">
            Retrieving profile records from database...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left relative font-sans">
      <SEO 
        title="Faculty Profile - Educational Administration" 
        description="View professional credentials, publications record, and management metrics for Dr. Sarah Chen." 
        keywords="Faculty profile, AI research, Educational Coordinator, AI Verse"
      />

      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toastQueue.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-4 rounded-xl shadow-lg flex items-center gap-3 border text-sm font-semibold 
                ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : ""}
                ${toast.type === "info" ? "bg-blue-50 border-blue-200 text-blue-800" : ""}
                ${toast.type === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : ""}
                ${toast.type === "error" ? "bg-red-50 border-red-200 text-red-800" : ""}`}
            >
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ================= ROW 1: MAIN BIOGRAPHY HEADER CARD ================= */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar Container */}
          <div className="relative">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              className="hidden"
              accept="image/*"
            />
            {profile.image ? (
              <img 
                src={profile.image} 
                alt={profile.name} 
                className="w-28 h-28 rounded-full object-cover border-4 border-slate-50 shadow-md shrink-0"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-3xl border-4 border-slate-50 shadow-md shrink-0 font-sans">
                {(() => {
                  if (!profile.name) return "AV";
                  const parts = profile.name.trim().split(/\s+/);
                  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                  return parts[0].substring(0, 2).toUpperCase();
                })()}
              </div>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white flex items-center justify-center border-2 border-white shadow transition-all animate-bounce-subtle"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center sm:text-left space-y-1.5">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{profile.name}</h2>
            <div className="text-sm font-extrabold text-[#2563EB]">{profile.role}</div>
            <div className="text-xs text-slate-400 font-semibold flex items-center justify-center sm:justify-start gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-350" />
              {profile.department}
            </div>
          </div>
        </div>

        <Button 
          variant={isEditing ? "primary" : "outline"} 
          size="md"
          onClick={handleEditToggle}
          disabled={isSaving}
          className={`font-bold flex items-center justify-center gap-1.5 shrink-0 self-center md:self-auto rounded-xl px-5 transition-all
            ${isEditing 
              ? "bg-[#2563EB] hover:bg-blue-700 text-white border-transparent" 
              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            }`}
        >
          {isSaving ? (
            <>
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent mr-1"></span>
              Saving...
            </>
          ) : (
            <>
              {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              {isEditing ? "Save Changes" : "Edit Profile"}
            </>
          )}
        </Button>
      </div>

      {/* ================= ROW 2: SPLIT CONTENT GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Personal Information Card */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2 text-slate-800">
                <Users className="h-4.5 w-4.5 text-[#2563EB]" />
                <h3 className="text-sm font-black uppercase tracking-wider">Personal Information</h3>
              </div>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Email Address</span>
                <span className="text-xs font-bold text-slate-700 block break-all">{profile.email}</span>
              </div>
              
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Phone Number</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={tempPhone}
                    onChange={(e) => setTempPhone(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <span className="text-xs font-bold text-slate-700 block">{profile.phone}</span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Office Location</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={tempOffice}
                    onChange={(e) => setTempOffice(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <span className="text-xs font-bold text-slate-700 block">{profile.office}</span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Timezone</span>
                <span className="text-xs font-bold text-slate-700 block">{profile.timezone}</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-50 pt-4 text-left">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Bio</span>
              {isEditing ? (
                <textarea 
                  rows={4}
                  value={tempBio}
                  onChange={(e) => setTempBio(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <p className="text-xs font-medium text-slate-500 leading-relaxed">{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Research Highlights Card */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2 text-slate-800">
                <BookOpen className="h-4.5 w-4.5 text-[#2563EB]" />
                <h3 className="text-sm font-black uppercase tracking-wider">Research Highlights</h3>
              </div>
            </div>

            {/* Core Research Areas */}
            <div className="space-y-3 text-left">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider block">Core Research Areas</span>
              <div className="flex flex-wrap gap-2">
                {["Neural Networks", "Generative AI", "Transformer Models", "LLM Security"].map((area, idx) => (
                  <span 
                    key={idx}
                    className="text-[10px] font-bold text-[#2563EB] bg-blue-50 border border-blue-100/50 px-3 py-1 rounded-full shadow-sm"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>

            {/* Recent Publications */}
            <div className="space-y-3.5 text-left border-t border-slate-50 pt-5">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider block">Recent Publications</span>
              
              <div className="space-y-3">
                {/* Pub 1 */}
                <div className="border border-slate-100 rounded-2xl p-4 hover:bg-slate-50/50 transition-colors duration-250 flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-slate-800 leading-tight">Deciphering Emergent Behaviors in Multi-Modal LLMs</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">Journal of Artificial Intelligence Research (JAIR)</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-100/60 text-[9px] font-black px-2.5 py-0.5 rounded-full shrink-0">
                    2024
                  </span>
                </div>
                {/* Pub 2 */}
                <div className="border border-slate-100 rounded-2xl p-4 hover:bg-slate-50/50 transition-colors duration-250 flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-slate-800 leading-tight">Efficient Fine-Tuning of 100B+ Parameter Models</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">IEEE International Conference on Big Data</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-100/60 text-[9px] font-black px-2.5 py-0.5 rounded-full shrink-0">
                    2023
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4/12) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Security & Settings */}
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left border-b border-slate-50 pb-2">
              Security & Settings
            </h3>
            
            <div className="space-y-2">
              {/* Option 1 */}
              <button className="flex items-center justify-between w-full p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                  <Lock className="w-4 h-4 text-slate-400" />
                  Change Password
                </div>
                <ChevronRight className="w-4 h-4 text-slate-350" />
              </button>

              {/* Option 2 */}
              <button className="flex items-center justify-between w-full p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                  <Bell className="w-4 h-4 text-slate-400" />
                  Notification Preferences
                </div>
                <ChevronRight className="w-4 h-4 text-slate-350" />
              </button>

              {/* Option 3 */}
              <div className="flex items-center justify-between w-full p-3 bg-slate-50/50 border border-slate-100 rounded-2xl">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  Two-Factor Auth
                </div>
                <span className="bg-emerald-50 text-emerald-600 border border-emerald-100/50 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Active
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
