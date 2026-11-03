"use client";

import { createContext, useContext, useRef, type ReactElement, type ReactNode } from "react";
import { motion, useMotionValue, useScroll, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@fs-career/ui/cn";

/** One edge of a useScroll offset, for example "start 92%". */
type Edge = NonNullable<Parameters<typeof useScroll>[0]>["offset"] extends (infer T)[] | undefined ? T : never;

// Reveals tied to the scrollbar rather than to a trigger: an element's progress runs 0 → 1
// while it climbs through the lower part of the viewport, so it rises as you scroll down
// and sinks back as you scroll up, at your pace. ScrollGroup measures one element and
// hands its progress to the Words and Slide inside it.

const ProgressContext = createContext<MotionValue<number> | null>(null);

/** Progress of the nearest ScrollGroup, or a finished (1) value outside one. */
export function useScrollProgress(): MotionValue<number> {
  const context = useContext(ProgressContext);
  const done = useMotionValue(1);
  return context ?? done;
}

interface ScrollGroupProps {
  children: ReactNode;
  className?: string;
  /** Where in the viewport the group's top starts (0) and finishes (1) its reveal. */
  from?: Edge;
  to?: Edge;
}

export function ScrollGroup({
  children,
  className,
  from = "start 92%",
  to = "start 50%",
}: ScrollGroupProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: [from, to] });

  return (
    <ProgressContext.Provider value={scrollYProgress}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </ProgressContext.Provider>
  );
}

type Side = "top" | "bottom" | "left" | "right";

const offsets: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: -28 },
  bottom: { x: 0, y: 28 },
  left: { x: -40, y: 0 },
  right: { x: 40, y: 0 },
};

// Defaults for `range`, kept out of the props so each render gets the same array.
const wholeGroup: [number, number] = [0, 1];
const headingRange: [number, number] = [0, 0.7];

interface SlideProps {
  children: ReactNode;
  className?: string;
  from?: Side;
  /** The slice of the group's progress this element moves through. */
  range?: [number, number];
}

export function Slide({ children, className, from = "bottom", range = wholeGroup }: SlideProps): ReactElement {
  const progress = useScrollProgress();
  const offset = offsets[from];
  const x = useTransform(progress, range, [offset.x, 0]);
  const y = useTransform(progress, range, [offset.y, 0]);
  const opacity = useTransform(progress, range, [0, 1]);

  return (
    <motion.div style={{ x, y, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

function Word({ text, range, from }: { text: string; range: [number, number]; from: Side }) {
  const progress = useScrollProgress();
  const offset = offsets[from];
  const y = useTransform(progress, range, [offset.y, 0]);
  const opacity = useTransform(progress, range, [0, 1]);

  return (
    <motion.span style={{ y, opacity }} className="inline-block">
      {text}
    </motion.span>
  );
}

interface WordsProps {
  text: string;
  className?: string;
  from?: Side;
  range?: [number, number];
}

// A heading that lands one word at a time, left to right, inside the given range.
export function Words({ text, className, from = "top", range = headingRange }: WordsProps): ReactElement {
  // Each word is keyed by where it starts in the text, which stays unique when a word repeats.
  const words = Array.from(text.matchAll(/[^ ]+/g), (match) => ({ word: match[0], at: match.index }));
  const span = (range[1] - range[0]) / (words.length + 1.5);

  return (
    <span className={cn("inline-flex flex-wrap gap-x-[0.25em]", className)}>
      {words.map(({ word, at }, index) => (
        <Word key={at} text={word} from={from} range={[range[0] + index * span, range[0] + (index + 2.5) * span]} />
      ))}
    </span>
  );
}
