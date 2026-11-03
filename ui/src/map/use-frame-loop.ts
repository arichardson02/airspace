import { useEffect, useRef, type RefObject } from "react";

/** Calls `onFrame(seconds since the last frame, timestamp)` every animation frame while `target` is on screen, the tab is visible and `active` is set. */
export function useFrameLoop(
  target: RefObject<Element | null>,
  onFrame: (dt: number, now: number) => void,
  active: boolean,
): void {
  const callback = useRef(onFrame);
  useEffect(() => {
    callback.current = onFrame;
  });

  useEffect(() => {
    const element = target.current;
    if (!active || !element) return undefined;
    let frame = 0;
    let last = 0;
    let onscreen = true;

    const tick = (now: number) => {
      callback.current(last ? Math.min((now - last) / 1000, 0.1) : 0, now);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      const run = onscreen && !document.hidden;
      if (run && !frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      } else if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [target, active]);
}
