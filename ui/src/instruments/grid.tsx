"use client";

import type { ReactElement } from "react";
import { useSvgId } from "./svg";

/**
 * A faint dot grid over the whole card, like plotting paper: strongest in the top-right corner and fading toward the
 * text. Static, for cards whose content is a list rather than an instrument.
 */
export function Grid(): ReactElement {
  const id = useSvgId();
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-paper">
      <defs>
        <pattern id={`${id}-dots`} width={14} height={14} patternUnits="userSpaceOnUse">
          <circle cx={7} cy={7} r={0.9} fill="currentColor" fillOpacity={0.22} />
        </pattern>
        <radialGradient id={`${id}-ramp`} cx="100%" cy="0%" r="110%">
          <stop offset={0} stopColor="white" />
          <stop offset={1} stopColor="white" stopOpacity={0} />
        </radialGradient>
        <mask id={`${id}-fade`}>
          <rect width="100%" height="100%" fill={`url(#${id}-ramp)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-dots)`} mask={`url(#${id}-fade)`} />
    </svg>
  );
}
