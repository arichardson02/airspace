import { useCallback, useEffect, type RefObject } from "react";
import type { Map as MapLibre } from "maplibre-gl";
import { limbOf, MAX_ZOOM, MIN_ZOOM } from "./globe";
import type { LonLat } from "./types";

// How long a change of `center` or `zoom` from props takes to ease there.
const EASE_MS = 700;

export interface Framing {
  /** How far across the box `center` sits, 0 to 1. */
  focusAt: number;
  width: number;
  height: number;
  globeRadius?: number;
  anchor?: { point: LonLat; x: number };
}

// `focusAt` off centre is padding on one side, so MapLibre centres the view in what is left.
function pad(view: MapLibre, focusAt: number, width: number): void {
  view.setPadding({
    left: Math.max(0, (2 * focusAt - 1) * width),
    right: Math.max(0, (1 - 2 * focusAt) * width),
    top: 0,
    bottom: 0,
  });
}

// Zooms until the globe measures `radius`, a few steps since perspective bends it. False when it cannot be measured.
function fitGlobe(view: MapLibre, radius: number): boolean {
  // MapLibre may not have seen the new size yet; measuring needs it to.
  view.resize();
  for (let step = 0; step < 4; step++) {
    const { r } = limbOf(view);
    if (r === 0) return false;
    const change = Math.log2(radius / r);
    if (Math.abs(change) < 1e-3) break;
    view.jumpTo({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.getZoom() + change)) });
  }
  return true;
}

// Turning the globe moves the place by about as many pixels as a degree of longitude spans there.
function turnToAnchor(view: MapLibre, [lon, lat]: LonLat, x: number): void {
  for (let step = 0; step < 4; step++) {
    const at = view.project([lon, lat]).x;
    const next = view.project([lon + 1, lat]).x;
    if (Math.abs(x - at) < 0.5 || next === at) return;
    const centre = view.getCenter();
    view.jumpTo({ center: [centre.lng - (x - at) / (next - at), centre.lat] });
  }
}

/**
 * Applies `focusAt`, `globeRadius` and `anchor` to the map, again whenever they or the box change. The map may arrive
 * after the box has its size, so the returned function applies the latest framing as it is made.
 */
export function useFraming(map: RefObject<MapLibre | null>, framing: Framing): () => void {
  const { focusAt, width, height, globeRadius } = framing;
  const anchorPoint = framing.anchor?.point;
  const anchorX = framing.anchor?.x;
  const [anchorLon, anchorLat] = anchorPoint ?? [0, 0];
  const frame = useCallback((): void => {
    const view = map.current;
    if (!view) return;
    pad(view, focusAt, width);
    if (globeRadius === undefined || globeRadius <= 0) return;
    if (!fitGlobe(view, globeRadius) || anchorX === undefined) return;
    turnToAnchor(view, [anchorLon, anchorLat], anchorX);
  }, [map, focusAt, width, globeRadius, anchorX, anchorLon, anchorLat]);
  useEffect(() => {
    frame();
  }, [frame, height]);
  return frame;
}

/**
 * New props ease the map there, unless it is already there because the viewer put it there. A map sized by
 * `globeRadius` keeps the zoom that gives it.
 */
export function useEaseTo(
  map: RefObject<MapLibre | null>,
  [lon, lat]: LonLat,
  zoom: number,
  still: boolean,
  globeRadius: number | undefined,
): void {
  useEffect(() => {
    const view = map.current;
    if (!view) return;
    const target = globeRadius !== undefined && globeRadius > 0 ? view.getZoom() : zoom;
    const here = view.getCenter();
    if (
      Math.abs(here.lng - lon) < 1e-6 &&
      Math.abs(here.lat - lat) < 1e-6 &&
      Math.abs(view.getZoom() - target) < 1e-3
    ) {
      return;
    }
    view.easeTo({ center: [lon, lat], zoom: target, duration: still ? 0 : EASE_MS });
  }, [map, lon, lat, zoom, still, globeRadius]);
}
