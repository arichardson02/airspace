"use client";

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { dot } from "./dots";
import { Pitched } from "./pitched";
import { useSvgId } from "./svg";

const SIZE = 360;
const STEP = 8;
// A seat is 9 dots by 11 rows; the top 3 rows are the head.
const COLUMNS = 9;
const ROWS = 11;
const HEAD = 3;
const SEAT_TOP = 124;
// The handover: the old seat drains top to bottom while the new one lights bottom to top, about 600ms in all.
const ROW_STAGGER = 0.035;
const ROW_FADE = 0.16;
const LIGHT_AFTER = 0.08;
const roll = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

// The nose is a parabola over the cabin; cells inside it get dots.
const inside = (x: number, y: number) => {
  const w = Math.abs(x - 180);
  return y > 20 + (w / 168) ** 2 * 120 && w < 168 && y < SIZE + 2;
};

// Only the outline is drawn dot by dot: its side dots run off the bottom of the card.
const outline: { x: number; y: number }[] = [];
for (let y = 4; y < SIZE; y += STEP) {
  for (let x = 4; x < SIZE; x += STEP) {
    if (inside(x, y) && (!inside(x - STEP, y) || !inside(x + STEP, y) || !inside(x, y - STEP))) outline.push({ x, y });
  }
}

const seats = [
  { x: 122, role: "LEFT SEAT" },
  { x: 238, role: "RIGHT SEAT" },
] as const;

interface Seat {
  name: string;
  flying: boolean;
}

// A seat's dot matrix: the dim dots are one pattern-filled rect, and the lit dots are one rect per row on top, so
// the handover animates 11 opacities instead of a hundred dots.
function SeatBlock({ id, seat: { name, flying }, x, role }: { id: string; seat: Seat; x: number; role: string }) {
  return (
    <g>
      <g transform={`translate(${x - (COLUMNS * STEP) / 2} ${SEAT_TOP})`}>
        <rect width={COLUMNS * STEP} height={HEAD * STEP} fill={`url(#${id}-head-dim)`} />
        <rect y={HEAD * STEP} width={COLUMNS * STEP} height={(ROWS - HEAD) * STEP} fill={`url(#${id}-body-dim)`} />
        {Array.from({ length: ROWS }, (_, row) => (
          <motion.rect
            key={row}
            y={row * STEP}
            width={COLUMNS * STEP}
            height={STEP}
            fill={`url(#${id}-${row < HEAD ? "head" : "body"}-lit)`}
            initial={false}
            animate={{ opacity: flying ? 1 : 0 }}
            transition={{
              duration: ROW_FADE,
              delay: flying ? LIGHT_AFTER + (ROWS - 1 - row) * ROW_STAGGER : row * ROW_STAGGER,
            }}
          />
        ))}
      </g>
      <motion.text
        x={x}
        y={226}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={11}
        fontWeight={600}
        fill="currentColor"
        initial={false}
        animate={{ fillOpacity: flying ? 1 : 0.4 }}
        transition={{ duration: 0.4 }}
      >
        {name.toUpperCase()}
      </motion.text>
      <g fontSize={9} fontWeight={500} fill="currentColor" textAnchor="middle">
        {[
          { label: "FLYING", on: flying },
          { label: role, on: !flying },
        ].map(({ label, on }) => (
          <motion.text
            key={label}
            x={x}
            y={242}
            dominantBaseline="hanging"
            initial={false}
            // The new label rolls up from below as the old one rolls out above.
            animate={{ opacity: on ? 1 : 0, y: on ? [6, 0] : [0, -6] }}
            transition={{ ...roll, delay: on ? 0.18 : 0 }}
            fillOpacity={flying ? 0.55 : 0.25}
          >
            {label}
          </motion.text>
        ))}
      </g>
    </g>
  );
}

// The two seats seen from above inside a dotted nose outline; the lit seat has the aircraft.
export function Cockpit({ seats: [left, right] }: { seats: [Seat, Seat] }): ReactElement {
  const id = useSvgId();
  const tile = (name: string, r: number, opacity: number) => (
    <pattern id={`${id}-${name}`} width={STEP} height={STEP} patternUnits="userSpaceOnUse">
      <circle cx={STEP / 2} cy={STEP / 2} r={r} fill="currentColor" fillOpacity={opacity} />
    </pattern>
  );
  return (
    <Pitched pose="deck">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="size-full text-paper">
        <defs>
          <clipPath id={`${id}-nose`}>
            <path d={`M 12 ${SIZE + 2} V 140 Q 180 -100 348 140 V ${SIZE + 2} Z`} />
          </clipPath>
          <pattern id={`${id}-dots`} x={0} y={0} width={STEP} height={STEP} patternUnits="userSpaceOnUse">
            <circle cx={4} cy={4} r={1} fill="currentColor" fillOpacity={0.06} />
          </pattern>
          {tile("head-lit", 2.4, 0.55)}
          {tile("body-lit", 3.2, 1)}
          {tile("head-dim", 2.4, 0.14)}
          {tile("body-dim", 3.2, 0.28)}
        </defs>
        <rect width={SIZE} height={SIZE} fill={`url(#${id}-dots)`} clipPath={`url(#${id}-nose)`} />
        {outline.map(({ x, y }) => dot(x, y, 1.8, 0.5))}
        <SeatBlock id={id} seat={left} {...seats[0]} />
        <SeatBlock id={id} seat={right} {...seats[1]} />
      </svg>
    </Pitched>
  );
}
