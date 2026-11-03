"use client";

import type { ReactElement, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

interface AppWindowProps {
  /** Shown in the address bar; rolls when it changes. */
  url: string;
  children: ReactNode;
  className?: string;
}

// A browser window showing the app, for the mock pages on the marketing site.
export function AppWindow({ url, children, className }: AppWindowProps): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-paper/12 bg-[#101318] text-paper shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-paper/10 px-4">
        <span className="size-2.5 rounded-full bg-paper/15" />
        <span className="size-2.5 rounded-full bg-paper/15" />
        <span className="size-2.5 rounded-full bg-paper/15" />
        <div className="ml-3 grid flex-1 overflow-hidden rounded-md bg-paper/6 px-3 py-1 text-xs text-paper/60">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={url}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease }}
              className="col-start-1 row-start-1"
            >
              {url}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
