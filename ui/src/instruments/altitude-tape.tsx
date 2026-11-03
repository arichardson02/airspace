"use client";

import { useMemo, type ReactElement, type ReactNode } from "react";
import { motion, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { useReading } from "./reading";

const W = 440;
const H = 400;
const MID = H / 2;
// Pixels per foot, and the tick spacing: minor ticks every 20 ft, numbered ones every 100.
const PX = 0.27;
const STEP = 20;
// Rows are laid out once around a coarse anchor and the whole layer slides, so a new reading never re-places a row.
const ANCHOR = 500;
const SPAN = 1200;
// The readout: one box centred on the pointer, every digit the same size, the last two rolling inside it.
const BOX = { left: 222, right: 350, top: MID - 24, bottom: MID + 24 };
const BOX_W = BOX.right - BOX.left;
const BOX_H = BOX.bottom - BOX.top;
const CENTRE = (BOX.left + BOX.right) / 2;
const DIGITS = 30;
// Inter's tabular figures are 0.6em wide, which is what centres the number without measuring it.
const DIGIT_WIDTH = DIGITS * 0.6;
const DRUM_ROW = 34;
// The drum's faces, one per 20 ft, with spares above and below so it can roll past 00 seamlessly.
const faces = Array.from({ length: 8 }, (_, i) => i - 1);
// The scale's numbers fade out around the readout, so none peek out beside it.
const GAP = `linear-gradient(to bottom, #000 ${((MID - 50) / H) * 100}%, transparent ${((MID - 32) / H) * 100}%,
  transparent ${((MID + 32) / H) * 100}%, #000 ${((MID + 50) / H) * 100}%)`;
const percent = (units: number, of: number) => `${(units / of) * 100}%`;

// A layer the browser moves on the GPU. A climb scrolls the tape a few pixels a second; redrawn as SVG each frame the
// ticks and numbers would snap to whole pixels and step, while a composited layer slides at sub-pixel positions.
function Slide({ y, box, children }: { y: MotionValue<string>; box: string; children: ReactNode }) {
  return (
    <motion.div className="absolute inset-0" style={{ y, willChange: "transform" }}>
      <svg viewBox={box} className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {children}
      </svg>
    </motion.div>
  );
}

// The vertical altitude tape of a PFD: the scale scrolls under a fixed readout whose last two digits roll on a drum.
export function AltitudeTape({ feet, climbing }: { feet: number; climbing?: boolean }): ReactElement {
  const still = useReducedMotion();
  // Moves at the climb's own rate between readings, so the scale scrolls evenly however often the sim reports.
  const offset = useReading(feet, still);
  const tape = useTransform(offset, (f) => percent(MID + f * PX, H));
  // The hundreds and up only change when the drum rolls past 00, like the counters on a real altimeter.
  const hundreds = useTransform(offset, (f) => {
    const h = Math.floor(Math.max(0, f) / 100);
    return h > 0 ? String(h) : "";
  });
  const drum = useTransform(offset, (f) => percent(((Math.max(0, f) % 100) / STEP) * DRUM_ROW, BOX_H));

  // Where the hundreds end and the drum begins, so the whole number sits centred in the box.
  const high = feet >= 100 ? String(Math.floor(feet / 100)).length : 0;
  const split = CENTRE + ((high - 2) * DIGIT_WIDTH) / 2;

  // Built again only when the anchor moves, every 500 ft, not on every reading.
  const anchor = Math.round(feet / ANCHOR) * ANCHOR;
  const { ticks, labels } = useMemo(() => {
    const tickMarks = [];
    const numbers = [];
    for (let v = Math.max(0, anchor - SPAN); v <= anchor + SPAN; v += STEP) {
      const major = v % 100 === 0;
      tickMarks.push(
        <rect
          key={v}
          x={major ? 330 : 342}
          y={-v * PX - 0.7}
          width={major ? 26 : 12}
          height={1.4}
          fillOpacity={major ? 0.55 : 0.18}
        />,
      );
      if (major) {
        numbers.push(
          <text key={v} x={314} y={-v * PX} textAnchor="end" dominantBaseline="central">
            {v}
          </text>,
        );
      }
    }
    return { ticks: tickMarks, labels: numbers };
  }, [anchor]);

  const trend = climbing === true ? -1 : 1;
  const readout = `${BOX.left} ${BOX.top} ${BOX_W} ${BOX_H}`;
  return (
    <div className="relative size-full text-paper" style={{ aspectRatio: `${W} / ${H}` }}>
      <Slide y={tape} box={`0 0 ${W} ${H}`}>
        <g fill="currentColor">{ticks}</g>
      </Slide>
      <div className="absolute inset-0" style={{ WebkitMaskImage: GAP, maskImage: GAP }}>
        <Slide y={tape} box={`0 0 ${W} ${H}`}>
          <g fill="currentColor" fillOpacity={0.5} fontSize={18} fontWeight={500}>
            {labels}
          </g>
        </Slide>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="absolute inset-0 size-full">
        <rect x={358} width={1} height={H} fill="currentColor" fillOpacity={0.16} />
        <rect
          x={BOX.left}
          y={BOX.top}
          width={BOX_W}
          height={BOX_H}
          rx={4}
          style={{ fill: "var(--color-ink)" }}
          stroke="currentColor"
          strokeOpacity={0.6}
        />
        <path d={`M 360 ${MID} L 378 ${MID - 11} V ${MID + 11} Z`} fill="currentColor" />
        {climbing !== undefined && (
          <path
            d={`M 363 ${MID + trend * 20} L 369 ${MID + trend * 28} L 375 ${MID + trend * 20}`}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.5}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {/* The readout's digits, clipped to the box: the hundreds stand still, the last two roll on their own layer. */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: percent(BOX.left, W),
          top: percent(BOX.top, H),
          width: percent(BOX_W, W),
          height: percent(BOX_H, H),
          // Inside a 3D-tilted parent a GPU layer can slip past overflow: hidden; a clip path holds it.
          clipPath: "inset(0)",
        }}
      >
        <svg viewBox={readout} aria-hidden className="absolute inset-0 size-full overflow-visible">
          <motion.text
            x={split}
            y={MID}
            textAnchor="end"
            dominantBaseline="central"
            fontSize={DIGITS}
            fontWeight={600}
            fill="currentColor"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {hundreds}
          </motion.text>
        </svg>
        <Slide y={drum} box={readout}>
          <g fontSize={DIGITS} fontWeight={600} fill="currentColor" style={{ fontVariantNumeric: "tabular-nums" }}>
            {faces.map((k) => (
              <text key={k} x={split} y={MID - k * DRUM_ROW} dominantBaseline="central">
                {String((((k * STEP) % 100) + 100) % 100).padStart(2, "0")}
              </text>
            ))}
          </g>
        </Slide>
      </div>
    </div>
  );
}
