import { label, paper } from "./label";
import type { RoutePath } from "./route-path";
import { latest, place, record, type Track } from "./tracks";
import type { LonLat, Pilot } from "./types";

// The airliner glyph, nose along +x, about 22 units long.
const PLANE =
  "M11 0 L7.5 1.2 L1.5 1.1 L-3 6.5 L-5 6.3 L-2.6 1 L-7.5 .8 L-9.2 2.6 L-10.6 2.4 L-9.6 0 L-10.6 -2.4 L-9.2 -2.6 L-7.5 -.8 L-2.6 -1 L-5 -6.3 L-3 -6.5 L1.5 -1.1 L7.5 -1.2 Z";
// The wing root, which the glyph is centred on so it turns about, and sits on, its position.
const CENTRE_X = -0.55;
// Built on first use: there is no Path2D while the page renders on the server.
let glyph: Path2D | undefined;
// Aircraft this far outside the box are not drawn.
const CULL = 60;
// The page's own font stack is passed in: next/font renames Inter, so the bare name may not resolve on a canvas.
const labelFont = (family: string): string => `600 12px ${family}`;
const detailFont = (family: string): string => `400 10px ${family}`;
const farFont = (family: string): string => `600 10px ${family}`;

export interface Line {
  id: string;
  club: boolean;
  path: RoutePath;
}

export interface Scene {
  /** Screen position of a place, or null where it cannot be seen (the far side of the globe). */
  project: (point: LonLat) => LonLat | null;
  routes: Line[];
  pilots: Pilot[];
  youId?: string;
  width: number;
  height: number;
  /** Zoomed out to a continent or more: aircraft are points, with no routes or trails, and only club pilots named. */
  far: boolean;
  /** The globe's edge on screen while it is still a globe, with how strongly to draw it (it fades as it flattens). */
  limb?: Limb;
}

export interface Limb {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

const RAD = Math.PI / 180;
// A step ahead along the heading, in degrees of arc, just far enough to measure the direction on screen.
const LOOK_AHEAD = 0.05;
// A pilot nearing the globe's edge fades out over this many pixels, as it goes over the horizon.
const EDGE_FADE = 28;

// Where the aircraft points on screen, in radians. A compass heading only means "up is north" on a flat chart; on a
// globe north leans with the view, so the heading is measured by projecting the aircraft and a point just ahead of it.
function screenAngle(project: Scene["project"], at: LonLat, [lon, lat]: LonLat, heading: number): number {
  const bearing = heading * RAD;
  const delta = LOOK_AHEAD * RAD;
  const phi = lat * RAD;
  const ahead = Math.asin(Math.sin(phi) * Math.cos(delta) + Math.cos(phi) * Math.sin(delta) * Math.cos(bearing));
  const east = Math.atan2(
    Math.sin(bearing) * Math.sin(delta) * Math.cos(phi),
    Math.cos(delta) - Math.sin(phi) * Math.sin(ahead),
  );
  const next = project([lon + east / RAD, ahead / RAD]);
  return next ? Math.atan2(next[1] - at[1], next[0] - at[0]) : (heading - 90) * RAD;
}

// How much of a pilot shows at (x, y) given the globe's edge: all of it well inside, none past it.
function insideEdge(limb: Limb | undefined, x: number, y: number): number {
  if (!limb) return 1;
  const inside = limb.r - Math.hypot(x - limb.x, y - limb.y);
  return Math.min(1, Math.max(0, inside / EDGE_FADE));
}

// A soft light inside the globe's edge, and the edge itself as an exact circle.
function edge(ctx: CanvasRenderingContext2D, { x, y, r, alpha }: Limb): void {
  const light = ctx.createRadialGradient(x, y, r * 0.86, x, y, r);
  light.addColorStop(0, paper(0));
  light.addColorStop(1, paper(0.07 * alpha));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = light;
  ctx.fill();
  ctx.strokeStyle = paper(0.2 * alpha);
  ctx.lineWidth = 1;
  ctx.stroke();
}

// The route from its start to `along` metres, then to the aircraft, so the solid part ends exactly at the join.
function flown(points: LonLat[], path: RoutePath, along: number, here: LonLat): LonLat[] {
  let i = 0;
  while (i < path.cum.length - 1 && path.cum[i + 1] <= along) i++;
  return [...points.slice(0, i + 1), here];
}

function polyline(ctx: CanvasRenderingContext2D, points: LonLat[]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// A trail that fades towards its tail: a Catmull-Rom spline through the points, one faint-to-bright piece at a time.
function trail(ctx: CanvasRenderingContext2D, points: LonLat[]): void {
  const n = points.length;
  if (n < 2) return;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(n - 1, i + 2)]];
    ctx.strokeStyle = paper((0.35 * (i + 1)) / n);
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
    ctx.stroke();
  }
}

// Where a pilot is on screen this frame, and where it is in the world.
interface Spot {
  at: LonLat;
  place: LonLat;
  heading: number;
  along?: number;
}

// The text settings every label needs: the canvas's pixel ratio and the page's font stack.
interface Type {
  ratio: number;
  family: string;
}

function planeGlyph(): Path2D {
  if (!glyph) {
    glyph = new Path2D();
    glyph.addPath(new Path2D(PLANE), { e: -CENTRE_X, f: 0 });
  }
  return glyph;
}

// Each pilot with a track, where it is drawn this frame. Animated, the drawn position is also added to its trail.
function placePilots(
  { project, pilots }: Scene,
  tracks: Partial<Record<string, Track>>,
  now: number,
  still: boolean,
): Map<string, Spot> {
  const placed = new Map<string, Spot>();
  for (const pilot of pilots) {
    const track = tracks[pilot.id];
    if (!track) continue;
    const found = still ? latest(track) : place(track, now);
    const at = project([found.lon, found.lat]);
    if (!at) continue;
    if (!still) record(track, [found.lon, found.lat], now);
    placed.set(pilot.id, { at, place: [found.lon, found.lat], heading: found.heading, along: found.along });
  }
  return placed;
}

// The points projected, or null when any is over the horizon.
function projectAll(project: Scene["project"], points: LonLat[]): LonLat[] | null {
  const projected: LonLat[] = [];
  for (const point of points) {
    const at = project(point);
    if (!at) return null;
    projected.push(at);
  }
  return projected;
}

// One route: dotted in full, solid up to the aircraft. A route running over the horizon is left out rather than
// drawn through the globe.
function drawRoute(ctx: CanvasRenderingContext2D, route: Line, here: Spot, project: Scene["project"]): void {
  const points = projectAll(project, route.path.points);
  if (!points) return;
  ctx.lineWidth = 1;
  ctx.strokeStyle = paper(0.1);
  ctx.setLineDash([2, 5]);
  polyline(ctx, points);
  ctx.setLineDash([]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = paper(route.club ? 0.45 : 0.18);
  if (here.along !== undefined) polyline(ctx, flown(points, route.path, here.along, here.at));
}

// Draws the routes of pilots that are placed, and returns the ids that have one (they get no trail).
function drawRoutes(
  ctx: CanvasRenderingContext2D,
  routes: Line[],
  placed: Map<string, Spot>,
  project: Scene["project"],
): Set<string> {
  const routed = new Set<string>();
  for (const route of routes) {
    const here = placed.get(route.id);
    if (!here) continue;
    routed.add(route.id);
    drawRoute(ctx, route, here, project);
  }
  return routed;
}

function drawTrails(
  ctx: CanvasRenderingContext2D,
  { project, pilots }: Scene,
  tracks: Partial<Record<string, Track>>,
  routed: Set<string>,
): void {
  for (const pilot of pilots) {
    const track = tracks[pilot.id];
    if (!track || routed.has(pilot.id)) continue;
    const points: LonLat[] = [];
    for (const point of track.trail) {
      const at = project(point);
      if (at) points.push(at);
    }
    trail(ctx, points);
  }
}

// Zoomed out, a pilot is a point, and the club's and the viewer's carry a name.
function drawPoint(ctx: CanvasRenderingContext2D, pilot: Pilot, you: boolean, [x, y]: LonLat, text: Type): void {
  const bright = pilot.club === true || you;
  ctx.beginPath();
  ctx.arc(x, y, bright ? 2.6 : 2, 0, Math.PI * 2);
  ctx.fillStyle = paper(bright ? 1 : 0.5);
  ctx.fill();
  if (bright) label(ctx, you ? "You" : pilot.name, farFont(text.family), 0.65, text.ratio, x + 7, y);
}

function drawAircraft(
  ctx: CanvasRenderingContext2D,
  project: Scene["project"],
  pilot: Pilot,
  you: boolean,
  spot: Spot,
  text: Type,
): void {
  const [x, y] = spot.at;
  const club = pilot.club === true;
  const size = (you ? 12 : club ? 11 : 9) / 9;
  if (you) {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.strokeStyle = paper(0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(screenAngle(project, spot.at, spot.place, spot.heading));
  ctx.scale(size, size);
  ctx.fillStyle = paper(club || you ? 1 : 0.4);
  ctx.fill(planeGlyph());
  ctx.restore();
  if (you) {
    label(ctx, "You", labelFont(text.family), 1, text.ratio, x + 22, y);
  } else if (club) {
    label(ctx, pilot.name, labelFont(text.family), 1, text.ratio, x + 16, y - 6);
    if (pilot.altitude !== undefined && pilot.altitude !== "") {
      label(ctx, pilot.altitude, detailFont(text.family), 0.5, text.ratio, x + 16, y + 8);
    }
  }
}

// One anchor carries the ring, the glyph and the label, so they move as one. It is left at its exact sub-pixel
// position: an aircraft moves a fraction of a pixel a frame, and snapping it makes it stall and jump.
function drawPilots(ctx: CanvasRenderingContext2D, scene: Scene, placed: Map<string, Spot>, text: Type): void {
  const { project, pilots, youId, width, height, far, limb } = scene;
  for (const pilot of pilots) {
    const spot = placed.get(pilot.id);
    if (!spot) continue;
    const [x, y] = spot.at;
    if (x < -CULL || x > width + CULL || y < -CULL || y > height + CULL) continue;
    // Near the globe's edge a pilot fades, and past it is gone: it has flown over the horizon.
    const shown = insideEdge(limb, x, y);
    if (shown <= 0) continue;
    ctx.globalAlpha = shown;
    const you = pilot.id === youId;
    if (far) drawPoint(ctx, pilot, you, spot.at, text);
    else drawAircraft(ctx, project, pilot, you, spot, text);
    ctx.globalAlpha = 1;
  }
}

/** Draws routes, trails, aircraft and their labels for one frame. `still` draws each aircraft where its last fix put it. */
export function draw(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  tracks: Partial<Record<string, Track>>,
  now: number,
  still: boolean,
  ratio: number,
  family: string,
): void {
  const { project, routes, width, height, far, limb } = scene;
  ctx.clearRect(0, 0, width, height);
  if (limb && limb.alpha > 0) edge(ctx, limb);

  const placed = placePilots(scene, tracks, now, still);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const routed = drawRoutes(ctx, far ? [] : routes, placed, project);
  if (!far) drawTrails(ctx, scene, tracks, routed);
  drawPilots(ctx, scene, placed, { ratio, family });
}
