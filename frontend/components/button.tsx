"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ButtonProps {
  href: string;
  children: ReactNode;
  /** Ink is the default on paper; paper is the default on ink. Ghost is the quiet one. */
  variant?: "ink" | "paper" | "ghost";
  size?: "sm" | "md";
  className?: string;
}

// Only href, children and className reach Link, which keeps React's drag handlers from
// colliding with Motion's.
const MotionLink = motion.create(Link);

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow] duration-200 [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:translate-x-0.5";

const variants = {
  ink: "bg-ink text-paper hover:bg-line hover:shadow-[0_8px_24px_-12px_rgba(11,13,16,0.6)]",
  paper: "bg-paper text-ink hover:bg-white hover:shadow-[0_8px_24px_-12px_rgba(246,247,249,0.5)]",
  ghost: "border border-current/20 hover:border-current/50",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-12 px-6 text-[15px]",
};

const press = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
  transition: { type: "spring", stiffness: 500, damping: 30 },
} as const;

export function Button({ href, children, variant = "ink", size = "md", className }: ButtonProps) {
  return (
    <MotionLink href={href} {...press} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </MotionLink>
  );
}

interface ActionButtonProps extends Omit<ButtonProps, "href"> {
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}

// The same look as Button, for submitting forms and other actions that aren't links.
export function ActionButton({
  children,
  variant = "ink",
  size = "md",
  className,
  type = "button",
  disabled,
  onClick,
}: ActionButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...(disabled ? {} : press)}
      className={cn(base, variants[variant], sizes[size], "disabled:cursor-not-allowed disabled:opacity-50", className)}
    >
      {children}
    </motion.button>
  );
}
