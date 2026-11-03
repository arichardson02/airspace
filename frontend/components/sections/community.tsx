"use client";

import Image from "next/image";
import type { ReactElement, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Counter } from "@/components/counter";
import { RollStack } from "@/components/roll-stack";
import { ScrollGroup, Slide, Words } from "@/components/scroll-group";
import { useTick } from "@/lib/use-tick";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

interface OnlinePilot {
  name: string;
  route: string;
  aircraft: string;
}

interface AirbornePilot extends OnlinePilot {
  altitude: number;
  /** Feet gained (or lost, when negative) every few seconds. */
  climb: number;
}

// Sample club. Everything here moves on a timer so the section reads as live.
const pilots: (OnlinePilot | AirbornePilot)[] = [
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
  { name: "Jonas", hours: 141.6 },
];

// One line each, so every chat row is the same height as a leaderboard row.
const chat = [
  { name: "Jonas", text: "Anchorage run Saturday, who's in?" },
  { name: "Mara K.", text: "In. Taking the 737." },
  { name: "Theo", text: "Same, I'll be on the CRJ." },
  { name: "Priya", text: "Greased one at SFO, -96 fpm." },
  { name: "Lena", text: "Show-off. What runway?" },
  { name: "Priya", text: "28L, light crosswind." },
  { name: "Jonas", text: "Departure 19:00 UTC, gate B4." },
];

/** Rows in the leaderboard and the chat window, so the two cards are the same size. */
const ROWS = 4;
/** Height of one row in px. Matches the h-11 on the rows. */
const ROW_PX = 44;

const lift = { whileHover: { y: -4 }, transition: { type: "spring" as const, stiffness: 400, damping: 30 } };

function Card({ children }: { children: ReactNode }) {
  return (
    <motion.div {...lift} className="flex h-full flex-col overflow-hidden rounded-3xl bg-ink p-6 text-paper sm:p-7">
      {children}
    </motion.div>
  );
}

// Every card opens with the same header, so titles line up across the grid.
function CardHeader({ title, aside }: { title: string; aside: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="text-xs text-paper/50">{aside}</span>
    </div>
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
      <CardHeader title="Online Now" aside="5 of 24" />
      <ul className="mt-4 flex flex-col gap-4">
        {pilots.map((pilot, index) => (
          <li key={pilot.name} className="flex items-center gap-3">
            <Avatar name={pilot.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{pilot.name}</p>
              <p className="truncate text-xs text-paper/50">
                {pilot.route} · {pilot.aircraft}
              </p>
            </div>
            {"altitude" in pilot && (
              <span className="text-xs text-paper/70">
                <Counter value={pilot.altitude + pilot.climb * ((tick + index) % 6)} /> ft
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
          <Image
            src={flight.image}
            alt={`${flight.city} in Microsoft Flight Simulator`}
            fill
            sizes="(min-width: 1024px) 800px, 100vw"
            className="object-cover"
          />
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
          items={groupFlights.map((item) => ({
            id: item.route,
            content: (
              <div>
                <p className="text-xs text-paper/60">
                  {item.when} · {item.city}
                </p>
                <p className="display mt-1 text-3xl sm:text-4xl">{item.route}</p>
              </div>
            ),
          }))}
        />
        <RollStack
          axis="y"
          current={current}
          className="shrink-0"
          items={groupFlights.map((item) => ({
            id: item.route,
            content: (
              <div className="flex items-center">
                {item.going.slice(0, 5).map((name, index) => (
                  <Avatar
                    key={name}
                    name={name}
                    className={cn("border-2 border-ink bg-paper text-ink", index > 0 && "-ml-2")}
                  />
                ))}
                <span className="ml-3 text-sm font-medium">{item.going.length} going</span>
              </div>
            ),
          }))}
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
      <CardHeader title="Leaderboard" aside="Hours" />
      <ol className="mt-4">
        {leaders.map((pilot, index) => (
          <li key={pilot.name} className="flex h-11 items-center gap-3 text-sm">
            <span className="w-4 tabular-nums text-paper/40">{index + 1}</span>
            <span className={cn("flex-1 font-medium", pilot.name === "You" && "text-paper/70")}>{pilot.name}</span>
            <span className="text-paper/70">
              <Counter value={pilot.hours + (pilot.flying === true ? tick * 0.1 : 0)} decimals={1} /> h
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function ClubChat() {
  // A conversation that keeps going. The window is ROWS lines tall and every row has the
  // same fixed height. Each tick the list is remounted with one more line below the
  // window and slides up by exactly one row, which leaves the lines in the same place as
  // the next remount starts them, so the stream never jumps.
  const tick = useTick(2600);
  const lines = Array.from({ length: ROWS + 1 }, (_, offset) => {
    const id = tick + offset;
    return { id, ...chat[id % chat.length] };
  });

  return (
    <>
      <CardHeader title="Club Chat" aside="5 online" />
      <div className="mt-4 overflow-hidden" style={{ height: ROWS * ROW_PX }}>
        <motion.ul key={tick} initial={{ y: 0 }} animate={{ y: -ROW_PX }} transition={{ duration: 0.6, ease }}>
          {lines.map((line) => (
            <li key={line.id} className="flex h-11 items-center gap-3">
              <Avatar name={line.name} className="size-6 text-[10px]" />
              <p className="min-w-0 truncate text-sm text-paper/80">
                <span className="font-medium text-paper">{line.name}</span> {line.text}
              </p>
            </li>
          ))}
        </motion.ul>
      </div>
    </>
  );
}

export function Community(): ReactElement {
  return (
    <section
      id="community"
      aria-labelledby="community-title"
      className="flex min-h-screen items-center bg-paper text-ink"
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:py-32">
        <ScrollGroup className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="community-title" className="display text-4xl sm:text-5xl md:text-6xl">
            <Words text="Your Club" />
          </h2>
          <Slide from="right" range={[0.3, 0.8]}>
            <p className="max-w-xs text-lg text-muted">
              Join a club, follow every flight on the live map, and plan group flights.
            </p>
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
