"use client";

import { useEffect, useState } from "react";

// Steps through phases 0, 1, 2… while `active`, waiting `durations[i]` ms before moving on
// from phase i, and holds the last one. It never rewinds: to replay a scene, remount it
// (give it a key that changes when it becomes active). `durations` should be a module
// constant.
export function usePhases(active: boolean, durations: readonly number[]): number {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) return;

    let index = 0;
    let timer = 0;
    const next = () => {
      if (index >= durations.length) return;
      timer = window.setTimeout(() => {
        index += 1;
        setPhase(index);
        next();
      }, durations[index]);
    };
    next();
    return () => clearTimeout(timer);
  }, [active, durations]);

  return phase;
}
