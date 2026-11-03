"use client";

import { useCallback, type ReactElement } from "react";
import { halftone, lines } from "./seam-patterns";
import { useCanvas } from "./use-canvas";

// The theme's two section tones, as the canvas needs them.
const TONES = { ink: "#0b0d10", "ink-2": "#181b21" } as const;
type Tone = keyof typeof TONES;

const patterns = { halftone, lines };

interface SeamProps {
  /** The tone of the section above and the one below. */
  from: Tone;
  to: Tone;
  pattern: keyof typeof patterns;
  height?: number;
}

/**
 * Carries the page from one section's tone into the next through a pattern, so the change of tone is the divider. It
 * is drawn once per width on a canvas and never moves.
 */
export function Seam({ from, to, pattern, height = 160 }: SeamProps): ReactElement {
  const draw = useCallback(
    (c: CanvasRenderingContext2D, w: number, h: number): void => {
      c.fillStyle = TONES[from];
      c.fillRect(0, 0, w, h);
      c.fillStyle = TONES[to];
      patterns[pattern](c, w, h);
    },
    [from, to, pattern],
  );
  const ref = useCanvas(height, draw);
  return <canvas ref={ref} aria-hidden className="block w-full" style={{ height, background: TONES[from] }} />;
}
