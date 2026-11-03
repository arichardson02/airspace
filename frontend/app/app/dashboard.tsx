"use client";

import type { ReactElement, ReactNode } from "react";
import { motion } from "framer-motion";
import { BookOpen, Briefcase, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease, delay },
});

// Mirrors the connector's sign-in: it opens /device with its code and the pilot approves it.
const connectSteps = [
  {
    title: "Download the connector",
    body: "A small Windows app for Microsoft Flight Simulator 2020. The download opens soon.",
  },
  { title: "Start it with the sim open", body: "It finds the simulator by itself and waits in the background." },
  {
    title: "Approve its code",
    body: "It opens airspace.club/device with a code. Approve it once and it stays signed in.",
  },
];

// Each fills in from the connector's data; until there is some, they say what will appear.
const upcoming = [
  {
    icon: Briefcase,
    title: "Jobs",
    body: "Passenger and cargo jobs from the airport you're parked at, once the connector sees your aircraft.",
  },
  {
    icon: BookOpen,
    title: "Logbook",
    body: "Every flight is recorded with its route, time and landing. You never type a line.",
  },
  { icon: Users, title: "Co-op", body: "Fly a shared cockpit with a friend: pilot and co-pilot in the same aircraft." },
];

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-paper/10 bg-paper/[0.03] p-6 sm:p-7", className)}>{children}</div>
  );
}

export function Dashboard({ name }: { name: string }): ReactElement {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:py-16">
      <motion.h1 {...rise(0)} className="display text-4xl sm:text-5xl md:text-6xl">
        Welcome aboard, {name}.
      </motion.h1>
      <motion.p {...rise(0.1)} className="mt-4 max-w-xl text-lg leading-relaxed text-paper/60">
        Your jobs, logbook and rank start filling in from your first flight.
      </motion.p>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <motion.div {...rise(0.2)}>
          <Panel className="h-full">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="display text-2xl">Connect your sim</h2>
              <span className="text-xs text-paper/50">Windows 10 and 11</span>
            </div>
            <ol className="mt-6 flex flex-col">
              {connectSteps.map((step, index) => (
                <li key={step.title} className="flex gap-5 border-t border-paper/10 py-5 last:pb-0">
                  <span className="text-sm font-semibold text-paper/35 tabular-nums">0{index + 1}</span>
                  <div>
                    <h3 className="text-[15px] font-medium">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-paper/55">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </motion.div>

        <div className="flex flex-col gap-4">
          {upcoming.map((item, index) => (
            <motion.div key={item.title} {...rise(0.3 + index * 0.08)}>
              <Panel>
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2.5 text-[15px] font-medium">
                    <item.icon className="size-4 text-paper/60" />
                    {item.title}
                  </h2>
                  <span className="rounded-full bg-paper/8 px-2.5 py-1 text-xs text-paper/55">Nothing yet</span>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-paper/55">{item.body}</p>
              </Panel>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
