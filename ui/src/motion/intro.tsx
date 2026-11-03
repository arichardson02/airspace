"use client";

import { useEffect, useState, type ReactElement } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { markPath, markViewBox } from "../brand/mark";
import { ease } from "./motion";

/** Seconds from launch until the curtain has lifted and the screen can start. */
export const INTRO_SECONDS = 1.5;

/** True once the curtain is lifting, so a screen can start its own motion; at once for reduced motion. */
export function useIntroDone(): boolean {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setDone(true);
      },
      (INTRO_SECONDS - 0.4) * 1000,
    );
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return reduceMotion === true || done;
}

// The mark draws itself in outline, fills, and the curtain fades to reveal the screen.
// Anyone who prefers reduced motion never sees it.
export function Intro(): ReactElement | null {
  const [done, setDone] = useState(false);
  const reduceMotion = useReducedMotion();

  if (reduceMotion === true || done) return null;

  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink text-paper"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.5, ease, delay: INTRO_SECONDS - 0.5 }}
      onAnimationComplete={() => {
        setDone(true);
      }}
    >
      <motion.svg
        viewBox={markViewBox}
        className="h-20 w-auto sm:h-24"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: INTRO_SECONDS, ease }}
      >
        <motion.path
          d={markPath}
          fill="currentColor"
          fillRule="evenodd"
          stroke="currentColor"
          strokeWidth={1.5}
          initial={{ pathLength: 0, fillOpacity: 0 }}
          animate={{ pathLength: 1, fillOpacity: 1 }}
          transition={{
            pathLength: { duration: 0.8, ease: "easeInOut" },
            fillOpacity: { duration: 0.4, delay: 0.6 },
          }}
        />
      </motion.svg>
    </motion.div>
  );
}
