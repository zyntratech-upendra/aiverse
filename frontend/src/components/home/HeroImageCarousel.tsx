import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchSettings } from "../../services/apiClient";
import { dataCache } from "../../utils/dataCache";

const DEFAULT_CAROUSEL_IMAGES = [
  { src: "/homepage/p.png", alt: "AI Verse - President" },
  { src: "/homepage/vice.png", alt: "AI Verse - Vice President" },
  { src: "/homepage/all.jpeg", alt: "AI Verse - Full Team" },
];

const AUTO_PLAY_INTERVAL = 4000; // 4 seconds

interface HeroImageCarouselProps {
  images?: (string | { src: string; alt?: string })[];
}

const HeroImageCarousel: React.FC<HeroImageCarouselProps> = ({ images: propImages }) => {
  const [fetchedImages, setFetchedImages] = useState<string[]>(() => {
    const cached = dataCache.get<any>("portal_config");
    return cached?.heroImages && Array.isArray(cached.heroImages) && cached.heroImages.length > 0
      ? cached.heroImages
      : [];
  });

  useEffect(() => {
    if (propImages && propImages.length > 0) return;

    let isMounted = true;
    const loadSettings = async () => {
      try {
        const config = await fetchSettings("portal_config");
        if (isMounted && config?.heroImages && Array.isArray(config.heroImages) && config.heroImages.length > 0) {
          setFetchedImages(config.heroImages);
        }
      } catch (err) {
        console.error("Error fetching hero images:", err);
      }
    };
    loadSettings();

    // Listen for custom settings update events
    const handleSettingsUpdate = () => {
      const cached = dataCache.get<any>("portal_config");
      if (cached?.heroImages && Array.isArray(cached.heroImages)) {
        setFetchedImages(cached.heroImages);
      }
    };
    window.addEventListener("portalSettingsUpdated", handleSettingsUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("portalSettingsUpdated", handleSettingsUpdate);
    };
  }, [propImages]);

  // Compute normalized active image list
  const activeImages = useMemo(() => {
    const rawList = (propImages && propImages.length > 0) ? propImages : fetchedImages;
    if (!rawList || rawList.length === 0) return DEFAULT_CAROUSEL_IMAGES;

    return rawList.map((item, index) => {
      if (typeof item === "string") {
        return {
          src: item,
          alt: `AI Verse Visual ${index + 1}`
        };
      }
      return {
        src: item.src || "/homepage/all.jpeg",
        alt: item.alt || `AI Verse Visual ${index + 1}`
      };
    });
  }, [propImages, fetchedImages]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Keep index within bounds if activeImages length changes
  useEffect(() => {
    if (currentIndex >= activeImages.length) {
      setCurrentIndex(0);
    }
  }, [activeImages.length, currentIndex]);

  const nextSlide = useCallback(() => {
    if (activeImages.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % activeImages.length);
  }, [activeImages.length]);

  // Continuous Auto-play
  useEffect(() => {
    if (activeImages.length <= 1) return;
    const timer = setInterval(nextSlide, AUTO_PLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [nextSlide, activeImages.length]);

  const currentImage = activeImages[currentIndex] || DEFAULT_CAROUSEL_IMAGES[0];

  return (
    <div className="relative w-full max-w-[440px] mx-auto group">
      {/* Main Image Card */}
      <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100 shadow-xl border border-white/60">
        <AnimatePresence mode="wait">
          <motion.img
            key={`${currentImage.src}-${currentIndex}`}
            src={currentImage.src}
            alt={currentImage.alt}
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            onError={(e) => {
              // Graceful fallback to default image if uploaded URL is broken
              const target = e.currentTarget as HTMLImageElement;
              if (target.src !== DEFAULT_CAROUSEL_IMAGES[0].src) {
                target.src = DEFAULT_CAROUSEL_IMAGES[0].src;
              }
            }}
          />
        </AnimatePresence>

        {/* Subtle gradient overlay at bottom for dots visibility */}
        {activeImages.length > 1 && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        )}

        {/* Dot indicators */}
        {activeImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {activeImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? "w-6 h-2 bg-white shadow-md"
                    : "w-2 h-2 bg-white/50 hover:bg-white/90"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {activeImages.length > 1 && (
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
      )}
    </div>
  );
};

export default HeroImageCarousel;
