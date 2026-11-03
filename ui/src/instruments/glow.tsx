"use client";

import type { ReactElement } from "react";
import { useSvgId } from "./svg";

interface GlowProps {
  /** Where the light sits, in percent of the box. */
  cx?: number;
  cy?: number;
}

// A soft paper light, so a card's empty side is lit instead of flat. A smooth radial gradient, no texture.
export function Glow({ cx = 84, cy = 50 }: GlowProps): ReactElement {
  const id = useSvgId();
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-paper">
      <defs>
        <radialGradient id={`${id}-light`} gradientUnits="userSpaceOnUse" cx={`${cx}%`} cy={`${cy}%`} r="70%">
          <stop offset={0} stopColor="currentColor" stopOpacity={0.14} />
          <stop offset={0.5} stopColor="currentColor" stopOpacity={0.04} />
          <stop offset={1} stopColor="currentColor" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-light)`} />
    </svg>
  );
}
