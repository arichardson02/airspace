import { alongOf, pointAt, type RoutePath } from "./route-path";
import type { LonLat, Pilot } from "./types";

const METRES_PER_DEGREE = 111320;
const METRES_PER_SECOND_PER_KNOT = 0.514444;
const MAX_FIXES = 8;
const OFFSET_SAMPLES = 16;
const MIN_INTERVAL = 0.2;
const MAX_INTERVAL = 5;
// Aircraft are drawn a little more than the slowest recent gap between fixes in the past (clamped), so there are
// almost always two fixes to interpolate between. Sizing it to the slowest gap, not the average, keeps it steady
// when the feed's pace wobbles.
const DELAY_GAPS = 1.15;
const GAP_SAMPLES = 8;
const MIN_DELAY = 1;
const MAX_DELAY = 3;
// The delay changes by at most these fractions of real time, which is how much faster or slower the aircraft looks
// while it does. It grows briskly to cover a slower feed and shrinks gently, where nobody can see it.
const DELAY_GROW = 0.05;
const DELAY_SHRINK = 0.005;
// After running out of fixes the aircraft coasts for two intervals (enough to ride over one lost update), then holds.
const COAST_INTERVALS = 2;
const EASE_SECONDS = 1;
const EASE_METRES = 1000;
// A fix this far from the last one is a new flight, not movement.
const JUMP_DEGREES = 1;
const TRAIL_EVERY_MS = 250;
const TRAIL_LENGTH = 24;

interface Fix {
  /** On this machine's clock, in ms. */
  t: number;
  /** As the sender stamped it, in ms. */
  sent: number;
  lon: number;
  lat: number;
  heading: number;
  groundspeed?: number;
  /** Degrees a second. */
  vLon: number;
  vLat: number;
  /** On a route: metres along it and metres a second. */
  along: number;
  vAlong: number;
}

/** What the map keeps for one pilot: the last few fixes and the state of the drawn aircraft. */
export interface Track {
  fixes: Fix[];
  /** The pilot's route. The aircraft is held to it, and fixes are measured along it. */
  path: RoutePath | null;
  /** Arrival time minus sent time for recent fixes; the smallest tells the sender's clock apart from ours. */
  lags: number[];
  /** Seconds between fixes, smoothed. */
  interval: number;
  /** The last few gaps between fixes, in seconds. */
  gaps: number[];
  /** How far in the past the aircraft is drawn, in ms. It follows the interval slowly so the time it shows never jumps. */
  delay: number;
  delayAt: number;
  extrapolating: boolean;
  /** Where the aircraft was last drawn (metres along the route on a route). */
  drawn: LonLat | null;
  /** A jump left by running out of fixes, closing to zero. */
  correction: LonLat;
  correctionAt: number;
  trail: LonLat[];
  trailAt: number;
}

export interface Placed {
  lon: number;
  lat: number;
  /** Compass degrees. */
  heading: number;
  /** Metres along the route, for an aircraft on one. */
  along?: number;
}

// The velocity along a heading at a speed, in degrees a second.
function fromSpeed(knots: number, heading: number, lat: number): LonLat {
  const metres = knots * METRES_PER_SECOND_PER_KNOT;
  const radians = (heading * Math.PI) / 180;
  return [
    (metres * Math.sin(radians)) / (METRES_PER_DEGREE * Math.max(0.05, Math.cos((lat * Math.PI) / 180))),
    (metres * Math.cos(radians)) / METRES_PER_DEGREE,
  ];
}

// The compass heading of a velocity in degrees a second, or `fallback` when it is too slow to tell.
function headingOf(vLon: number, vLat: number, lat: number, fallback: number): number {
  const east = vLon * Math.cos((lat * Math.PI) / 180);
  if (Math.hypot(east, vLat) < 1e-9) return fallback;
  return ((Math.atan2(east, vLat) * 180) / Math.PI + 360) % 360;
}

// A reported speed of zero is the same as none: the tangents then come from the positions.
const hasSpeed = (knots: number | undefined): knots is number => knots !== undefined && knots !== 0;

const lagOf = (track: Track) => Math.min(...track.lags);

function fixFrom(pilot: Pilot, sent: number, lag: number): Fix {
  const [vLon, vLat] = hasSpeed(pilot.groundspeed) ? fromSpeed(pilot.groundspeed, pilot.heading, pilot.lat) : [0, 0];
  return {
    t: sent + lag,
    sent,
    lon: pilot.lon,
    lat: pilot.lat,
    heading: pilot.heading,
    groundspeed: pilot.groundspeed,
    vLon,
    vLat,
    along: 0,
    vAlong: 0,
  };
}

// On a route a fix is its distance along the line; the speed is the groundspeed, or what the neighbouring fixes imply.
function measure(track: Track) {
  const { fixes, path } = track;
  if (!path) return;
  for (const fix of fixes) fix.along = alongOf(path, fix.lon, fix.lat);
  fixes.forEach((fix, i) => {
    if (hasSpeed(fix.groundspeed)) {
      fix.vAlong = fix.groundspeed * METRES_PER_SECOND_PER_KNOT;
      return;
    }
    const before = fixes[Math.max(0, i - 1)];
    const after = fixes[Math.min(fixes.length - 1, i + 1)];
    const seconds = (after.sent - before.sent) / 1000;
    fix.vAlong = seconds > 0 ? (after.along - before.along) / seconds : 0;
  });
}

/** Holds a track to a route (or frees it). Fixes already kept are measured along the new line. */
function follow(track: Track, path: RoutePath | null) {
  if (track.path === path) return;
  track.path = path;
  track.drawn = null;
  track.correction = [0, 0];
  track.extrapolating = false;
  measure(track);
}

function fresh(pilot: Pilot, sent: number, now: number, path: RoutePath | null): Track {
  const track: Track = {
    fixes: [fixFrom(pilot, sent, now - sent)],
    path: null,
    lags: [now - sent],
    interval: 1,
    gaps: [],
    delay: 0,
    delayAt: 0,
    extrapolating: false,
    drawn: null,
    correction: [0, 0],
    correctionAt: 0,
    trail: [],
    trailAt: 0,
  };
  follow(track, path);
  return track;
}

// An update that adds nothing: unstamped and unchanged, or stamped no later than the newest fix.
function isRepeat(newest: Fix, pilot: Pilot, sent: number): boolean {
  if (pilot.t !== undefined) return sent <= newest.sent;
  return (
    newest.lon === pilot.lon &&
    newest.lat === pilot.lat &&
    newest.heading === pilot.heading &&
    newest.groundspeed === pilot.groundspeed
  );
}

// Without a groundspeed the tangents come from the positions: backward at the new fix, centred at the one before.
function tangentsFromPositions(track: Track, fix: Fix, newest: Fix, seconds: number): void {
  fix.vLon = (fix.lon - newest.lon) / seconds;
  fix.vLat = (fix.lat - newest.lat) / seconds;
  const before = track.fixes.at(-2);
  if (before) {
    const span = (fix.sent - before.sent) / 1000;
    newest.vLon = (fix.lon - before.lon) / span;
    newest.vLat = (fix.lat - before.lat) / span;
  } else {
    newest.vLon = fix.vLon;
    newest.vLat = fix.vLat;
  }
}

/** Takes a pilot's latest update. A missing `t` is stamped now; stale, out of order and repeated fixes are dropped. */
export function receive(track: Track | undefined, pilot: Pilot, now: number, path: RoutePath | null): Track {
  const sent = pilot.t ?? now;
  if (!track) return fresh(pilot, sent, now, path);
  follow(track, path);
  const newest = track.fixes[track.fixes.length - 1];
  if (isRepeat(newest, pilot, sent)) return track;
  if (Math.hypot(pilot.lon - newest.lon, pilot.lat - newest.lat) > JUMP_DEGREES) return fresh(pilot, sent, now, path);

  track.lags.push(now - sent);
  if (track.lags.length > OFFSET_SAMPLES) track.lags.shift();
  const fix = fixFrom(pilot, sent, lagOf(track));
  if (fix.t <= newest.t) return track;

  const seconds = (sent - newest.sent) / 1000;
  track.interval = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, track.interval + (seconds - track.interval) * 0.3));
  track.gaps.push(seconds);
  if (track.gaps.length > GAP_SAMPLES) track.gaps.shift();
  if (!hasSpeed(pilot.groundspeed) && seconds > 0) tangentsFromPositions(track, fix, newest, seconds);
  track.fixes.push(fix);
  if (track.fixes.length > MAX_FIXES) track.fixes.shift();
  measure(track);
  return track;
}

/** The newest fix as it came, for when nothing is animating. */
export function latest(track: Track): Placed {
  const fix = track.fixes[track.fixes.length - 1];
  return track.path ? pointAt(track.path, fix.along) : { lon: fix.lon, lat: fix.lat, heading: fix.heading };
}

// The weights of a cubic Hermite curve at `u`, and of its derivative.
function hermite(u: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  return {
    h00: 2 * u3 - 3 * u2 + 1,
    h10: u3 - 2 * u2 + u,
    h01: -2 * u3 + 3 * u2,
    h11: u3 - u2,
    d00: 6 * u2 - 6 * u,
    d10: 3 * u2 - 4 * u + 1,
    d11: 3 * u2 - 2 * u,
  };
}

// A cubic Hermite curve through two fixes using their velocities as tangents: the path and its heading have no
// corners, and the speed does not jump at a fix.
function between(a: Fix, b: Fix, time: number): Placed {
  const span = (b.t - a.t) / 1000;
  const w = hermite((time - a.t) / (b.t - a.t));
  const lon = w.h00 * a.lon + w.h10 * span * a.vLon + w.h01 * b.lon + w.h11 * span * b.vLon;
  const lat = w.h00 * a.lat + w.h10 * span * a.vLat + w.h01 * b.lat + w.h11 * span * b.vLat;
  const vLon = (w.d00 * (a.lon - b.lon)) / span + w.d10 * a.vLon + w.d11 * b.vLon;
  const vLat = (w.d00 * (a.lat - b.lat)) / span + w.d10 * a.vLat + w.d11 * b.vLat;
  return { lon, lat, heading: headingOf(vLon, vLat, lat, a.heading) };
}

// The same curve in one dimension, for an aircraft held to a route: metres along it.
function alongBetween(a: Fix, b: Fix, time: number): number {
  const span = (b.t - a.t) / 1000;
  const w = hermite((time - a.t) / (b.t - a.t));
  return w.h00 * a.along + w.h10 * span * a.vAlong + w.h01 * b.along + w.h11 * span * b.vAlong;
}

// The index of the fix at or before `time`; callers have checked that time is inside the buffer.
function bracket(fixes: Fix[], time: number): number {
  let i = 0;
  while (fixes[i + 1].t <= time) i++;
  return i;
}

// 0 once a correction has played out, 1 when it starts.
function remaining(track: Track, now: number): number {
  const s = Math.min(1, (now - track.correctionAt) / (EASE_SECONDS * 1000));
  return 1 - (3 * s * s - 2 * s * s * s);
}

// The moment an aircraft is being placed for: the time it shows, and where that sits against the newest fix.
interface Moment {
  now: number;
  /** The time shown, a delay behind `now`. */
  time: number;
  last: Fix;
  /** Seconds of coasting past the newest fix. */
  coast: number;
  /** Past the newest fix (an underrun), so the aircraft carries on along its velocity for a while, then holds. */
  extrapolating: boolean;
}

// Moves the delay towards the wanted one at a bounded rate and returns the moment to place for.
function momentOf(track: Track, now: number): Moment {
  const { fixes } = track;
  const slowest = track.gaps.length > 0 ? Math.max(...track.gaps) : track.interval;
  const wanted = Math.min(MAX_DELAY, Math.max(MIN_DELAY, slowest * DELAY_GAPS)) * 1000;
  if (track.delayAt === 0) track.delay = wanted;
  const elapsed = Math.max(0, now - track.delayAt);
  track.delay += Math.max(-DELAY_SHRINK * elapsed, Math.min(DELAY_GROW * elapsed, wanted - track.delay));
  track.delayAt = now;
  const time = now - track.delay;
  const last = fixes[fixes.length - 1];
  const extrapolating = time >= last.t;
  const coast = extrapolating ? Math.min((time - last.t) / 1000, track.interval * COAST_INTERVALS) : 0;
  return { now, time, last, coast, extrapolating };
}

// Metres along the route at the moment, from the fixes' distances along it.
function alongAt(track: Track, path: RoutePath, { time, last, coast, extrapolating }: Moment): number {
  const { fixes } = track;
  let along: number;
  if (extrapolating) along = last.along + last.vAlong * coast;
  else if (time <= fixes[0].t) along = fixes[0].along;
  else {
    const i = bracket(fixes, time);
    along = alongBetween(fixes[i], fixes[i + 1], time);
  }
  return Math.max(0, Math.min(path.length, along));
}

function placeOnRoute(track: Track, path: RoutePath, moment: Moment): Placed {
  const along = alongAt(track, path, moment);
  // After an underrun the line may not pass where the aircraft was drawn: a big gap is eased out.
  if (track.extrapolating && !moment.extrapolating && track.drawn && Math.abs(track.drawn[0] - along) > EASE_METRES) {
    track.correction = [track.drawn[0] - along, 0];
    track.correctionAt = moment.now;
  }
  track.extrapolating = moment.extrapolating;
  const shown = Math.max(0, Math.min(path.length, along + track.correction[0] * remaining(track, moment.now)));
  track.drawn = [shown, 0];
  return pointAt(path, shown);
}

// Where the fixes put an aircraft that is free of any route, before any correction.
function freeAt(fixes: Fix[], { time, last, coast, extrapolating }: Moment): Placed {
  if (extrapolating) {
    const lat = last.lat + last.vLat * coast;
    return { lon: last.lon + last.vLon * coast, lat, heading: headingOf(last.vLon, last.vLat, lat, last.heading) };
  }
  if (time <= fixes[0].t) return { lon: fixes[0].lon, lat: fixes[0].lat, heading: fixes[0].heading };
  const i = bracket(fixes, time);
  return between(fixes[i], fixes[i + 1], time);
}

function placeFree(track: Track, moment: Moment): Placed {
  const placed = freeAt(track.fixes, moment);
  if (track.extrapolating && !moment.extrapolating && track.drawn) {
    const dLon = track.drawn[0] - placed.lon;
    const dLat = track.drawn[1] - placed.lat;
    const metres = Math.hypot(dLon * Math.cos((placed.lat * Math.PI) / 180), dLat) * METRES_PER_DEGREE;
    if (metres > EASE_METRES) {
      track.correction = [dLon, dLat];
      track.correctionAt = moment.now;
    }
  }
  track.extrapolating = moment.extrapolating;
  const k = remaining(track, moment.now);
  placed.lon += track.correction[0] * k;
  placed.lat += track.correction[1] * k;
  track.drawn = [placed.lon, placed.lat];
  return placed;
}

/** Where the aircraft is at `now` (ms): the path through the fixes as they were a moment ago. */
export function place(track: Track, now: number): Placed {
  const moment = momentOf(track, now);
  return track.path ? placeOnRoute(track, track.path, moment) : placeFree(track, moment);
}

/** Adds the drawn position to the pilot's trail every quarter second. */
export function record(track: Track, at: LonLat, now: number): void {
  if (now - track.trailAt < TRAIL_EVERY_MS) return;
  track.trailAt = now;
  track.trail.push(at);
  if (track.trail.length > TRAIL_LENGTH) track.trail.shift();
}
