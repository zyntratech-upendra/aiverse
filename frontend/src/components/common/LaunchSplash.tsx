import { useState, useEffect, useCallback, useRef } from 'react';

// ─── 3D Confetti System ───
const CONFETTI_COUNT = 24;
type ConfettiType = 'rect' | 'ribbon-left' | 'ribbon-right' | 'diamond';

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
    const types: ConfettiType[] = ['rect', 'ribbon-left', 'ribbon-right', 'diamond'];
    const colors = [
      '#3B82F6', // bright blue
      '#60A5FA', // light blue
      '#DBEAFE', // pale blue
      '#ffffff', // white
    ];
    return {
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 12 + 6,
      opacity: Math.random() * 0.7 + 0.3,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * -20, // Start animations at different phases
      type: types[Math.floor(Math.random() * types.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
    };
  });

export const LaunchSplash: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'untie' | 'split' | 'fadeout' | 'done'>('idle');
  const [entered, setEntered] = useState(false);
  const confettiRef = useRef<Confetti[]>(generateConfetti());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Trigger: Alt + Shift + L
      if (e.altKey && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setIsVisible(true);
        setIsOpening(false);
        setPhase('idle');
        setEntered(false);
        requestAnimationFrame(() => {
          setTimeout(() => setEntered(true), 50);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpen = useCallback(() => {
    if (isOpening) return;
    setIsOpening(true);
    setPhase('untie');
    setTimeout(() => setPhase('split'), 800);
    setTimeout(() => {
      setPhase('fadeout');
      // After split animation, start fading out the whole container
      setTimeout(() => {
        setPhase('done');
        setIsVisible(false);
      }, 1800); // Increased from 1200ms to match the slower animation
    }, 1200);
  }, [isOpening]);

  if (!isVisible || phase === 'done') return null;

  const confetti = confettiRef.current;

  return (
    <div
      className={`fixed inset-0 z-[9999] select-none flex flex-col overflow-hidden ${
        phase === 'fadeout' ? 'pointer-events-none' : ''
      }`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ═══ Background Doors (Splits the page) ═══ */}
      <div 
        className="absolute inset-y-0 left-0 w-1/2 bg-[#FAFCFF]"
        style={{ 
          transform: phase === 'fadeout' ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 1500ms cubic-bezier(0.7,0,0.3,1)'
        }}
      />
      <div 
        className="absolute inset-y-0 right-0 w-1/2 bg-[#FAFCFF]"
        style={{ 
          transform: phase === 'fadeout' ? 'translateX(100%)' : 'translateX(0)',
          transition: 'transform 1500ms cubic-bezier(0.7,0,0.3,1)'
        }}
      />

      {/* ═══ Content Wrapper (Fades and scales) ═══ */}
      <div 
        className={`absolute inset-0 flex flex-col transition-all duration-[1200ms] ease-in-out ${
          phase === 'fadeout' ? 'opacity-0 scale-110 blur-sm' : 'opacity-100 scale-100 blur-none'
        }`}
      >
      {/* ═══ Keyframes & Global Styles ═══ */}
      <style>{`
        @keyframes floatConfetti {
          0% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-15px) rotate(45deg); }
          66% { transform: translateY(10px) rotate(-20deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes bgGlowMove {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.1); }
        }
      `}</style>

      {/* ═══ Background Layer ═══ */}
      {/* Soft atmospheric glows */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-[#60A5FA]/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" style={{ animation: 'bgGlowMove 20s ease-in-out infinite' }} />
      <div className="absolute bottom-[20%] right-[15%] w-[600px] h-[600px] bg-[#3B82F6]/10 rounded-full blur-[140px] pointer-events-none mix-blend-multiply" style={{ animation: 'bgGlowMove 25s ease-in-out infinite reverse' }} />

      {/* Abstract Background Waves & Shapes (SVG) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
        {/* Top Left Gradient Circle */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(191,219,254,0.6) 0%, rgba(239,246,255,0) 70%)' }} />
        
        {/* Bottom Right Graphic Circle */}
        <div className="absolute bottom-[-15%] right-[-10%] w-[450px] h-[450px] rounded-full border-[1px] border-[#BFDBFE] opacity-60" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#BFDBFE]/60 to-[#EFF6FF]/10" />

        {/* Top Right Dot Grid */}
        <div className="absolute top-[10%] right-[5%] w-32 h-24 opacity-40" style={{ backgroundImage: 'radial-gradient(#94A3B8 2px, transparent 2px)', backgroundSize: '16px 16px' }} />
        
        {/* Bottom Left Dot Grid */}
        <div className="absolute bottom-[10%] left-[5%] w-32 h-24 opacity-40" style={{ backgroundImage: 'radial-gradient(#94A3B8 2px, transparent 2px)', backgroundSize: '16px 16px' }} />
      </div>

      {/* ═══ 3D Confetti ═══ */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute transition-opacity duration-1000"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              opacity: entered ? c.opacity : 0,
              transitionDelay: `${c.id * 50}ms`,
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
                <div style={{ width: '100%', height: '40%', background: c.color, borderRadius: '1px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
              )}
              {c.type === 'diamond' && (
                <div style={{ width: '80%', height: '80%', background: c.color, borderRadius: '2px', transform: 'rotate(45deg)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
              )}
              {c.type === 'ribbon-left' && (
                <svg width="100%" height="100%" viewBox="0 0 20 20" fill="none">
                  <path d="M2 18 C5 10, 15 10, 18 2" stroke={c.color} strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {c.type === 'ribbon-right' && (
                <svg width="100%" height="100%" viewBox="0 0 20 20" fill="none">
                  <path d="M2 2 C10 5, 10 15, 18 18" stroke={c.color} strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Top Logo ═══ */}
      <div className={`absolute top-12 md:top-16 left-0 w-full flex justify-center z-50 transition-all duration-1000 delay-100 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
        <img src="/ai_verse.png" alt="AI Verse Logo" className="h-20 md:h-28 lg:h-32 object-contain mix-blend-multiply" />
      </div>

      {/* ═══ Main Content (Hero) ═══ */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-20 pb-20 mt-16 md:mt-0">
        
        {/* WE ARE */}
        <p className={`text-[#64748B] tracking-[0.3em] uppercase text-xs md:text-sm font-medium mb-4 transition-all duration-1000 delay-300 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          WE ARE
        </p>

        {/* Heading */}
        <h1 className={`text-[clamp(3.5rem,8vw,6.5rem)] font-extrabold tracking-tight leading-none mb-6 transition-all duration-1000 delay-400 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="text-[#111827]">Launching</span>{' '}
          <span className="text-[#2563EB]">Website</span>
        </h1>

        {/* Subtitle */}
        <p className={`text-[#64748B] text-base md:text-lg max-w-[280px] md:max-w-md text-center leading-relaxed font-normal transition-all duration-1000 delay-500 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          A new chapter of innovation, collaboration and<br className="hidden md:block" /> opportunity is about to begin.
        </p>
      </div>

      {/* ═══════════════════════════════════════════
          RIBBON & BOW (Extremely realistic satin 3D)
          ═══════════════════════════════════════════ */}
      <div className={`absolute top-[52%] md:top-[55%] left-0 w-full z-40 flex items-center justify-center transition-all duration-1000 delay-700 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}
           style={{ pointerEvents: phase === 'split' || phase === 'fadeout' ? 'none' : 'auto' }}>
        
        {/* Horizontal Ribbons SVG (Slides away) */}
        <div className="absolute w-[340px] md:w-[500px] pointer-events-none">
          <svg width="400" height="300" viewBox="0 0 400 300" className="w-full overflow-visible drop-shadow-[0_12px_24px_rgba(59,130,246,0.15)]">
            <defs>
              <linearGradient id="ribbonH" x1="0" y1="0" x2="0" y2="1">
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
                transition: 'transform 1500ms cubic-bezier(0.7,0,0.3,1)' 
              }}
            >
              <path d="M-3000 140 Q -1425 170, 150 125 L 150 165 Q -1425 210, -3000 180 Z" fill="url(#ribbonH)" />
              <path d="M-3000 140 Q -1425 170, 150 125" fill="none" stroke="#ffffff" strokeWidth="2" />
              <path d="M-3000 180 Q -1425 210, 150 165" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
            </g>
            {/* Horizontal Ribbon Right */}
            <g 
              style={{ 
                transform: phase === 'split' || phase === 'fadeout' ? 'translateX(3000px)' : 'translateX(0)', 
                transition: 'transform 1500ms cubic-bezier(0.7,0,0.3,1)' 
              }}
            >
              <path d="M250 125 Q 1825 170, 3400 140 L 3400 180 Q 1825 210, 250 165 Z" fill="url(#ribbonH)" />
              <path d="M250 125 Q 1825 170, 3400 140" fill="none" stroke="#ffffff" strokeWidth="2" />
              <path d="M250 165 Q 1825 210, 3400 180" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
            </g>
          </svg>
        </div>

        {/* 3D Bow SVG */}
        <div 
          onClick={handleOpen}
          className="relative cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
          style={{ 
            animation: phase === 'idle' ? 'pulseSoft 4s ease-in-out infinite' : 'none',
            opacity: phase === 'fadeout' ? 0 : 1,
            pointerEvents: phase !== 'idle' ? 'none' : 'auto',
            transition: 'opacity 400ms ease-out'
          }}
        >
          <svg width="400" height="300" viewBox="0 0 400 300" className="w-[340px] md:w-[500px] drop-shadow-[0_12px_24px_rgba(59,130,246,0.15)] overflow-visible">
            <defs>
              <filter id="bowInnerShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#1e3a8a" floodOpacity="0.12" />
              </filter>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              
              <linearGradient id="loopL" x1="0" y1="0.2" x2="0.8" y2="0.8">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="30%" stopColor="#e2eaf4" />
                <stop offset="60%" stopColor="#f4f7fb" />
                <stop offset="85%" stopColor="#d1deee" />
                <stop offset="100%" stopColor="#e8f0f8" />
              </linearGradient>
              <linearGradient id="loopR" x1="1" y1="0.2" x2="0.2" y2="0.8">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="30%" stopColor="#e2eaf4" />
                <stop offset="60%" stopColor="#f4f7fb" />
                <stop offset="85%" stopColor="#d1deee" />
                <stop offset="100%" stopColor="#e8f0f8" />
              </linearGradient>
              <linearGradient id="creaseInnerL" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#f8fafd" />
                <stop offset="40%" stopColor="#d1deee" />
                <stop offset="100%" stopColor="#aebed7" />
              </linearGradient>
              <linearGradient id="creaseInnerR" x1="0.8" y1="0" x2="0.2" y2="1">
                <stop offset="0%" stopColor="#f8fafd" />
                <stop offset="40%" stopColor="#d1deee" />
                <stop offset="100%" stopColor="#aebed7" />
              </linearGradient>
              <linearGradient id="tailL" x1="0" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#f0f4fa" />
                <stop offset="50%" stopColor="#d5e1f0" />
                <stop offset="100%" stopColor="#b4c5dc" />
              </linearGradient>
              <linearGradient id="tailR" x1="1" y1="0" x2="0.2" y2="1">
                <stop offset="0%" stopColor="#f0f4fa" />
                <stop offset="50%" stopColor="#d5e1f0" />
                <stop offset="100%" stopColor="#b4c5dc" />
              </linearGradient>
              <linearGradient id="knot" x1="0.3" y1="0" x2="0.7" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="30%" stopColor="#dde6f2" />
                <stop offset="70%" stopColor="#c5d4e6" />
                <stop offset="100%" stopColor="#e6eef6" />
              </linearGradient>
            </defs>

            <g filter="url(#bowInnerShadow)">
              {/* Left Half (Slides Left) */}
              <g style={{ transform: phase === 'split' || phase === 'fadeout' ? 'translateX(-3000px)' : 'translateX(0)', opacity: phase === 'split' || phase === 'fadeout' ? 0 : 1, transition: 'all 1500ms cubic-bezier(0.7,0,0.3,1)' }}>
                {/* Left Tail */}
                <path d="M190 140 C140 180, 100 240, 70 290 C90 280, 110 270, 140 260 C150 220, 180 180, 200 150 Z" fill="url(#tailL)" stroke="#b5c4d8" strokeWidth="1" />
                <path d="M185 145 C145 180, 115 230, 95 270" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" filter="url(#softGlow)" />
                {/* Left Loop */}
                <path d="M200 140 C180 40, 20 20, 20 100 C20 180, 150 170, 200 140 Z" fill="url(#loopL)" stroke="#c2d0e2" strokeWidth="1" />
                <path d="M190 135 C160 70, 60 50, 50 100 C40 150, 140 150, 190 135 Z" fill="url(#creaseInnerL)" opacity="0.8" />
                <path d="M180 130 C150 60, 40 40, 35 100" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3" filter="url(#softGlow)" />
              </g>

              {/* Right Half (Slides Right) */}
              <g style={{ transform: phase === 'split' || phase === 'fadeout' ? 'translateX(3000px)' : 'translateX(0)', opacity: phase === 'split' || phase === 'fadeout' ? 0 : 1, transition: 'all 1500ms cubic-bezier(0.7,0,0.3,1)' }}>
                {/* Right Tail */}
                <path d="M210 140 C260 180, 300 240, 330 290 C310 280, 290 270, 260 260 C250 220, 220 180, 200 150 Z" fill="url(#tailR)" stroke="#b5c4d8" strokeWidth="1" />
                <path d="M215 145 C255 180, 285 230, 305 270" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" filter="url(#softGlow)" />
                {/* Right Loop */}
                <path d="M200 140 C220 40, 380 20, 380 100 C380 180, 250 170, 200 140 Z" fill="url(#loopR)" stroke="#c2d0e2" strokeWidth="1" />
                <path d="M210 135 C240 70, 340 50, 350 100 C360 150, 260 150, 210 135 Z" fill="url(#creaseInnerR)" opacity="0.8" />
                <path d="M220 130 C250 60, 360 40, 365 100" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3" filter="url(#softGlow)" />
              </g>

              {/* Center Knot (Fades instantly) */}
              <g style={{ transformOrigin: '200px 140px', transform: phase === 'split' || phase === 'fadeout' ? 'scale(0)' : 'scale(1)', opacity: phase === 'split' || phase === 'fadeout' ? 0 : 1, transition: 'all 600ms ease-in' }}>
                <path d="M185 125 C185 115, 190 110, 200 110 C210 110, 215 115, 215 125 L215 155 C215 165, 210 170, 200 170 C190 170, 185 165, 185 155 Z" fill="url(#knot)" stroke="#b5c4d8" strokeWidth="1" />
                <path d="M192 118 C195 130, 195 150, 192 162" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1.5" />
                <path d="M208 118 C205 130, 205 150, 208 162" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" filter="url(#softGlow)" />
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* ═══ Bottom Text ═══ */}
      <div className={`absolute bottom-8 md:bottom-12 w-full flex items-center justify-center z-50 transition-all duration-1000 delay-800 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${phase === 'split' || phase === 'fadeout' ? '!opacity-0 translate-y-4' : ''}`}>
        <div className="flex items-center gap-6">
          <div className="w-16 md:w-24 h-[1px] bg-gradient-to-r from-transparent to-[#1E3A8A]/40" />
          <div className="flex items-center gap-4 md:gap-6 text-[#1E3A8A] font-bold tracking-[0.3em] text-[11px] md:text-sm drop-shadow-md">
            <span className="cursor-default">EXPLORE</span>
            <span className="text-[#3B82F6]/50 font-normal">/</span>
            <span className="cursor-default">CONNECT</span>
            <span className="text-[#3B82F6]/50 font-normal">/</span>
            <span className="cursor-default">BUILD</span>
          </div>
          <div className="w-16 md:w-24 h-[1px] bg-gradient-to-l from-transparent to-[#1E3A8A]/40" />
        </div>
      </div>

      </div>
    </div>
  );
};
