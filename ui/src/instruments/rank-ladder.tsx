"use client";

import { useEffect, type ReactElement } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { ease } from "../motion/motion";
import { clamp, useSvgId } from "./svg";

const W = 370;
const H = 120;
const FIRST = 30;
const LAST = 326;
const LINE = 52;
// Dots along a link, and the space they leave around each rank.
const SPACING = 8;
const CLEARANCE = 13;
// Seconds for the ring to settle on a new rank, plus a little per rank it passes.
const BASE = 0.45;
const PER_RANK = 0.3;
// How far the light behind the current rank reaches.
const GLOW = 170;
// Driven by a level, the ring leaves a rank as the link to the next is this full, and arrives as it completes.
const CHASE = 0.85;

interface RankLadderProps {
  /** Lowest rank first. */
  ranks: string[];
  current: string;
  /** 0..1, how far the pilot is from the current rank to the next. */
  progress: number;
  /** XP still needed for the next rank, shown above it. */
  xpToNext: number;
  /**
   * Drives the ladder from outside instead of `current`, `progress` and `xpToNext`: the rank index plus the progress
   * to the next, as one number that climbs steadily. The link fills as it rises, the ring follows it to the next rank,
   * and the XP to go counts down (`xpPerRank` is a rank's worth), all frame by frame with nothing rendered.
   */
  level?: MotionValue<number>;
  xpPerRank?: number;
}

interface StopProps {
  rank: string;
  index: number;
  x: number;
  at: MotionValue<number>;
  xp: MotionValue<string>;
}

// One rank on the track. Everything reads off `at`, the ring's place on the track in ranks, so a change of rank
// is one tween and no renders.
function Stop({ rank, index, x, at, xp: xpText }: StopProps) {
  // How far the ring has come to this rank (1 once it is here or past it) and how close it is to sitting on it.
  const reached = (a: number) => clamp(a - index + 1);
  const near = (a: number) => clamp(1 - Math.abs(a - index));
  const fill = useTransform(at, (a) => reached(a) * 0.9 + near(a) * 0.1);
  const hollow = useTransform(at, (a) => (1 - reached(a)) * 0.35);
  // The name cross-fades between a plain layer and a semibold one, since SVG can't tween a static font's weight.
  const plain = useTransform(at, (a) => (1 - near(a)) * (0.45 + reached(a) * 0.4));
  const bold = useTransform(at, near);
  const xp = useTransform(at, (a) => near(a + 1) * 0.55);
  return (
    <g>
      <motion.circle cx={x} cy={LINE} r={5} fill="currentColor" fillOpacity={fill} />
      <motion.circle
        cx={x}
        cy={LINE}
        r={5}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeOpacity={hollow}
      />
      <g fontSize={10.5} fill="currentColor" textAnchor="middle">
        <motion.text x={x} y={LINE + 20} dominantBaseline="hanging" fontWeight={500} fillOpacity={plain}>
          {rank}
        </motion.text>
        <motion.text x={x} y={LINE + 20} dominantBaseline="hanging" fontWeight={600} fillOpacity={bold}>
          {rank}
        </motion.text>
        <motion.text x={x} y={LINE - 20} fontSize={10} fontWeight={500} fillOpacity={xp}>
          {xpText}
        </motion.text>
      </g>
    </g>
  );
}

// A dot of the track between two ranks: it fills as the pilot's progress passes it and drains going back.
function Link({ fill, x, place }: { fill: MotionValue<number>; x: number; place: number }) {
  const opacity = useTransform(fill, (f) => 0.18 + 0.67 * clamp((f - place) * 10 + 0.5));
  return <motion.circle cx={x} cy={LINE} r={1.6} fill="currentColor" fillOpacity={opacity} />;
}

// The ranks as a track, lowest on the left: passed ranks are solid, the current one is ringed and the next is
// hollow with the XP left above it. The link to the next rank fills with the pilot's progress, and a new rank
// sends the ring along the track, filling or draining the links it passes.
export function RankLadder({
  ranks,
  current,
  progress,
  xpToNext,
  level,
  xpPerRank = 3000,
}: RankLadderProps): ReactElement {
  const id = useSvgId();
  const still = useReducedMotion();
  const index = Math.max(0, ranks.indexOf(current));
  const last = Math.max(1, ranks.length - 1);
  const target = index + (index < last ? clamp(progress) : 0);
  const at = useMotionValue(index);
  const fill = useMotionValue(target);
  const xp = useMotionValue(xpToNext);
  const x = (i: number) => FIRST + (i * (LAST - FIRST)) / last;
  const ring = useTransform(at, x);
  const xpText = useTransform(xp, (v) => `${Math.round(v).toLocaleString("en-US")} XP to go`);

  // Given a rank and progress, a change tweens there.
  useEffect(() => {
    if (level) return undefined;
    xp.set(xpToNext);
    if (still === true) {
      at.jump(index);
      fill.jump(target);
      return undefined;
    }
    const duration = BASE + Math.abs(at.get() - index) * PER_RANK;
    const controls = [animate(at, index, { duration, ease }), animate(fill, target, { duration, ease })];
    return () => {
      for (const control of controls) control.stop();
    };
  }, [level, at, fill, xp, index, target, xpToNext, still]);

  // Given a level, it is followed as it goes: the link fills with it, and the ring chases the head of the fill.
  useEffect(() => {
    if (!level) return undefined;
    const follow = (value: number) => {
      const whole = Math.min(last - 1, Math.floor(value));
      const part = clamp(value - whole);
      const chase = clamp((part - CHASE) / (1 - CHASE));
      at.set(whole + chase * chase * (3 - 2 * chase));
      fill.set(Math.min(last, value));
      xp.set((1 - part) * xpPerRank);
    };
    follow(level.get());
    return level.on("change", follow);
  }, [level, last, xpPerRank, at, fill, xp]);

  const links = ranks.slice(1).flatMap((_rank, i) => {
    const from = x(i) + CLEARANCE;
    const count = Math.floor((x(i + 1) - CLEARANCE - from) / SPACING);
    return Array.from({ length: count + 1 }, (_, k) => ({ x: from + k * SPACING, place: i + (k + 0.5) / (count + 1) }));
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMid meet"
      overflow="visible"
      aria-hidden
      className="size-full text-paper"
    >
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset={0} stopColor="currentColor" stopOpacity={0.16} />
          <stop offset={0.5} stopColor="currentColor" stopOpacity={0.05} />
          <stop offset={1} stopColor="currentColor" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* A soft light behind the current rank that travels with the ring. */}
      <motion.circle cx={ring} cy={LINE} r={GLOW} fill={`url(#${id}-glow)`} />
      {links.map(({ x: linkX, place }) => (
        <Link key={linkX} fill={fill} x={linkX} place={place} />
      ))}
      {ranks.map((rank, i) => (
        <Stop key={rank} rank={rank} index={i} x={x(i)} at={at} xp={xpText} />
      ))}
      <motion.circle
        cx={ring}
        cy={LINE}
        r={10}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeOpacity={0.5}
      />
    </svg>
  );
}
