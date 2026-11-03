"use client";

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import dots from "@/lib/world-dots.json";

const WIDTH = 1000;
const HEIGHT = 500;

// Two decimals, so the server and the browser print the same path string.
const round = (n: number) => Math.round(n * 100) / 100;

// Equirectangular, matching scripts/world-dots.mts.
const project = ([lat, lon]: [number, number]) => ({
  x: round(((lon + 180) / 360) * WIDTH),
  y: round(((90 - lat) / 180) * HEIGHT),
});

const airports = {
  KSEA: [47.45, -122.31],
  KJFK: [40.64, -73.78],
  KLAX: [33.94, -118.41],
  SBGR: [-23.43, -46.47],
  EGLL: [51.47, -0.46],
  LFPG: [49.01, 2.55],
  EDDF: [50.03, 8.57],
  OMDB: [25.25, 55.36],
  FAOR: [-26.14, 28.25],
  VHHH: [22.31, 113.91],
  RJTT: [35.55, 139.78],
  YSSY: [-33.95, 151.18],
} satisfies Record<string, [number, number]>;

const routes: [keyof typeof airports, keyof typeof airports][] = [
  ["KSEA", "EGLL"],
  ["KJFK", "LFPG"],
  ["KLAX", "RJTT"],
  ["SBGR", "EDDF"],
  ["OMDB", "YSSY"],
  ["FAOR", "VHHH"],
];

// A curve bowed towards the nearer pole, which is roughly what a great circle looks like
// on this projection.
function arc(from: keyof typeof airports, to: keyof typeof airports): string {
  const a = project(airports[from]);
  const b = project(airports[to]);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const north = mid.y < HEIGHT / 2 ? -1 : 1;
  return `M ${a.x} ${a.y} Q ${round(mid.x)} ${round(mid.y + north * distance * 0.25)} ${b.x} ${b.y}`;
}

// The dot world map behind the hero, with flights drawing themselves between airports.
export function FlightMap({ className }: { className?: string }): ReactElement {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid slice" aria-hidden className={className}>
      <g fill="currentColor" opacity={0.28}>
        {dots.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />
        ))}
      </g>

      {routes.map(([from, to], index) => {
        const a = project(airports[from]);
        const b = project(airports[to]);
        const delay = index * 1.4;
        return (
          <g key={`${from}-${to}`} stroke="currentColor" fill="none">
            <motion.path
              d={arc(from, to)}
              strokeWidth={1.4}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: [0, 1, 1], opacity: [0.9, 0.9, 0] }}
              transition={{ duration: 7, times: [0, 0.55, 1], delay, repeat: Infinity, ease: "easeInOut" }}
            />
            {[
              { airport: from, point: a, start: delay },
              { airport: to, point: b, start: delay + 3.5 },
            ].map(({ airport, point, start }) => (
              <motion.circle
                key={airport}
                cx={point.x}
                cy={point.y}
                r={2.5}
                fill="currentColor"
                stroke="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 7, times: [0, 0.1, 0.55, 1], delay: start, repeat: Infinity }}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
