"use client";

import { useEffect, useMemo, type ReactElement } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, MotionValue } from "framer-motion";
import { geoInterpolate, geoMercator, geoPath } from "d3-geo";
import { useAirports } from "../map/airports";
import type { Airport, LonLat } from "../map/types";
import { landIn, useLand, type Land } from "../map/land";
import { useSize } from "../map/use-size";
import { follow, round, useSvgId } from "./svg";

// Points along the great circle, enough that the line reads smooth.
const POINTS = 64;
// The route is fitted into the card's right part, leaving room around it for the airport codes.
const ART_LEFT = 0.45;
const PAD = { top: 30, right: 56, bottom: 30, left: 24 };
const NEARBY = 2;
// How far a nearby airport must be from either end, in pixels.
const CLEAR = 36;

interface Place {
  code: string;
  lon: number;
  lat: number;
}

interface RouteChartProps {
  from: Place;
  to: Place;
  /**
   * How far along the route the aircraft is: 0..1 flies from `from` to `to`, and 1..2 flies back again. A number is
   * sprung to; a motion value is followed exactly, for a flight a clock drives frame by frame.
   */
  progress: number | MotionValue<number>;
  /** Opacity of the flown line, for letting it go once the aircraft has landed. */
  fade?: MotionValue<number>;
}

// The route as projected points, the land in view, and the nearest other airports, for one route and box size. The
// coast and the airports are left out until their data has loaded.
function chart(from: Place, to: Place, width: number, height: number, coast: Land | null, airports: Airport[]) {
  const along = geoInterpolate([from.lon, from.lat], [to.lon, to.lat]);
  const route = Array.from({ length: POINTS }, (_, i) => along(i / (POINTS - 1)));
  // Fit the route's mercator bounds into the art box; the land then runs out to fill the whole card around it.
  const unit = geoMercator().scale(1).translate([0, 0]);
  const flat = route.map((p) => unit(p) ?? [0, 0]);
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const box = {
    left: width * ART_LEFT + PAD.left,
    right: width - PAD.right,
    top: PAD.top,
    bottom: height - PAD.bottom,
  };
  const spanX = Math.max(...xs) - Math.min(...xs) || 1e-6;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1e-6;
  const scale = Math.min((box.right - box.left) / spanX, (box.bottom - box.top) / spanY);
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const projection = geoMercator()
    .scale(scale)
    .translate([(box.left + box.right) / 2 - midX * scale, (box.top + box.bottom) / 2 - midY * scale])
    .clipExtent([
      [-8, -8],
      [width + 8, height + 8],
    ]);

  const [west, north] = projection.invert?.([0, 0]) ?? [-180, 85];
  const [east, south] = projection.invert?.([width, height]) ?? [180, -85];
  const land = coast ? (geoPath(projection).digits(1)(landIn(coast, { west, east, south, north })) ?? "") : "";
  const points = route.map((p): LonLat => projection(p) ?? [0, 0]);
  const at = (place: Place): LonLat => projection([place.lon, place.lat]) ?? [0, 0];
  const ends = { from: at(from), to: at(to) };

  // The other airports closest to the route that land inside the art box.
  const candidates = airports
    .filter(({ code }) => code !== from.code && code !== to.code)
    .map((airport) => {
      const [x, y] = at(airport);
      return Object.assign(airport, {
        x,
        y,
      });
    })
    .filter(({ x, y }) => x > box.left && x < width - 20 && y > 12 && y < height - 12)
    // Not so close to either end that the codes collide.
    .filter(({ x, y }) => [ends.from, ends.to].every(([ex, ey]) => Math.hypot(ex - x, ey - y) > CLEAR))
    .map((airport) => {
      const { x, y } = airport;
      const closest = points.reduce((best, p) =>
        Math.hypot(p[0] - x, p[1] - y) < Math.hypot(best[0] - x, best[1] - y) ? p : best,
      );
      // The code goes on the side away from the route, so the line and the aircraft never cross it.
      return Object.assign(airport, {
        distance: Math.hypot(closest[0] - x, closest[1] - y),
        left: x < closest[0],
      });
    })
    .toSorted((a, b) => a.distance - b.distance);
  // The closest few, skipping any so close to one already picked that their codes would collide.
  const nearby: typeof candidates = [];
  for (const airport of candidates) {
    if (nearby.length < NEARBY && nearby.every(({ x, y }) => Math.hypot(x - airport.x, y - airport.y) > CLEAR)) {
      nearby.push(airport);
    }
  }

  return { land, points, ...ends, nearby };
}

// The route from its start to t (0..1) as path data, and where the aircraft is.
function flownTo(points: LonLat[], t: number) {
  const end = t * (points.length - 1);
  const whole = Math.floor(end);
  const part: LonLat[] = points.slice(0, whole + 1);
  const next = points[Math.min(points.length - 1, whole + 1)];
  const last = points[whole];
  const f = end - whole;
  const tip: LonLat = [last[0] + (next[0] - last[0]) * f, last[1] + (next[1] - last[1]) * f];
  part.push(tip);
  return { d: `M ${part.map(([x, y]) => `${round(x)} ${round(y)}`).join(" L ")}`, tip };
}

// Where the aircraft is along the route, as a motion value either way: a number is sprung to and a motion value is
// followed as it is.
function useRouteProgress(progress: number | MotionValue<number>): MotionValue<number> {
  const still = useReducedMotion();
  const driven = progress instanceof MotionValue;
  const sprung = useSpring(driven ? 0 : progress, { stiffness: 60, damping: 16 });
  useEffect(() => {
    if (!driven) follow(sprung, progress, still);
  }, [sprung, driven, progress, still]);
  return driven ? progress : sprung;
}

// The flown part of the route as path data, and the aircraft's position, both updated as `t` moves with no render.
function useFlight(points: LonLat[] | undefined, t: MotionValue<number>) {
  const flown = useMotionValue("");
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  useEffect(() => {
    if (!points) return undefined;
    const back = [...points].toReversed();
    const update = (v: number): void => {
      const returning = v > 1;
      const { d, tip } = flownTo(returning ? back : points, Math.min(1, Math.max(0, returning ? v - 1 : v)));
      flown.set(d);
      x.set(tip[0]);
      y.set(tip[1]);
    };
    update(t.get());
    return t.on("change", update);
  }, [points, t, flown, x, y]);
  return { flown, x, y };
}

type Chart = ReturnType<typeof chart>;

interface AirportLabelsProps {
  nearby: Chart["nearby"];
  ends: { code: string; at: LonLat }[];
}

// The two ends ringed and labelled, and the nearby airports dim.
function AirportLabels({ nearby, ends }: AirportLabelsProps): ReactElement {
  return (
    <g fontSize={10} fill="currentColor">
      {nearby.map(({ code, x, y, left }) => (
        <g key={code}>
          <circle cx={x} cy={y} r={3} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.4} />
          <text
            x={left ? x - 9 : x + 9}
            y={y + 4}
            textAnchor={left ? "end" : "start"}
            fontWeight={500}
            fillOpacity={0.35}
          >
            {code}
          </text>
        </g>
      ))}
      {ends.map(({ code, at: [x, y] }) => (
        <g key={code}>
          <circle cx={x} cy={y} r={4.5} fill="none" stroke="currentColor" strokeOpacity={0.8} strokeWidth={1.4} />
          <text x={x + 10} y={y + 4} fontWeight={600} fillOpacity={0.75}>
            {code}
          </text>
        </g>
      ))}
    </g>
  );
}

// The last flight over the real coastline: land a faint fill with a hairline coast, the great-circle route dashed
// with the flown part solid up to the aircraft, the two airports ringed and up to two nearby ones dim. The coast is
// worked out once per route and size; only the flown line and the aircraft move. Give it as `background`.
export function RouteChart({ from, to, progress, fade }: RouteChartProps): ReactElement {
  const id = useSvgId();
  const [ref, { width, height }] = useSize();
  const coast = useLand();
  // Only the bigger airports: a small field beside the route says nothing about the flight.
  const large = useAirports("large");
  const medium = useAirports("medium");
  const map = useMemo(
    () => (width ? chart(from, to, width, height, coast, [...(large ?? []), ...(medium ?? [])]) : undefined),
    [from, to, width, height, coast, large, medium],
  );

  const t = useRouteProgress(progress);
  const { flown, x, y } = useFlight(map?.points, t);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0">
      {map && (
        <svg width={width} height={height} aria-hidden className="absolute inset-0 text-paper">
          <defs>
            {/* The land fades toward the text but never quite goes. */}
            <linearGradient id={`${id}-ramp`}>
              <stop offset={0} stopColor="white" stopOpacity={0.2} />
              <stop offset={0.55} stopColor="white" stopOpacity={0.8} />
              <stop offset={1} stopColor="white" />
            </linearGradient>
            <mask id={`${id}-fade`}>
              <rect width={width} height={height} fill={`url(#${id}-ramp)`} />
            </mask>
          </defs>
          <path
            d={map.land}
            mask={`url(#${id}-fade)`}
            fill="currentColor"
            fillOpacity={0.035}
            stroke="currentColor"
            strokeOpacity={0.16}
          />
          <path
            d={`M ${map.points.map(([px, py]) => `${round(px)} ${round(py)}`).join(" L ")}`}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeDasharray="3 4"
          />
          <motion.path
            d={flown}
            style={{ opacity: fade }}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <AirportLabels
            nearby={map.nearby}
            ends={[
              { code: from.code, at: map.from },
              { code: to.code, at: map.to },
            ]}
          />
          <motion.g style={{ x, y }}>
            <circle r={3.5} fill="currentColor" />
            <circle r={8} fill="none" stroke="currentColor" strokeOpacity={0.35} />
          </motion.g>
        </svg>
      )}
    </div>
  );
}
