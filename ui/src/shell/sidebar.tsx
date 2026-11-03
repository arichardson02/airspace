"use client";

import type { ComponentType, ReactElement, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../cn";
import { ease } from "../motion/motion";

/** What a sidebar link renders as: an <a> by default, or the app's router link. */
export type SidebarLink = ComponentType<{ href: string; className?: string; children: ReactNode }>;

const Anchor: SidebarLink = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

interface SidebarProps {
  /** The brand lockup, when the window has no title bar carrying it. */
  brand?: ReactNode;
  /** Sections and items. */
  children: ReactNode;
  /** The signed-in pilot, at the foot; usually a SidebarAccount. */
  account: ReactNode;
  className?: string;
}

// The app's left rail: brand on top, grouped items, the pilot at the foot. It slides in once.
export function Sidebar({ brand, children, account, className }: SidebarProps): ReactElement {
  return (
    <motion.nav
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease }}
      className={cn("flex w-60 shrink-0 flex-col border-r border-paper/8 bg-[#0e1115] px-3", className)}
    >
      {brand !== undefined && <div className="flex h-16 items-center px-3">{brand}</div>}
      <div className="flex flex-1 flex-col">{children}</div>
      <div className="mt-auto pb-3">{account}</div>
    </motion.nav>
  );
}

interface SidebarAccountProps {
  name: string;
  /** Set while the settings page is showing. */
  settingsActive?: boolean;
  /** A route to settings; renders as `link`. */
  settingsHref?: string;
  /** Or an action, for apps with no router. */
  onSettings?: () => void;
  link?: SidebarLink;
}

// Lucide's settings gear, inlined so ui doesn't need the icon package.
function SettingsIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const settingsClass = "grid size-12 shrink-0 place-items-center rounded-xl transition-colors [&>svg]:size-4.5";

// The pilot at the foot of the sidebar, with settings one tap away beside them.
export function SidebarAccount({
  name,
  settingsActive,
  settingsHref,
  onSettings,
  link: Link = Anchor,
}: SidebarAccountProps): ReactElement {
  // Like a menu item: bare until it is the page showing, then raised on the same marker surface.
  const className = cn(
    settingsClass,
    settingsActive === true ? "surface text-paper" : "text-paper/55 hover:bg-paper/6 hover:text-paper",
  );
  return (
    <div className="flex gap-2">
      <div className="surface flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-sm font-medium">
        <Avatar name={name} className="size-7" />
        <span className="truncate">{name}</span>
      </div>
      {settingsHref !== undefined ? (
        <Link href={settingsHref} className={className}>
          <SettingsIcon />
        </Link>
      ) : (
        <button
          type="button"
          onClick={onSettings}
          aria-label="Settings"
          aria-current={settingsActive === true ? "page" : undefined}
          className={className}
        >
          <SettingsIcon />
        </button>
      )}
    </div>
  );
}

/** A labelled group of items. The label is left out when there is only one group. */
export function SidebarSection({ label, children }: { label?: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-1 pt-4 first:pt-2">
      {label !== undefined && <p className="px-3.5 pb-1.5 text-xs font-medium text-paper/35">{label}</p>}
      {children}
    </div>
  );
}

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  /** A route; renders as `link`. */
  href?: string;
  /** Or an action, for apps with no router. */
  onClick?: () => void;
  link?: SidebarLink;
}

const itemClass =
  "relative flex h-10.5 w-full items-center gap-3 rounded-xl border border-transparent px-3.5 text-left text-[14.5px] transition-colors";

// The marker behind the active item glides between items.
export function SidebarItem({
  icon,
  label,
  active,
  href,
  onClick,
  link: Link = Anchor,
}: SidebarItemProps): ReactElement {
  const inner = (
    <>
      {active === true && (
        <motion.span
          layoutId="sidebar-marker"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="surface absolute inset-0 rounded-xl"
        />
      )}
      <span className="relative [&>svg]:size-4.5">{icon}</span>
      <span className="relative">{label}</span>
    </>
  );
  const className = cn(itemClass, active === true ? "font-medium text-paper" : "text-paper/55 hover:text-paper");

  if (href !== undefined) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-current={active === true ? "page" : undefined} className={className}>
      {inner}
    </button>
  );
}

/** What the app calls a pilot to their face. */
export const firstName = (name: string): string => name.split(" ")[0] ?? name;

/** The pilot's initial in a circle. */
export function Avatar({ name, className }: { name: string; className?: string }): ReactElement {
  return (
    <span
      className={cn(
        "grid size-7.5 shrink-0 place-items-center rounded-full bg-paper text-xs font-semibold text-ink",
        className,
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
