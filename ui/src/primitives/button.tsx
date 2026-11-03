"use client";

import type { ReactElement, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../cn";

export type ButtonVariant = "ink" | "paper" | "ghost";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow] duration-200 [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:translate-x-0.5";

const variants = {
  ink: "bg-ink text-paper hover:bg-line hover:shadow-[0_8px_24px_-12px_rgba(11,13,16,0.6)]",
  paper: "surface-paper",
  ghost: "surface-button hover:bg-paper/6",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-12 px-6 text-[15px]",
};

/** The pill look shared by every button and button-styled link. Ink is the default on paper; paper is the default on ink. Ghost is the quiet one. */
export function buttonClass(variant: ButtonVariant = "ink", size: ButtonSize = "md", className?: string): string {
  return cn(base, variants[variant], sizes[size], className);
}

/** Motion props for the lift on hover and the slight squeeze on press. */
export const press = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.985 },
  transition: { type: "spring", stiffness: 500, damping: 30 },
} as const;

interface ActionButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}

// The button look for submitting forms and other actions that aren't links.
export function ActionButton({
  children,
  variant = "ink",
  size = "md",
  className,
  type = "button",
  disabled,
  onClick,
}: ActionButtonProps): ReactElement {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...(disabled === true ? {} : press)}
      className={buttonClass(variant, size, cn("disabled:cursor-not-allowed disabled:opacity-50", className))}
    >
      {children}
    </motion.button>
  );
}
