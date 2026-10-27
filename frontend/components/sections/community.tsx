"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Counter } from "@/components/counter";
import { RollStack } from "@/components/roll-stack";
import { ScrollGroup, Slide, Words } from "@/components/scroll-group";
import { useTick } from "@/lib/use-tick";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

// Sample club. Everything here moves on a timer so the section reads as live.
const pilots = [
  { name: "Mara K.", route: "EGLL → LFPG", aircraft: "A320neo", altitude: 31000, climb: 400 },
  { name: "Jonas", route: "KSEA → KPDX", aircraft: "CRJ-700", altitude: 24000, climb: 650 },
  { name: "Priya", route: "KLAX → KSFO", aircraft: "737-800", altitude: 36000, climb: -300 },
  { name: "Theo", route: "Parked at EDDF", aircraft: "C208" },
  { name: "Lena", route: "Parked at KJFK", aircraft: "E175" },
];

// Each group flight has its own destination shot and its own list of who is going.
const groupFlights = [
  {
    when: "Saturday 19:00 UTC",
    route: "KJFK → SBGL",
    city: "Rio de Janeiro",
    image: "/demo/rio.jpg",
    going: ["Mara K.", "Jonas", "Priya", "Theo", "Omar", "Sana", "Lena", "Eli"],
  },
  {
    when: "Sunday 14:00 UTC",
    route: "EGLL → LFPG",
    city: "Paris",
    image: "/demo/paris.jpg",
    going: ["Lena", "Theo", "Omar", "Sana", "Jonas", "Ava", "Mara K.", "Noor", "Eli", "Kai", "Priya", "Ben"],
  },
  {
    when: "Tuesday 20:00 UTC",
    route: "KLAS → KPGA",
    city: "Monument Valley",
    image: "/demo/monument.jpg",
    going: ["Priya", "Omar", "Mara K.", "Kai", "Ava", "Ben"],
  },
];

const leaders = [
  { name: "Priya", hours: 212.4, flying: true },
  { name: "Mara K.", hours: 187.1, flying: true },
  { name: "You", hours: 164.8 },
];

const chat = [
  { name: "Jonas", text: "Anyone up for the Anchorage run Saturday?" },
  { name: "Mara K.", text: "In. Taking the 737." },
  { name: "Theo", text: "Same, I'll be on the CRJ." },
  { name: "Priya", text: "Just greased one at SFO, -96 fpm." },
  { name: "Lena", text: "Show-off. What runway?" },
  { name: "Priya", text: "28L, light crosswind." },
  { name: "Jonas", text: "Departure 19:00 UTC then, gate B4." },
];

const lift = { whileHover: { y: -4 }, transition: { type: "spring" as const, stiffness: 400, damping: 30 } };

function Card({ children }: { children: ReactNode }) {
  return (
    <motion.div {...lift} className="flex h-full flex-col overflow-hidden rounded-3xl bg-ink p-6 text-paper sm:p-7">
      {children}
    </motion.div>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-paper/12 text-xs font-semibold",
        className,
      )}
    >
      {name[0]}
    </span>
  );
}

function OnlineNow() {
  // Each pilot in the air climbs or descends a little every few seconds, and the figure
  // glides to the new altitude rather than snapping.
  const tick = useTick(3000);

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Online Now</h3>
        <span className="text-xs text-paper/50">5 of 24</span>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {pilots.map((pilot, index) => (
          <li key={pilot.name} className="flex items-center gap-3">
            <Avatar name={pilot.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{pilot.name}</p>
              <p className="truncate text-xs text-paper/50">
                {pilot.route} · {pilot.aircraft}
              </p>
            </div>
            {pilot.altitude && (
              <span className="text-xs text-paper/70">
                <Counter value={pilot.altitude + pilot.climb! * ((tick + index) % 6)} /> ft
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function GroupFlight() {
  const tick = useTick(6000);
  const current = tick % groupFlights.length;
  const flight = groupFlights[current];

  return (
    <motion.div {...lift} className="relative h-full min-h-80 overflow-hidden rounded-3xl text-paper">
      {/* The destination shot cross-fades; the old one eases out as the new one settles. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={flight.image}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease }}
          className="absolute inset-0"
        >
          <Image src={flight.image} alt={`${flight.city} in Microsoft Flight Simulator`} fill sizes="(min-width: 1024px) 800px, 100vw" className="object-cover" />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/10" />

      <div className="absolute inset-x-6 top-6 flex items-center justify-between text-xs">
        <span className="font-medium">Group Flight</span>
        <span className="flex gap-1.5">
          {groupFlights.map((item, index) => (
            <span
              key={item.route}
              className={cn(
                "h-1 rounded-full transition-[width,background-color] duration-500",
                index === current ? "w-5 bg-paper" : "w-2 bg-paper/40",
              )}
            />
          ))}
        </span>
      </div>

      <div className="absolute inset-x-6 bottom-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <RollStack
          axis="x"
          current={current}
          items={groupFlights.map((item) => (
            <div key={item.route}>
              <p className="text-xs text-paper/60">
                {item.when} · {item.city}
              </p>
              <p className="display mt-1 text-3xl sm:text-4xl">{item.route}</p>
            </div>
          ))}
        />
        <RollStack
          axis="y"
          current={current}
          className="shrink-0"
          items={groupFlights.map((item) => (
            <div key={item.route} className="flex items-center">
              {item.going.slice(0, 5).map((name, index) => (
                <Avatar key={name} name={name} className={cn("border-2 border-ink bg-paper text-ink", index > 0 && "-ml-2")} />
              ))}
              <span className="ml-3 text-sm font-medium">{item.going.length} going</span>
            </div>
          ))}
        />
      </div>
    </motion.div>
  );
}

function Leaderboard() {
  // Pilots in the air keep adding to their total.
  const tick = useTick(3000);

  return (
    <>
      <h3 className="text-sm font-semibold">Leaderboard · Hours</h3>
      <ol className="mt-5 flex flex-col gap-3.5">
        {leaders.map((pilot, index) => (
          <li key={pilot.name} className="flex items-center gap-3 text-sm">
            <span className="w-4 tabular-nums text-paper/40">{index + 1}</span>
            <span className={cn("flex-1 font-medium", pilot.name === "You" && "text-paper/70")}>{pilot.name}</span>
            <span className="text-paper/70">
              <Counter value={pilot.hours + (pilot.flying ? tick * 0.1 : 0)} decimals={1} /> h
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function ClubChat() {
  // A conversation that keeps going: every few seconds the next line arrives at the
  // bottom and everything above slides up to make room, the oldest leaving at the top.
  const tick = useTick(2800);
  const visible = Array.from({ length: 4 }, (_, offset) => {
    const id = tick + offset;
    return { id, ...chat[id % chat.length] };
  });

  return (
    <>
      <h3 className="text-sm font-semibold">Club Chat</h3>
      <ul className="mt-5 flex h-40 flex-col justify-end gap-3 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((message) => (
            <motion.li
              key={message.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease }}
              className="flex gap-3"
            >
              <Avatar name={message.name} className="size-6 text-[10px]" />
              <p className="text-sm leading-snug text-paper/80">
                <span className="font-medium text-paper">{message.name}</span> {message.text}
              </p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}

export function Community() {
  return (
    <section
      id="community"
      aria-labelledby="community-title"
      className="flex min-h-screen items-center bg-paper text-ink"
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:py-32">
        <ScrollGroup className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="community-title" className="display text-4xl sm:text-5xl md:text-6xl">
            <Words text="Fly With Other Pilots" />
          </h2>
          <Slide from="right" range={[0.3, 0.8]}>
            <p className="max-w-xs text-lg text-muted">Join a club, see who is in the air, and plan flights together.</p>
          </Slide>
        </ScrollGroup>

        <ScrollGroup className="mt-12 grid gap-5 md:grid-cols-6" to="start 35%">
          <Slide from="left" range={[0, 0.6]} className="md:col-span-3 lg:col-span-2 lg:row-span-2">
            <Card>
              <OnlineNow />
            </Card>
          </Slide>
          <Slide from="top" range={[0.1, 0.7]} className="md:col-span-3 lg:col-span-4">
            <GroupFlight />
          </Slide>
          <Slide from="bottom" range={[0.3, 0.9]} className="md:col-span-3 lg:col-span-2">
            <Card>
              <Leaderboard />
            </Card>
          </Slide>
          <Slide from="right" range={[0.4, 1]} className="md:col-span-3 lg:col-span-2">
            <Card>
              <ClubChat />
            </Card>
          </Slide>
        </ScrollGroup>
      </div>
    </section>
  );
}
