"use client";

import { useRef, type ReactElement } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { dot } from "./dots";
import { round, useShown, useSvgId } from "./svg";

const W = 640;
const H = 280;
// The scope is about as big as the card is tall and sits on its right edge, so half of it bleeds off.
const CX = 584;
const CY = 140;
// The outer ring's radius. Blips beyond it are clipped.
const R = 270;
// Where the sweep line points at rest, in degrees clockwise from east.
const REST = 297.6;
const FAN_DEGREES = 90;
const FAN_STEPS = 30;
const SWEEP_SECONDS = 6;

interface Blip {
  /** Offset from the scope's centre, in pixels. */
  dx: number;
  dy: number;
  /** 0..1, how bright the blip is. */
  strength: number;
  /** A short label beside the blip, e.g. a club pilot's name. */
  name?: string;
}

// The fan trailing the sweep line, drawn around the origin as thin wedges that brighten towards the line. SVG has
// no conic gradient.
const fan = Array.from({ length: FAN_STEPS }, (_, i) => {
  const a = ((-FAN_DEGREES + (i * FAN_DEGREES) / FAN_STEPS) * Math.PI) / 180;
  const b = ((-FAN_DEGREES + ((i + 1) * FAN_DEGREES) / FAN_STEPS) * Math.PI) / 180;
  const point = (t: number) => `${round(Math.cos(t) * R)} ${round(Math.sin(t) * R)}`;
  return {
    d: `M 0 0 L ${point(a)} A ${R} ${R} 0 0 1 ${point(b)} Z`,
    opacity: round((0.14 * (i + 0.5)) / FAN_STEPS),
  };
});

// A radar scope bleeding off the card's right edge: rings, crosshair, a rotating sweep and blips that spring to their new
// positions.
export function Scope({ pilots, sweep = true }: { pilots: Blip[]; sweep?: boolean }): ReactElement {
  const id = useSvgId();
  const ref = useRef<SVGSVGElement>(null);
  const shown = useShown(ref);
  const still = useReducedMotion() === true || !sweep;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden
      className="pointer-events-none size-full text-paper"
    >
      <defs>
        <style>{"@keyframes instrument-sweep { to { transform: rotate(360deg) } }"}</style>
        <clipPath id={`${id}-clip`}>
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        {/* A very faint fill inside the ring is the only thing that sets the scope off from the card. */}
        <circle cx={CX} cy={CY} r={R} fill="currentColor" fillOpacity={0.02} />
        {/* The sweep is drawn around the origin and placed on the centre, so its CSS rotation pivots on the
            centre dot in every browser without relying on transform-box. */}
        <g transform={`translate(${CX} ${CY}) rotate(${REST})`}>
          <g
            style={{
              transformOrigin: "0 0",
              animationName: still ? "none" : "instrument-sweep",
              animationDuration: `${SWEEP_SECONDS}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              animationPlayState: shown ? "running" : "paused",
            }}
          >
            {fan.map(({ d, opacity }) => (
              <path key={d} d={d} fill="currentColor" fillOpacity={opacity} />
            ))}
            <line x2={R} stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.2} />
          </g>
        </g>
        <AnimatePresence initial={false}>
          {pilots.map(({ dx, dy, strength, name }, i) => (
            <motion.g
              key={i}
              initial={{ x: CX + dx, y: CY + dy, opacity: 0 }}
              animate={{ x: CX + dx, y: CY + dy, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 70, damping: 16 }}
            >
              <motion.circle r={3} fill="currentColor" initial={false} animate={{ fillOpacity: strength }} />
              <motion.circle
                r={7}
                fill="none"
                stroke="currentColor"
                initial={false}
                animate={{ strokeOpacity: strength * 0.4 }}
              />
              {name !== undefined && name !== "" && (
                <text
                  x={11}
                  y={1}
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={600}
                  fill="currentColor"
                  fillOpacity={0.6}
                >
                  {name}
                </text>
              )}
            </motion.g>
          ))}
        </AnimatePresence>
      </g>

      {[R / 4, R / 2, (R * 3) / 4].map((r) => (
        <circle key={r} cx={CX} cy={CY} r={round(r)} fill="none" stroke="currentColor" strokeOpacity={0.08} />
      ))}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.5} />
      <path
        d={`M ${CX - R} ${CY} H ${CX + R} M ${CX} ${CY - R} V ${CY + R}`}
        stroke="currentColor"
        strokeOpacity={0.06}
      />
      {dot(CX, CY, 4)}
    </svg>
  );
}
