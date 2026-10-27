"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { markPath, markViewBox } from "@/components/mark";

const ease = [0.22, 1, 0.36, 1] as const;

/** Seconds from page load until the curtain has lifted and the hero can start. */
export const INTRO_SECONDS = 1.5;

// The mark draws itself in outline, fills, and the curtain fades to reveal the hero.
// Visitors who prefer reduced motion never see it.
export function Intro() {
  const [done, setDone] = useState(false);
  const reduceMotion = useReducedMotion();

  if (reduceMotion || done) return null;

  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink text-paper"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.5, ease, delay: INTRO_SECONDS - 0.5 }}
      onAnimationComplete={() => setDone(true)}
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
