"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const ease = [0.22, 1, 0.36, 1] as const;

export function UserMenu({ name, email }: { name: string; email: string }): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // Closes on a click anywhere else or on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent | KeyboardEvent) => {
      const inside = event.target instanceof Node && menu.current?.contains(event.target) === true;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !inside) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function signOut(): Promise<void> {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 text-[13px] font-medium transition-colors hover:bg-paper/8"
      >
        <span className="grid size-7 place-items-center rounded-full bg-paper text-xs font-semibold text-ink">
          {name.slice(0, 1).toUpperCase()}
        </span>
        {name}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease }}
            className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-paper/12 bg-[#101318] p-1.5 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)]"
          >
            <div className="px-3 py-2.5">
              <p className="text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-paper/50">{email}</p>
            </div>
            <div className="my-1 h-px bg-paper/8" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-paper/75 transition-colors hover:bg-paper/8 hover:text-paper"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
