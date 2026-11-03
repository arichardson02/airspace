"use client";

import type { ReactElement } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ease } from "../motion/motion";

interface Flight {
  /** e.g. "KLAX→KSEA". */
  route: string;
  /** Hours since midnight, 0..24. */
  start: number;
  end: number;
}

const W = 340;
// The route names take the left, the 24 h span the rest.
const SCALE_LEFT = 112;
const SCALE_WIDTH = 228;
const ROW = 30;
const BAR = 10;
const fade = { duration: 0.4 };
// On mount the bars grow from their start one after another.
const GROW = { duration: 0.6, ease };
const GROW_STAGGER = 0.12;

const X = (hours: number) => SCALE_LEFT + (Math.min(24, Math.max(0, hours)) * SCALE_WIDTH) / 24;

// The day as a Gantt chart: one row per flight with its route on the left and its span across the day. Flown bars are
// paper at half strength, the one in the air is solid, later ones are outlined. There is no axis or clock line: the
// rows' states say where the day is. It places itself in the right half of the card, clear of the card's text, so
// give it as `background` over the card's own art.
export function DayChart({ flights, now }: { flights: Flight[]; now: number }): ReactElement {
  const still = useReducedMotion();
  const height = flights.length * ROW;
  return (
    <div className="pointer-events-none absolute inset-y-0 right-6 flex w-[50%] items-center">
      <svg viewBox={`0 0 ${W} ${height}`} aria-hidden className="w-full overflow-visible text-paper">
        {flights.map(({ route, start, end }, i) => {
          const state = end < now ? "done" : start <= now ? "now" : "next";
          const y = ROW / 2 + i * ROW;
          const width = Math.max(BAR, X(end) - X(start));
          return (
            <g key={`${route}-${start}`}>
              {/* A thin rule between rows, across the chart. */}
              {i > 0 && <rect y={y - ROW / 2} width={W} height={1} fill="currentColor" fillOpacity={0.06} />}
              <g fontSize={11} fill="currentColor">
                {/* The name cross-fades between a plain and a semibold layer as the flight changes state. */}
                <motion.text
                  y={y}
                  dominantBaseline="central"
                  fontWeight={500}
                  initial={false}
                  animate={{ fillOpacity: state === "now" ? 0 : state === "done" ? 0.75 : 0.4 }}
                  transition={fade}
                >
                  {route}
                </motion.text>
                <motion.text
                  y={y}
                  dominantBaseline="central"
                  fontWeight={600}
                  initial={false}
                  animate={{ fillOpacity: state === "now" ? 1 : 0 }}
                  transition={fade}
                >
                  {route}
                </motion.text>
              </g>
              <motion.rect
                x={X(start)}
                y={y - BAR / 2}
                height={BAR}
                rx={BAR / 2}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={1.2}
                // A one-off grow on mount; after that only the fill and outline fade between states.
                initial={still === true ? false : { width: BAR, fillOpacity: 0, strokeOpacity: 0 }}
                animate={{
                  width,
                  fillOpacity: state === "now" ? 1 : state === "done" ? 0.55 : 0,
                  strokeOpacity: state === "next" ? 0.35 : 0,
                }}
                transition={{
                  width: { ...GROW, delay: i * GROW_STAGGER },
                  default: { ...fade, delay: i * GROW_STAGGER },
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
