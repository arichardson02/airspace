"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

interface AuthCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Quiet links under the card, like "Already have an account?". */
  footer?: ReactNode;
}

// The panel every sign-in page sits in, styled like the app windows on the marketing page.
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease }}
      className="w-full max-w-sm"
    >
      <div className="rounded-2xl border border-paper/12 bg-[#101318]/85 p-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8">
        <h1 className="display text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-paper/60">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-paper/55">{footer}</div>}
    </motion.div>
  );
}
