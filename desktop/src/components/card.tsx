import type { ReactNode } from "react";
import { cn } from "@fs-career/ui/cn";

/** The quiet panel from the website dashboard. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-paper/10 bg-paper/[0.03] p-6", className)}>{children}</div>;
}

/** A small rounded label, e.g. "Connected". `live` adds a pulsing dot. */
export function Pill({ children, live, strong }: { children: ReactNode; live?: boolean; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs",
        strong ? "bg-paper font-medium text-ink" : "bg-paper/8 text-paper/60",
      )}
    >
      {live && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

/** A pilot's initial in a circle, as in the website's account menu. */
export function Avatar({ name, inverted }: { name: string; inverted?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
        inverted ? "bg-paper/12 text-paper" : "bg-paper text-ink",
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
