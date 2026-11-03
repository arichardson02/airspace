"use client";

import Link from "next/link";
import { useMemo, useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { sections } from "@/config/site";
import { useActiveSection } from "@/lib/use-active-section";
import { cn } from "@/lib/utils";

const NAV_HEIGHT = 56;
const ease = [0.22, 1, 0.36, 1] as const;

export function Navbar(): ReactElement {
  const ids = useMemo(() => sections.map((section) => section.id), []);
  // The bar is the opposite of the section under it, so it always stands out: paper over
  // ink, ink over paper. The highlighted link follows the section showing the most.
  const { under, dominant } = useActiveSection(ids, NAV_HEIGHT);
  const ink = (sections.find((section) => section.id === under)?.theme ?? "ink") === "paper";
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 backdrop-blur-xl transition-colors duration-150",
        ink ? "bg-ink/85 text-paper" : "bg-paper/85 text-ink",
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto] items-center px-5 md:grid-cols-[1fr_auto_1fr]"
      >
        <Link href="#home" aria-label="Airspace home" className="w-fit">
          <Logo inverted={ink} className="h-5" />
        </Link>

        <ul className="hidden items-center gap-0.5 md:flex">
          {sections.map((section) => {
            const active = section.id === dominant;
            return (
              <li key={section.id}>
                <Link
                  href={`#${section.id}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "block rounded-full px-3 py-1.5 text-[13px] font-medium transition-[background-color,opacity] duration-200",
                    active ? "opacity-100" : "opacity-55 hover:opacity-100",
                    active && (ink ? "bg-paper/12" : "bg-ink/8"),
                  )}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center justify-end gap-4 md:flex">
          <Link href="/login" className="text-[13px] font-medium opacity-55 transition-opacity hover:opacity-100">
            Sign In
          </Link>
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/signup"
              className={cn(
                "block rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                ink ? "bg-paper text-ink hover:bg-white" : "bg-ink text-paper hover:bg-line",
              )}
            >
              Get Started
            </Link>
          </motion.div>
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
                <Link
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={() => {
                    setOpen(false);
                  }}
                  className={cn("py-2.5 text-base font-medium", section.id !== dominant && "opacity-55")}
                >
                  {section.label}
                </Link>
              ))}
              <Link
                href="/signup"
                className={cn(
                  "mt-3 rounded-full py-2.5 text-center text-sm font-medium",
                  ink ? "bg-paper text-ink" : "bg-ink text-paper",
                )}
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
