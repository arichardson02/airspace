import { geoInterpolate } from "d3-geo";
import type { LonLat } from "./types";

const METRES_PER_DEGREE = 111320;
const STEPS = 64;

/** A route's great circle as points with the distance along it, so an aircraft can be held to the line. */
export interface RoutePath {
  points: LonLat[];
  /** Metres from the start to each point. */
  cum: number[];
  length: number;
  /** Compass degrees of each segment. */
  bearings: number[];
}

// Metres east and north between two nearby points.
function offset(a: LonLat, b: LonLat): LonLat {
  const lat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return [(b[0] - a[0]) * Math.cos(lat) * METRES_PER_DEGREE, (b[1] - a[1]) * METRES_PER_DEGREE];
}

export function routePath(from: LonLat, to: LonLat): RoutePath {
  const at = geoInterpolate(from, to);
  const points = Array.from({ length: STEPS + 1 }, (_, i) => at(i / STEPS));
  const cum = [0];
  const bearings: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const [east, north] = offset(points[i - 1], points[i]);
    cum.push(cum[i - 1] + Math.hypot(east, north));
    bearings.push(((Math.atan2(east, north) * 180) / Math.PI + 360) % 360);
  }
  return { points, cum, length: cum[cum.length - 1], bearings };
}

/** How far along the route the nearest point to `lon`, `lat` is, in metres. */
export function alongOf(path: RoutePath, lon: number, lat: number): number {
  let along = 0;
  let nearest = Infinity;
  for (let i = 0; i < path.points.length - 1; i++) {
    const [ex, ny] = offset(path.points[i], path.points[i + 1]);
    const [px, py] = offset(path.points[i], [lon, lat]);
    const span = ex * ex + ny * ny || 1;
    const t = Math.max(0, Math.min(1, (px * ex + py * ny) / span));
    const distance = (px - t * ex) ** 2 + (py - t * ny) ** 2;
    if (distance < nearest) {
      nearest = distance;
      along = path.cum[i] + t * (path.cum[i + 1] - path.cum[i]);
    }
  }
  return along;
}

// The angle a degrees of the way from `from` to `to`, going the short way.
const turn = (from: number, to: number, a: number) => from + (((((to - from) % 360) + 540) % 360) - 180) * a;

/** A place on a route with the heading there. */
export interface PathPoint {
  lon: number;
  lat: number;
  /** Compass degrees. */
  heading: number;
  /** Metres along the route. */
  along: number;
}

/** The point `along` metres down the route and which way the line points there, smoothed between segments. */
export function pointAt(path: RoutePath, along: number): PathPoint {
  const s = Math.max(0, Math.min(path.length, along));
  let i = 0;
  while (i < path.points.length - 2 && path.cum[i + 1] <= s) i++;
  const u = (s - path.cum[i]) / (path.cum[i + 1] - path.cum[i] || 1);
  const [a, b] = [path.points[i], path.points[i + 1]];
  const here = path.bearings[i];
  const heading =
    u < 0.5 && i > 0
      ? turn(path.bearings[i - 1], here, 0.5 + u)
      : u >= 0.5 && i < path.bearings.length - 1
        ? turn(here, path.bearings[i + 1], u - 0.5)
        : here;
  return { lon: a[0] + (b[0] - a[0]) * u, lat: a[1] + (b[1] - a[1]) * u, heading: (heading + 360) % 360, along: s };
}
