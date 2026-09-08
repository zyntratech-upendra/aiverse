import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  BarChart3,
  Calendar,
  Beaker,
  TrendingUp,
  Rocket,
  Eye,
  BookOpen,
  Search,
  Lightbulb
} from "lucide-react";
import Button from "../../components/ui/Button";
import SEO from "../../components/layout/SEO";
import { db } from "../../config/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { dataCache } from "../../utils/dataCache";

// Fallback assets
import sparkImg from "../../assets/images/spark.png";
import hackathonImg from "../../assets/images/hackathon.png";
import seminarImg from "../../assets/images/seminar.png";

interface HighlightEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  description: string;
  image: string;
  iconType: "globe" | "network";
}

const defaultHighlights: HighlightEvent[] = [
  {
    id: "mock-summit-2024",
    title: "Global AI Summit 2024",
    category: "Conference",
    date: "Oct 15",
    description: "Join industry leaders for a two-day symposium on the future of autonomous agents and LLMs.",
    image: sparkImg,
    iconType: "globe"
  },
  {
    id: "mock-masterclass-2024",
    title: "Neural Networks Masterclass",
    category: "Workshop",
    date: "Nov 05",
    description: "Hands-on session building custom architectures using PyTorch and exploring modern optimization.",
    image: seminarImg,
    iconType: "network"
  }
];

const HomePage: React.FC = () => {
  const [highlights, setHighlights] = useState<HighlightEvent[]>(() => dataCache.get<HighlightEvent[]>("home_highlights") || defaultHighlights);

  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const list: HighlightEvent[] = [];
        const titlesSeen = new Set<string>();

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === "Draft") return;

          const title = (data.title || "").trim();

          if (title && titlesSeen.has(title.toLowerCase())) return;
          if (title) titlesSeen.add(title.toLowerCase());

          let eventType = "Workshop";
          if (data.category === "HACKATHONS") eventType = "Hackathon";
          else if (data.category === "LECTURES") eventType = "Seminar";

          let img = sparkImg;
          if (data.imageName === "hackathonImg" || data.category === "HACKATHONS") img = hackathonImg;
          else if (data.imageName === "seminarImg" || data.category === "LECTURES") img = seminarImg;

          if (data.posterPreview) {
            img = data.posterPreview;
          }

          list.push({
            id: docSnap.id,
            title: title,
            category: eventType,
            date: data.date || "Oct 24",
            description: data.description || "",
            image: img,
            iconType: eventType === "Hackathon" ? "globe" : "network"
          });
        });

        if (list.length > 0) {
          const parseEventDate = (dateStr: string): number => {
            if (!dateStr) return Infinity;
            const parsed = Date.parse(dateStr);
            if (!isNaN(parsed)) return parsed;
            const currentYear = new Date().getFullYear();
            const parsedWithYear = Date.parse(`${dateStr}, ${currentYear}`);
            if (!isNaN(parsedWithYear)) return parsedWithYear;

            const monthNames: Record<string, number> = {
              jan: 0, january: 0,
              feb: 1, february: 1,
              mar: 2, march: 2,
              apr: 3, april: 3,
              may: 4,
              jun: 5, june: 5,
              jul: 6, july: 6,
              aug: 7, august: 7,
              sep: 8, sept: 8, september: 8,
              oct: 9, october: 9,
              nov: 10, november: 10,
              dec: 11, december: 11
            };

            const tokens = dateStr.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
            let foundMonth = -1;
            let foundDay = -1;
            let foundYear = currentYear;

            for (const t of tokens) {
              if (monthNames[t] !== undefined) {
                foundMonth = monthNames[t];
              } else {
                const n = parseInt(t, 10);
                if (!isNaN(n)) {
                  if (n > 1900 && n < 2100) foundYear = n;
                  else if (n >= 1 && n <= 31 && foundDay === -1) foundDay = n;
                }
              }
            }

            if (foundMonth !== -1 && foundDay !== -1) {
              return new Date(foundYear, foundMonth, foundDay).getTime();
            }

            return Infinity;
          };

          const now = Date.now() - 24 * 60 * 60 * 1000;
          const upcoming = list.filter(e => parseEventDate(e.date) >= now);
          const past = list.filter(e => parseEventDate(e.date) < now);

          upcoming.sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date));
          past.sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date));

          const combined = [...upcoming, ...past];
          const topHighlights = combined.slice(0, 2);
          setHighlights(topHighlights);
          dataCache.set("home_highlights", topHighlights);
        } else {
          setHighlights(defaultHighlights);
        }
      } catch (err) {
        console.error("Error loading highlights:", err);
        setHighlights(defaultHighlights);
      }
    };
    fetchHighlights();
  }, []);

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" as const }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };



  return (
    <div className="overflow-hidden bg-[#F8FAFC]">
      <SEO
        title="AI Verse VITB | AI & Data Science Student Community - VIT Bhimavaram"
        description="Welcome to AI Verse VITB (aiversevitb) — the premier Artificial Intelligence & Data Science student community at Vishnu Institute of Technology, Bhimavaram (VIT Bhimavaram). Collaborate on AI projects, hackathons, workshops, and student innovation."
        keywords="AI Verse, aiversevitb, AI Verse VITB, VIT Bhimavaram, Vishnu Institute of Technology, AI & Data Science, Data Science, Student AI Community, VITB AI"
      />
      {/* ================= HERO SECTION ================= */}
      <section className="relative min-h-[90vh] flex items-center pt-8 pb-16 lg:py-24">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <motion.div 
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(219,234,254,0.6)_0%,transparent_70%)] pointer-events-none transform-gpu"
            animate={{ x: [0, 40, -20, 0], y: [0, -40, 20, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute top-1/3 right-10 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(224,242,254,0.7)_0%,transparent_70%)] pointer-events-none transform-gpu"
            animate={{ x: [0, -30, 40, 0], y: [0, 30, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Subtle grid lines */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Left Copy Column */}
            <motion.div
              className="lg:col-span-7 space-y-6 text-left"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              {/* Badge */}
              <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-aether-blue-50 border border-aether-blue-100/50">
                <Sparkles className="h-3.5 w-3.5 text-aether-blue-600" />
                <span className="text-[10px] font-bold text-aether-blue-700 tracking-wider uppercase">
                  Welcome to AI Verse
                </span>
              </motion.div>

              {/* Headings */}
              <motion.div variants={fadeInUp} className="space-y-3">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.08] text-aether-dark font-sans tracking-tight">
                  Empowering the <br />
                  <span className="bg-gradient-to-r from-aether-blue-600 via-aether-blue-500 to-aether-blue-400 bg-clip-text text-transparent">
                    Future of AI
                  </span>
                </h1>
              </motion.div>

              {/* Subtitle */}
              <motion.p
                variants={fadeInUp}
                className="text-base sm:text-lg text-slate-500 max-w-xl font-normal leading-relaxed"
              >
                Join an elite community of innovators, researchers, and creators shaping the aetheric landscape of artificial intelligence. Discover, collaborate, and transcend.
              </motion.p>

              {/* Buttons */}
              <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-4 pt-2">
                <Link to="/events">
                  <Button variant="gradient" className="rounded-full px-6 py-3 font-bold group shadow-button hover:shadow-lg hover:scale-102 transition-all">
                    Register Now
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link to="/gallery">
                  <Button variant="secondary" className="rounded-full px-6 py-3 font-bold hover:bg-slate-50 transition-all">
                    Explore Gallery
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Right Stat Cards Column */}
            <motion.div
              className="lg:col-span-5 relative min-h-[380px] flex items-center justify-center"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" as const }}
            >
              {/* Stats card container with floating visual cards */}
              <div className="space-y-4 max-w-[360px] w-full mx-auto relative lg:mr-0">
                {/* Top Row: Two Square Cards */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Card 1: Active Members */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: [0, -10, 0],
                    }}
                    transition={{
                      y: {
                        duration: 5.5,
                        repeat: Infinity,
                        ease: "easeInOut" as const
                      },
                      opacity: { duration: 0.5, delay: 0.1 }
                    }}
                    whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                    className="glass-panel rounded-card shadow-card p-6 flex flex-col justify-between aspect-square text-left transition-all duration-300 hover:shadow-cardHover hover:border-blue-200/50"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 shadow-inner">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-3xl font-extrabold text-aether-dark tracking-tight">2.5k+</div>
                      <div className="text-[11px] sm:text-xs text-slate-500 font-semibold tracking-wide mt-1">Participants</div>
                    </div>
                  </motion.div>

                  {/* Card 2: Yearly Events */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: [-6, 4, -6],
                    }}
                    transition={{
                      y: {
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut" as const
                      },
                      opacity: { duration: 0.5, delay: 0.2 }
                    }}
                    whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                    className="glass-panel rounded-card shadow-card p-6 flex flex-col justify-between aspect-square text-left transition-all duration-300 hover:shadow-cardHover hover:border-sky-200/50"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-50 text-sky-600 shadow-inner">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-3xl font-extrabold text-aether-dark tracking-tight">20+</div>
                      <div className="text-[11px] sm:text-xs text-slate-500 font-semibold tracking-wide mt-1">Yearly Events</div>
                    </div>
                  </motion.div>
                </div>

                {/* Bottom Row: Wide Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: 1,
                    y: [4, -6, 4],
                  }}
                  transition={{
                    y: {
                      duration: 6.5,
                      repeat: Infinity,
                      ease: "easeInOut" as const
                    },
                    opacity: { duration: 0.5, delay: 0.3 }
                  }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  className="glass-panel rounded-card shadow-card p-6 flex items-center justify-between text-left transition-all duration-300 w-full hover:shadow-cardHover hover:border-emerald-200/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 shadow-inner">
                      <Beaker className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-aether-dark tracking-tight">300+</div>
                      <div className="text-[11px] sm:text-xs text-slate-500 font-semibold tracking-wide mt-0.5">Innovative Projects Delivered</div>
                    </div>
                  </div>
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </motion.div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ================= ABOUT US SPOTLIGHT CARD ================= */}
      <section id="about" className="py-12 sm:py-16 bg-white border-t border-slate-100 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
            className="relative rounded-3xl bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 border border-slate-200/80 p-6 sm:p-10 lg:p-12 shadow-card hover:shadow-cardHover transition-all duration-300 overflow-hidden"
          >
            {/* Ambient background glows */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-sky-100/40 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Left Column: Visual Media & Badges */}
              <motion.div variants={fadeInUp} className="lg:col-span-5 space-y-4">
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-900 shadow-md group border border-slate-100">
                  <img
                    src={sparkImg}
                    alt="AI Verse Community at VIT Bhimavaram"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                  
                  {/* Floating Chips inside Image */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 font-semibold text-[11px]">
                      <Sparkles className="h-3 w-3 text-blue-400" />
                      VIT Bhimavaram
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-blue-600/85 backdrop-blur-md font-bold text-[10px] uppercase tracking-wider">
                      Estd. 2022
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Right Column: About Card Content */}
              <motion.div variants={fadeInUp} className="lg:col-span-7 space-y-5 text-left">
                {/* Section Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-aether-blue-50 border border-aether-blue-100/60">
                  <Sparkles className="h-3.5 w-3.5 text-aether-blue-600" />
                  <span className="text-[10px] font-bold text-aether-blue-700 tracking-wider uppercase">
                    About AI Verse
                  </span>
                </div>

                {/* Heading */}
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-aether-dark tracking-tight leading-tight">
                  The Premier Student AI Community at <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-aether-blue-600 via-aether-blue-500 to-aether-blue-400 bg-clip-text text-transparent">
                    Vishnu Institute of Technology
                  </span>
                </h2>

                {/* Description */}
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-normal">
                  AI Verse is a student-driven ecosystem dedicated to demystifying Artificial Intelligence, Machine Learning, and Data Science. We bridge the gap between academic theories and practical deployment through cutting-edge hackathons, peer-led research, expert speaker series, and collaborative engineering projects.
                </p>

                {/* Highlights Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 border border-slate-100 shadow-sm">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Rocket className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">Hands-on AI Hackathons</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 border border-slate-100 shadow-sm">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                      <Search className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">Applied ML & Research</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 border border-slate-100 shadow-sm">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">Weekly Skill Bootcamps</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 border border-slate-100 shadow-sm">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Lightbulb className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">Faculty & Peer Mentorship</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link to="/team">
                    <Button variant="outline" className="rounded-xl px-5 py-2.5 font-bold hover:bg-slate-50 transition-all text-xs group">
                      Meet Our Team
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                  <Link to="/events">
                    <Button variant="secondary" className="rounded-xl px-5 py-2.5 font-bold hover:bg-slate-100 transition-all text-xs">
                      Explore Activities
                    </Button>
                  </Link>
                </div>
              </motion.div>

            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= OUR PURPOSE SECTION ================= */}
      <section className="py-20 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-aether-dark">
              Our Purpose
            </h2>
            <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">
              Driving the future of technology through collaborative learning and groundbreaking research.
            </p>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto"
          >
            {/* The Mission Card */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -6, boxShadow: "0 20px 40px rgba(37,99,235,0.08)" }}
              className="bg-white rounded-card shadow-card border border-slate-100 p-8 text-left space-y-5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-aether-blue-50 text-aether-blue-600 flex items-center justify-center shadow-inner">
                <Rocket className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-aether-dark">The Mission</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Democratizing AI education by providing accessible resources, hands-on workshops, and collaborative project environments. We strive to empower students and professionals alike to harness the power of artificial intelligence ethically and effectively.
              </p>
            </motion.div>

            {/* The Vision Card */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -6, boxShadow: "0 20px 40px rgba(37,99,235,0.08)" }}
              className="bg-white rounded-card shadow-card border border-slate-100 p-8 text-left space-y-5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-aether-blue-50 text-aether-blue-600 flex items-center justify-center shadow-inner">
                <Eye className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-aether-dark">The Vision</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                To become a global nexus for AI innovation where visionary minds converge to solve complex challenges. We envision a future where our community leads the development of aetheric AI technologies that positively transform society.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================= CORE PILLARS / FEATURED INITIATIVES ================= */}
      <section className="py-20 bg-slate-50 border-t border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-16">
            <span className="text-xs uppercase font-bold text-aether-blue-600 tracking-widest bg-aether-blue-50 px-3.5 py-1.5 rounded-full">
              Core Pillars
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-aether-dark mt-4">
              Featured Initiatives
            </h2>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Pillar 1: Education */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -8, borderBottomColor: "#3b82f6" }}
              className="bg-white rounded-card shadow-card border border-slate-100 p-8 text-left space-y-6 flex flex-col justify-between transition-all duration-300 border-b-2"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-aether-dark">Education</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Comprehensive curriculums and bootcamps covering artificial intelligence, data science, neural networks, and prompt engineering for all skill levels.
                </p>
              </div>
              <Link to="/events" className="inline-flex items-center gap-1.5 text-xs font-bold text-aether-blue-600 hover:text-aether-blue-700 mt-4 group">
                Learn More
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

            {/* Pillar 2: Research */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -8, borderBottomColor: "#3b82f6" }}
              className="bg-white rounded-card shadow-card border border-slate-100 p-8 text-left space-y-6 flex flex-col justify-between transition-all duration-300 border-b-2"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-aether-dark">Research</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Cutting-edge academic research groups exploring AGI, ethics in AI, and advanced generative models in collaboration with leading universities.
                </p>
              </div>
              <Link to="/team" className="inline-flex items-center gap-1.5 text-xs font-bold text-aether-blue-600 hover:text-aether-blue-700 mt-4 group">
                Meet Researchers
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

            {/* Pillar 3: Innovation */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -8, borderBottomColor: "#3b82f6" }}
              className="bg-white rounded-card shadow-card border border-slate-100 p-8 text-left space-y-6 flex flex-col justify-between transition-all duration-300 border-b-2"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-aether-dark">Innovation</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Incubator programs supporting student-led AI startups. Turn your aetheric concepts into market-ready products with our mentorship.
                </p>
              </div>
              <Link to="/gallery" className="inline-flex items-center gap-1.5 text-xs font-bold text-aether-blue-600 hover:text-aether-blue-700 mt-4 group">
                View Gallery
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* ================= UPCOMING HIGHLIGHTS SECTION ================= */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-16">
            <div className="text-left space-y-2">
              <h2 className="text-3xl font-extrabold text-aether-dark">
                Upcoming Highlights
              </h2>
              <p className="text-slate-500 text-sm sm:text-base font-medium">
                Don't miss out on our premier events and workshops.
              </p>
            </div>
            <Link to="/events">
              <Button variant="outline" className="rounded-full px-5 py-2.5 font-bold hover:bg-slate-50 transition-all text-xs">
                View All Events
              </Button>
            </Link>
          </div>

          {/* Highlights Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {highlights.map((event) => (
              <motion.div
                key={event.id}
                whileHover={{ y: -4, boxShadow: "0 15px 35px rgba(37,99,235,0.06)" }}
                className="bg-white rounded-[24px] border border-slate-100 p-5 flex flex-col sm:flex-row gap-6 text-left shadow-sm transition-all duration-300 group"
              >
                {/* Event Thumbnail */}
                <div className="w-full sm:w-40 h-40 rounded-2xl relative overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center border border-slate-100">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 text-[9px] font-bold bg-white/95 backdrop-blur-sm border border-slate-200/50 text-slate-800 px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                    {event.date}
                  </span>
                </div>

                {/* Event Copy Area */}
                <div className="flex flex-col justify-between py-1 flex-grow space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-aether-blue-600 uppercase tracking-widest bg-aether-blue-50 px-2.5 py-1 rounded-md inline-block">
                      {event.category}
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-800 tracking-tight leading-tight group-hover:text-aether-blue-600 transition-colors line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
                      {event.description}
                    </p>
                  </div>
                  <Link to={`/events/${event.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-aether-blue-600 hover:text-aether-blue-700 group/link">
                    View Details
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
