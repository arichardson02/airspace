"use client";

import type { ReactElement, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../cn";
import { rise } from "../motion/motion";

/** The slim bar above a page: its icon and name. */
export function PageBar({ icon, title }: { icon: ReactNode; title: string }): ReactElement {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2.5 border-b border-paper/6 px-10 text-[14.5px] text-paper/75 [&>svg]:size-4.5">
      {icon}
      {title}
    </header>
  );
}

interface PageProps {
  /** The headline, with `accent` rendered muted after it. */
  title: string;
  accent?: string;
  /** One line under the headline that states the real situation. */
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
}

// A page's content: headline, one-line status, then whatever the page shows.
export function Page({ title, accent, sub, children, className }: PageProps): ReactElement {
  return (
    <div className={cn("px-10 py-9", className)}>
      <motion.h1 {...rise(0)} className="display text-[42px] leading-[1.05]">
        {title}
        {accent !== undefined && <span className="text-paper/40"> {accent}</span>}
      </motion.h1>
      {sub !== undefined && (
        <motion.p {...rise(0.04)} className="mt-2.5 flex items-center gap-2 text-[15px] text-muted">
          {sub}
        </motion.p>
      )}
      {children}
    </div>
  );
}

/** Cards in a two-column grid, rising in one after another. */
export function CardGrid({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return <div className={cn("mt-7 grid gap-4 md:grid-cols-2", className)}>{children}</div>;
}

interface StatCardProps {
  label: string;
  value: string;
  /** One short fact. It never wraps. */
  detail?: string;
  /** Fills the whole card behind the text, e.g. a glow or a scope. */
  background?: ReactNode;
  /** Art on the right, bleeding off the card's edge. */
  art?: ReactNode;
  /** How tall the card stands: "md" for a strip of art, "lg" for an instrument that needs room to read. */
  size?: "md" | "lg";
  /** When the card leads somewhere. Its label then ends in an arrow, like every card you can open. */
  onClick?: () => void;
  /** The card opens something outside the app, such as the website: the arrow points out. */
  external?: boolean;
  index?: number;
  className?: string;
}

// Where a card that opens something points: out for the website, across for a page.
function CardArrow({ external }: { external: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn(
        "size-3 shrink-0 transition-transform duration-300",
        external ? "group-hover:translate-x-0.5 group-hover:-translate-y-0.5" : "group-hover:translate-x-0.5",
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {external ? <path d="M5 11 11 5M6 5h5v5" /> : <path d="M3 8h10M9 4l4 4-4 4" />}
    </svg>
  );
}

function StatBody({
  label,
  value,
  detail,
  background,
  art,
  interactive,
  external,
}: Pick<StatCardProps, "label" | "value" | "detail" | "background" | "art" | "external"> & {
  interactive: boolean;
}): ReactElement {
  return (
    <>
      {background !== undefined && <div className="pointer-events-none absolute inset-0">{background}</div>}
      {(background ?? art) !== undefined && (
        <div className="text-veil pointer-events-none absolute inset-y-0 left-0 z-[5] w-[56%]" />
      )}
      <p className="relative z-10 flex items-center gap-1.5 truncate text-[13.5px] text-paper/55">
        {label}
        {/* A card that opens something says so after its label: an arrow out for the website, across for a page. */}
        {interactive && <CardArrow external={external === true} />}
      </p>
      {/* A full line height, so truncate's clipping box keeps the descenders. */}
      <p className="display relative z-10 mt-1.5 truncate text-[28px] leading-[1.35]">{value}</p>
      {detail !== undefined && <p className="relative z-10 mt-1 truncate text-[13.5px] text-muted">{detail}</p>}
      {art !== undefined && <div className="pointer-events-none absolute inset-y-0 right-0 w-[52%]">{art}</div>}
    </>
  );
}

const statHeights = new Map<StatCardProps["size"], string>([
  ["md", "min-h-[220px]"],
  ["lg", "min-h-[280px]"],
]);

function statClass(size: StatCardProps["size"], interactive: boolean, className: string | undefined): string {
  return cn(
    "surface relative flex min-h-[150px] flex-col justify-center overflow-hidden rounded-[18px] px-6 py-5 text-left",
    statHeights.get(size),
    interactive &&
      "group transition-[border-color,translate] duration-300 hover:-translate-y-0.5 hover:border-paper/20",
    className,
  );
}

// Label, value, fact. The art sits in the right 52% and the card crops it.
export function StatCard({ onClick, size, index = 0, className, ...body }: StatCardProps): ReactElement {
  const interactive = onClick !== undefined;
  const motionProps = rise(0.08 + index * 0.04);
  const content = <StatBody {...body} interactive={interactive} />;

  return interactive ? (
    <motion.button type="button" onClick={onClick} {...motionProps} className={statClass(size, true, className)}>
      {content}
    </motion.button>
  ) : (
    <motion.div {...motionProps} className={statClass(size, false, className)}>
      {content}
    </motion.div>
  );
}
