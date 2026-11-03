"use client";

import type { ReactElement } from "react";
import { motion, useTransform } from "framer-motion";
import { ScrollGroup, Slide, Words, useScrollProgress } from "@/components/scroll-group";
import { cn } from "@/lib/utils";

const jobs = [
  { route: "KSEA → KPDX", detail: "48 passengers · CRJ-700", pay: "$4,200", xp: "180 XP" },
  { route: "KSEA → KBFI", detail: "1,200 lb cargo · C208", pay: "$1,650", xp: "90 XP" },
  { route: "KSEA → KGEG", detail: "110 passengers · A320neo", pay: "$7,800", xp: "310 XP" },
];

const flights = [
  { date: "Oct 24", route: "KSEA → KPDX", time: "0:52", landing: "-138 fpm" },
  { date: "Oct 22", route: "KSEA → KGEG", time: "1:04", landing: "-204 fpm" },
  { date: "Oct 21", route: "KBFI → KSEA", time: "0:14", landing: "-96 fpm" },
];

const ranks = ["Student", "First Officer", "Captain", "Senior Captain"];

// Vertical speed over the last seconds before touchdown.
const descent = "M 0 10 C 60 14, 120 22, 180 34 S 260 58, 300 60";

// Rows arrive one after another, each from the side its card's visual comes from. The
// windows are spread over 0.3 to 0.95 of the card's progress, so the last row has finished
// by the time the card is fully in: a window ending past 1 would leave it short of its spot.
const rowRange = (index: number, total: number): [number, number] => {
  const start = 0.3 + (total > 1 ? (index * 0.3) / (total - 1) : 0);
  return [start, start + 0.35];
};

function JobsList({ from }: { from: "left" | "right" }) {
  return (
    <ul className="divide-y divide-paper/10 border-t border-paper/10">
      {jobs.map((job, index) => (
        <Slide key={job.route} from={from} range={rowRange(index, jobs.length)}>
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium">{job.route}</p>
              <p className="text-xs text-paper/50">{job.detail}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium tabular-nums">{job.pay}</p>
              <p className="text-xs text-paper/50">{job.xp}</p>
            </div>
          </div>
        </Slide>
      ))}
    </ul>
  );
}

function LogbookTable({ from }: { from: "left" | "right" }) {
  return (
    <div className="border-t border-paper/10 text-sm">
      <div className="grid grid-cols-[1fr_1.6fr_1fr_1fr] pt-3 pb-2 text-xs font-medium text-paper/50">
        <span>Date</span>
        <span>Route</span>
        <span>Time</span>
        <span className="text-right">Landing</span>
      </div>
      <ul className="divide-y divide-paper/10">
        {flights.map((flight, index) => (
          <Slide key={flight.date} from={from} range={rowRange(index, flights.length)}>
            <div className="grid grid-cols-[1fr_1.6fr_1fr_1fr] py-3.5">
              <span className="text-paper/50">{flight.date}</span>
              <span className="font-medium">{flight.route}</span>
              <span className="tabular-nums">{flight.time}</span>
              <span className="text-right tabular-nums text-paper/70">{flight.landing}</span>
            </div>
          </Slide>
        ))}
      </ul>
    </div>
  );
}

function LandingTrace() {
  const progress = useScrollProgress();
  // The trace draws with the scroll and the touchdown dot lands at the end of it.
  const pathLength = useTransform(progress, [0.3, 0.85], [0, 1]);
  const dot = useTransform(progress, [0.82, 0.9], [0, 1]);

  return (
    <>
      <svg viewBox="0 0 300 70" className="w-full" aria-hidden>
        <g stroke="currentColor" strokeOpacity={0.12}>
          <line x1="0" y1="35" x2="300" y2="35" />
          <line x1="0" y1="60" x2="300" y2="60" />
        </g>
        <motion.path
          d={descent}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ pathLength }}
        />
        <motion.circle cx="300" cy="60" r="4" fill="currentColor" style={{ opacity: dot, scale: dot }} />
      </svg>
      <div className="mt-6 flex items-end justify-between">
        <Slide from="left" range={[0.5, 0.9]}>
          <p className="display text-5xl tabular-nums sm:text-6xl">
            -138<span className="ml-1.5 text-lg font-medium text-paper/50">fpm</span>
          </p>
        </Slide>
        <Slide from="right" range={[0.55, 0.95]}>
          <p className="text-right text-sm text-paper/60">
            1.12 G
            <br />
            3rd in your club
          </p>
        </Slide>
      </div>
    </>
  );
}

function RankLadder({ from }: { from: "left" | "right" }) {
  const progress = useScrollProgress();
  const scaleX = useTransform(progress, [0.6, 1], [0, 0.64]);

  return (
    <>
      <ol className="flex flex-col border-t border-paper/10 pt-1">
        {ranks.map((rank, index) => {
          const done = index <= 1;
          return (
            <Slide key={rank} from={from} range={rowRange(index, ranks.length)}>
              <div className="flex items-center gap-4 py-3">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                    done ? "border-paper bg-paper text-ink" : "border-paper/25 text-paper/50",
                  )}
                >
                  {index + 1}
                </span>
                <span className={cn("text-sm font-medium", !done && "text-paper/50")}>{rank}</span>
                {index === 1 && <span className="ml-auto text-xs text-paper/50">2,140 XP to Captain</span>}
              </div>
            </Slide>
          );
        })}
      </ol>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-paper/15">
        <motion.div style={{ scaleX }} className="h-full origin-left rounded-full bg-paper" />
      </div>
    </>
  );
}

const features = [
  {
    title: "Jobs From Where You Are",
    body: "Passenger and cargo jobs from the airport you are parked at, each with its pay and XP.",
    Visual: JobsList,
  },
  {
    title: "A Logbook That Fills Itself",
    body: "Every flight is recorded with its route, time and landing. You never type a line.",
    Visual: LogbookTable,
  },
  {
    title: "Every Landing Graded",
    body: "Touchdown rate and G on every arrival, ranked against the rest of your club.",
    Visual: LandingTrace,
  },
  {
    title: "Ranks",
    body: "XP from every job moves you up the ranks. Every aircraft is open from day one.",
    Visual: RankLadder,
  },
];

export function Features(): ReactElement {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="flex min-h-screen items-center bg-paper text-ink"
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:py-32">
        <ScrollGroup>
          <h2 id="features-title" className="display text-4xl sm:text-5xl md:text-6xl">
            <Words text="What You Get" />
          </h2>
        </ScrollGroup>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {features.map((feature, index) => {
            // Left-hand cards bring their content in from the left, right-hand from the right.
            const from = index % 2 === 0 ? "left" : "right";
            return (
              <ScrollGroup key={feature.title} className="h-full">
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="flex h-full flex-col rounded-3xl bg-ink p-7 text-paper sm:p-8"
                >
                  <Slide from="top" range={[0, 0.3]}>
                    <span className="text-sm font-semibold tabular-nums text-paper/35">0{index + 1}</span>
                  </Slide>
                  <h3 className="display mt-3 text-2xl sm:text-3xl">
                    <Words text={feature.title} range={[0.05, 0.5]} />
                  </h3>
                  <Slide from="bottom" range={[0.25, 0.55]}>
                    <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-paper/55">{feature.body}</p>
                  </Slide>
                  <div className="mt-8 flex-1">
                    <feature.Visual from={from} />
                  </div>
                </motion.div>
              </ScrollGroup>
            );
          })}
        </div>
      </div>
    </section>
  );
}
