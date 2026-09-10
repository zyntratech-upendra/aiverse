import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CAROUSEL_IMAGES = [
  { src: "/homepage/p.jpeg", alt: "AI Verse - President" },
  { src: "/homepage/vice.jpeg", alt: "AI Verse - Vice President" },
  { src: "/homepage/all.jpeg", alt: "AI Verse - Full Team" },
];

const AUTO_PLAY_INTERVAL = 4000; // 4 seconds

const HeroImageCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
  }, []);

  // Auto-play
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, AUTO_PLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  return (
    <div
      className="relative w-full max-w-[440px] mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Main Image Card */}
      <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100 shadow-xl border border-white/60">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={CAROUSEL_IMAGES[currentIndex].src}
            alt={CAROUSEL_IMAGES[currentIndex].alt}
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </AnimatePresence>

        {/* Subtle gradient overlay at bottom for dots visibility */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {/* Dot indicators */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {CAROUSEL_IMAGES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-6 h-2 bg-white shadow-md"
                  : "w-2 h-2 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 mx-auto w-3/4 h-1 bg-slate-200/60 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full"
          key={currentIndex}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{
            duration: AUTO_PLAY_INTERVAL / 1000,
            ease: "linear",
          }}
        />
      </div>
    </div>
  );
};

export default HeroImageCarousel;
