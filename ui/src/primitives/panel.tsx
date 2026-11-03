import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

/** The dark glass surface of the app windows on the marketing page, for cards on ink. */
export const panelClass =
  "rounded-2xl border border-paper/12 bg-[#101318]/85 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl";

export function Panel({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return <div className={cn(panelClass, className)}>{children}</div>;
}
