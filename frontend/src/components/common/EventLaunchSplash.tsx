import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Calendar, MapPin, ExternalLink, CheckCircle2, ArrowRight, X } from 'lucide-react';

// ─── 3D Confetti Particle System ───
const CONFETTI_COUNT = 32;
type ConfettiType = 'rect' | 'ribbon-left' | 'ribbon-right' | 'diamond' | 'circle';

interface Confetti {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  type: ConfettiType;
  color: string;
  rotation: number;
}

const generateConfetti = (): Confetti[] =>
  Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const types: ConfettiType[] = ['rect', 'ribbon-left', 'ribbon-right', 'diamond', 'circle'];
    const colors = [
      '#2563EB', // brand blue
      '#3B82F6', // vibrant blue
      '#60A5FA', // sky blue
      '#93C5FD', // soft blue
      '#F59E0B', // celebration amber
      '#10B981', // emerald green
      '#8B5CF6', // purple
      '#FFFFFF', // white
    ];
    return {
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 14 + 7,
      opacity: Math.random() * 0.75 + 0.25,
      duration: Math.random() * 14 + 8,
      delay: Math.random() * -15,
      type: types[Math.floor(Math.random() * types.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
    };
  });

// ─── Web Audio Chime Synthesizer ───
const playCelebrationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonic fanfare frequencies: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.65);
    });
  } catch {
    // AudioContext blocked or not supported - fail silently
  }
};

export interface EventLaunchData {
  title: string;
  category?: string;
  date?: string;
  location?: string;
  poster?: string;
  status?: string;
  eventId?: string;
  isEditing?: boolean;
}

interface EventLaunchSplashProps {
  isOpen: boolean;
  event: EventLaunchData | null;
  onClose: () => void;
  onViewEvent?: (eventId?: string) => void;
}

export const EventLaunchSplash: React.FC<EventLaunchSplashProps> = ({
  isOpen,
  event,
  onClose,
  onViewEvent
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'untie' | 'split' | 'fadeout' | 'done'>('idle');
  const [entered, setEntered] = useState(false);
  const confettiRef = useRef<Confetti[]>(generateConfetti());

  useEffect(() => {
    if (isOpen) {
      setIsOpening(false);
      setPhase('idle');
      setEntered(false);
      const timer = setTimeout(() => setEntered(true), 60);
      return () => clearTimeout(timer);
    } else {
      setPhase('done');
      setEntered(false);
    }
  }, [isOpen]);

  const handleUntieRibbon = useCallback(() => {
    if (isOpening) return;
    setIsOpening(true);
    playCelebrationChime();
    setPhase('untie');
    setTimeout(() => setPhase('split'), 700);
    setTimeout(() => {
      setPhase('fadeout');
      setTimeout(() => {
        setPhase('done');
        onClose();
      }, 1600);
    }, 1100);
  }, [isOpening, onClose]);

  if (!isOpen || phase === 'done' || !event) return null;

  const confetti = confettiRef.current;
  const isEditing = event.isEditing;

  return createPortal(
    <div
      className={`fixed inset-0 z-[99999] select-none flex flex-col overflow-hidden ${
        phase === 'fadeout' ? 'pointer-events-none' : ''
      }`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ═══ Background Doors (Splits the page left & right) ═══ */}
      <div
        className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-br from-[#FAFCFF] via-[#F0F6FF] to-[#E5EFFF] shadow-2xl"
        style={{
          transform: phase === 'fadeout' ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 1500ms cubic-bezier(0.7,0,0.3,1)',
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-bl from-[#FAFCFF] via-[#F0F6FF] to-[#E5EFFF] shadow-2xl"
        style={{
          transform: phase === 'fadeout' ? 'translateX(100%)' : 'translateX(0)',
          transition: 'transform 1500ms cubic-bezier(0.7,0,0.3,1)',
        }}
      />

      {/* ═══ Content Wrapper ═══ */}
      <div
        className={`absolute inset-0 flex flex-col justify-between p-6 md:p-12 transition-all duration-[1200ms] ease-in-out ${
          phase === 'fadeout' ? 'opacity-0 scale-110 blur-sm' : 'opacity-100 scale-100 blur-none'
        }`}
      >
        {/* ═══ Keyframes & Animations ═══ */}
        <style>{`
          @keyframes floatConfetti {
            0% { transform: translateY(0) rotate(0deg); }
            33% { transform: translateY(-18px) rotate(45deg); }
            66% { transform: translateY(12px) rotate(-25deg); }
            100% { transform: translateY(0) rotate(0deg); }
          }
          @keyframes pulseSoft {
            0%, 100% { opacity: 0.95; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.03); }
          }
          @keyframes badgeGlow {
            0%, 100% { box-shadow: 0 0 15px rgba(37,99,235,0.25); }
            50% { box-shadow: 0 0 30px rgba(37,99,235,0.55); }
          }
        `}</style>

        {/* ═══ Atmospheric Ambient Glows ═══ */}
        <div className="absolute top-[8%] left-[15%] w-[550px] h-[550px] bg-blue-400/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[15%] w-[600px] h-[600px] bg-indigo-500/15 rounded-full blur-[160px] pointer-events-none" />

        {/* ═══ 3D Floating Confetti ═══ */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {confetti.map((c) => (
            <div
              key={c.id}
              className="absolute transition-opacity duration-1000"
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                opacity: entered ? c.opacity : 0,
                transitionDelay: `${c.id * 35}ms`,
              }}
            >
              <div
                style={{
                  width: c.size,
                  height: c.size,
                  animation: `floatConfetti ${c.duration}s ease-in-out ${c.delay}s infinite`,
                  transform: `rotate(${c.rotation}deg)`,
                }}
              >
                {c.type === 'rect' && (
                  <div style={{ width: '100%', height: '45%', background: c.color, borderRadius: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }} />
                )}
                {c.type === 'diamond' && (
                  <div style={{ width: '85%', height: '85%', background: c.color, borderRadius: '2px', transform: 'rotate(45deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }} />
                )}
                {c.type === 'circle' && (
                  <div style={{ width: '70%', height: '70%', background: c.color, borderRadius: '50%', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }} />
                )}
                {c.type === 'ribbon-left' && (
                  <svg width="100%" height="100%" viewBox="0 0 20 20" fill="none">
                    <path d="M2 18 C5 10, 15 10, 18 2" stroke={c.color} strokeWidth="3.5" strokeLinecap="round" />
                  </svg>
                )}
                {c.type === 'ribbon-right' && (
                  <svg width="100%" height="100%" viewBox="0 0 20 20" fill="none">
                    <path d="M2 2 C10 5, 10 15, 18 18" stroke={c.color} strokeWidth="3.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ═══ Top Action Bar: Logo & Close Button ═══ */}
        <div className="relative z-30 flex items-center justify-between w-full">
          <div className={`flex items-center gap-3 transition-all duration-1000 delay-100 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
            <img src="/ai_verse.png" alt="AI Verse" className="h-10 sm:h-12 md:h-14 object-contain drop-shadow-sm" />
            <div className="hidden sm:block border-l border-slate-300 pl-3">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#2563EB] block">Department Portal</span>
              <span className="text-[10px] font-bold text-slate-500 block">Vishnu Institute of Technology</span>
            </div>
          </div>

          <div className={`flex items-center gap-2 transition-all duration-1000 delay-150 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer"
              title="Close & Go to Events"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ Center Ceremony: Event Title, Badges, & Satin Ribbon Bow ═══ */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center my-auto max-w-4xl mx-auto w-full px-4">
          
          {/* Official Launch Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50/90 border border-blue-200 text-[#2563EB] font-black text-xs uppercase tracking-[0.2em] mb-4 shadow-sm transition-all duration-1000 delay-200 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
               style={{ animation: 'badgeGlow 3s ease-in-out infinite' }}>
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>{isEditing ? "Event Updated & Successfully Launched" : "Official Event Launch Ceremony"}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          </div>

          {/* Super Heading */}
          <p className={`text-slate-500 tracking-[0.35em] uppercase text-xs md:text-sm font-extrabold mb-2 transition-all duration-1000 delay-300 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            AI VERSE PRESENTS
          </p>

          <h1 className={`text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-4 transition-all duration-1000 delay-400 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="text-slate-900">{event.title}</span>{" "}
            <span className="bg-gradient-to-r from-[#2563EB] via-blue-600 to-indigo-600 bg-clip-text text-transparent block sm:inline">
              is Launched!
            </span>
          </h1>

          {/* Subtitle Details Pill */}
          <div className={`flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-slate-600 mb-6 transition-all duration-1000 delay-500 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {event.category && (
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black tracking-wider text-[11px] uppercase shadow-sm">
                {event.category}
              </span>
            )}
            {event.date && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-slate-200/90 text-slate-700 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                {event.date}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-slate-200/90 text-slate-700 shadow-xs">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                {event.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px] uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {event.status || "Opened"}
            </span>
          </div>

          {/* ═══════════════════════════════════════════
              3D SATIN RIBBON & BOW CEREMONY
              ═══════════════════════════════════════════ */}
          <div
            className={`relative w-full flex items-center justify-center my-2 sm:my-4 transition-all duration-1000 delay-700 ${
              entered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
            style={{ pointerEvents: phase === 'split' || phase === 'fadeout' ? 'none' : 'auto' }}
          >
            {/* Horizontal Satin Ribbons SVG (Slides outward upon cutting) */}
            <div className="absolute w-[360px] sm:w-[540px] md:w-[700px] pointer-events-none">
              <svg width="100%" height="240" viewBox="0 0 400 240" className="w-full overflow-visible drop-shadow-[0_12px_28px_rgba(37,99,235,0.2)]">
                <defs>
                  <linearGradient id="eventRibbonH" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="25%" stopColor="#e2eaf4" />
                    <stop offset="50%" stopColor="#f4f7fb" />
                    <stop offset="75%" stopColor="#d1deee" />
                    <stop offset="100%" stopColor="#ffffff" />
                  </linearGradient>
                </defs>
                {/* Horizontal Ribbon Left */}
                <g
                  style={{
                    transform: phase === 'split' || phase === 'fadeout' ? 'translateX(-3000px)' : 'translateX(0)',
                    transition: 'transform 1500ms cubic-bezier(0.7,0,0.3,1)',
                  }}
                >
                  <path d="M-3000 110 Q -1425 140, 150 95 L 150 135 Q -1425 180, -3000 150 Z" fill="url(#eventRibbonH)" />
                  <path d="M-3000 110 Q -1425 140, 150 95" fill="none" stroke="#ffffff" strokeWidth="2" />
                  <path d="M-3000 150 Q -1425 180, 150 135" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
                </g>
                {/* Horizontal Ribbon Right */}
                <g
                  style={{
                    transform: phase === 'split' || phase === 'fadeout' ? 'translateX(3000px)' : 'translateX(0)',
                    transition: 'transform 1500ms cubic-bezier(0.7,0,0.3,1)',
                  }}
                >
                  <path d="M250 95 Q 1825 140, 3400 110 L 3400 150 Q 1825 180, 250 135 Z" fill="url(#eventRibbonH)" />
                  <path d="M250 95 Q 1825 140, 3400 110" fill="none" stroke="#ffffff" strokeWidth="2" />
                  <path d="M250 135 Q 1825 180, 3400 150" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
                </g>
              </svg>
            </div>

            {/* 3D Realistic Satin Bow SVG */}
            <div
              onClick={handleUntieRibbon}
              className="relative cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 group"
              style={{
                animation: phase === 'idle' ? 'pulseSoft 4s ease-in-out infinite' : 'none',
                opacity: phase === 'fadeout' ? 0 : 1,
                pointerEvents: phase !== 'idle' ? 'none' : 'auto',
                transition: 'opacity 400ms ease-out',
              }}
              title="Click Bow to Untie Ribbon & Reveal Event!"
            >
              <svg width="340" height="240" viewBox="0 0 400 300" className="w-[280px] sm:w-[360px] md:w-[420px] drop-shadow-[0_16px_32px_rgba(37,99,235,0.22)] overflow-visible">
                <defs>
                  <filter id="bowShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#1e3a8a" floodOpacity="0.16" />
                  </filter>
                  <filter id="bowGlow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  
                  <linearGradient id="bowLoopL" x1="0" y1="0.2" x2="0.8" y2="0.8">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="30%" stopColor="#e2eaf4" />
                    <stop offset="60%" stopColor="#f4f7fb" />
                    <stop offset="85%" stopColor="#d1deee" />
                    <stop offset="100%" stopColor="#e8f0f8" />
                  </linearGradient>
                  <linearGradient id="bowLoopR" x1="1" y1="0.2" x2="0.2" y2="0.8">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="30%" stopColor="#e2eaf4" />
                    <stop offset="60%" stopColor="#f4f7fb" />
                    <stop offset="85%" stopColor="#d1deee" />
                    <stop offset="100%" stopColor="#e8f0f8" />
                  </linearGradient>
                  <linearGradient id="bowCreaseL" x1="0.2" y1="0" x2="0.8" y2="1">
                    <stop offset="0%" stopColor="#f8fafd" />
                    <stop offset="40%" stopColor="#d1deee" />
                    <stop offset="100%" stopColor="#aebed7" />
                  </linearGradient>
                  <linearGradient id="bowCreaseR" x1="0.8" y1="0" x2="0.2" y2="1">
                    <stop offset="0%" stopColor="#f8fafd" />
                    <stop offset="40%" stopColor="#d1deee" />
                    <stop offset="100%" stopColor="#aebed7" />
                  </linearGradient>
                  <linearGradient id="bowTailL" x1="0" y1="0" x2="0.8" y2="1">
                    <stop offset="0%" stopColor="#f0f4fa" />
                    <stop offset="50%" stopColor="#d5e1f0" />
                    <stop offset="100%" stopColor="#b4c5dc" />
                  </linearGradient>
                  <linearGradient id="bowTailR" x1="1" y1="0" x2="0.2" y2="1">
                    <stop offset="0%" stopColor="#f0f4fa" />
                    <stop offset="50%" stopColor="#d5e1f0" />
                    <stop offset="100%" stopColor="#b4c5dc" />
                  </linearGradient>
                  <linearGradient id="bowKnot" x1="0.3" y1="0" x2="0.7" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="30%" stopColor="#dde6f2" />
                    <stop offset="70%" stopColor="#c5d4e6" />
                    <stop offset="100%" stopColor="#e6eef6" />
                  </linearGradient>
                </defs>

                <g filter="url(#bowShadow)">
                  {/* Left Half (Slides Left) */}
                  <g style={{
                    transform: phase === 'split' || phase === 'fadeout' ? 'translateX(-3000px)' : 'translateX(0)',
                    opacity: phase === 'split' || phase === 'fadeout' ? 0 : 1,
                    transition: 'all 1500ms cubic-bezier(0.7,0,0.3,1)',
                  }}>
                    <path d="M190 140 C140 180, 100 240, 70 290 C90 280, 110 270, 140 260 C150 220, 180 180, 200 150 Z" fill="url(#bowTailL)" stroke="#b5c4d8" strokeWidth="1" />
                    <path d="M185 145 C145 180, 115 230, 95 270" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" filter="url(#bowGlow)" />
                    <path d="M200 140 C180 40, 20 20, 20 100 C20 180, 150 170, 200 140 Z" fill="url(#bowLoopL)" stroke="#c2d0e2" strokeWidth="1" />
                    <path d="M190 135 C160 70, 60 50, 50 100 C40 150, 140 150, 190 135 Z" fill="url(#bowCreaseL)" opacity="0.8" />
                    <path d="M180 130 C150 60, 40 40, 35 100" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3" filter="url(#bowGlow)" />
                  </g>

                  {/* Right Half (Slides Right) */}
                  <g style={{
                    transform: phase === 'split' || phase === 'fadeout' ? 'translateX(3000px)' : 'translateX(0)',
                    opacity: phase === 'split' || phase === 'fadeout' ? 0 : 1,
                    transition: 'all 1500ms cubic-bezier(0.7,0,0.3,1)',
                  }}>
                    <path d="M210 140 C260 180, 300 240, 330 290 C310 280, 290 270, 260 260 C250 220, 220 180, 200 150 Z" fill="url(#bowTailR)" stroke="#b5c4d8" strokeWidth="1" />
                    <path d="M215 145 C255 180, 285 230, 305 270" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" filter="url(#bowGlow)" />
                    <path d="M200 140 C220 40, 380 20, 380 100 C380 180, 250 170, 200 140 Z" fill="url(#bowLoopR)" stroke="#c2d0e2" strokeWidth="1" />
                    <path d="M210 135 C240 70, 340 50, 350 100 C360 150, 260 150, 210 135 Z" fill="url(#bowCreaseR)" opacity="0.8" />
                    <path d="M220 130 C250 60, 360 40, 365 100" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3" filter="url(#bowGlow)" />
                  </g>

                  {/* Center Knot */}
                  <g style={{
                    transformOrigin: '200px 140px',
                    transform: phase === 'split' || phase === 'fadeout' ? 'scale(0)' : 'scale(1)',
                    opacity: phase === 'split' || phase === 'fadeout' ? 0 : 1,
                    transition: 'all 600ms ease-in',
                  }}>
                    <path d="M185 125 C185 115, 190 110, 200 110 C210 110, 215 115, 215 125 L215 155 C215 165, 210 170, 200 170 C190 170, 185 165, 185 155 Z" fill="url(#bowKnot)" stroke="#b5c4d8" strokeWidth="1" />
                    <path d="M192 118 C195 130, 195 150, 192 162" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1.5" />
                    <path d="M208 118 C205 130, 205 150, 208 162" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" filter="url(#bowGlow)" />
                  </g>
                </g>
              </svg>
            </div>
          </div>

          {/* Prompt to Untie / Cut Ribbon */}
          <div className={`mt-2 transition-all duration-1000 delay-800 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5 mb-5">
              <span>✂️</span>
              <span>Click the 3D Bow or button below to untie ribbon and reveal event</span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleUntieRibbon}
                disabled={isOpening}
                className="px-7 py-3.5 bg-[#2563EB] hover:bg-blue-700 active:scale-95 text-white font-extrabold rounded-2xl shadow-xl shadow-blue-600/25 hover:shadow-2xl transition-all text-sm flex items-center gap-2.5 cursor-pointer"
              >
                <span>✂️ Untie Ribbon & Reveal Event</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onViewEvent && (
                <button
                  type="button"
                  onClick={() => onViewEvent(event.eventId)}
                  className="px-6 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl shadow-sm hover:shadow-md transition-all text-sm flex items-center gap-2 cursor-pointer"
                >
                  <span>View Details</span>
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* ═══ Footer: Brand pillars ═══ */}
        <div className={`relative z-20 flex items-center justify-center pt-4 transition-all duration-1000 delay-900 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center gap-4 text-[10px] sm:text-xs font-extrabold tracking-[0.25em] text-slate-400">
            <span>INNOVATE</span>
            <span className="text-blue-500/40">•</span>
            <span>COLLABORATE</span>
            <span className="text-blue-500/40">•</span>
            <span>EXCEL</span>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
