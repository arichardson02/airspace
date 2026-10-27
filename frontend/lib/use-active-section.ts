"use client";

import { useEffect, useState } from "react";

interface ActiveSection {
  /** The section directly under the navbar: the last one whose top passed `line` px. */
  under: string;
  /** The section covering the most of the viewport. There is always one. */
  dominant: string;
}

// Positions are read on every scroll rather than through IntersectionObserver
// thresholds, so both answers are the same at any scroll speed. `under` changes at the
// pixel a section crosses the bar, which is what its colors should follow. `dominant`
// is for the highlighted link: between two sections it is whichever one is showing more.
export function useActiveSection(ids: string[], line: number): ActiveSection {
  const [state, setState] = useState<ActiveSection>({ under: ids[0], dominant: ids[0] });

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const height = window.innerHeight;
      let under = ids[0];
      let dominant = ids[0];
      let most = -1;

      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= line) under = id;
        const visible = Math.min(rect.bottom, height) - Math.max(rect.top, 0);
        if (visible > most) {
          most = visible;
          dominant = id;
        }
      }

      setState((previous) =>
        previous.under === under && previous.dominant === dominant ? previous : { under, dominant },
      );
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids, line]);

  return state;
}
