import { useEffect, useRef, type RefObject } from "react";

/**
 * A canvas the width of its box, `height` tall, redrawn at the device's pixel density whenever its size changes.
 * `draw` must be stable, or every render repaints.
 */
export function useCanvas(
  height: number,
  draw: (c: CanvasRenderingContext2D, w: number, h: number) => void,
): RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null) return undefined;
    const paint = (): void => {
      const c = canvas.getContext("2d");
      if (c === null) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      c.scale(dpr, dpr);
      draw(c, w, height);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [height, draw]);
  return ref;
}
