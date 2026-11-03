"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { seeded } from "@fs-career/ui/instruments";
import { Map as LiveMap, MAX_ZOOM, MIN_ZOOM, type Pilot, type Route } from "@fs-career/ui/map";
import { Knob, Range, Toggle } from "./knobs";

type Place = [number, number];
const KSEA: Place = [-122.31, 47.45];
const KPDX: Place = [-122.6, 45.59];
const CYVR: Place = [-123.18, 49.19];
const KGEG: Place = [-117.53, 47.62];
const KEUG: Place = [-123.21, 44.12];
const KSFO: Place = [-122.37, 37.62];
const KBLI: Place = [-122.54, 48.79];
const KYKM: Place = [-120.54, 46.57];

interface Flight {
  id: string;
  name: string;
  altitude?: string;
  club?: boolean;
  from: Place;
  to: Place;
  /** How far along the route, 0 to 1. */
  start: number;
}

// Six pilots in the Pacific Northwest and the viewer, each partway along a route.
const FLIGHTS: Flight[] = [
  { id: "sam", name: "Sam", altitude: "FL240", club: true, from: KSEA, to: KPDX, start: 0.45 },
  { id: "jordan", name: "Jordan", altitude: "8,500", club: true, from: CYVR, to: KSEA, start: 0.7 },
  { id: "alex", name: "Alex", altitude: "FL180", club: true, from: KSEA, to: KGEG, start: 0.3 },
  { id: "priya", name: "Priya", altitude: "FL200", from: KPDX, to: KEUG, start: 0.55 },
  { id: "noah", name: "Noah", altitude: "FL310", from: KSEA, to: KSFO, start: 0.12 },
  { id: "air12", name: "AIR12", altitude: "6,000", from: KBLI, to: KSEA, start: 0.85 },
  { id: "you", name: "You", from: KSEA, to: KYKM, start: 0.02 },
];

const KNOTS = 450;
// A real airliner would barely move on this map, so the lab flies faster and reports the faster speed.
const SPEEDUP = 30;
const METRES_PER_DEGREE = 111320;
const METRES_PER_SECOND_PER_KNOT = 0.514444;
// Like a real feed: a fix every 0.8 to 1.5 s, one in ten lost, positions good to about 30 m.
const MIN_GAP_MS = 800;
const MAX_GAP_MS = 1500;
const DROP_RATE = 0.1;
const NOISE_METRES = 30;

const ROUTES: Route[] = FLIGHTS.map(({ id, from, to }) => ({ pilotId: id, from, to }));

// Background traffic without routes, wandering the Pacific Northwest.
function traffic(count: number): Flight[] {
  const next = seeded(7);
  return Array.from({ length: count }, (_, i) => {
    const from: Place = [-124 + next() * 6, 44 + next() * 5];
    const angle = next() * Math.PI * 2;
    const reach = 1.5 + next() * 2.5;
    const to: Place = [from[0] + Math.cos(angle) * reach, from[1] + Math.sin(angle) * reach * 0.7];
    return { id: `x${i}`, name: `N${100 + i}`, from, to, start: 0.05 + next() * 0.9 };
  });
}

const lengthOf = ({ from, to }: Flight) =>
  Math.hypot(
    (to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180) * METRES_PER_DEGREE,
    (to[1] - from[1]) * METRES_PER_DEGREE,
  );

function headingOf({ from, to }: Flight) {
  const east = (to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180);
  return ((Math.atan2(east, to[1] - from[1]) * 180) / Math.PI + 360) % 360;
}

// A pilot partway along a flight. A straight lerp is plenty over a few hundred miles.
function pilotAt(flight: Flight, progress: number, noise: boolean, t?: number): Pilot {
  let lon = flight.from[0] + (flight.to[0] - flight.from[0]) * progress;
  let lat = flight.from[1] + (flight.to[1] - flight.from[1]) * progress;
  if (noise) {
    lon += ((Math.random() * 2 - 1) * NOISE_METRES) / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
    lat += ((Math.random() * 2 - 1) * NOISE_METRES) / METRES_PER_DEGREE;
  }
  return {
    id: flight.id,
    name: flight.name,
    altitude: flight.altitude,
    club: flight.club,
    lon,
    lat,
    heading: headingOf(flight),
    groundspeed: KNOTS * SPEEDUP,
    t,
  };
}

// Feeds the map like the real thing: each pilot sends its own fixes at an irregular pace, with the odd one lost.
function useFeed(flights: Flight[], flying: boolean): Pilot[] {
  const [fixes, setFixes] = useState<Record<string, Pilot>>({});
  // The first fixes carry no timestamp, so the map stamps them as they arrive.
  const initial = useMemo(() => Object.fromEntries(flights.map((f) => [f.id, pilotAt(f, f.start, false)])), [flights]);
  const progress = useRef<Record<string, { p: number; at: number } | undefined>>({});

  useEffect(() => {
    if (!flying) return undefined;
    const timers = flights.map((flight) => {
      const speed = KNOTS * SPEEDUP * METRES_PER_SECOND_PER_KNOT;
      const length = lengthOf(flight);
      const state = { p: progress.current[flight.id]?.p ?? flight.start, at: Date.now() };
      progress.current[flight.id] = state;
      let timer = 0;
      const emit = () => {
        const now = Date.now();
        const p = state.p + ((now - state.at) / 1000) * (speed / length);
        // Past the end the flight starts again from near its beginning.
        state.p = p > 0.98 ? 0.02 : p;
        state.at = now;
        if (Math.random() >= DROP_RATE) {
          setFixes((all) => ({
            ...all,
            [flight.id]: pilotAt(flight, state.p, true, Math.max(now, (all[flight.id]?.t ?? 0) + 1)),
          }));
        }
        timer = window.setTimeout(emit, MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
      };
      timer = window.setTimeout(emit, Math.random() * MAX_GAP_MS);
      return () => {
        window.clearTimeout(timer);
      };
    });
    return () => {
      timers.forEach((stop) => {
        stop();
      });
    };
  }, [flights, flying]);

  return useMemo(() => flights.map((f) => fixes[f.id] ?? initial[f.id]), [flights, fixes, initial]);
}

// The live map, with the knobs to drive it. Zoomed out it is a globe; zoomed in it flattens into a chart. Fly feeds
// the map like a real stream: fixes at an irregular pace with noise and gaps, so the smoothing is exercised.
export function MapCards(): ReactElement {
  const [view, setView] = useState<{ center: Place; zoom: number }>({ center: [-122.5, 46.4], zoom: 5.5 });
  const [fly, setFly] = useState(false);
  const [extra, setExtra] = useState(0);
  const flights = useMemo(() => [...FLIGHTS, ...traffic(extra)], [extra]);
  const pilots = useFeed(flights, fly);

  return (
    <>
      <div className="col-span-full flex flex-col gap-4">
        <div className="h-[560px] overflow-hidden rounded-2xl border border-paper/10 bg-paper/[0.03]">
          <LiveMap
            center={view.center}
            zoom={view.zoom}
            onViewChange={(center, zoom) => {
              setView({ center, zoom });
            }}
            pilots={pilots}
            routes={ROUTES}
            youId="you"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Toggle
            on={fly}
            label="Fly"
            onClick={() => {
              setFly((f) => !f);
            }}
          />
          <div className="min-w-64 flex-1">
            <Knob label="Zoom" value={view.zoom.toFixed(1)}>
              <Range
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.1}
                value={view.zoom}
                onChange={(zoom) => {
                  setView((v) => ({ ...v, zoom }));
                }}
              />
            </Knob>
          </div>
          <div className="min-w-64 flex-1">
            <Knob label="Traffic" value={String(extra)}>
              <Range min={0} max={60} value={extra} onChange={setExtra} />
            </Knob>
          </div>
        </div>
      </div>
    </>
  );
}
