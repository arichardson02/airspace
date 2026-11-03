import { useEffect, useId, useState, type RefObject } from "react";
import type { MotionValue } from "framer-motion";

// Two decimals, so the server and the browser print the same attribute strings.
export const round = (n: number): number => Math.round(n * 100) / 100;

/** A per-instance prefix for gradient, mask and clip ids. React's ids carry colons, which break `url(#…)`. */
export const useSvgId = (): string => useId().replace(/:/g, "");

/** A repeatable 0..1 sequence, so the server and the browser draw the same field. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// useSpring ignores MotionConfig, so instruments jump instead when the viewer prefers reduced motion.
export const follow = (value: MotionValue<number>, to: number, still: boolean | null): void => {
  if (still === true) {
    value.jump(to);
  } else {
    value.set(to);
  }
};

export const clamp = (n: number, min = 0, max = 1): number => Math.min(max, Math.max(min, n));

/** Whether the element is on screen in a visible tab, so a looping instrument can stop when nobody sees it. */
export function useShown(target: RefObject<Element | null>): boolean {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const element = target.current;
    if (!element) return undefined;
    let onscreen = true;
    const sync = () => {
      setShown(onscreen && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [target]);
  return shown;
}
