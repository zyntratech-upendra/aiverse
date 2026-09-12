import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  FileUp, 
  Video, 
  Code, 
  Globe, 
  PlayCircle, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { db } from "../../config/firebase";
import { doc, updateDoc, getDoc, collection, getDocs } from "../../config/firebase";

interface ProjectSubmissionPageProps {
  targetRegId?: string;
  activeRoundType?: string;
  initialData?: any;
  onSuccess?: () => void;
  embedded?: boolean;
}

export const ProjectSubmissionPage: React.FC<ProjectSubmissionPageProps> = ({
  targetRegId,
  activeRoundType,
  initialData,
  onSuccess,
  embedded = false
}) => {
  // Stepper State (1 to 4)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Textarea Refs for Auto-Expansion (Full Card View, No Scrolling Box)
  const problemStatementRef = useRef<HTMLTextAreaElement>(null);
  const keyFeaturesRef = useRef<HTMLTextAreaElement>(null);

  // Form State
  const [problemStatement, setProblemStatement] = useState("");
  const [keyFeatures, setKeyFeatures] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [prototypeUrl, setPrototypeUrl] = useState("");
  const [demoVideoUrl, setDemoVideoUrl] = useState("");

  // Document Upload File States
  const [srsFileName, setSrsFileName] = useState("");
  const [presentationFileName, setPresentationFileName] = useState("");

  // Status & Submit States
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Problem Statements List, Selected, Saved & Lock State
  const [availableProblemStatements, setAvailableProblemStatements] = useState<any[]>([]);
  const [selectedPsId, setSelectedPsId] = useState<string>("");
  const [takenPsMap, setTakenPsMap] = useState<Record<string, string>>({});
  const [isPsSaved, setIsPsSaved] = useState<boolean>(false);
  const [savingPs, setSavingPs] = useState<boolean>(false);
  const [isPsLocked, setIsPsLocked] = useState<boolean>(false);
  const [submissionStatus, setSubmissionStatus] = useState<string>("");
  const [currentTeamRound, setCurrentTeamRound] = useState<number>(initialData?.currentRound ? Number(initialData.currentRound) : 1);
  // Event Step Locks State
  const [eventLockedSteps, setEventLockedSteps] = useState<Record<number, boolean>>({});
  const [currentEventId, setCurrentEventId] = useState<string>("");

  const isStepLocked = (stepId: number): boolean => {
    if (stepId === 1 && (isPsLocked || eventLockedSteps[1])) return true;
    return !!eventLockedSteps[stepId];
  };

  const saveStepDataToFirestore = async (additionalFields: Record<string, any> = {}) => {
    if (!targetRegId) return;
    try {
      const regRef = doc(db, "registrations", targetRegId);
      const selectedPsObj = availableProblemStatements.find(p => p.id === selectedPsId || p.code === selectedPsId) || null;
      // Read currentRound to tag saved data with correct round
      const currentDocSnap = await getDoc(regRef);
      const currentRoundVal = currentDocSnap.exists() ? (Number(currentDocSnap.data().currentRound) || currentTeamRound || 1) : (currentTeamRound || 1);
      const rP = `r${currentRoundVal}_`;
      await updateDoc(regRef, {
        problemStatement,
        keyFeatures,
        githubUrl,
        prototypeUrl,
        demoVideoUrl,
        srsFileName,
        presentationFileName,
        selectedProblemStatementId: selectedPsId,
        selectedProblemStatement: selectedPsObj,
        submissionRound: currentRoundVal,
        updatedAt: Date.now(),
        [`${rP}problemStatement`]: problemStatement,
        [`${rP}keyFeatures`]: keyFeatures,
        [`${rP}githubUrl`]: githubUrl,
        [`${rP}prototypeUrl`]: prototypeUrl,
        [`${rP}demoVideoUrl`]: demoVideoUrl,
        [`${rP}srsFileName`]: srsFileName,
        [`${rP}presentationFileName`]: presentationFileName,
        [`${rP}selectedProblemStatementId`]: selectedPsId,
        [`${rP}selectedProblemStatement`]: selectedPsObj,
        ...additionalFields
      });
    } catch (err) {
      console.error("Error saving step data to Firestore:", err);
    }
  };

  // Helper to apply registration data with strict per-round isolation
  const applyRegistrationDocData = (data: any) => {
    const regCurrentRound = Number(data.currentRound || data.promotedToRound || initialData?.currentRound || 1);
    setCurrentTeamRound(regCurrentRound);

    const rP = `r${regCurrentRound}_`;
    const hasExplicitRoundData = !!(
      data[`${rP}problemStatement`] ||
      data[`${rP}selectedProblemStatementId`] ||
      data[`${rP}submittedAt`] ||
      data[`${rP}submissionStatus`] ||
      data[`${rP}srsFileName`] ||
      data[`${rP}presentationFileName`] ||
      data[`${rP}keyFeatures`] ||
      data[`${rP}githubUrl`]
    );
    const isLiveSubmissionForCurrentRound = Number(data.submissionRound) === regCurrentRound || (regCurrentRound === 1 && !data.submissionRound);

    if (hasExplicitRoundData) {
      setProblemStatement(data[`${rP}problemStatement`] || "");
      setKeyFeatures(data[`${rP}keyFeatures`] || "");
      setGithubUrl(data[`${rP}githubUrl`] || data[`${rP}githubLink`] || "");
      setPrototypeUrl(data[`${rP}prototypeUrl`] || data[`${rP}figmaUrl`] || "");
      setDemoVideoUrl(data[`${rP}demoVideoUrl`] || data[`${rP}videoLink`] || "");
      setSrsFileName(data[`${rP}srsFileName`] || "");
      setPresentationFileName(data[`${rP}presentationFileName`] || "");
      setSelectedPsId(data[`${rP}selectedProblemStatementId`] || "");
      setIsPsSaved(Boolean(data[`${rP}isPsSaved`] || data[`${rP}selectedProblemStatementId`]));
      setIsPsLocked(Boolean(data[`${rP}isPsLocked`]));
      setSubmissionStatus(data[`${rP}submissionStatus`] || "Draft");
    } else if (isLiveSubmissionForCurrentRound) {
      if (data.problemStatement) setProblemStatement(data.problemStatement);
      if (data.keyFeatures) setKeyFeatures(data.keyFeatures);
      if (data.githubUrl || data.githubLink) setGithubUrl(data.githubUrl || data.githubLink);
      if (data.prototypeUrl || data.figmaUrl) setPrototypeUrl(data.prototypeUrl || data.figmaUrl);
      if (data.demoVideoUrl || data.videoLink) setDemoVideoUrl(data.demoVideoUrl || data.videoLink);
      if (data.srsFileName) setSrsFileName(data.srsFileName);
      if (data.presentationFileName) setPresentationFileName(data.presentationFileName);
      if (data.selectedProblemStatementId) setSelectedPsId(data.selectedProblemStatementId);
      if (data.isPsSaved) setIsPsSaved(true);
      if (data.isPsLocked || data.problemStatementLocked) {
        setIsPsLocked(true);
        setIsPsSaved(true);
      }
      if (data.submissionStatus) setSubmissionStatus(data.submissionStatus);
    } else {
      // Newly entered/promoted round with no submissions yet — start clean without previous round's ideology
      setProblemStatement("");
      setKeyFeatures("");
      setGithubUrl("");
      setPrototypeUrl("");
      setDemoVideoUrl("");
      setSrsFileName("");
      setPresentationFileName("");
      setSelectedPsId("");
      setIsPsSaved(false);
      setIsPsLocked(false);
      setSubmissionStatus("Pending");
    }

    if (data.eventId && data.eventId !== currentEventId) {
      setCurrentEventId(data.eventId);
    }
  };

  // Real-time listener for current team's registration
  useEffect(() => {
    if (!targetRegId) return;

    let pollReg: any = null;
    const loadReg = async () => {
      try {
        const docSnap = await getDoc(doc(db, "registrations", targetRegId));
        if (docSnap.exists()) {
          applyRegistrationDocData(docSnap.data());
        }
      } catch (err) {
        console.error("Error loading registration doc:", err);
      }
    };
    loadReg();
    pollReg = setInterval(loadReg, 5000);
    return () => { if (pollReg) clearInterval(pollReg); };
  }, [targetRegId]);

  // Real-time listener for event locked steps
  useEffect(() => {
    if (!currentEventId) return;

    let pollEv: any = null;
    const loadEv = async () => {
      try {
        const evSnap = await getDoc(doc(db, "events", currentEventId));
        if (evSnap.exists()) {
          const evData = evSnap.data();
          if (evData.lockedSteps) setEventLockedSteps(evData.lockedSteps);
          else setEventLockedSteps({});
          if (evData.problemStatements && evData.problemStatements.length > 0) setAvailableProblemStatements(evData.problemStatements);
        }
      } catch (err) {
        console.error("Error loading event doc:", err);
      }
    };
    loadEv();
    pollEv = setInterval(loadEv, 5000);
    return () => { if (pollEv) clearInterval(pollEv); };
  }, [currentEventId]);

  // Real-time listener for registrations to track problem statements claimed by other teams in the active round
  useEffect(() => {
    let pollAll: any = null;
    const loadAll = async () => {
      try {
        const snapshot = await getDocs(collection(db, "registrations"));
        const takenMap: Record<string, string> = {};
        snapshot.docs.forEach((docSnap) => {
          const reg = docSnap.data();
          const regId = docSnap.id;
          if (targetRegId && regId === targetRegId) return;
          const regRound = Number(reg.currentRound || reg.promotedToRound || 1);
          const rP = `r${currentTeamRound}_`;
          const psId = (regRound === currentTeamRound ? reg.selectedProblemStatementId : "") || reg[`${rP}selectedProblemStatementId`];
          const isSaved = reg[`${rP}isPsSaved`] === true || (regRound === currentTeamRound && reg.isPsSaved !== false && !!psId);
          if (psId && isSaved) {
            const teamName = reg.groupName || reg.teamName || reg.participantName || reg.name || "Another Team";
            takenMap[psId] = teamName;
            if (reg.selectedProblemStatement?.code) takenMap[reg.selectedProblemStatement.code] = teamName;
            if (reg.selectedProblemStatement?.id) takenMap[reg.selectedProblemStatement.id] = teamName;
          }
        });
        setTakenPsMap(takenMap);
      } catch (err) {
        console.error("Error loading registrations for problem statements:", err);
      }
    };
    loadAll();
    pollAll = setInterval(loadAll, 10000);
    return () => { if (pollAll) clearInterval(pollAll); };
  }, [targetRegId, currentTeamRound]);

  // Auto-expand Problem Statement textarea to full height (eliminates inner scrollbar & text truncation)
  useEffect(() => {
    const updateHeight = () => {
      if (problemStatementRef.current) {
        problemStatementRef.current.style.height = "auto";
        problemStatementRef.current.style.height = `${Math.max(220, problemStatementRef.current.scrollHeight + 32)}px`;
      }
    };
    updateHeight();
    const timer1 = setTimeout(updateHeight, 50);
    const timer2 = setTimeout(updateHeight, 250);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [problemStatement, currentStep, selectedPsId]);

  // Auto-expand Key Features textarea
  useEffect(() => {
    const updateHeight = () => {
      if (keyFeaturesRef.current) {
        keyFeaturesRef.current.style.height = "auto";
        keyFeaturesRef.current.style.height = `${Math.max(160, keyFeaturesRef.current.scrollHeight + 20)}px`;
      }
    };
    updateHeight();
    const timer = setTimeout(updateHeight, 50);
    return () => clearTimeout(timer);
  }, [keyFeatures, currentStep]);

  // Initialize values from initialData (only if values exist to prevent accidental wipes)
  useEffect(() => {
    if (initialData) {
      applyRegistrationDocData(initialData);
    }
  }, [initialData]);

  // Load latest values if targetRegId provided
  useEffect(() => {
    const loadRegData = async () => {
      if (!targetRegId) return;
      try {
        const docRef = doc(db, "registrations", targetRegId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          applyRegistrationDocData(data);

          // Fetch Event Problem Statements from Firestore
          let eventId = data.eventId;
          let eventData: any = null;

          if (eventId) {
            const evSnap = await getDoc(doc(db, "events", eventId));
            if (evSnap.exists()) eventData = evSnap.data();
          }

          if (!eventData && data.eventTitle) {
            const evsSnap = await getDocs(collection(db, "events"));
            const matched = evsSnap.docs.find(d => (d.data().title || "").toLowerCase().trim() === (data.eventTitle || "").toLowerCase().trim());
            if (matched) eventData = matched.data();
          }

          if (eventData) {
            if (eventData.problemStatements && eventData.problemStatements.length > 0) {
              setAvailableProblemStatements(eventData.problemStatements);
            } else if (eventData.problemStatementTitle) {
              setAvailableProblemStatements([{
                id: "ps_1",
                code: "PS-01",
                title: eventData.problemStatementTitle,
                track: eventData.problemStatementTrack || "General",
                description: eventData.problemStatement || ""
              }]);
            }
          }
        }
      } catch (err) {
        console.error("Error loading registration submission data:", err);
      }
    };
    loadRegData();
  }, [targetRegId]);

  // Handle Problem Statement Card Selection (Preview locally)
  const handleSelectProblemStatement = (item: any, idx: number) => {
    if (isPsLocked) {
      setStatusNotice({
        type: "error",
        message: "Problem statement selection is locked for your team because you already confirmed it and continued to SRS & PPT submission."
      });
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }

    const psKey = item.id || item.code || `ps_${idx + 1}`;
    const takenBy = takenPsMap[item.id] || takenPsMap[item.code] || takenPsMap[psKey];

    // If taken by another team who saved it, show error notice
    if (takenBy && selectedPsId !== item.id && selectedPsId !== item.code) {
      setStatusNotice({
        type: "error",
        message: `"${item.title}" is already taken by ${takenBy}.`
      });
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }

    const newId = item.id || item.code || `ps_${idx + 1}`;
    const isDifferent = selectedPsId !== newId;

    setSelectedPsId(newId);
    const fullText = `[${item.code || `PS-0${idx + 1}`}] ${item.title}\n\n${item.description}`;
    setProblemStatement(fullText);

    if (isDifferent) {
      setIsPsSaved(false);
    }
  };

  // Save My Problem Statement Button Handler (Marks statement as TAKEN for other teams in real-time)
  const handleSaveProblemStatement = async () => {
    if (!problemStatement.trim()) {
      setStatusNotice({
        type: "error",
        message: "Please select or enter a problem statement before saving."
      });
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }

    const selectedPsObj = availableProblemStatements.find(p => p.id === selectedPsId || p.code === selectedPsId) || null;
    const psKey = selectedPsId || selectedPsObj?.code;
    const takenBy = psKey ? takenPsMap[psKey] : null;

    if (takenBy) {
      setStatusNotice({
        type: "error",
        message: `This problem statement is already taken by ${takenBy}. Please select another statement.`
      });
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }

    setSavingPs(true);
    setStatusNotice(null);

    try {
      if (targetRegId) {
        const regRef = doc(db, "registrations", targetRegId);
        const currentDocSnap = await getDoc(regRef);
        const currentRoundVal = currentDocSnap.exists() ? (Number(currentDocSnap.data().currentRound) || currentTeamRound || 1) : (currentTeamRound || 1);
        const rP = `r${currentRoundVal}_`;
        await updateDoc(regRef, {
          selectedProblemStatementId: selectedPsId,
          selectedProblemStatement: selectedPsObj,
          problemStatement,
          isPsSaved: true,
          submissionRound: currentRoundVal,
          updatedAt: Date.now(),
          [`${rP}selectedProblemStatementId`]: selectedPsId,
          [`${rP}selectedProblemStatement`]: selectedPsObj,
          [`${rP}problemStatement`]: problemStatement,
          [`${rP}isPsSaved`]: true,
        });
      }

      setIsPsSaved(true);
      setStatusNotice({
        type: "success",
        message: "Problem statement successfully saved & held for your team!"
      });
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err) {
      console.error("Error saving problem statement:", err);
      setStatusNotice({
        type: "error",
        message: "Failed to save problem statement. Please try again."
      });
    } finally {
      setSavingPs(false);
    }
  };

  // Handle Clearing/Resetting Selection (Releases Hold for Other Teams)
  const handleClearSelection = async () => {
    if (isPsLocked) {
      setStatusNotice({
        type: "error",
        message: "Your problem statement selection is locked and cannot be reset."
      });
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }

    setSelectedPsId("");
    setProblemStatement("");
    setIsPsSaved(false);

    if (targetRegId) {
      try {
        const regRef = doc(db, "registrations", targetRegId);
        const currentDocSnap = await getDoc(regRef);
        const currentRoundVal = currentDocSnap.exists() ? (Number(currentDocSnap.data().currentRound) || currentTeamRound || 1) : (currentTeamRound || 1);
        const rP = `r${currentRoundVal}_`;
        await updateDoc(regRef, {
          selectedProblemStatementId: "",
          selectedProblemStatement: null,
          problemStatement: "",
          isPsSaved: false,
          isPsLocked: false,
          problemStatementLocked: false,
          updatedAt: Date.now(),
          [`${rP}selectedProblemStatementId`]: "",
          [`${rP}selectedProblemStatement`]: null,
          [`${rP}problemStatement`]: "",
          [`${rP}isPsSaved`]: false,
          [`${rP}isPsLocked`]: false,
        });
      } catch (err) {
        console.error("Error clearing problem statement hold in Firestore:", err);
      }
    }
  };

  // Confirm Problem Statement & Lock Selection before moving to Step 2
  const handleConfirmProblemStatementAndContinue = async () => {
    if (!problemStatement.trim()) {
      setStatusNotice({
        type: "error",
        message: "Please select an available problem statement or enter your custom statement before continuing."
      });
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }

    // Lock PS Selection for current team
    setIsPsSaved(true);
    setIsPsLocked(true);

    if (targetRegId) {
      try {
        const regRef = doc(db, "registrations", targetRegId);
        const selectedPsObj = availableProblemStatements.find(p => p.id === selectedPsId || p.code === selectedPsId) || null;
        const currentDocSnap = await getDoc(regRef);
        const currentRoundVal = currentDocSnap.exists() ? (Number(currentDocSnap.data().currentRound) || currentTeamRound || 1) : (currentTeamRound || 1);
        const rP = `r${currentRoundVal}_`;
        await updateDoc(regRef, {
          problemStatement,
          selectedProblemStatementId: selectedPsId,
          selectedProblemStatement: selectedPsObj,
          isPsSaved: true,
          isPsLocked: true,
          problemStatementLocked: true,
          submissionRound: currentRoundVal,
          updatedAt: Date.now(),
          [`${rP}problemStatement`]: problemStatement,
          [`${rP}selectedProblemStatementId`]: selectedPsId,
          [`${rP}selectedProblemStatement`]: selectedPsObj,
          [`${rP}isPsSaved`]: true,
          [`${rP}isPsLocked`]: true,
        });
      } catch (err) {
        console.error("Error locking problem statement selection in Firestore:", err);
      }
    }

    setCurrentStep(2);
  };

  // Handle Draft Save
  const handleSaveDraft = async () => {
    setSaving(true);
    setStatusNotice(null);

    try {
      if (targetRegId) {
        const regRef = doc(db, "registrations", targetRegId);
        const selectedPsObj = availableProblemStatements.find(p => p.id === selectedPsId || p.code === selectedPsId) || null;
        // Read currentRound from the doc to tag this submission with the correct round
        const currentDocSnap = await getDoc(regRef);
        const currentRoundVal = currentDocSnap.exists() ? (Number(currentDocSnap.data().currentRound) || currentTeamRound || 1) : (currentTeamRound || 1);
        const rP = `r${currentRoundVal}_`;
        await updateDoc(regRef, {
          problemStatement,
          keyFeatures,
          githubUrl,
          prototypeUrl,
          demoVideoUrl,
          srsFileName,
          presentationFileName,
          selectedProblemStatementId: selectedPsId,
          selectedProblemStatement: selectedPsObj,
          submissionStatus: "Draft",
          submissionRound: currentRoundVal,
          updatedAt: Date.now(),
          [`${rP}problemStatement`]: problemStatement,
          [`${rP}keyFeatures`]: keyFeatures,
          [`${rP}githubUrl`]: githubUrl,
          [`${rP}prototypeUrl`]: prototypeUrl,
          [`${rP}demoVideoUrl`]: demoVideoUrl,
          [`${rP}srsFileName`]: srsFileName,
          [`${rP}presentationFileName`]: presentationFileName,
          [`${rP}selectedProblemStatementId`]: selectedPsId,
          [`${rP}selectedProblemStatement`]: selectedPsObj,
          [`${rP}submissionStatus`]: "Draft",
        });
      }

      setStatusNotice({ type: "success", message: "Draft saved successfully!" });
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err) {
      console.error("Error saving draft:", err);
      setStatusNotice({ type: "error", message: "Failed to save draft. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Handle Final Submission
  const handleSubmitProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    setStatusNotice(null);

    try {
      if (targetRegId) {
        const regRef = doc(db, "registrations", targetRegId);
        const selectedPsObj = availableProblemStatements.find(p => p.id === selectedPsId || p.code === selectedPsId) || null;
        // Read currentRound to tag this submission with the correct round
        const currentDocSnap = await getDoc(regRef);
        const currentRoundVal = currentDocSnap.exists() ? (Number(currentDocSnap.data().currentRound) || currentTeamRound || 1) : (currentTeamRound || 1);
        const rP = `r${currentRoundVal}_`;
        const now = Date.now();
        await updateDoc(regRef, {
          problemStatement,
          keyFeatures,
          githubUrl,
          prototypeUrl,
          demoVideoUrl,
          srsFileName,
          presentationFileName,
          selectedProblemStatementId: selectedPsId,
          selectedProblemStatement: selectedPsObj,
          submissionStatus: "Submitted",
          submissionRound: currentRoundVal,
          submittedAt: now,
          updatedAt: now,
          [`${rP}problemStatement`]: problemStatement,
          [`${rP}keyFeatures`]: keyFeatures,
          [`${rP}githubUrl`]: githubUrl,
          [`${rP}prototypeUrl`]: prototypeUrl,
          [`${rP}demoVideoUrl`]: demoVideoUrl,
          [`${rP}srsFileName`]: srsFileName,
          [`${rP}presentationFileName`]: presentationFileName,
          [`${rP}selectedProblemStatementId`]: selectedPsId,
          [`${rP}selectedProblemStatement`]: selectedPsObj,
          [`${rP}submissionStatus`]: "Submitted",
          [`${rP}submittedAt`]: now,
          [`${rP}isPsSaved`]: true,
          [`${rP}isPsLocked`]: true,
        });
      }

      setStatusNotice({ type: "success", message: "Project submitted successfully!" });
      if (onSuccess) onSuccess();
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err) {
      console.error("Error submitting project:", err);
      setStatusNotice({ type: "error", message: "Failed to submit project. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  // SRS File Drop / Choose
  const handleSrsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isStepLocked(2)) {
      setStatusNotice({ type: "error", message: "Step 2 (SRS Submission) is locked by event administrators." });
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setSrsFileName(fileName);
      await saveStepDataToFirestore({ srsFileName: fileName, srsFileUrl: `uploaded://${fileName}` });
      setStatusNotice({ type: "success", message: `SRS Document "${fileName}" saved to database!` });
      setTimeout(() => setStatusNotice(null), 3500);
    }
  };

  // Presentation File Drop / Choose
  const handlePresentationFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isStepLocked(3)) {
      setStatusNotice({ type: "error", message: "Step 3 (PPT Submission) is locked by event administrators." });
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setPresentationFileName(fileName);
      await saveStepDataToFirestore({ presentationFileName: fileName, presentationUrl: `uploaded://${fileName}` });
      setStatusNotice({ type: "success", message: `PPT Presentation "${fileName}" saved to database!` });
      setTimeout(() => setStatusNotice(null), 3500);
    }
  };

  const isIdeationRound = activeRoundType === "Ideation & Video Submission" || activeRoundType === "Ideation" || activeRoundType === "Video Submission";

  // Dynamic Steps Definition
  const STEPS = isIdeationRound ? [
    { 
      id: 1, 
      name: "Ideation Description", 
      label: "1. Ideation Description", 
      icon: FileText, 
      desc: "Provide details of your ideation" 
    },
    { 
      id: 2, 
      name: "Video Submission", 
      label: "2. Video Link", 
      icon: PlayCircle, 
      desc: "Provide your YouTube video link" 
    },
    {
      id: 3,
      name: "Overview",
      label: "3. Submission Overview",
      icon: ShieldCheck,
      desc: "Review and submit your ideation"
    }
  ] : [
    { 
      id: 1, 
      name: "Problem Statement", 
      label: "1. Problem Statement", 
      icon: FileText, 
      desc: "Select or enter your problem statement" 
    },
    { 
      id: 2, 
      name: "SRS", 
      label: "2. SRS Submission", 
      icon: FileUp, 
      desc: "Upload SRS document" 
    },
    { 
      id: 3, 
      name: "PPT", 
      label: "3. PPT Submission", 
      icon: Video, 
      desc: "Upload presentation deck" 
    },
    { 
      id: 4, 
      name: "Features", 
      label: "4. Key Features", 
      icon: Code, 
      desc: "Describe key features" 
    },
    { 
      id: 5, 
      name: "Repo", 
      label: "5. Code Repository", 
      icon: Globe, 
      desc: "Code repository link" 
    },
    { 
      id: 6, 
      name: "Prototype & Video", 
      label: "6. Prototype Link & Video Submission", 
      icon: PlayCircle, 
      desc: "Live prototype and video demo link" 
    },
    {
      id: 7,
      name: "Overview",
      label: "7. Submission Overview",
      icon: ShieldCheck,
      desc: "Review and submit your project"
    }
  ];

  const checkStepCompleted = (stepId: number) => {
    if (isIdeationRound) {
      if (stepId === 1) return !!problemStatement?.trim();
      if (stepId === 2) return !!demoVideoUrl?.trim();
      if (stepId === 3) return submissionStatus === "Submitted";
    } else {
      if (stepId === 1) return !!selectedPsId || !!problemStatement?.trim();
      if (stepId === 2) return !!srsFileName;
      if (stepId === 3) return !!presentationFileName;
      if (stepId === 4) return !!keyFeatures?.trim();
      if (stepId === 5) return !!githubUrl?.trim();
      if (stepId === 6) return !!demoVideoUrl?.trim() || !!prototypeUrl?.trim();
      if (stepId === 7) return submissionStatus === "Submitted";
    }
    return false;
  };

  return (
    <div className={`space-y-8 font-sans ${embedded ? "" : "max-w-6xl mx-auto p-8"}`}>
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img src="/ai_verse.png" alt="AI Verse Logo" className="w-12 h-12 rounded-2xl object-contain shadow-md shadow-blue-500/25 shrink-0 ring-1 ring-blue-500/20" />
          <div>
            <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">Project Submission</h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">
              Complete the 7 steps below to submit your hackathon project to AI Verse.
            </p>
          </div>
        </div>

        {/* Top Right Quick Draft Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : null}
            <span>Save Draft</span>
          </button>
        </div>
      </div>

      {/* Alert Notice */}
      {statusNotice && (
        <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 shadow-md animate-fade-in ${
          statusNotice.type === "success" 
            ? "bg-emerald-500 text-white" 
            : "bg-red-500 text-white"
        }`}>
          <CheckCircle2 className="w-5 h-5" />
          <span>{statusNotice.message}</span>
        </div>
      )}

      {/* 🚀 PROGRESS INDICATOR */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between relative max-w-5xl mx-auto overflow-x-auto pb-2 -mb-2">
          
          {STEPS.map((step, idx) => {
            const isCompleted = checkStepCompleted(step.id);
            const isActive = currentStep === step.id;

            return (
              <React.Fragment key={step.id}>
                {/* Step Circle & Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className="flex flex-col items-center gap-2.5 z-10 group cursor-pointer focus:outline-none"
                >
                  <div 
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-300 ${
                      isCompleted 
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-100"
                        : isActive 
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20 scale-105"
                          : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-[#0F172A]"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5 stroke-[3]" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </div>

                  <div className="text-center">
                    <span 
                      className={`block text-xs font-black transition-colors ${
                        isActive 
                          ? "text-blue-600" 
                          : isCompleted 
                            ? "text-emerald-700 font-bold" 
                            : "text-slate-400 font-medium group-hover:text-slate-600"
                      }`}
                    >
                      {step.name}
                    </span>
                  </div>
                </button>

                {/* Progress Connecting Line */}
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-1 mx-3 rounded-full overflow-hidden bg-slate-100 self-center -mt-6">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        isCompleted ? "bg-emerald-500" : currentStep === step.id ? "bg-blue-600" : "bg-slate-200"
                      }`} 
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}

        </div>
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-9 shadow-xs space-y-8 text-left">
        
        {/* STEP 1: PROBLEM STATEMENT */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                    Step 1 of {isIdeationRound ? '2' : '6'}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">1. {isIdeationRound ? 'Ideation Description' : 'Problem Statement'}</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isIdeationRound ? 'Provide details of your ideation.' : "Select an official event problem statement or enter your team's custom problem statement."}
                </p>
              </div>
            </div>

            {/* Available Official Event Problem Statements Picker */}
            {(() => {
              if (isIdeationRound) return null;
              const filteredProblemStatements = availableProblemStatements.filter((item) => {
                if (!item.round || item.round === "all" || item.round === "All") return true;
                return Number(item.round) === currentTeamRound;
              });

              if (filteredProblemStatements.length === 0 && availableProblemStatements.length === 0) return null;

              return (
                <div className="space-y-4 p-5 bg-slate-50/80 border border-slate-200/90 rounded-3xl">
                  {isPsLocked && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-800 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>🔒 Problem Statement Confirmed & Locked — Selection cannot be changed after proceeding.</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/60 pb-3.5">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#2563EB]" /> Official Event Problem Statements ({filteredProblemStatements.length})
                      </label>
                      {currentTeamRound > 1 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Round {currentTeamRound}
                        </span>
                      )}
                    </div>

                    {/* Allocation Status Legend */}
                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Green: Available
                      </span>
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                        <span className="w-2 h-2 rounded-full bg-[#2563EB]" /> Blue: Held (Your Team)
                      </span>
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50 text-red-700 border border-red-200">
                        <span className="w-2 h-2 rounded-full bg-red-500" /> Red: Taken (Other Team)
                      </span>
                    </div>
                  </div>

                  {filteredProblemStatements.length === 0 ? (
                    <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                      <p className="text-xs font-bold text-slate-600">
                        No official problem statements specifically assigned for Round {currentTeamRound} yet.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        You can enter your custom problem statement below or check with your event coordinators.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredProblemStatements.map((item, idx) => {
                        const psKey = item.id || item.code || `ps_${idx + 1}`;
                        const isSelected = selectedPsId === item.id || selectedPsId === item.code;
                        const takenByTeam = takenPsMap[item.id] || takenPsMap[item.code] || takenPsMap[psKey];
                        const isTakenByOther = !!takenByTeam && !isSelected;

                        return (
                          <div
                            key={item.id || idx}
                            onClick={() => handleSelectProblemStatement(item, idx)}
                            className={`p-5 rounded-2xl border-2 transition-all text-left space-y-2.5 relative ${
                              isSelected
                                ? isPsLocked
                                  ? "bg-amber-50/90 border-amber-500 shadow-md ring-2 ring-amber-500/20 cursor-not-allowed"
                                  : "bg-blue-50/90 border-[#2563EB] shadow-md ring-2 ring-blue-500/20 cursor-pointer"
                                : isTakenByOther || isPsLocked
                                  ? "bg-red-50/60 border-red-300 opacity-90 cursor-not-allowed shadow-2xs"
                                  : "bg-emerald-50/30 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/80 hover:shadow-xs cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                                    isSelected
                                      ? isPsLocked ? "bg-amber-600 text-white" : "bg-[#2563EB] text-white"
                                      : isTakenByOther
                                        ? "bg-red-600 text-white"
                                        : "bg-emerald-600 text-white"
                                  }`}
                                >
                                  {item.code || `PS-0${idx + 1}`}
                                </span>
                                {item.round && item.round !== "all" && item.round !== "All" && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    R{item.round}
                                  </span>
                                )}
                              </div>

                              {/* Status Pill Badge */}
                              {isSelected ? (
                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black text-white border flex items-center gap-1.5 shadow-2xs ${
                                  isPsLocked ? "bg-amber-600 border-amber-700" : "bg-blue-600 border-blue-700"
                                }`}>
                                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                  {isPsLocked ? "🔒 Confirmed & Locked" : "In Hold (Your Team)"}
                                </span>
                              ) : isTakenByOther ? (
                                <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-red-100 text-red-700 border border-red-200 flex items-center gap-1.5 shadow-2xs">
                                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                  Taken ({takenByTeam})
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  Available
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-black text-slate-900 leading-tight">{item.title}</h4>
                            <p
                              className={`text-xs font-medium leading-relaxed line-clamp-3 ${
                                isSelected
                                  ? "text-slate-800 font-semibold"
                                  : isTakenByOther
                                    ? "text-slate-600"
                                    : "text-slate-700"
                              }`}
                            >
                              {item.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Problem Statement Text & Detailed Description Card */}
            <div className="bg-white p-7 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 text-left relative overflow-hidden">
              
              {/* Subtle Ambient Glow */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle,rgba(59,130,246,0.06)_0%,transparent_70%)] pointer-events-none transform-gpu" />

              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2563EB] to-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-blue-500/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 tracking-tight">
                      {isIdeationRound ? 'Ideation Details' : 'Problem Statement & Requirements'}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {isIdeationRound ? 'Describe your ideation thoroughly.' : "Review, customize, or paste your team's exact problem statement requirements."}
                    </p>
                  </div>
                </div>

                {!isIdeationRound && (
                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    {selectedPsId ? (
                      <span className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xs ${
                        isPsLocked ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200/80"
                      }`}>
                        <span className={`w-2 h-2 rounded-full animate-pulse ${isPsLocked ? "bg-amber-600" : "bg-[#2563EB]"}`} />
                        {isPsLocked ? "🔒 Problem Statement Confirmed & Locked" : "Official Statement Selected"}
                      </span>
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-slate-100 text-slate-600 border border-slate-200/80">
                        Custom Statement Mode
                      </span>
                    )}
                    {problemStatement && (
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        disabled={isPsLocked}
                        className={`text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all border shadow-2xs ${
                          isPsLocked 
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                            : "text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 border-slate-200/60 cursor-pointer"
                        }`}
                      >
                        {isPsLocked ? "🔒 Selection Locked" : "Reset / Clear"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Seamless Borderless Text Area */}
              <div className="space-y-4 relative z-10">
                <textarea
                  ref={problemStatementRef}
                  rows={8}
                  value={problemStatement}
                  onChange={(e) => {
                    if (isPsLocked) return;
                    let val = e.target.value;
                    const words = val.trim() ? val.trim().split(/\s+/) : [];
                    if (words.length > 150) {
                      const match = val.match(/^(\s*\S+){0,150}/);
                      if (match) val = match[0];
                    }
                    setProblemStatement(val);
                  }}
                  readOnly={isPsLocked}
                  placeholder="Type or paste your problem statement title, detailed description, constraints, and target user requirements..."
                  className={`w-full p-5 sm:p-6 border-0 rounded-2xl text-sm font-medium leading-relaxed whitespace-pre-wrap font-sans transition-all overflow-hidden resize-none shadow-2xs ${
                    isPsLocked 
                      ? "bg-slate-100/80 text-slate-700 cursor-not-allowed" 
                      : "bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  }`}
                />
                
                {/* Clean Seamless Footer Status & Counter Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-semibold text-slate-500 px-1 pt-1">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0" />
                    <span>
                      {isPsLocked 
                        ? "🔒 Problem Statement is confirmed and locked for your team." 
                        : "Full card view enabled — multiline requirements, formatting, and constraints expanded."}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                    <div className="w-20 h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                      {(() => {
                        const wordCount = problemStatement.trim() ? problemStatement.trim().split(/\s+/).length : 0;
                        return (
                          <div 
                            className={`h-full transition-all duration-300 ${
                              wordCount > 135 ? "bg-red-500" : wordCount > 100 ? "bg-amber-500" : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${Math.min((wordCount / 150) * 100, 100)}%` }}
                          />
                        );
                      })()}
                    </div>
                    <span className={`font-mono text-xs font-black ${
                      (problemStatement.trim() ? problemStatement.trim().split(/\s+/).length : 0) > 135 ? "text-red-600" : "text-slate-600"
                    }`}>
                      {problemStatement.trim() ? problemStatement.trim().split(/\s+/).length : 0} / 150 words
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Navigation Buttons for Step 1 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer self-start sm:self-auto"
              >
                Save Draft
              </button>
              
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {/* Save My Problem Statement Button (Placed in user's requested red box area) */}
                {!isIdeationRound && (
                  <button
                    type="button"
                    onClick={handleSaveProblemStatement}
                    disabled={savingPs || isPsLocked}
                    className={`px-6 py-3 font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                      isPsSaved
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30"
                    } ${isPsLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {savingPs ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : isPsSaved ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-white" />
                    )}
                    <span>{isPsSaved ? "✓ Problem Statement Saved" : "Save My Problem Statement"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={isIdeationRound ? () => { 
                    if (!problemStatement.trim()) {
                      setStatusNotice({ type: "error", message: "Please provide your Ideation Description before continuing." });
                      setTimeout(() => setStatusNotice(null), 4000);
                      return;
                    }
                    handleSaveDraft(); 
                    setCurrentStep(2); 
                  } : handleConfirmProblemStatementAndContinue}
                  className="px-7 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>{isIdeationRound ? 'Continue to Video Submission' : 'Continue to SRS Submission'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SRS SUBMISSION (HACKATHON ONLY) */}
        {!isIdeationRound && currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FileUp className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Step 2 of 6
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">2. SRS Submission</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Upload your project Software Requirements Specification (SRS) document.
                </p>
              </div>
            </div>

            {isStepLocked(2) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-extrabold text-amber-800 flex items-center gap-2.5 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>🔒 Step 2 (SRS Submission) is LOCKED by event administrators. Document updates are currently disabled.</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 max-w-2xl">
              {/* SRS Document Upload Card */}
              <div className={`border-2 border-dashed rounded-3xl p-8 text-center space-y-4 transition-all relative group ${
                isStepLocked(2) 
                  ? "border-slate-300 bg-slate-100/70 opacity-60 cursor-not-allowed" 
                  : "border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20"
              }`}>
                <input 
                  type="file" 
                  accept=".pdf,.docx,.doc"
                  onChange={handleSrsFileChange}
                  disabled={isStepLocked(2)}
                  className={`absolute inset-0 opacity-0 w-full h-full z-10 ${isStepLocked(2) ? "cursor-not-allowed" : "cursor-pointer"}`}
                />
                <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-[#2563EB] flex items-center justify-center mx-auto transition-colors">
                  <FileUp className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">SRS Document Submission</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {isStepLocked(2) ? "Submissions Locked" : <>Drag & drop file or <span className="text-blue-600 font-extrabold underline cursor-pointer">browse from device</span></>}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                    PDF, DOCX (MAX 10MB)
                  </p>
                </div>

                {srsFileName ? (
                  <div className="pt-2 text-xs font-black text-emerald-600 bg-emerald-50 py-2 px-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 w-max mx-auto">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="truncate max-w-[240px]">{srsFileName}</span>
                  </div>
                ) : (
                  <span className="inline-block text-[11px] font-extrabold text-slate-400 bg-slate-100 px-3 py-1 rounded-lg">
                    No file selected yet
                  </span>
                )}
              </div>
            </div>

            {/* Navigation Buttons for Step 2 */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  await saveStepDataToFirestore();
                  setCurrentStep(3);
                }}
                className="px-7 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to PPT Submission</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PPT SUBMISSION */}
        {!isIdeationRound && currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Step 3 of 6
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">3. PPT Submission</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Upload your project Presentation Deck.
                </p>
              </div>
            </div>

            {isStepLocked(3) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-extrabold text-amber-800 flex items-center gap-2.5 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>🔒 Step 3 (PPT Submission) is LOCKED by event administrators. Document updates are currently disabled.</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 max-w-2xl">
              {/* Project Presentation PPT Upload Card */}
              <div className={`border-2 border-dashed rounded-3xl p-8 text-center space-y-4 transition-all relative group ${
                isStepLocked(3) 
                  ? "border-slate-300 bg-slate-100/70 opacity-60 cursor-not-allowed" 
                  : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20"
              }`}>
                <input 
                  type="file" 
                  accept=".ppt,.pptx,.pdf"
                  onChange={handlePresentationFileChange}
                  disabled={isStepLocked(3)}
                  className={`absolute inset-0 opacity-0 w-full h-full z-10 ${isStepLocked(3) ? "cursor-not-allowed" : "cursor-pointer"}`}
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto transition-colors">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">PPT Presentation Submission</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {isStepLocked(3) ? "Submissions Locked" : <>Drag & drop pitch deck or <span className="text-indigo-600 font-extrabold underline cursor-pointer">browse from device</span></>}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                    PPT, PPTX, PDF (MAX 25MB)
                  </p>
                </div>

                {presentationFileName ? (
                  <div className="pt-2 text-xs font-black text-emerald-600 bg-emerald-50 py-2 px-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 w-max mx-auto">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="truncate max-w-[240px]">{presentationFileName}</span>
                  </div>
                ) : (
                  <span className="inline-block text-[11px] font-extrabold text-slate-400 bg-slate-100 px-3 py-1 rounded-lg">
                    No presentation uploaded yet
                  </span>
                )}
              </div>
            </div>

            {/* Navigation Buttons for Step 3 */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  await saveStepDataToFirestore();
                  setCurrentStep(4);
                }}
                className="px-7 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Features</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: FEATURES */}
        {!isIdeationRound && currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Code className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100">
                    Step 4 of 6
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">4. Key Features</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Describe key features & technical functionalities of your project.
                </p>
              </div>
            </div>

            {isStepLocked(4) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-extrabold text-amber-800 flex items-center gap-2.5 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>🔒 Step 4 (Key Features) is LOCKED by event administrators. Edits are currently disabled.</span>
              </div>
            )}

            {/* Key Features Textarea */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Key Features & Technical Functionalities
              </label>
              <textarea
                ref={keyFeaturesRef}
                rows={6}
                value={keyFeatures}
                disabled={isStepLocked(4)}
                onChange={(e) => setKeyFeatures(e.target.value)}
                placeholder={`1. AI-driven predictive resource management algorithm\n2. Real-time websocket notification engine\n3. Role-based authentication & analytics dashboard...`}
                className={`w-full p-4.5 border rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all leading-relaxed whitespace-pre-wrap overflow-hidden resize-none ${
                  isStepLocked(4) 
                    ? "bg-slate-100/80 cursor-not-allowed border-slate-300 text-slate-600" 
                    : "bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white"
                }`}
              />
            </div>

            {/* Navigation Buttons for Step 4 */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  await saveStepDataToFirestore();
                  setCurrentStep(5);
                }}
                className="px-7 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Code Repository</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: REPO */}
        {!isIdeationRound && currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100">
                    Step 5 of 6
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">5. Code Repository</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Provide your code repository link.
                </p>
              </div>
            </div>

            {isStepLocked(5) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-extrabold text-amber-800 flex items-center gap-2.5 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>🔒 Step 5 (Code Repository) is LOCKED by event administrators. Edits are currently disabled.</span>
              </div>
            )}

            {/* Code Repository URL Input */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Code Repository URL (GitHub / GitLab / Bitbucket)
              </label>
              <div className="relative flex items-center">
                <Code className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
                <input 
                  type="url" 
                  value={githubUrl}
                  disabled={isStepLocked(5)}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/your-username/your-project-repo" 
                  className={`w-full pl-12 pr-4 py-3.5 border rounded-2xl text-sm font-semibold transition-all ${
                    isStepLocked(5) 
                      ? "bg-slate-100/80 cursor-not-allowed border-slate-300 text-slate-600" 
                      : "bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  }`}
                  required
                />
              </div>
            </div>

            {/* Navigation Buttons for Step 5 */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  await saveStepDataToFirestore();
                  setCurrentStep(6);
                }}
                className="px-7 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Prototype & Video</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: PROTOTYPE LINK AND VIDEO SUBMISSION (or STEP 2 for IDEATION) */}
        {currentStep === (isIdeationRound ? 2 : 6) && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                <PlayCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-100">
                    Step {isIdeationRound ? '2 of 2' : '6 of 6'}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{isIdeationRound ? '2. Video Submission' : '6. Prototype Link & Video Submission'}</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isIdeationRound ? 'Submit your YouTube video link.' : 'Submit live prototype URL, demo video link, and complete final project submission.'}
                </p>
              </div>
            </div>

            {isStepLocked(6) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-extrabold text-amber-800 flex items-center gap-2.5 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>🔒 Step 6 (Prototype & Video) is LOCKED by event administrators. Edits are currently disabled.</span>
              </div>
            )}

            <div className={`grid grid-cols-1 ${!isIdeationRound ? 'md:grid-cols-2' : ''} gap-6`}>
              {/* Prototype Link */}
              {!isIdeationRound && (
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Live Prototype / Demo URL
                  </label>
                  <div className="relative flex items-center">
                    <Globe className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
                    <input 
                      type="url" 
                      value={prototypeUrl}
                      disabled={isStepLocked(6)}
                      onChange={(e) => setPrototypeUrl(e.target.value)}
                      placeholder="https://figma.com/... or https://myproject.vercel.app" 
                      className={`w-full pl-12 pr-4 py-3.5 border rounded-2xl text-sm font-semibold transition-all ${
                        isStepLocked(6) 
                          ? "bg-slate-100/80 cursor-not-allowed border-slate-300 text-slate-600" 
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Demo Video URL */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  Demo Video URL (YouTube / Google Drive / Loom)
                </label>
                <div className="relative flex items-center">
                  <PlayCircle className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
                  <input 
                    type="url" 
                    value={demoVideoUrl}
                    disabled={isStepLocked(6)}
                    onChange={(e) => setDemoVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or Drive link" 
                    className={`w-full pl-12 pr-4 py-3.5 border rounded-2xl text-sm font-semibold transition-all ${
                      isStepLocked(6) 
                        ? "bg-slate-100/80 cursor-not-allowed border-slate-300 text-slate-600" 
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                    }`}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Navigation Buttons for Step */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(isIdeationRound ? 1 : 5)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  if (isIdeationRound && !demoVideoUrl.trim()) {
                    setStatusNotice({ type: "error", message: "Please provide your YouTube video link before continuing." });
                    setTimeout(() => setStatusNotice(null), 4000);
                    return;
                  }
                  await saveStepDataToFirestore();
                  setCurrentStep(isIdeationRound ? 3 : 7);
                }}
                className="px-7 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Overview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: SUBMISSION OVERVIEW (or STEP 3 for IDEATION) */}
        {currentStep === (isIdeationRound ? 3 : 7) && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Step 7 of 7
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">7. Submission Overview</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Review your project details before final submission.
                </p>
              </div>
            </div>

            {/* Submission Summary Content */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Problem Statement / Ideation Description */}
                <div className={`p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2 ${isIdeationRound ? '' : 'md:col-span-2'}`}>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">1. {isIdeationRound ? 'Ideation Description' : 'Problem Statement'}</span>
                  </div>
                  <p className="font-bold text-slate-900 text-sm whitespace-pre-wrap">
                    {problemStatement || "Not specified"}
                  </p>
                </div>

                {!isIdeationRound && (
                  <>
                    {/* 2. SRS */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <FileUp className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">2. SRS Document</span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm break-all">
                        {srsFileName || "SRS Pending"}
                      </p>
                    </div>

                    {/* 3. PPT */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Video className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">3. PPT Document</span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm break-all">
                        {presentationFileName || "PPT Pending"}
                      </p>
                    </div>

                    {/* 4. Features */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Code className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">4. Key Features</span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm">
                        {keyFeatures ? "Features Provided" : "Pending"}
                      </p>
                    </div>

                    {/* 5. Repository */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Globe className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">5. Code Repository</span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm break-all">
                        {githubUrl || "Repo URL Pending"}
                      </p>
                    </div>
                  </>
                )}

                {/* 6. Prototype & Video / 2. Video */}
                <div className={`p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2 ${isIdeationRound ? '' : 'md:col-span-2'}`}>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <PlayCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">{isIdeationRound ? '2. Video Link' : '6. Prototype & Video Links'}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {!isIdeationRound && (
                      <div className="flex items-start gap-2">
                        <span className="text-slate-500 font-semibold text-xs min-w-[70px]">Prototype:</span>
                        <span className="font-bold text-slate-900 text-sm break-all">{prototypeUrl || "Pending"}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 font-semibold text-xs min-w-[70px]">Video:</span>
                      <span className="font-bold text-slate-900 text-sm break-all">{demoVideoUrl || "Pending"}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Final Submission Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(isIdeationRound ? 2 : 6)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleSubmitProject()}
                disabled={submitting}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Submitting Project...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-white" />
                    <span>Submit Project Details</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProjectSubmissionPage;

