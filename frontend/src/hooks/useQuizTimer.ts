import { useState, useEffect, useRef, useCallback } from "react";

interface UseQuizTimerProps {
  endTime: number; // authoritative epoch ms
  onTimeExpired: () => void;
}

export interface QuizTimerState {
  remainingSeconds: number;
  formattedTime: string;
  isExpired: boolean;
  isUrgent: boolean; // < 5 minutes
}

export function useQuizTimer({ endTime, onTimeExpired }: UseQuizTimerProps): QuizTimerState {
  const computeRemaining = useCallback(() => {
    if (!endTime || endTime <= 0) return 0;
    const diffMs = endTime - Date.now();
    return Math.max(0, Math.floor(diffMs / 1000));
  }, [endTime]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(computeRemaining);
  const expiredTriggeredRef = useRef(false);
  const onTimeExpiredRef = useRef(onTimeExpired);
  onTimeExpiredRef.current = onTimeExpired;

  useEffect(() => {
    // If endTime is not set or non-positive, do not activate timer
    if (!endTime || endTime <= 0) {
      setRemainingSeconds(0);
      return;
    }

    expiredTriggeredRef.current = false;
    
    const checkTimer = () => {
      const remaining = computeRemaining();
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !expiredTriggeredRef.current && endTime > 0) {
        expiredTriggeredRef.current = true;
        onTimeExpiredRef.current();
      }
    };

    // Initial check
    checkTimer();

    // 1-second ticking interval
    const intervalId = setInterval(checkTimer, 1000);

    // Sync on tab visibility change or window focus to prevent drift from browser throttling
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkTimer();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkTimer);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkTimer);
    };
  }, [endTime, computeRemaining]);

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  return {
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
    isExpired: remainingSeconds <= 0,
    isUrgent: remainingSeconds > 0 && remainingSeconds <= 300 // 5 minutes
  };
}
