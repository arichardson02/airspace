"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@fs-career/ui/cn";

const ease = [0.22, 1, 0.36, 1] as const;

/** 1 = the next item arrives from below or the right, -1 = from above or the left. */
type RollDirection = 1 | -1;

interface RollItem {
  /** Unique within the stack. */
  id: string;
  content: ReactNode;
}

interface RollStackProps {
  /** Every item that can be shown. They all reserve space, so the stack never changes size. */
  items: RollItem[];
  current: number;
  axis: "x" | "y";
  direction?: RollDirection;
  className?: string;
  /** Applied to every slide and to the invisible size reservations. */
  slideClassName?: string;
}

// One rolling transition for anything that cycles: the outgoing item slides away and fades
// while the next slides in, as one motion. Invisible copies of every item sit in the same
// grid cell, so the box is always as big as the largest and nothing around it shifts.
export function RollStack({
  items,
  current,
  axis,
  direction = 1,
  className,
  slideClassName,
}: RollStackProps): ReactElement {
  const reduceMotion = useReducedMotion();
  const offset = (sign: number): string => `${reduceMotion === true ? 0 : sign * 110}%`;

  const variants: Variants = {
    enter: (dir: RollDirection) => ({ [axis]: offset(dir), opacity: 0 }),
    center: { [axis]: "0%", opacity: 1 },
    exit: (dir: RollDirection) => ({ [axis]: offset(-dir), opacity: 0 }),
  };

  return (
    <div className={cn("grid overflow-hidden", className)}>
      {items.map((item) => (
        <div key={item.id} aria-hidden inert className={cn("invisible col-start-1 row-start-1", slideClassName)}>
          {item.content}
        </div>
      ))}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={current}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.65, ease }}
          className={cn("col-start-1 row-start-1", slideClassName)}
        >
          {items[current]?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
