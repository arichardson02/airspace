import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Map as MapLibre } from "maplibre-gl";
import { draw, type Line, type Scene } from "./draw";
import { limbMeter, projectionOf, projector } from "./globe";
import { routePath, type RoutePath } from "./route-path";
import { GLOBE_UNTIL } from "./style";
import { receive, type Track } from "./tracks";
import type { Pilot, Route } from "./types";
import { useFrameLoop } from "./use-frame-loop";

const MAX_PIXEL_RATIO = 2;
// Zoomed further out than this, routes, trails and names would only clutter the world.
const FAR_ZOOM = 3.5;

// A route's great circle, kept so the same one is used while its endpoints stay put.
function pathFor(cache: Record<string, RoutePath>, { from, to }: Route): RoutePath {
  return (cache[`${from.join()}|${to.join()}`] ??= routePath(from, to));
}

interface Surface {
  ctx: CanvasRenderingContext2D;
  ratio: number;
  family: string;
}

interface Overlay {
  pilots: Pilot[];
  routes: Route[];
  /** The viewer's own pilot: ringed and labelled "You". */
  youId?: string;
  /** Skips the animation: aircraft are drawn where their last fix put them. */
  still: boolean;
  width: number;
  height: number;
}

/**
 * The aircraft layer: routes, trails and aircraft on `canvas`, over the map. Returns the function that draws a frame
 * for the view MapLibre is showing; MapLibre calls it with its own frames while it moves, and the animation loop does
 * while it is still.
 */
export function useOverlay(
  box: RefObject<HTMLDivElement | null>,
  canvas: RefObject<HTMLCanvasElement | null>,
  map: RefObject<MapLibre | null>,
  moving: RefObject<boolean>,
  { pilots, routes, youId, still, width, height }: Overlay,
): (now: number) => void {
  // Which pilots exist and who is bright decide a route's weight; a pilot moving must not rebuild it.
  const ids = pilots.map((p) => p.id).join();
  const clubIds = pilots
    .filter((p) => p.club === true)
    .map((p) => p.id)
    .join();
  const cache = useRef<Record<string, RoutePath>>({});
  const lines = useMemo<Line[]>(
    () =>
      routes.flatMap((route) => {
        if (!ids.split(",").includes(route.pilotId)) return [];
        const club = clubIds.split(",").includes(route.pilotId) || route.pilotId === youId;
        return [{ id: route.pilotId, club, path: pathFor(cache.current, route) }];
      }),
    [routes, ids, clubIds, youId],
  );

  const tracks = useRef<Partial<Record<string, Track>>>({});
  const surface = useRef<Surface | null>(null);
  const [measure] = useState(limbMeter);

  const paint = (now: number): void => {
    const target = surface.current;
    const view = map.current;
    if (!target || !view || width === 0) return;
    const projection = projectionOf(view);
    if (projection === undefined) return;
    const globe = projection.type === "globe";
    target.ctx.setTransform(target.ratio, 0, 0, target.ratio, 0, 0);
    const zoom = view.getZoom();
    const scene: Scene = {
      project: projector(view, globe),
      routes: lines,
      pilots,
      youId,
      width,
      height,
      far: zoom < FAR_ZOOM,
      limb: globe && zoom < GLOBE_UNTIL ? measure(view, width, height) : undefined,
    };
    draw(target.ctx, scene, tracks.current, now, still, target.ratio, target.family);
  };

  // The canvas follows the box. Resizing clears it, so it is drawn again straight away.
  useLayoutEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx || width === 0) return;
    const ratio = Math.min(window.devicePixelRatio > 0 ? window.devicePixelRatio : 1, MAX_PIXEL_RATIO);
    element.width = width * ratio;
    element.height = height * ratio;
    surface.current = { ctx, ratio, family: getComputedStyle(element).fontFamily };
  }, [canvas, width, height]);

  // A new update goes into the pilot's buffer.
  useLayoutEffect(() => {
    const now = Date.now();
    const next: Partial<Record<string, Track>> = {};
    for (const pilot of pilots) {
      const route = routes.find((r) => r.pilotId === pilot.id);
      const path = route ? pathFor(cache.current, route) : null;
      next[pilot.id] = receive(tracks.current[pilot.id], pilot, now, path);
    }
    tracks.current = next;
  }, [pilots, routes]);

  // Under reduced motion there is no loop, so each render paints; otherwise the loop does while the map is still.
  useLayoutEffect(() => {
    if (still) paint(Date.now());
  });
  useFrameLoop(
    box,
    (_, frame) => {
      if (!moving.current) paint(performance.timeOrigin + frame);
    },
    !still,
  );

  return paint;
}
