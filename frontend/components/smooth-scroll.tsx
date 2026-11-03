"use client";

import { useSyncExternalStore, type ReactElement } from "react";
import { ReactLenis } from "lenis/react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
}

// Lenis smooth scrolling for the whole document. It lives in the root layout, so one
// instance persists across page navigations. Visitors who prefer reduced motion get
// native scrolling.
export function SmoothScroll(): ReactElement | null {
  const reduceMotion = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true, // server: render nothing until the client decides
  );

  if (reduceMotion) return null;

  // lerp 0.12 keeps the glide but tracks the wheel closely; lower values feel floaty.
  return <ReactLenis root options={{ lerp: 0.12, anchors: true, autoRaf: true }} />;
}
