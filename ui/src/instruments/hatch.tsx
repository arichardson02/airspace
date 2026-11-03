"use client";

import type { ReactElement } from "react";
import { useSvgId } from "./svg";

/**
 * Fine diagonal hatching over the whole card, like apron markings: strongest on the right under the instrument and
 * fading toward the text, never quite gone. Static and faint, so it never competes with the text or the instrument.
 */
export function Hatch(): ReactElement {
  const id = useSvgId();
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-paper">
      <defs>
        <pattern id={`${id}-lines`} width={6.4} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={1} height={10} fill="currentColor" fillOpacity={0.1} />
        </pattern>
        <linearGradient id={`${id}-ramp`}>
          <stop offset={0} stopColor="white" stopOpacity={0.25} />
          <stop offset={1} stopColor="white" />
        </linearGradient>
        <mask id={`${id}-fade`}>
          <rect width="100%" height="100%" fill={`url(#${id}-ramp)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-lines)`} mask={`url(#${id}-fade)`} />
    </svg>
  );
}
