"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ScrollGroup, Slide, Words } from "@/components/scroll-group";
import { AltitudeTape, Beam, Cockpit, Hatch, Pitched, RankLadder, RouteChart } from "@fs-career/ui/instruments";
import { MapBackdrop } from "@fs-career/ui/map";
import { cn } from "@fs-career/ui/cn";

// Sample data for the instruments: real airports, plausible numbers.
const KSEA = { code: "KSEA", lon: -122.3103, lat: 47.4479 };
const KPDX = { code: "KPDX", lon: -122.5975, lat: 45.5887 };
// The jobs card flies KSEA to KPDX and back, forever: a leg is the flight, then a rest on the ground in which the flown
// line lets go (the last FADE seconds), all one clock so nothing steps.
const FLY = 10;
const REST = 3.2;
const FADE = 1;
const LEG = FLY + REST;
const ranks = ["Cadet", "First Officer", "Captain", "Senior Captain"];
// The ranks card earns XP at one steady rate, climbing a rank every RANK_SECONDS. The ladder fades out once the top
// rank has been held a moment, and the climb starts again.
const RANK_SECONDS = 6;
const RANK_HOLD = 2.4;
const RANKS_CYCLE = (ranks.length - 1) * RANK_SECONDS + RANK_HOLD;
// The logbook's tape, once a second: a climb at 1,800 fpm, level at 5,000 ft, a descent at 1,200 fpm, level at
// 3,600 ft, and round again. It reads like a real aircraft because the change per reading is what a real one does in a second.
const CLIMB = 30;
const DESCENT = 20;
function altitude(second: number) {
  const t = second % 150;
  if (t < 65) return Math.min(5000, 3600 + t * CLIMB);
  if (t < 135) return 5000 - (t - 65) * DESCENT;
  return 3600;
}
// Pilots crossing the live map card, each on its own heading. Every flight starts and ends off the card (past its top,
// bottom or right edge), takes `period` seconds, and starts again from where it began, so pilots fly out of view and
// others fly in rather than jumping about. The speed is far faster than real, or nothing would seem to move, but
// under 1° a second: the map takes a bigger step between fixes for a new flight and would jump.
const flights = [
  { name: "Mara", club: true, from: [-127, 54.5], to: [-117, 36.5], period: 70, phase: 0 },
  { name: "Jonas", club: true, from: [-107, 40], to: [-131, 54.5], period: 90, phase: 40 },
  { name: "Priya", club: true, from: [-107, 50], to: [-150, 44], period: 140, phase: 90 },
  { name: "Theo", club: false, from: [-122, 54.5], to: [-107, 43], period: 65, phase: 20 },
  { name: "Lena", club: false, from: [-135, 54.5], to: [-112, 36.5], period: 95, phase: 60 },
  { name: "Omar", club: false, from: [-115, 36.5], to: [-140, 54.5], period: 100, phase: 30 },
] as const;

const RAD = Math.PI / 180;
const unit = ([lon, lat]: readonly [number, number]) =>
  [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)] as const;

// The point `f` of the way along the great circle between two places, and the compass bearing there towards the
// end. A pilot on this heading is going the way its aircraft points on a globe, which a straight line through
// longitude and latitude would not be.
function along(from: readonly [number, number], to: readonly [number, number], f: number) {
  const [a, b] = [unit(from), unit(to)];
  const angle = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const [s0, s1] = [Math.sin((1 - f) * angle) / Math.sin(angle), Math.sin(f * angle) / Math.sin(angle)];
  const p = [s0 * a[0] + s1 * b[0], s0 * a[1] + s1 * b[1], s0 * a[2] + s1 * b[2]] as const;
  const lat = Math.asin(p[2]) / RAD;
  const lon = Math.atan2(p[1], p[0]) / RAD;
  const [phi, phi2, dLon] = [lat * RAD, to[1] * RAD, (to[0] - lon) * RAD];
  const bearing = Math.atan2(
    Math.sin(dLon) * Math.cos(phi2),
    Math.cos(phi) * Math.sin(phi2) - Math.sin(phi) * Math.cos(phi2) * Math.cos(dLon),
  );
  return { lon, lat, heading: (bearing / RAD + 360) % 360 };
}

// Where each pilot is `second`s into the loop.
function pilotsAt(second: number) {
  return flights.map(({ name, club, from, to, period, phase }) => {
    const { lon, lat, heading } = along(from, to, ((second + phase) % period) / period);
    return { id: name, name, club, lon, lat, heading };
  });
}
// Time between handovers in the co-op card.
const HANDOVER_MS = 4000;

const lift = { whileHover: { y: -4 }, transition: { type: "spring" as const, stiffness: 400, damping: 30 } };

interface FeatureCardProps {
  label: string;
  title: string;
  body: string;
  /** Fills the card behind the text. */
  background?: ReactNode;
  /** Sits in the right half, bleeding off the edge. */
  art?: ReactNode;
  className?: string;
}

// The signed-in app's card, told as a feature: a label, a title, one line, and the live instrument the app shows for
// it. The text keeps to the left half so the instrument has the right.
function FeatureCard({ label, title, body, background, art, className }: FeatureCardProps): ReactElement {
  return (
    <motion.div
      {...lift}
      className={cn(
        "surface relative flex min-h-[300px] flex-col justify-center overflow-hidden rounded-[18px] px-7 py-8",
        className,
      )}
    >
      {background !== undefined && <div className="pointer-events-none absolute inset-0">{background}</div>}
      <div className="text-veil pointer-events-none absolute inset-y-0 left-0 z-[5] w-[56%]" />
      <p className="relative z-10 text-[13.5px] text-paper/55">{label}</p>
      <h3 className="display relative z-10 mt-1.5 max-w-[40%] text-[26px] leading-[1.15]">{title}</h3>
      {/* One short line, like the fact on an app card. */}
      <p className="relative z-10 mt-2 text-[14.5px] whitespace-nowrap text-muted">{body}</p>
      {art !== undefined && <div className="pointer-events-none absolute inset-y-0 right-0 w-[52%]">{art}</div>}
    </motion.div>
  );
}

// A clock for an instrument that moves continuously: seconds, counting from 0 to `seconds` and round again while the
// card is on screen. It rests at `rest` off screen and for visitors who prefer reduced motion. Everything it drives
// reads it as a motion value, so a frame of the loop is no React render.
function useClock(ref: RefObject<Element | null>, seconds: number, rest: number) {
  const visible = useInView(ref, { amount: 0.3 });
  const still = useReducedMotion();
  const clock = useMotionValue(rest);
  useEffect(() => {
    if (!visible || still === true) {
      clock.set(rest);
      return undefined;
    }
    clock.set(0);
    const run = animate(clock, [0, seconds], { duration: seconds, ease: "linear", repeat: Infinity });
    return () => {
      run.stop();
    };
  }, [visible, still, seconds, rest, clock]);
  return clock;
}

// 0..1 in, 0..1 out, eased at both ends like an aircraft leaving and arriving.
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// A step count that goes up every `ms` while the card is on screen, so each instrument plays a loop. It holds at 0
// off screen and for visitors who prefer reduced motion.
function useLoop(ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.3 });
  const still = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!visible || still === true) return undefined;
    const id = setInterval(() => {
      setStep((value) => value + 1);
    }, ms);
    return () => {
      clearInterval(id);
    };
  }, [visible, still, ms]);
  return [ref, step] as const;
}

function Jobs() {
  const ref = useRef<HTMLDivElement>(null);
  const clock = useClock(ref, LEG * 2, LEG * 0.45);
  // 0..1 is KSEA to KPDX, 1..2 the way back; a leg's time on the ground holds the end of its range.
  const progress = useTransform(clock, (v) => (v >= LEG ? 1 : 0) + smooth((v % LEG) / FLY));
  const fade = useTransform(clock, (v) => 1 - smooth(((v % LEG) - (LEG - FADE)) / FADE));
  return (
    <div ref={ref} className="h-full">
      <FeatureCard
        label="Jobs"
        title="Passengers and Cargo"
        body="Every job starts where you're parked."
        className="min-h-[240px]"
        background={<RouteChart from={KSEA} to={KPDX} progress={progress} fade={fade} />}
      />
    </div>
  );
}

function Logbook() {
  const [ref, step] = useLoop(1000);
  const feet = altitude(step);
  const next = altitude(step + 1);
  return (
    <div ref={ref} className="h-full">
      <FeatureCard
        label="Logbook"
        title="Every Flight Logged"
        body="Straight from the sim, nothing to type."
        background={<Hatch />}
        art={
          <Pitched pose="tape">
            <AltitudeTape feet={feet} climbing={next === feet ? undefined : next > feet} />
          </Pitched>
        }
      />
    </div>
  );
}

function Ranks() {
  const ref = useRef<HTMLDivElement>(null);
  const clock = useClock(ref, RANKS_CYCLE, RANK_SECONDS * 1.4);
  // One steady climb, then a rest at the top where the ladder fades out and the next climb fades in from the start.
  const level = useTransform(clock, (v) => Math.min(ranks.length - 1, v / RANK_SECONDS));
  const opacity = useTransform(clock, (v) => Math.min(smooth(v / 0.6), 1 - smooth((v - (RANKS_CYCLE - 0.8)) / 0.8)));
  return (
    <div ref={ref} className="h-full">
      <FeatureCard
        label="Ranks"
        title="Climb the Ranks"
        body="Every job earns XP."
        art={
          <motion.div style={{ opacity }} className="size-full">
            <RankLadder ranks={ranks} current={ranks[0]} progress={0} xpToNext={3000} level={level} />
          </motion.div>
        }
      />
    </div>
  );
}

function Coop() {
  // Control changes hands every few seconds while the card is on screen, the way it does in a real group.
  const [ref, step] = useLoop(HANDOVER_MS);
  const flying = step % 2 === 0;
  return (
    <div ref={ref} className="h-full">
      <FeatureCard
        label="Co-op"
        title="Two Pilots, One Aircraft"
        body="Move your controls to take over."
        background={<Beam />}
        art={
          <Cockpit
            seats={[
              { name: "Mara", flying },
              { name: "Jonas", flying: !flying },
            ]}
          />
        }
      />
    </div>
  );
}

function LiveMap() {
  // A fix a second, which the map glides between like a real feed.
  const [ref, step] = useLoop(1000);
  const pilots = useMemo(() => pilotsAt(step), [step]);
  return (
    <div ref={ref} className="h-full">
      <FeatureCard
        label="Live Map"
        title="Your Club in the Air"
        body="Who's flying right now, and where."
        background={<MapBackdrop focus={[-122.3, 46.6]} pilots={pilots} />}
      />
    </div>
  );
}

// A bento: wide and narrow swap sides each row, and jobs close it at full width. Each card slides in from its side.
const cards = [
  { key: "map", Card: LiveMap, span: "lg:col-span-7", from: "left" },
  { key: "coop", Card: Coop, span: "lg:col-span-5", from: "right" },
  { key: "logbook", Card: Logbook, span: "lg:col-span-5", from: "left" },
  { key: "ranks", Card: Ranks, span: "lg:col-span-7", from: "right" },
  { key: "jobs", Card: Jobs, span: "lg:col-span-12", from: "bottom" },
] as const;

export function Features(): ReactElement {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="flex min-h-screen items-center overflow-x-clip bg-ink-2 text-paper"
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:py-32">
        <ScrollGroup>
          <h2 id="features-title" className="display text-4xl sm:text-5xl md:text-6xl">
            <Words text="What You Get" />
          </h2>
        </ScrollGroup>

        <div className="mt-12 grid gap-4 lg:grid-cols-12">
          {cards.map(({ key, Card, span, from }) => (
            <ScrollGroup key={key} className={cn("h-full", span)}>
              <Slide from={from} range={[0, 0.5]} className="h-full">
                <Card />
              </Slide>
            </ScrollGroup>
          ))}
        </div>
      </div>
    </section>
  );
}
