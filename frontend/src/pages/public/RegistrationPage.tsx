import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
  Users,
  Info,
  ShieldAlert,
  Loader2,
  Trash2,
  ClipboardList,
  Send,
  QrCode,
  UploadCloud,
  CheckCircle2,
  Eye,
  X,
  Receipt,
  ZoomIn
} from "lucide-react";
import SEO from "../../components/layout/SEO";
import Button from "../../components/ui/Button";
import { db } from "../../config/firebase";
import { doc, getDoc, getDocs, collection, addDoc, updateDoc, increment } from "firebase/firestore";
import { userService } from "../../services/userService";
import { fetchEvents, fetchEventById, createRegistration, uploadImage, sendEmail } from "../../services/apiClient";

interface Teammate {
  name: string;
  email: string;
  studentId: string;
  phone?: string;
}

interface EventData {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  minTeamSize: number;
  maxTeamSize: number;
  currentReg: number;
  maxReg: number;
  posterPreview?: string;
  registrationFee?: number;
  pricingType?: "per_person" | "per_team";
  pricingModel?: string;
  category?: string;
  isPaidEvent?: boolean;
  paymentQrImagePreview?: string;
  upiId?: string;
  allowRegistrations?: boolean;
}

const RegistrationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdRegId, setCreatedRegId] = useState("");

  // Step 1 Form States
  const [groupName, setGroupName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadCollegeEmail, setLeadCollegeEmail] = useState("");
  const [leadPersonalEmail, setLeadPersonalEmail] = useState("");
  const [leadStudentId, setLeadStudentId] = useState("");
  const [leadPhone, setLeadPhone] = useState("");

  // Step 2 Form States (Additional Members & Food Preferences)
  const [members, setMembers] = useState<Teammate[]>([]);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [confirmedInfo, setConfirmedInfo] = useState(false);

  // Step 3 Payment Proof States
  const [paymentProofPreview, setPaymentProofPreview] = useState("");
  const [paymentProofFilename, setPaymentProofFilename] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [showExampleProofModal, setShowExampleProofModal] = useState(false);
  const paymentProofFileInputRef = useRef<HTMLInputElement>(null);

  const isQuiz = Boolean(
    event?.category === "QUIZ" ||
    event?.category === "Quiz" ||
    event?.category?.toLowerCase()?.includes("quiz")
  );

  // Check if lead's college email belongs strictly to vishnu.edu.in
  const isVishnuDomain = leadCollegeEmail.trim().toLowerCase().endsWith("@vishnu.edu.in");

  const isPricingPerTeam = event?.pricingType === "per_team" || event?.pricingModel === "per_team";

  // Dynamic fee calculation per person
  const perPersonFee = React.useMemo(() => {
    if (isQuiz || isVishnuDomain) {
      return 0; // 100% Free for Quiz or Vishnu Educational Society students
    }
    return Number(event?.registrationFee) || 0; // Standard event fee for all other colleges
  }, [event, isVishnuDomain, isQuiz]);

  const totalTeamMembers = isQuiz ? 1 : members.length + 1;
  const totalRegistrationFee = (isQuiz || isVishnuDomain)
    ? 0
    : isPricingPerTeam
      ? (Number(event?.registrationFee) || 0)
      : perPersonFee * totalTeamMembers;
  const requiresPaymentProof = !isQuiz && !isVishnuDomain && totalRegistrationFee > 0;

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        // 1. Try Backend MongoDB API first
        try {
          let backendEvent: any = null;
          try {
            backendEvent = await fetchEventById(id);
          } catch (e) {
            const allEvents = await fetchEvents().catch(() => []);
            backendEvent = (allEvents || []).find((ev: any) => 
              ev.id === id || 
              ev._id === id || 
              (ev.title && ev.title.toLowerCase().replace(/[^a-z0-9]/g, "-").includes(id.toLowerCase()))
            );
          }

          if (backendEvent && (backendEvent.id || backendEvent._id)) {
            const minT = Number(backendEvent.minTeamSize || backendEvent.teamSizeMin) || 1;
            const maxT = Number(backendEvent.maxTeamSize || backendEvent.teamSizeMax) || 1;

            let timeText = backendEvent.time || "10:00 AM";
            if (backendEvent.startTime) {
              timeText = backendEvent.startTime;
              if (backendEvent.endTime) timeText += ` - ${backendEvent.endTime}`;
            }

            setEvent({
              id: backendEvent.id || backendEvent._id,
              title: backendEvent.title || "",
              date: backendEvent.date || "Oct 24",
              time: timeText,
              location: backendEvent.location || backendEvent.venue || "Virtual Hub",
              minTeamSize: minT,
              maxTeamSize: maxT,
              currentReg: Math.max(0, Number(backendEvent.currentReg) || 0),
              maxReg: Number(backendEvent.maxReg || backendEvent.maxParticipants) || 100,
              posterPreview: backendEvent.posterPreview || backendEvent.coverImage || backendEvent.bannerImage || backendEvent.banner || "",
              registrationFee: backendEvent.registrationFee !== undefined ? backendEvent.registrationFee : (backendEvent.fee || 0),
              pricingType: backendEvent.pricingType === "per_team" || backendEvent.pricingModel === "per_team" ? "per_team" : "per_person",
              pricingModel: backendEvent.pricingModel || backendEvent.pricingType || "per_person",
              category: backendEvent.category || "Workshop",
              isPaidEvent: backendEvent.isPaidEvent !== undefined ? Boolean(backendEvent.isPaidEvent) : (Number(backendEvent.registrationFee || backendEvent.fee) > 0),
              paymentQrImagePreview: backendEvent.paymentQrImagePreview || backendEvent.paymentQr || "",
              upiId: backendEvent.upiId || "",
              allowRegistrations: backendEvent.allowRegistrations !== undefined ? backendEvent.allowRegistrations : (backendEvent.registrationOpen !== false),
            });

            const initialTeammatesCount = Math.max(0, minT - 1);
            const initialMembers = Array.from({ length: initialTeammatesCount }, () => ({
              name: "",
              email: "",
              studentId: "",
            }));
            setMembers(initialMembers);
            setLoading(false);
            return;
          }
        } catch (backendErr) {
          console.warn("[RegistrationPage] Backend event fetch notice:", backendErr);
        }

        // 2. Fallback to Firestore
        let docSnap = await getDoc(doc(db, "events", id));
        if (!docSnap.exists()) {
          const cleanId = id.replace(/[Il]/g, "i").toLowerCase();
          const allEventsSnap = await getDocs(collection(db, "events"));
          const matchedDoc = allEventsSnap.docs.find(d =>
            d.id.toLowerCase() === id.toLowerCase() ||
            d.id.replace(/[Il]/g, "i").toLowerCase() === cleanId
          );
          if (matchedDoc) {
            docSnap = matchedDoc;
          }
        }

        if (docSnap.exists()) {
          const data = docSnap.data();
          const minT = data.minTeamSize || 1;
          const maxT = data.maxTeamSize || 1;

          let timeText = data.time || "10:00 AM";
          if (data.startTime) {
            timeText = data.startTime;
            if (data.endTime) timeText += ` - ${data.endTime}`;
          }

          setEvent({
            id: docSnap.id,
            title: data.title || "",
            date: data.date || "Oct 24",
            time: timeText,
            location: data.location || "Virtual Hub",
            minTeamSize: minT,
            maxTeamSize: maxT,
            currentReg: Math.max(0, Number(data.currentReg) || 0),
            maxReg: data.maxReg || 100,
            posterPreview: data.posterPreview || "",
            registrationFee: data.registrationFee !== undefined ? data.registrationFee : 0,
            pricingType: data.pricingType === "per_team" || data.pricingModel === "per_team" ? "per_team" : "per_person",
            pricingModel: data.pricingModel || data.pricingType || "per_person",
            category: data.category || "Workshop",
            isPaidEvent: data.isPaidEvent !== undefined ? Boolean(data.isPaidEvent) : (Number(data.registrationFee) > 0),
            paymentQrImagePreview: data.paymentQrImagePreview || data.paymentQr || "",
            upiId: data.upiId || "",
            allowRegistrations: data.allowRegistrations !== undefined ? data.allowRegistrations : true
          });

          // Initialize members array to satisfy minTeamSize (excluding lead)
          const initialTeammatesCount = Math.max(0, minT - 1);
          const initialMembers = Array.from({ length: initialTeammatesCount }, () => ({
            name: "",
            email: "",
            studentId: ""
          }));
          setMembers(initialMembers);
        }
      } catch (err) {
        console.error("Error loading event for registration:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  const handleAddTeammate = () => {
    if (event && members.length < event.maxTeamSize - 1) {
      setMembers([...members, { name: "", email: "", studentId: "" }]);
    }
  };

  const handleRemoveTeammate = (index: number) => {
    if (event && members.length > event.minTeamSize - 1) {
      setMembers(members.filter((_, idx) => idx !== index));
    }
  };

  const handleMemberChange = (index: number, field: keyof Teammate, value: string) => {
    setMembers(prev => prev.map((m, idx) => idx === index ? { ...m, [field]: value } : m));
  };

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const validateStep1 = () => {
    if (!isQuiz && event && event.maxTeamSize > 1 && !groupName.trim()) {
      alert("Please enter a Group/Team Name.");
      return false;
    }
    if (!leadName.trim()) {
      alert(isQuiz ? "Please enter your Full Name." : "Please enter the Team Lead's name.");
      return false;
    }
    if (!leadStudentId.trim()) {
      alert(isQuiz ? "Please enter your Regd No / Roll No." : "Please enter the Team Lead's Student ID.");
      return false;
    }
    if (leadStudentId.includes("@")) {
      alert(isQuiz ? "Regd No / Roll No should not be an email address. Please check your inputs." : "Team Lead Student ID should not be an email address. Please check your inputs.");
      return false;
    }
    if (!leadCollegeEmail.trim()) {
      alert(isQuiz ? "Please enter your College Mail." : "Please enter the Team Lead's College / Institutional Email address.");
      return false;
    }
    if (leadCollegeEmail.trim().toLowerCase().endsWith("@gmail.com") || leadCollegeEmail.trim().toLowerCase().endsWith("@googlemail.com")) {
      alert("College Email cannot be @gmail.com. Please enter your official college / institutional email ID (any domain except @gmail.com), and use the Personal Email field for your personal Gmail.");
      return false;
    }
    if (!leadPersonalEmail.trim() || !EMAIL_REGEX.test(leadPersonalEmail.trim())) {
      alert(isQuiz ? "Please enter a valid Personal Mail address (e.g. personal@gmail.com)." : "Please enter a valid Team Lead Personal Email address (e.g. personal@gmail.com) for event updates and credentials.");
      return false;
    }
    if (!leadPhone.trim()) {
      alert(isQuiz ? "Please enter your Phone Number." : "Please enter the Team Lead's Phone Number.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (!member.name.trim()) {
        alert(`Please enter a name for Member ${i + 1}.`);
        return false;
      }
      if (!member.email.trim() || !EMAIL_REGEX.test(member.email.trim())) {
        alert(`Please enter a valid email address with a domain (e.g. member@college.edu.in or member@gmail.com) for Member ${i + 1}.`);
        return false;
      }
      if (!member.studentId.trim()) {
        alert(`Please enter a Student ID for Member ${i + 1}.`);
        return false;
      }
      if (member.studentId.includes("@")) {
        alert(`Student ID for Member ${i + 1} appears to be an email address. Please make sure Email and Student ID fields are not swapped.`);
        return false;
      }
    }

    return true;
  };

  const compressPaymentProof = (base64Str: string, maxDimension = 1000, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  const handlePaymentProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Payment screenshot image should be less than 15MB.");
      return;
    }

    setPaymentProofFilename(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        try {
          // Compress the payment proof image to fit comfortably within Firestore's 1MB limit (~50-100KB)
          const compressed = await compressPaymentProof(reader.result, 1000, 0.72);
          setPaymentProofPreview(compressed);
        } catch (err) {
          console.error("Payment proof compression error:", err);
          setPaymentProofPreview(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!id || !event) return;
    if (event.allowRegistrations === false) {
      alert("Registrations for this event are currently closed.");
      return;
    }

    // Check payment proof only when total fee is required
    if (requiresPaymentProof) {
      if (!paymentProofPreview) {
        alert("Please upload your payment screenshot/proof before submitting.");
        return;
      }
      if (!transactionId.trim()) {
        alert("Please enter the UPI Transaction ID / UTR Number from your payment receipt.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const foodPreferenceText = "Standard Entry";

      // Ensure payment proof is well compressed before writing to Firestore document (safely under 1MB limit)
      let compressedProof = "";
      if (requiresPaymentProof && paymentProofPreview) {
        if (paymentProofPreview.length > 400000) {
          compressedProof = await compressPaymentProof(paymentProofPreview, 850, 0.65);
        } else {
          compressedProof = paymentProofPreview;
        }
      }

      // Upload Payment Proof to Cloudinary
      let cloudinaryProofUrl = "";
      if (requiresPaymentProof && paymentProofPreview) {
        try {
          const uploadRes = await uploadImage(paymentProofPreview, "ai_verse_payment_proofs");
          if (uploadRes?.secure_url) {
            cloudinaryProofUrl = uploadRes.secure_url;
          }
        } catch (upErr) {
          console.warn("[RegistrationPage] Cloudinary upload notice, using compressed data URI:", upErr);
        }
      }

      const commonQuizPassword = "Aiverse@vitb";
      const isEventLoginAllowed = Boolean((event as any)?.allowLoginAccess);

      const payload: any = {
        eventId: event.id,
        eventTitle: event.title,
        category: event.category || (isQuiz ? "QUIZ" : "Tech Event"),
        isQuiz: Boolean(isQuiz),
        groupName: isQuiz ? "Individual Registration" : (event.maxTeamSize > 1 ? groupName : "Individual RSVP"),
        fullName: leadName.trim(),
        teamLeadName: leadName.trim(),
        teamLeadEmail: leadPersonalEmail.trim() || leadCollegeEmail.trim(), // Primary communication email for credentials & updates
        teamLeadCollegeEmail: leadCollegeEmail.trim(),
        teamLeadPersonalEmail: leadPersonalEmail.trim(),
        collegeEmail: leadCollegeEmail.trim(),
        personalEmail: leadPersonalEmail.trim(),
        email: leadPersonalEmail.trim() || leadCollegeEmail.trim(),
        teamLeadStudentId: leadStudentId.trim(),
        studentId: leadStudentId.trim(),
        rollNo: leadStudentId.trim(),
        teamLeadPhone: leadPhone.trim(),
        phoneNumber: leadPhone.trim(),
        phone: leadPhone.trim(),
        teamPassword: isQuiz ? commonQuizPassword : undefined,
        accessGranted: isQuiz ? isEventLoginAllowed : false,
        loginAccessGranted: isQuiz ? isEventLoginAllowed : false,
        members: isQuiz ? [] : members,
        teamSize: isQuiz ? 1 : members.length + 1,
        // Food preferences
        isVishnuStudent: isVishnuDomain,
        needsFood: false,
        foodOption: "none",
        foodPreference: foodPreferenceText,
        // Payment proof fields
        isPaidEvent: isQuiz ? false : Boolean(requiresPaymentProof),
        pricingType: isQuiz ? "per_person" : (isPricingPerTeam ? "per_team" : "per_person"),
        registrationFee: isQuiz ? 0 : (isPricingPerTeam ? (event?.registrationFee || 0) : perPersonFee),
        totalFeePaid: isQuiz ? 0 : totalRegistrationFee,
        paymentProofPreview: isQuiz ? "" : (cloudinaryProofUrl || compressedProof),
        paymentProofFilename: isQuiz ? "" : (requiresPaymentProof ? (paymentProofFilename || "") : ""),
        paymentProof: isQuiz ? "" : (cloudinaryProofUrl || compressedProof),
        transactionId: isQuiz ? "FREE_QUIZ_ENTRY" : (requiresPaymentProof ? transactionId.trim() : "EXEMPT_VISHNU_FREE"),
        paymentStatus: isQuiz ? "Confirmed" : (requiresPaymentProof ? "Submitted (Pending Verification)" : "Free (Pending Review)"),
        status: isQuiz ? "Confirmed" : "Pending",
        confirmedAt: isQuiz ? Date.now() : null,
        sendEmail: false,
        sendConfirmationEmail: false,
        createdAt: Date.now()
      };

      let finalRegId = `REG-${Date.now()}`;

      // 1. Create in Backend MongoDB API
      try {
        const backendRes = await createRegistration(payload);
        if (backendRes?.id || backendRes?.registration?.id || backendRes?._id) {
          finalRegId = backendRes.id || backendRes?.registration?.id || backendRes?._id;
        }
      } catch (backendErr) {
        console.warn("[RegistrationPage] Backend createRegistration notice:", backendErr);
      }

      // 2. Add document to Firestore registrations collection (sync)
      try {
        const regDocRef = await addDoc(collection(db, "registrations"), {
          ...payload,
          backendId: finalRegId,
        });
        if (!finalRegId) finalRegId = regDocRef.id;
        await updateDoc(doc(db, "registrations", regDocRef.id), {
          qrCodeData: finalRegId
        }).catch(() => {});
      } catch (fErr) {
        console.warn("[RegistrationPage] Firestore save notice:", fErr);
      }

      setCreatedRegId(finalRegId);

      // Auto-provision login credentials for Quiz registrations with common password Aiverse@vitb
      if (isQuiz) {
        const personalEmail = leadPersonalEmail.trim().toLowerCase();
        const displayName = leadName.trim() || "Participant";
        const userPhone = leadPhone.trim();
        try {
          const allEmails = Array.from(new Set([personalEmail].filter(e => e && e.includes("@"))));
          // 4. Supabase public.users Profile Upsert
          const supaUsers = allEmails.map(em => ({
            email: em,
            personal_email: personalEmail || em,
            phone: userPhone || null,
            name: displayName,
            display_name: displayName,
            role: "participant",
            status: "Active",
            event_title: event.title || "",
            registration_id: finalRegId,
            team_name: displayName,
          }));
          await userService.bulkUpsertUsers(supaUsers).catch(() => {});

          // 5. Supabase Auth Account Creation (Password: Aiverse@vitb)
          const authAccounts = allEmails.map(em => ({
            email: em,
            password: commonQuizPassword,
            name: displayName,
            phone: userPhone,
            role: "participant",
            isQuiz: true,
            eventTitle: event.title || "",
            registrationId: finalRegId,
          }));
          await userService.bulkCreateAuthUsers(authAccounts).catch(() => {});
        } catch (credErr) {
          console.warn("[Registration] Non-critical error auto-provisioning quiz credentials:", credErr);
        }
      }

      // Send registration confirmation email via Nodemailer SMTP
      try {
        const recipientEmail = leadPersonalEmail.trim() || leadCollegeEmail.trim();
        if (recipientEmail) {
          await sendEmail({
            to: recipientEmail,
            subject: `Registration Confirmed: ${event.title} - AI Verse`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
                <h2 style="color: #2563eb; margin-top: 0;">🎉 Registration Confirmed!</h2>
                <p>Hello <strong>${leadName}</strong>,</p>
                <p>You have successfully registered for <strong>${event.title}</strong>.</p>
                <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 4px 0;"><strong>Registration ID:</strong> ${finalRegId}</p>
                  <p style="margin: 4px 0;"><strong>Team Name:</strong> ${isQuiz ? "Individual Registration" : (groupName || "Individual")}</p>
                  <p style="margin: 4px 0;"><strong>Date:</strong> ${event.date}</p>
                  <p style="margin: 4px 0;"><strong>Time:</strong> ${event.time}</p>
                  <p style="margin: 4px 0;"><strong>Location:</strong> ${event.location}</p>
                </div>
                <p style="margin-top: 20px;">View and download your digital pass ticket: <a href="http://localhost:5173/ticket/${finalRegId}" style="color: #2563eb; font-weight: bold;">View Ticket</a></p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #64748b;">AI Verse Club &bull; Vishnu Institute of Technology, Bhimavaram</p>
              </div>
            `,
          }).catch((mailErr) => {
            console.warn("[RegistrationPage] Confirmation email notice:", mailErr);
          });
        }
      } catch (e) {}

      // Increment registrations counter on event in Firestore safely
      try {
        const docRef = doc(db, "events", event.id);
        await updateDoc(docRef, {
          currentReg: increment(isQuiz ? 1 : members.length + 1)
        });
      } catch (e) {}

      setSuccess(true);
    } catch (err) {
      console.error("Error submitting registration:", err);
      alert("Failed to submit registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500">Loading registration guidelines...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans text-center px-4">
        <ShieldAlert className="h-10 w-10 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Event Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">The event you are attempting to register for could not be found in the database.</p>
        <Link to="/events" className="mt-5">
          <Button variant="outline" className="rounded-xl text-xs">Back to Events</Button>
        </Link>
      </div>
    );
  }

  if (event.allowRegistrations === false) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans text-center px-4">
        <Info className="h-10 w-10 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Registrations Closed</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed font-medium">
          Registrations for <span className="font-bold text-slate-700">"{event.title}"</span> are currently closed or paused by the event coordinators.
        </p>
        <Link to={`/events/${event.id}`} className="mt-5">
          <Button variant="gradient" className="rounded-xl text-xs font-bold px-6 py-2.5">View Event Details</Button>
        </Link>
      </div>
    );
  }

  const isHackathon =
    event.category === "HACKATHONS" ||
    event.category === "Hackathon" ||
    event.category?.toLowerCase()?.includes("hackathon");

  if (!isHackathon && !isQuiz) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans text-center px-4">
        <Info className="h-10 w-10 text-blue-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">No Registration Required</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed font-medium">
          Registration is not open for this category. The event <span className="font-bold text-slate-700">"{event.title}"</span> is an open public event with no registration required.
        </p>
        <Link to={`/events/${event.id}`} className="mt-5">
          <Button variant="gradient" className="rounded-xl text-xs font-bold px-6 py-2.5">View Event Details</Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans text-center px-4 py-16">
        <SEO 
          title={isQuiz ? "Quiz Registration Confirmed" : "Registration Completed - Under Review"} 
          description={isQuiz ? "Your quiz registration has been confirmed." : "Your registration was completed and is under review to confirm."} 
        />

        {/* Success Checkmark Badge */}
        <div className={`w-16 h-16 rounded-full bg-white border flex items-center justify-center mb-6 animate-bounce ${
          isQuiz 
            ? "border-emerald-100 text-emerald-600 shadow-[0_8px_30px_rgba(16,185,129,0.18)]" 
            : "border-amber-100 text-amber-600 shadow-[0_8px_30px_rgba(217,119,6,0.15)]"
        }`}>
          <Check className="h-8 w-8 stroke-[3]" />
        </div>

        {/* Successful Headline */}
        <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-none">
          {isQuiz ? (
            <>Quiz Registration <span className="text-emerald-600">Confirmed!</span></>
          ) : (
            <>Registration <span className="text-[#2563EB]">Completed!</span></>
          )}
        </h1>

        {/* Subtitle description */}
        <p className="text-slate-600 text-sm mt-3 max-w-xl font-medium leading-relaxed">
          {isQuiz ? (
            <>Your registration for <strong className="text-slate-800 font-bold">{event.title}</strong> is confirmed. You are officially enrolled in this quiz.</>
          ) : (
            <>Your registration was completed and <strong className="text-amber-700 font-bold">it is currently under review to confirm</strong> by the event coordinators.</>
          )}
        </p>

        {/* Details Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full max-w-5xl mt-10">
          {/* Left Column (span 7) */}
          <div className="lg:col-span-7 space-y-6 text-left">

            {/* Confirmed Registration card */}
            <div className={`bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border-l-4 flex items-center gap-4 ${
              isQuiz ? "border-l-emerald-500" : "border-l-amber-500"
            }`}>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isQuiz ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              }`}>
                {isQuiz ? <CheckCircle2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              </div>
              <div className="leading-normal">
                <span className={`text-[9px] font-black tracking-widest uppercase block ${
                  isQuiz ? "text-emerald-600" : "text-amber-600"
                }`}>
                  {isQuiz ? "Registration Confirmed" : "Application Submitted (Under Review)"}
                </span>
                <span className="text-sm font-black text-slate-800 mt-0.5 block">{leadName}</span>
                <span className="text-[10px] text-slate-450 font-semibold block mt-0.5">
                  Roll No: <span className="font-bold text-slate-750">{leadStudentId}</span> • Event: <span className="font-bold text-slate-750">{event.title}</span>
                </span>
              </div>
            </div>

            {/* What's Next card */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-6">
              <h3 className="text-base font-extrabold text-slate-850 leading-tight">What's Next?</h3>
              <div className="space-y-6">

                {isQuiz ? (
                  <>
                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                        1
                      </div>
                      <div className="leading-normal text-left">
                        <h4 className="text-xs font-black text-slate-850">Registration Confirmed</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                          Your participant details have been stored and confirmed for the quiz.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                        2
                      </div>
                      <div className="leading-normal text-left">
                        <h4 className="text-xs font-black text-slate-855">Attend on Event Schedule</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                          Please be present on {event.date} at {event.time} to participate in the quiz.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                        3
                      </div>
                      <div className="leading-normal text-left">
                        <h4 className="text-xs font-black text-slate-850">Access Event Pass</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                          You can view your confirmed registration pass and event details anytime.
                        </p>
                      </div>
                    </div>

                    {/* Quiz Credentials Card */}
                    <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-100 text-xs text-left space-y-2 mt-2">
                      <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs uppercase tracking-wider">
                        <span>🔑</span>
                        <span>Your Portal Login Credentials</span>
                      </div>
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <p>• <strong>Personal Email:</strong> <code className="font-mono bg-blue-100/90 px-1.5 py-0.5 rounded text-blue-900 font-bold">{leadPersonalEmail}</code></p>
                        <p>• <strong>Common Password:</strong> <code className="font-mono bg-blue-100/90 px-1.5 py-0.5 rounded text-blue-900 font-bold">Aiverse@vitb</code></p>
                        <p>• <strong>Phone Login:</strong> <span className="text-emerald-700 font-bold">{leadPhone}</span> (Direct access without password)</p>
                        <p className="text-[10px] text-slate-500 pt-0.5 font-medium">
                          Note: You can log in as soon as the event coordinator clicks <strong>"Allow to Login"</strong> for this event.
                        </p>
                      </div>
                      <div className="pt-1">
                        <Link to="/login" className="inline-flex items-center gap-1 text-xs font-black text-[#2563EB] hover:underline">
                          Go to Participant Portal Login →
                        </Link>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Step 1 */}
                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold text-xs shrink-0">
                        1
                      </div>
                      <div className="leading-normal text-left">
                        <h4 className="text-xs font-black text-slate-850">Verification & Approval</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                          Faculty coordinators are reviewing your registration details and payment proof.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                        2
                      </div>
                      <div className="leading-normal text-left">
                        <h4 className="text-xs font-black text-slate-855">Confirmation & Credentials</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                          Once verified, official confirmation and login credentials will be delivered to your registered personal email.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                        3
                      </div>
                      <div className="leading-normal text-left">
                        <h4 className="text-xs font-black text-slate-850">Access Event Pass</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                          You can view your provisional check-in pass and track your confirmation status anytime on the ticket page.
                        </p>
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>

          {/* Right Column (span 5) */}
          <div className="lg:col-span-5 space-y-6 text-left">
            {/* Event Logistics card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
              {/* Image banner with "In Person" badge */}
              <div className="relative rounded-2xl overflow-hidden h-32 bg-slate-150 border border-slate-100 flex items-center justify-center">
                {event.posterPreview ? (
                  <img
                    src={event.posterPreview}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent z-10" />
                    <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px] opacity-10" />
                    <span className="absolute bottom-3 left-4 right-4 z-20 text-[10px] font-bold text-white uppercase tracking-wider block truncate">
                      {event.title}
                    </span>
                  </>
                )}
                <span className="absolute top-3 right-3 z-20 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 rounded-full text-[9px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse"></span>
                  In Person
                </span>
              </div>

              <h3 className="text-sm font-black text-slate-850 leading-tight">Event Logistics</h3>

              <div className="space-y-3.5 text-xs text-slate-550 font-semibold pt-1 border-t border-slate-50">
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  <div className="leading-tight">
                    <span>{event.location}</span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Silicon Plaza, Tech District</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-50/60">
                <button onClick={() => alert("Loading directions map...")} className="w-full py-2 bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100 font-bold rounded-2xl text-[10px] flex items-center justify-center gap-1.5 transition-colors">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  View on Map
                </button>
              </div>
            </div>

            {/* Actions layout button mapping */}
            <div className="space-y-2">
              <Link to={`/ticket/${createdRegId}`}>
                <Button variant="gradient" className="w-full rounded-2xl py-3.5 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
                  View Ticket
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC] pb-24 text-left font-sans pt-24 min-h-screen">
      <SEO
        title={`Register for ${event.title} - AI Verse`}
        description={`Complete registration details to secure your spot for ${event.title}.`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ================= STEPPER ================= */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="flex items-center justify-between relative">
            {/* Background progress track */}
            <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-slate-200 -translate-y-1/2 -z-10" />
            <div
              className="absolute left-0 top-1/2 h-[2px] bg-blue-600 -translate-y-1/2 -z-10 transition-all duration-300"
              style={{ width: isQuiz ? (step >= 3 ? "100%" : "0%") : `${((step - 1) / 2) * 100}%` }}
            />

            {/* Step 1 Node */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full border-2 font-black text-xs flex items-center justify-center shadow-sm transition-all duration-300
                ${step > 1 ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-blue-600 text-blue-600"}
              `}>
                {step > 1 ? <Check className="h-4 w-4 stroke-[3]" /> : 1}
              </div>
              <span className={`text-[10px] font-bold mt-2 uppercase tracking-wide
                ${step >= 1 ? "text-blue-600" : "text-slate-400"}
              `}>
                {isQuiz ? "Participant Details" : "Group Info"}
              </span>
            </div>

            {/* Step 2 Node (only for non-quiz events) */}
            {!isQuiz && (
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full border-2 font-black text-xs flex items-center justify-center shadow-sm transition-all duration-300
                  ${step > 2 ? "bg-blue-600 border-blue-600 text-white" : step === 2 ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-400"}
                `}>
                  {step > 2 ? <Check className="h-4 w-4 stroke-[3]" /> : 2}
                </div>
                <span className={`text-[10px] font-bold mt-2 uppercase tracking-wide
                  ${step >= 2 ? "text-blue-600" : "text-slate-400"}
                `}>
                  Group Members
                </span>
              </div>
            )}

            {/* Step 3 Node (or Step 2 for Quiz) */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full border-2 font-black text-xs flex items-center justify-center shadow-sm transition-all duration-300
                ${step >= 3 ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-400"}
              `}>
                {isQuiz ? 2 : 3}
              </div>
              <span className={`text-[10px] font-bold mt-2 uppercase tracking-wide
                ${step >= 3 ? "text-blue-600" : "text-slate-400"}
              `}>
                {isQuiz ? "Review & Confirm" : "Review & Submit"}
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {isQuiz ? "Quiz Registration" : "Event Registration"}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-semibold">
            {isQuiz
              ? step === 1
                ? "Enter your details to register for the quiz."
                : "Review your information before confirming your quiz registration."
              : step === 1
                ? "Complete the first step to secure your spot. Start by forming your innovation group."
                : step === 2
                  ? "Add the members who will be joining your group."
                  : "Review all registration details before committing final submission details."}
          </p>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-200">
            {/* Left Main Workspace (span 8) */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-6">
                {isQuiz ? (
                  /* Quiz Single Participant Form */
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="reg-lead-name" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="reg-lead-name"
                        name="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder="Enter full name"
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="reg-lead-student-id" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Regd No / Roll No <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="reg-lead-student-id"
                        name="studentId"
                        type="text"
                        placeholder="e.g. 21B01A1201 / Roll No"
                        value={leadStudentId}
                        onChange={(e) => setLeadStudentId(e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-2xl focus:outline-none font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all ${
                          leadStudentId.includes("@") ? "border-red-400 focus:border-red-500 bg-red-50/10" : "border-slate-200 focus:border-blue-500"
                        }`}
                      />
                      {leadStudentId.includes("@") && (
                        <span className="text-[10px] text-red-500 font-semibold mt-1 block">Regd No / Roll No should not contain '@'</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="reg-lead-college-email" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          College Mail <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="reg-lead-college-email"
                          name="collegeEmail"
                          type="email"
                          autoComplete="email"
                          placeholder="e.g. student@college.edu.in or rollno@university.ac.in"
                          value={leadCollegeEmail}
                          onChange={(e) => setLeadCollegeEmail(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-2xl focus:outline-none font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all ${
                            leadCollegeEmail.trim().toLowerCase().endsWith("@gmail.com") ||
                            leadCollegeEmail.trim().toLowerCase().endsWith("@googlemail.com")
                              ? "border-red-400 focus:border-red-500 bg-red-50/10"
                              : "border-slate-200 focus:border-blue-500"
                          }`}
                        />
                        {leadCollegeEmail.trim().toLowerCase().endsWith("@gmail.com") || leadCollegeEmail.trim().toLowerCase().endsWith("@googlemail.com") ? (
                          <span className="text-[10px] text-red-500 font-semibold mt-1 block">
                            @gmail.com is not allowed here. Please enter your college / institutional email ID. Use the Personal Email field below for Gmail.
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                            Accepts any college / institutional email domain (except @gmail.com)
                          </span>
                        )}
                      </div>

                      <div>
                        <label htmlFor="reg-lead-personal-email" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Personal Mail <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="reg-lead-personal-email"
                          name="personalEmail"
                          type="email"
                          autoComplete="email"
                          placeholder="personal@gmail.com"
                          value={leadPersonalEmail}
                          onChange={(e) => setLeadPersonalEmail(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-2xl focus:outline-none font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all ${
                            leadPersonalEmail.trim() && !EMAIL_REGEX.test(leadPersonalEmail.trim()) ? "border-red-400 focus:border-red-500 bg-red-50/10" : "border-slate-200 focus:border-blue-500"
                          }`}
                        />
                        {leadPersonalEmail.trim() && !EMAIL_REGEX.test(leadPersonalEmail.trim()) ? (
                          <span className="text-[10px] text-red-500 font-semibold mt-1 block">Enter a valid personal email (e.g. name@gmail.com)</span>
                        ) : (
                          <span className="text-[10px] text-blue-600 font-bold mt-1 block">Used for official updates & notifications</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reg-lead-phone" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="reg-lead-phone"
                        name="phoneNumber"
                        type="tel"
                        autoComplete="tel"
                        placeholder="e.g. 9876543210"
                        value={leadPhone}
                        onChange={(e) => setLeadPhone(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {event.maxTeamSize > 1 && (
                      <div>
                        <label htmlFor="reg-group-name" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Group Name</label>
                        <input
                          id="reg-group-name"
                          name="groupName"
                          type="text"
                          placeholder="e.g. Neural Nexus Alpha"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-855 bg-slate-50/30 focus:bg-white transition-all"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="reg-team-lead-name" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Team Lead Name</label>
                        <input
                          id="reg-team-lead-name"
                          name="teamLeadName"
                          type="text"
                          autoComplete="name"
                          placeholder="Full legal name"
                          value={leadName}
                          onChange={(e) => setLeadName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                        />
                      </div>

                      <div>
                        <label htmlFor="reg-team-lead-student-id" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Team Lead Student ID</label>
                        <input
                          id="reg-team-lead-student-id"
                          name="teamLeadStudentId"
                          type="text"
                          placeholder="e.g. Roll No / Student ID"
                          value={leadStudentId}
                          onChange={(e) => setLeadStudentId(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-2xl focus:outline-none font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all ${
                            leadStudentId.includes("@") ? "border-red-400 focus:border-red-500 bg-red-50/10" : "border-slate-200 focus:border-blue-500"
                          }`}
                        />
                        {leadStudentId.includes("@") && (
                          <span className="text-[10px] text-red-500 font-semibold mt-1 block">Student ID should not contain '@'</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="reg-team-lead-college-email" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Team Lead College Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="reg-team-lead-college-email"
                          name="teamLeadCollegeEmail"
                          type="email"
                          autoComplete="email"
                          placeholder="e.g. student@college.edu.in or rollno@university.ac.in"
                          value={leadCollegeEmail}
                          onChange={(e) => setLeadCollegeEmail(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-2xl focus:outline-none font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all ${
                            leadCollegeEmail.trim().toLowerCase().endsWith("@gmail.com") ||
                            leadCollegeEmail.trim().toLowerCase().endsWith("@googlemail.com")
                              ? "border-red-400 focus:border-red-500 bg-red-50/10"
                              : "border-slate-200 focus:border-blue-500"
                          }`}
                        />
                        {leadCollegeEmail.trim().toLowerCase().endsWith("@gmail.com") || leadCollegeEmail.trim().toLowerCase().endsWith("@googlemail.com") ? (
                          <span className="text-[10px] text-red-500 font-semibold mt-1 block">
                            @gmail.com is not allowed here. Please enter your college / institutional email ID. Use the Personal Email field below for Gmail.
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                            Accepts any college / institutional email domain (except @gmail.com)
                          </span>
                        )}
                      </div>

                      <div>
                        <label htmlFor="reg-team-lead-personal-email" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Team Lead Personal Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="reg-team-lead-personal-email"
                          name="teamLeadPersonalEmail"
                          type="email"
                          autoComplete="email"
                          placeholder="personal@gmail.com"
                          value={leadPersonalEmail}
                          onChange={(e) => setLeadPersonalEmail(e.target.value)}
                          className={`w-full px-4 py-2.5 border rounded-2xl focus:outline-none font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all ${
                            leadPersonalEmail.trim() && !EMAIL_REGEX.test(leadPersonalEmail.trim()) ? "border-red-400 focus:border-red-500 bg-red-50/10" : "border-slate-200 focus:border-blue-500"
                          }`}
                        />
                        {leadPersonalEmail.trim() && !EMAIL_REGEX.test(leadPersonalEmail.trim()) ? (
                          <span className="text-[10px] text-red-500 font-semibold mt-1 block">Enter a valid personal email (e.g. name@gmail.com)</span>
                        ) : (
                          <span className="text-[10px] text-blue-600 font-bold mt-1 block">Used for official updates, notifications & login credentials</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="reg-team-lead-phone" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Lead Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="reg-team-lead-phone"
                          name="teamLeadPhone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="1234567890"
                          value={leadPhone}
                          onChange={(e) => setLeadPhone(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-medium text-sm text-slate-850 bg-slate-50/30 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-4 flex justify-end">
                  <Button
                    variant="gradient"
                    onClick={() => {
                      if (validateStep1()) {
                        if (isQuiz) {
                          setStep(3); // Directly redirect to the review page!
                        } else if (event.maxTeamSize > 1) {
                          setStep(2);
                        } else {
                          setStep(3); // Skip step 2 for individual events
                        }
                      }
                    }}
                    className="rounded-2xl px-6 py-3 font-bold text-xs flex items-center gap-1.5"
                  >
                    {isQuiz ? "Proceed to Review" : "Proceed to Member Details"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Metadata Sidebar (span 4) */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5 text-left">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50">
                  Event Details
                </h3>
                <div className="space-y-4">
                  <h4 className="text-base font-extrabold text-slate-800 leading-snug">{event.title}</h4>
                  <div className="space-y-3 text-xs text-slate-550 font-semibold pt-1 border-t border-slate-50 mt-1">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                      <span>{event.time}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                      <span>{event.location}</span>
                    </div>
                  </div>
                </div>
              </div>

              {isQuiz ? (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50">
                    Registration Info
                  </h3>
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span className="text-xs text-slate-650 font-semibold">Participation: <span className="font-extrabold text-slate-800">Individual Participant</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span className="text-xs text-slate-650 font-semibold">Entry: <span className="font-extrabold text-emerald-600">Free Registration</span></span>
                    </div>
                  </div>
                </div>
              ) : event.maxTeamSize > 1 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50">
                    Requirements
                  </h3>
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span className="text-xs text-slate-650 font-semibold">Minimum <span className="font-extrabold text-slate-800">{event.minTeamSize} members</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span className="text-xs text-slate-650 font-semibold">Maximum <span className="font-extrabold text-slate-800">{event.maxTeamSize} members</span></span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/40 text-left flex gap-2.5">
                <Info className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Ensure your personal mail id is correct. This is used for verification and issuing digital certificates.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column (span 4): Registration Summary */}
              <div className="lg:col-span-4 space-y-6">
                {/* Registration Summary */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-50 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                    Registration Summary
                  </h3>

                  {event.maxTeamSize > 1 && (
                    <div className="space-y-1 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100/50">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Group Name</span>
                      <span className="text-xs font-extrabold text-slate-800 block truncate">{groupName}</span>
                    </div>
                  )}

                  <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100/50 space-y-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Team Lead</span>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0 uppercase">
                        {leadName ? leadName.substring(0, 2).toUpperCase() : "TL"}
                      </div>
                      <div className="leading-tight text-left truncate">
                        <span className="text-[10px] font-extrabold text-slate-850 block">{leadName}</span>
                        <span className="text-[8px] font-bold text-slate-450 block mt-0.5 truncate">{leadCollegeEmail}</span>
                        <span className="text-[8px] font-bold text-blue-600 block truncate">{leadPersonalEmail}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vishnu Domain Status Badge */}
                  {isVishnuDomain && (
                    <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/70 space-y-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wider">Campus Privilege</span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          @vishnu.edu.in
                        </span>
                      </div>
                      <div className="text-xs font-black text-slate-800 flex items-center justify-between pt-0.5">
                        <span>Registration Fee:</span>
                        <span className="text-emerald-600 font-extrabold">
                          ₹0 (100% Free)
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-50/60 text-xs font-bold text-slate-400 text-left">
                    <span>Event: {event.title}</span>
                  </div>
                </div>
              </div>

              {/* Right Column (span 8): Member Details form */}
              <div className="lg:col-span-8 space-y-6 text-left">
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-6">

                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-855 leading-tight">Member Details</h3>
                      <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Add the members who will be joining your group.</p>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-black rounded-full text-[9px] border border-blue-100/30">
                      {members.length === 1 ? "1 Member Added" : `${members.length} Members Added`}
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                    {members.map((member, idx) => (
                      <div key={idx} className="p-4 border border-slate-100 bg-slate-50/10 rounded-2xl space-y-3.5 relative">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-blue-600 tracking-wider">TEAM MEMBER #{idx + 2}</span>
                          {members.length > event.minTeamSize - 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTeammate(idx)}
                              className="text-red-500 hover:text-red-750 font-bold text-[9px] hover:bg-red-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor={`reg-member-name-${idx}`} className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                            <input
                              id={`reg-member-name-${idx}`}
                              name={`memberName_${idx}`}
                              type="text"
                              autoComplete="name"
                              placeholder="e.g. Sarah Jenkins"
                              value={member.name}
                              onChange={(e) => handleMemberChange(idx, "name", e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-800 bg-white"
                            />
                          </div>
                          <div>
                            <label htmlFor={`reg-member-email-${idx}`} className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">University / Member Email</label>
                            <input
                              id={`reg-member-email-${idx}`}
                              name={`memberEmail_${idx}`}
                              type="email"
                              autoComplete="email"
                              placeholder="e.g. member@college.edu.in or member@gmail.com"
                              value={member.email}
                              onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                              className={`w-full px-3 py-2 border rounded-xl focus:outline-none font-semibold text-xs text-slate-800 bg-white transition-colors ${
                                member.email.trim() && !EMAIL_REGEX.test(member.email.trim()) ? "border-red-400 focus:border-red-500 bg-red-50/10" : "border-slate-200 focus:border-blue-500"
                              }`}
                            />
                            {member.email.trim() && !EMAIL_REGEX.test(member.email.trim()) && (
                              <span className="text-[9px] text-red-500 font-semibold mt-1 block">Must be a valid email with a domain (e.g. name@domain.com)</span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor={`reg-member-student-id-${idx}`} className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Student ID</label>
                            <input
                              id={`reg-member-student-id-${idx}`}
                              name={`memberStudentId_${idx}`}
                              type="text"
                              placeholder="e.g. Roll No / Student ID"
                              value={member.studentId}
                              onChange={(e) => handleMemberChange(idx, "studentId", e.target.value)}
                              className={`w-full px-3 py-2 border rounded-xl focus:outline-none font-semibold text-xs text-slate-800 bg-white transition-colors ${
                                member.studentId.includes("@") ? "border-red-400 focus:border-red-500 bg-red-50/10" : "border-slate-200 focus:border-blue-500"
                              }`}
                            />
                            {member.studentId.includes("@") && (
                              <span className="text-[9px] text-red-500 font-semibold mt-1 block">Student ID should not contain '@'</span>
                            )}
                          </div>
                          <div>
                            <label htmlFor={`reg-member-phone-${idx}`} className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                            <input
                              id={`reg-member-phone-${idx}`}
                              name={`memberPhone_${idx}`}
                              type="tel"
                              autoComplete="tel"
                              placeholder="1234567890"
                              value={member.phone || ""}
                              onChange={(e) => handleMemberChange(idx, "phone", e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-800 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {members.length < event.maxTeamSize - 1 && (
                    <button
                      type="button"
                      onClick={handleAddTeammate}
                      className="w-full py-2.5 border border-dashed border-slate-200 hover:border-blue-500 rounded-2xl text-slate-500 hover:text-blue-600 font-bold text-xs bg-slate-50/20 hover:bg-blue-50/10 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Add Another Member
                    </button>
                  )}



                  <div className="pt-4 flex justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-2xl px-5 py-2.5 font-bold text-xs bg-white text-slate-700 flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous Step
                    </button>
                    <Button
                      variant="gradient"
                      onClick={() => {
                        if (validateStep2()) {
                          setStep(3);
                        }
                      }}
                      className="rounded-2xl px-6 py-3 font-bold text-xs flex items-center gap-1.5"
                    >
                      Proceed to Review
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Requirements Card (Moved to the very bottom of the page) */}
            {event.maxTeamSize > 1 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-3 text-left">
                <h3 className="text-xs font-black text-[#2563EB] uppercase tracking-wider pb-2 border-b border-slate-50">
                  Requirements
                </h3>

                <div className="space-y-2 text-xs text-slate-600 font-semibold leading-relaxed">
                  <p>Minimum <span className="text-slate-800 font-bold">{event.minTeamSize} members</span>, maximum <span className="text-slate-800 font-bold">{event.maxTeamSize} members</span> allowed per group. Ensure all emails are official university IDs.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-200">
            {/* Left Column (span 8): Group Identity + Team Roster */}
            <div className="lg:col-span-8 space-y-6">

              {/* Identity Card */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-6 text-left">
                <div className="flex justify-between items-center border-b border-slate-55 pb-3">
                  <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-blue-600" />
                    {isQuiz ? "Participant Details" : "Group Identity"}
                  </h3>
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                  {!isQuiz && event.maxTeamSize > 1 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Group Name</span>
                      <span className="text-xs font-black text-slate-800 block">{groupName || "Individual RSVP"}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isQuiz ? "Full Name" : "Team Lead Name"}
                    </span>
                    <span className="text-xs font-black text-slate-800 block">{leadName}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isQuiz ? "Regd No / Roll No" : "Lead Student ID"}
                    </span>
                    <span className="text-xs font-black text-slate-800 block">{leadStudentId}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isQuiz ? "College Mail" : "Lead College Email"}
                    </span>
                    <span className="text-xs font-black text-slate-800 block">{leadCollegeEmail}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isQuiz ? "Personal Mail" : "Lead Personal Email (For Updates)"}
                    </span>
                    <span className="text-xs font-black text-blue-600 block">{leadPersonalEmail}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isQuiz ? "Phone Number" : "Lead Phone Number"}
                    </span>
                    <span className="text-xs font-black text-slate-800 block">{leadPhone}</span>
                  </div>
                </div>
              </div>

              {/* Team Roster Card (Only for non-quiz with members) */}
              {!isQuiz && members.length > 0 && (
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-6 text-left">
                  <div className="flex justify-between items-center border-b border-slate-55 pb-3">
                    <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
                      Team Roster
                    </h3>
                    <button
                      onClick={() => setStep(2)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-650">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="pb-3 pr-4 font-bold text-left">Name</th>
                          <th className="pb-3 px-4 font-bold text-left">Email</th>
                          <th className="pb-3 px-4 font-bold text-left">Phone Number</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium text-slate-750">
                        {members.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/20">
                            <td className="py-3.5 pr-4 font-bold text-slate-800">{m.name}</td>
                            <td className="py-3.5 px-4 font-semibold text-slate-550">{m.email}</td>
                            <td className="py-3.5 px-4 text-slate-500 font-bold">{m.phone || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Proof Card (Only shown when total payable > 0) */}
              {requiresPaymentProof ? (
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-6 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Receipt className="h-4.5 w-4.5 text-blue-600" />
                        Payment Proof & Verification
                      </h3>
                      <p className="text-[11px] text-slate-450 font-semibold mt-0.5">
                        Please upload your payment screenshot and provide the Transaction ID / UTR for confirmation.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-extrabold rounded-full text-[9px] border border-amber-200/60 uppercase tracking-wide">
                      Verification Required
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Transaction ID and Upload screenshot */}
                    <div className="md:col-span-7 space-y-4">
                      {/* Transaction ID / UTR Input */}
                      <div>
                        <label htmlFor="reg-payment-transaction-id" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          UPI Transaction ID / UTR Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="reg-payment-transaction-id"
                          name="transactionId"
                          type="text"
                          placeholder="e.g. T2608141120004017775562 or 12-digit UTR"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-mono text-xs text-slate-800 bg-slate-50/30 focus:bg-white transition-all shadow-2xs"
                        />
                        <span className="text-[9.5px] text-slate-400 font-medium mt-1 block">
                          Enter the 12-digit UTR or Transaction ID visible in your PhonePe / GPay / Paytm receipt.
                        </span>
                      </div>

                      {/* Screenshot Upload Dropzone */}
                      <div>
                        <label htmlFor="reg-payment-proof-file" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Upload Payment Screenshot <span className="text-red-500">*</span>
                        </label>

                        <input
                          ref={paymentProofFileInputRef}
                          id="reg-payment-proof-file"
                          name="paymentProofFile"
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={handlePaymentProofChange}
                        />

                        {!paymentProofPreview ? (
                          <div
                            onClick={() => paymentProofFileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 hover:border-blue-500 bg-slate-50/40 hover:bg-blue-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                          >
                            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center group-hover:scale-105 group-hover:border-blue-400 transition-all shadow-xs">
                              <UploadCloud className="w-5 h-5" />
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors block">
                                Click to upload payment screenshot
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium block">
                                PNG, JPG, or WEBP (Max 5MB)
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-14 h-14 rounded-xl bg-white border border-emerald-200 p-1 overflow-hidden shrink-0 shadow-2xs">
                                <img
                                  src={paymentProofPreview}
                                  alt="Payment Proof"
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              </div>
                              <div className="min-w-0 text-left">
                                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Proof Attached</span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                                  {paymentProofFilename || "payment-receipt.jpg"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => paymentProofFileInputRef.current?.click()}
                                className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 rounded-xl transition-all"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentProofPreview("");
                                  setPaymentProofFilename("");
                                  if (paymentProofFileInputRef.current) {
                                    paymentProofFileInputRef.current.value = "";
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 rounded-xl transition-all"
                                title="Remove"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Example Reference Card */}
                    <div className="md:col-span-5 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                          <Eye className="w-3 h-3 text-blue-600" />
                          Example Reference
                        </span>
                        <span className="px-2 py-0.5 bg-blue-100/70 text-blue-700 font-black rounded text-[8px] uppercase">
                          Sample Proof
                        </span>
                      </div>

                      <div
                        onClick={() => setShowExampleProofModal(true)}
                        className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200/80 bg-white shadow-2xs aspect-[4/5] flex items-center justify-center"
                        title="Click to expand example"
                      >
                        <img
                          src="/payment proff.jpeg"
                          alt="Example Payment Proof"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 p-2">
                          <ZoomIn className="w-5 h-5" />
                          <span className="text-[9px] font-bold">Click to view full sample</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[9.5px] text-slate-500 font-semibold leading-relaxed">
                        <div className="flex items-center gap-1 text-emerald-700 font-bold">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Status "Successful" must be visible</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-700 font-bold">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Transaction ID / UTR must be clear</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : isVishnuDomain ? (
                /* Free Internal Registration Banner */
                <div className="bg-emerald-50/80 p-6 rounded-3xl border border-emerald-200 shadow-2xs space-y-2 text-left animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5 text-emerald-800 font-black text-sm">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <span>No Payment Proof Required</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-200/80 text-emerald-900 ml-auto">
                      100% Free Entry
                    </span>
                  </div>
                  <p className="text-xs text-emerald-850 font-semibold leading-relaxed">
                    As a Vishnu Educational Society student (@vishnu.edu.in), your team registration is completely free (₹0) whether food or no food is chosen. You can submit directly without any payment screenshot or UTR number.
                  </p>
                </div>
              ) : null}

            </div>

            {/* Right Column (span 4): Event Recap + Terms Checkbox & Submit */}
            <div className="lg:col-span-4 space-y-6">

              {/* Event Recap Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4 text-left">
                <h3 className="text-sm font-black text-slate-800 tracking-tight pb-3 border-b border-slate-50">
                  Event Recap
                </h3>

                <div className="space-y-4">
                  {/* Premium illustration or map badge banner */}
                  <div className="relative rounded-2xl overflow-hidden h-28 bg-slate-150 border border-slate-100 flex items-center justify-center">
                    {event.posterPreview ? (
                      <img
                        src={event.posterPreview}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent z-10" />
                        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px] opacity-10" />
                        <span className="absolute bottom-3 left-4 right-4 z-20 text-[10px] font-bold text-white uppercase tracking-wider block truncate">
                          {event.title}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-550 font-semibold pt-1 border-t border-slate-50">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                      <span>{event.time}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                      <span>{event.location}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100/80 space-y-2 text-[11px] font-bold text-slate-400">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">{isQuiz ? "Event Category" : "Pricing Model"}</span>
                      <span className="text-slate-800 font-bold">
                        {isQuiz ? "Quiz Competition" : isPricingPerTeam ? `₹${event.registrationFee} (Flat Fee per Team)` : `₹${perPersonFee} per Person`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">{isQuiz ? "Participation" : "Total Team Size"}</span>
                      <span className="text-slate-800 font-bold">{isQuiz ? "Individual (1 Attendee)" : `${members.length + 1} Attendees`}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-700 font-black">Total Registration Fee</span>
                      <span className="font-black text-sm text-emerald-600">
                        {isQuiz || totalRegistrationFee === 0 ? "₹0 (100% Free Entry)" : `₹${totalRegistrationFee}`}
                      </span>
                    </div>
                  </div>

                  {/* Payment QR Code Box for Paid Event */}
                  {requiresPaymentProof && (event.paymentQrImagePreview || event.upiId) ? (
                    <div className="mt-3 p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2 text-left">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-black text-[10px] uppercase tracking-wider">
                        <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Scan & Pay Registration Fee</span>
                      </div>

                      {event.paymentQrImagePreview && (
                        <div className="w-32 h-32 mx-auto bg-white p-2 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-center">
                          <img
                            src={event.paymentQrImagePreview}
                            alt="Payment QR"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}

                      {event.upiId && (
                        <div className="text-center">
                          <span className="text-[10px] text-slate-500 font-bold">UPI ID: </span>
                          <span className="text-xs font-mono font-black text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 select-all">
                            {event.upiId}
                          </span>
                        </div>
                      )}

                      <p className="text-[9px] text-slate-500 font-medium text-center leading-tight">
                        Please complete payment of <strong>₹{totalRegistrationFee}</strong> via UPI before submitting.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Confirm Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-5 text-left">
                <div className="space-y-3.5">
                  <label htmlFor="reg-agreed-terms" className="flex gap-3 cursor-pointer">
                    <input
                      id="reg-agreed-terms"
                      name="agreedTerms"
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-semibold text-slate-500 leading-normal select-none cursor-pointer">
                      I agree to the <span className="text-blue-600 hover:underline font-bold">Terms and Conditions</span> of the AI Innovation Club.
                    </span>
                  </label>

                  <label htmlFor="reg-confirmed-info" className="flex gap-3 cursor-pointer">
                    <input
                      id="reg-confirmed-info"
                      name="confirmedInfo"
                      type="checkbox"
                      checked={confirmedInfo}
                      onChange={(e) => setConfirmedInfo(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-semibold text-slate-500 leading-normal select-none cursor-pointer">
                      I confirm all provided information is accurate and final.
                    </span>
                  </label>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    variant="gradient"
                    onClick={handleSubmit}
                    disabled={submitting || !agreedTerms || !confirmedInfo}
                    className="w-full rounded-2xl py-3 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        {isQuiz ? "Confirming Registration..." : "Submitting..."}
                      </>
                    ) : (
                      <>
                        {isQuiz ? "Confirm Registration" : "Submit Registration"}
                        {isQuiz ? <Check className="h-4 w-4 stroke-[3]" /> : <Send className="h-4 w-4" />}
                      </>
                    )}
                  </Button>

                  <button
                    onClick={() => setStep(isQuiz ? 1 : 2)}
                    className="w-full py-2.5 bg-white border border-slate-200 text-slate-550 hover:bg-slate-50 font-bold rounded-2xl text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {isQuiz ? "Back to Edit Details" : "Back to Members"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Example Payment Proof Lightbox Modal */}
        {showExampleProofModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
            onClick={() => setShowExampleProofModal(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl relative space-y-3.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="text-left">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Example Payment Receipt</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Standard UPI success screen format</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExampleProofModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-1 flex items-center justify-center">
                <img
                  src="/payment proff.jpeg"
                  alt="Example Payment Receipt"
                  className="w-full h-auto object-contain rounded-xl shadow-xs"
                />
              </div>

              <p className="text-[10px] text-slate-500 text-center font-medium leading-tight">
                Ensure your screenshot clearly shows the <strong>Transaction Successful</strong> status, amount, and <strong>Transaction ID / UTR</strong>.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RegistrationPage;
