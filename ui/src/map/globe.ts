import type { Map as MapLibre, ProjectionSpecification } from "maplibre-gl";
import type { Limb, Scene } from "./draw";
import { GLOBE_FROM, GLOBE_UNTIL } from "./style";
import type { LonLat } from "./types";

/** MapLibre zoom levels: 0 is the whole world, about 5.5 a region like the Pacific Northwest, 14 an airfield. */
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 16;
// How far, in degrees, a place may come back off the screen from where it was and still count as on the near side.
const HORIZON_SLACK = 0.05;

const RAD = Math.PI / 180;

type Edge = Omit<Limb, "alpha">;

/** The view's projection, which MapLibre doesn't have until its style has loaded, though its types say it always does. */
export function projectionOf(view: MapLibre): ProjectionSpecification | undefined {
  return view.getProjection();
}

// The globe's edge on screen. The view's centre faces the camera, so it is the disc's centre; the edge is where a
// walk east from it reaches furthest across the screen, a little short of 90° since the camera has perspective.
export function limbOf(view: MapLibre): Edge {
  const { lng, lat } = view.getCenter();
  const centre = view.project([lng, lat]);
  const phi = lat * RAD;
  let r = 0;
  for (let d = 60; d <= 90; d += 0.25) {
    const delta = d * RAD;
    const phi2 = Math.asin(Math.sin(phi) * Math.cos(delta));
    const lon2 =
      lng + Math.atan2(Math.sin(delta) * Math.cos(phi), Math.cos(delta) - Math.sin(phi) * Math.sin(phi2)) / RAD;
    const at = view.project([lon2, phi2 / RAD]);
    r = Math.max(r, Math.hypot(at.x - centre.x, at.y - centre.y));
  }
  return { x: centre.x, y: centre.y, r };
}

/** A place's screen position under the view, or null where it cannot be seen. */
export function projector(view: MapLibre, globe: boolean): Scene["project"] {
  return (point: LonLat): LonLat | null => {
    const at = view.project(point);
    // On the globe a place over the horizon still projects, onto the near side: taken back off the screen it comes
    // out somewhere else, and is left out.
    if (globe) {
      const back = view.unproject(at);
      const east = ((back.lng - point[0] + 540) % 360) - 180;
      if (Math.abs(east) > HORIZON_SLACK || Math.abs(back.lat - point[1]) > HORIZON_SLACK) return null;
    }
    return [at.x, at.y];
  };
}

/** Measures the globe's edge, and measures it again only when the view has changed. */
export function limbMeter(): (view: MapLibre, width: number, height: number) => Limb {
  let last: (Edge & { key: string }) | undefined;
  return (view, width, height) => {
    const zoom = view.getZoom();
    const { lng, lat } = view.getCenter();
    const key = `${lng},${lat},${zoom},${width},${height}`;
    if (last?.key !== key) last = { key, ...limbOf(view) };
    const alpha = Math.min(1, (GLOBE_UNTIL - zoom) / (GLOBE_UNTIL - GLOBE_FROM));
    return { x: last.x, y: last.y, r: last.r, alpha };
  };
}

/** A first guess at the zoom that draws the globe `radius` pixels across at `lat`, refined once the map has loaded. */
export function zoomForRadius(radius: number, lat: number): number {
  return Math.max(MIN_ZOOM, Math.log2((2 * Math.PI * radius * Math.cos(lat * RAD)) / 512));
}
