"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { ActionButton } from "@fs-career/ui/button";
import {
  AltitudeTape,
  Beam,
  Cockpit,
  DayChart,
  Hatch,
  Pitched,
  RankLadder,
  RouteChart,
  seeded,
  WindField,
} from "@fs-career/ui/instruments";
import { MapBackdrop, type Pilot } from "@fs-career/ui/map";
import { CardGrid, Page, StatCard } from "@fs-career/ui/shell";
import { Knob, Range, Toggle } from "./knobs";
import { MapCards } from "./map-cards";

const RANKS = ["Cadet", "First Officer", "Captain", "Senior Captain"];
// The XP between two ranks, so the XP knob can say how far along the track the pilot is.
const RANK_XP = 2000;
const FLIGHTS = [
  { route: "KLAX→KSEA", start: 7.5, end: 9.2 },
  { route: "KSEA→KPDX", start: 11, end: 13.5 },
  { route: "KPDX→KSEA", start: 14.1, end: 15.2 },
  { route: "KSEA→KSFO", start: 17.5, end: 19.6 },
];
// 1,200 fpm is 20 ft a second.
const CLIMB_FT_PER_TICK = 2;
const CLIMB_TICK_MS = 100;
const MAX_FEET = 40000;

// The first pilots are club pilots and carry a name.
const CLUB = ["Sam", "Jordan", "Alex"];
const HOME: [number, number] = [-122.31, 47.45];
const LAST_FROM = { code: "KLAX", lon: -118.408, lat: 33.9425 };
const LAST_TO = { code: "KSEA", lon: -122.3103, lat: 47.4479 };

// Pilots scattered around the Pacific Northwest, drawn from a seed so a shuffle gives new positions.
function nearby(count: number, seed: number) {
  const next = seeded(seed);
  return Array.from({ length: count }, (_, i): Pilot => ({
    id: `p${i}`,
    name: CLUB[i] ?? `N${100 + i}`,
    lon: HOME[0] + (next() - 0.5) * 14,
    lat: HOME[1] + (next() - 0.5) * 9,
    heading: next() * 360,
    club: i < CLUB.length,
  }));
}

// A beat after mount, so each knob visibly animates from its rest value.
function useQueryKnobs(set: {
  climbing: (on: boolean) => void;
  direction: (degrees: number) => void;
  speed: (knots: number) => void;
  feet: (feet: number) => void;
  now: (hours: number) => void;
  rank: (name: string) => void;
  flying: (seat: 0 | 1) => void;
}): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = new URLSearchParams(window.location.search);
      const numbers: [string, (value: number) => void][] = [
        ["wind", set.direction],
        ["speed", set.speed],
        ["feet", set.feet],
        ["now", set.now],
      ];
      if (query.has("climb")) set.climbing(true);
      for (const [key, apply] of numbers) {
        if (query.has(key)) apply(Number(query.get(key)));
      }
      if (query.has("rank")) set.rank(query.get("rank") ?? "Captain");
      if (query.has("flying")) set.flying(query.get("flying") === "1" ? 1 : 0);
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [set]);
}

function useClimb(climbing: boolean, setFeet: (update: (feet: number) => number) => void): void {
  useEffect(() => {
    if (!climbing) return undefined;
    const timer = setInterval(() => {
      setFeet((f) => Math.min(MAX_FEET, f + CLIMB_FT_PER_TICK));
    }, CLIMB_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [climbing, setFeet]);
}

interface PilotsCardProps {
  pilots: number;
  fleet: Pilot[];
  onPilots: (count: number) => void;
  onShuffle: () => void;
}

function PilotsCard({ pilots, fleet, onPilots, onShuffle }: PilotsCardProps): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <StatCard
        size="lg"
        label="Live map"
        value={`${pilots} ${pilots === 1 ? "pilot" : "pilots"} flying`}
        detail="Pacific Northwest"
        background={<MapBackdrop focus={HOME} pilots={fleet} />}
      />
      <Knob label="Pilots" value={String(pilots)}>
        <Range min={0} max={8} value={pilots} onChange={onPilots} />
      </Knob>
      <ActionButton size="sm" variant="ghost" className="self-start" onClick={onShuffle}>
        Shuffle
      </ActionButton>
    </div>
  );
}

interface AltitudeCardProps {
  feet: number;
  climbing: boolean;
  onFeet: (feet: number) => void;
  onClimb: () => void;
}

function AltitudeCard({ feet, climbing, onFeet, onClimb }: AltitudeCardProps): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <StatCard
        size="lg"
        label="Altitude"
        value={`${Math.round(feet).toLocaleString("en-US")} ft`}
        detail={climbing ? "Climbing · 1,200 fpm" : "Level"}
        background={<Hatch />}
        art={
          <Pitched pose="tape">
            <AltitudeTape feet={feet} climbing={climbing || undefined} />
          </Pitched>
        }
      />
      <Knob label="Feet" value={String(feet)}>
        <Range min={0} max={MAX_FEET} step={20} value={feet} onChange={onFeet} />
      </Knob>
      <Toggle on={climbing} label="Climb" onClick={onClimb} />
    </div>
  );
}

interface RankCardProps {
  rank: string;
  xp: number;
  onRank: (name: string) => void;
  onXp: (xp: number) => void;
}

function RankCard({ rank, xp, onRank, onXp }: RankCardProps): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <StatCard
        size="md"
        label="Rank"
        value={rank}
        detail={`${xp.toLocaleString("en-US")} XP to go`}
        art={<RankLadder ranks={RANKS} current={rank} progress={1 - xp / RANK_XP} xpToNext={xp} />}
      />
      <div className="flex flex-wrap gap-2">
        {RANKS.map((name) => (
          <Toggle
            key={name}
            on={rank === name}
            label={name}
            onClick={() => {
              onRank(name);
            }}
          />
        ))}
      </div>
      <Knob label="XP to go" value={String(xp)}>
        <Range min={0} max={RANK_XP} step={20} value={xp} onChange={onXp} />
      </Knob>
    </div>
  );
}

function CoopCard({ flying, onFlying }: { flying: 0 | 1; onFlying: () => void }): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <StatCard
        size="lg"
        label="Co-op · SKY123"
        value="Flying with Sam"
        detail={flying === 0 ? "You have control" : "Sam has control"}
        background={<Beam />}
        art={
          <Cockpit
            seats={[
              { name: "Cameron", flying: flying === 0 },
              { name: "Sam", flying: flying === 1 },
            ]}
          />
        }
      />
      <Toggle on={flying === 1} label="Sam flying" onClick={onFlying} />
    </div>
  );
}

// Each instrument in a card, with the knobs under it. `?climb`, `?feet=<n>`, `?wind=<degrees>`, `?speed=<kt>`,
// `?now=<hours>`, `?rank=<name>` and `?flying=<0|1>` set a knob on load, so a capture can start an animation
// without clicking.
export function Lab(): ReactElement {
  const [pilots, setPilots] = useState(6);
  const [seed, setSeed] = useState(1);
  // Memoised, so the map only takes new fixes when the pilots change.
  const fleet = useMemo(() => nearby(pilots, seed), [pilots, seed]);
  const [feet, setFeet] = useState(3400);
  const [climbing, setClimbing] = useState(false);
  const [direction, setDirection] = useState(0);
  const [speed, setSpeed] = useState(12);
  const [now, setNow] = useState(14.8);
  const [route, setRoute] = useState(0.78);
  const [flying, setFlying] = useState<0 | 1>(0);
  const [rank, setRank] = useState("Captain");
  const [xp, setXp] = useState(760);

  const knobSetters = useMemo(
    () => ({
      climbing: setClimbing,
      direction: setDirection,
      speed: setSpeed,
      feet: setFeet,
      now: setNow,
      rank: setRank,
      flying: setFlying,
    }),
    [],
  );
  useQueryKnobs(knobSetters);
  useClimb(climbing, setFeet);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <Page title="Instrument" accent="Lab" sub="Dev only. Every instrument takes live data and animates to it.">
        <CardGrid className="gap-x-6 gap-y-10 md:grid-cols-1 lg:grid-cols-2">
          <PilotsCard
            pilots={pilots}
            fleet={fleet}
            onPilots={setPilots}
            onShuffle={() => {
              setSeed((n) => n + 1);
            }}
          />
          <AltitudeCard
            feet={feet}
            climbing={climbing}
            onFeet={setFeet}
            onClimb={() => {
              setClimbing((c) => !c);
            }}
          />

          <div className="flex flex-col gap-4">
            <StatCard
              size="lg"
              label="KSEA weather"
              value={`Wind ${String(direction).padStart(3, "0")} at ${speed}`}
              detail="Gusting 18"
              background={<WindField direction={direction} speed={speed} />}
            />
            <Knob label="Direction" value={`${direction}°`}>
              <Range min={0} max={359} value={direction} onChange={setDirection} />
            </Knob>
            <Knob label="Speed" value={`${speed} kt`}>
              <Range min={0} max={40} value={speed} onChange={setSpeed} />
            </Knob>
          </div>

          <div className="flex flex-col gap-4">
            <StatCard
              size="lg"
              label="Last flight"
              value="KLAX → KSEA"
              detail="954 nm · 2h 41m"
              background={<RouteChart from={LAST_FROM} to={LAST_TO} progress={route} />}
            />
            <Knob label="Progress" value={route.toFixed(2)}>
              <Range min={0} max={1} step={0.01} value={route} onChange={setRoute} />
            </Knob>
          </div>

          <div className="flex flex-col gap-4">
            <StatCard
              size="md"
              label="Today"
              value="3 flights"
              detail="5h 12m · next at 17:30"
              background={<DayChart flights={FLIGHTS} now={now} />}
            />
            <Knob
              label="Now"
              value={`${String(Math.floor(now)).padStart(2, "0")}:${String(Math.round((now % 1) * 60)).padStart(2, "0")}`}
            >
              <Range min={0} max={24} step={0.1} value={now} onChange={setNow} />
            </Knob>
          </div>

          <RankCard rank={rank} xp={xp} onRank={setRank} onXp={setXp} />
          <CoopCard
            flying={flying}
            onFlying={() => {
              setFlying((f) => (f === 0 ? 1 : 0));
            }}
          />

          <MapCards />
        </CardGrid>
      </Page>
    </main>
  );
}
