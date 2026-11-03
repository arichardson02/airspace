"use client";

import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { motion } from "framer-motion";
import { buttonClass, press, type ButtonSize, type ButtonVariant } from "@fs-career/ui/button";

interface ButtonProps {
  href: string;
  children: ReactNode;
  /** Ink is the default on paper; paper is the default on ink. Ghost is the quiet one. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

// Only href, children and className reach Link, which keeps React's drag handlers from
// colliding with Motion's.
const MotionLink = motion.create(Link);

export function Button({ href, children, variant = "ink", size = "md", className }: ButtonProps): ReactElement {
  return (
    <MotionLink href={href} {...press} className={buttonClass(variant, size, className)}>
      {children}
    </MotionLink>
  );
}
