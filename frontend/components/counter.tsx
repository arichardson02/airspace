"use client";

import { useEffect, type ReactElement } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { cn } from "@fs-career/ui/cn";

interface CounterProps {
  value: number;
  decimals?: number;
  className?: string;
}

// A number that glides to each new value instead of jumping. Tabular figures keep the
// width steady while the digits roll.
export function Counter({ value, decimals = 0, className }: CounterProps): ReactElement {
  const spring = useSpring(value, { stiffness: 45, damping: 16 });
  const text = useTransform(spring, (latest) =>
    latest.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={cn("tabular-nums", className)}>{text}</motion.span>;
}
