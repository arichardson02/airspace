"use client";

import Link from "next/link";
import { useMemo, useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@fs-career/ui/logo";
import { Button } from "@/components/button";
import { SectionLink } from "@/components/section-link";
import { sections } from "@/config/site";
import { useActiveSection } from "@/lib/use-active-section";
import { cn } from "@fs-career/ui/cn";

const NAV_HEIGHT = 56;
const ease = [0.22, 1, 0.36, 1] as const;

export function Navbar(): ReactElement {
  const ids = useMemo(() => sections.map((section) => section.id), []);
  // The page is ink throughout, so the bar is dark glass with a hairline under it. The highlighted link follows the
  // section showing the most.
  const { dominant } = useActiveSection(ids, NAV_HEIGHT);
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-paper/6 bg-ink/75 text-paper backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto] items-center px-5 md:grid-cols-[1fr_auto_1fr]"
      >
        <SectionLink id="home" aria-label="Airspace home" className="w-fit">
          <Logo className="h-5" />
        </SectionLink>

        <ul className="well hidden items-center gap-0.5 rounded-full p-0.5 md:flex">
          {sections.map((section) => {
            const active = section.id === dominant;
            return (
              <li key={section.id}>
                <SectionLink
                  id={section.id}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "block rounded-full px-3 py-1.5 text-[13px] font-medium transition-[background-color,opacity] duration-200",
                    active ? "opacity-100" : "opacity-55 hover:opacity-100",
                    active && "surface-button",
                  )}
                >
                  {section.label}
                </SectionLink>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center justify-end gap-4 md:flex">
          <Link href="/login" className="text-[13px] font-medium opacity-55 transition-opacity hover:opacity-100">
            Sign In
          </Link>
          <Button href="/signup" variant="paper" size="sm">
            Get Started
          </Button>
        </div>

        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
          }}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="justify-self-end p-2 md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden md:hidden"
          >
            <div className="flex flex-col px-5 pb-5">
              {sections.map((section) => (
                <SectionLink
                  key={section.id}
                  id={section.id}
                  onClick={() => {
                    setOpen(false);
                  }}
                  className={cn("py-2.5 text-base font-medium", section.id !== dominant && "opacity-55")}
                >
                  {section.label}
                </SectionLink>
              ))}
              <Link
                href="/signup"
                className="mt-3 rounded-full bg-paper py-2.5 text-center text-sm font-medium text-ink"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
