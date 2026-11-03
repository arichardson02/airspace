import { useEffect, useState, type RefObject } from "react";
import type { GeoJSONSource, Map as MapLibre, MapOptions } from "maplibre-gl";
import { loadAirports } from "./airports";
import { MAX_ZOOM, MIN_ZOOM, zoomForRadius } from "./globe";
import { loadLand } from "./land";
import { AIRPORTS_SOURCE, airspaceStyle, LAND_SOURCE } from "./style";
import type { LonLat } from "./types";
import { useLatest } from "./use-latest";

// The worker that decodes tiles is its own file, which the bundler copies next to the page and this points at.
const WORKER = new URL("../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href;

/** What the map is made from. It is read once: later changes move the map (see `useEaseTo`), not remake it. */
export interface MapSettings {
  projection: "globe" | "mercator";
  center: LonLat;
  zoom: number;
  globeRadius?: number;
  interactive: boolean;
  still: boolean;
}

interface Callbacks {
  /** Applies the latest framing. */
  frame: () => void;
  /** Draws the aircraft layer. */
  paint: (now: number) => void;
  /** Called with the view after a gesture. */
  onViewChange?: (center: LonLat, zoom: number) => void;
}

function optionsFor(
  container: HTMLElement,
  { projection, center, zoom, globeRadius, interactive }: MapSettings,
): MapOptions {
  return {
    container,
    style: airspaceStyle(projection),
    center,
    zoom: globeRadius !== undefined && globeRadius > 0 ? zoomForRadius(globeRadius, center[1]) : zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    attributionControl: false,
    interactive,
    // A flat chart, always north up: no rotating or tilting.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
    fadeDuration: 150,
  };
}

// The globe's land arrives before the map is shown, so it never draws without it.
async function feedLand(made: MapLibre, isLive: () => boolean, onShown: () => void): Promise<void> {
  const land = await loadLand();
  if (!isLive()) return;
  void made.getSource<GeoJSONSource>(LAND_SOURCE)?.setData(land);
  made.once("idle", () => {
    if (isLive()) onShown();
  });
}

async function feedAirports(made: MapLibre, isLive: () => boolean): Promise<void> {
  const sets = await Promise.all([loadAirports("large"), loadAirports("medium")]);
  if (!isLive()) return;
  const features = sets.flatMap((set) =>
    set.airports.map(({ code, lon, lat }) => ({
      type: "Feature" as const,
      properties: { code, size: set.size },
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
    })),
  );
  void made.getSource<GeoJSONSource>(AIRPORTS_SOURCE)?.setData({ type: "FeatureCollection", features });
}

/**
 * MapLibre is loaded and the map made once, into `chart`. It reports the view after each gesture and draws the
 * aircraft with its own frames while it moves. The chart stays hidden until its first tiles are drawn, then fades in,
 * so it never shows half-loaded: the result says when.
 */
export function useMapLibre(
  chart: RefObject<HTMLDivElement | null>,
  map: RefObject<MapLibre | null>,
  moving: RefObject<boolean>,
  settings: MapSettings,
  { frame, paint, onViewChange }: Callbacks,
): boolean {
  const [drawn, setDrawn] = useState(false);
  const [initial] = useState(settings);
  const latest = useLatest({ frame, paint, onViewChange });

  useEffect(() => {
    const container = chart.current;
    if (!container) return undefined;
    let made: MapLibre | null = null;
    let live = true;
    const isLive = (): boolean => live;
    const start = async (): Promise<void> => {
      const { Map: MapLibreMap, setWorkerUrl } = await import("maplibre-gl");
      if (!live) return;
      setWorkerUrl(WORKER);
      const view = new MapLibreMap(optionsFor(container, initial));
      made = view;
      view.touchZoomRotate.disableRotation();
      view.keyboard.disableRotation();
      map.current = view;
      view.on("movestart", () => {
        moving.current = true;
      });
      view.on("moveend", (event) => {
        moving.current = false;
        // Only a viewer's own gesture is reported; an ease from new props already matches them.
        if (!("originalEvent" in event) || !event.originalEvent) return;
        const { lng, lat } = view.getCenter();
        latest.current.onViewChange?.([lng, lat], view.getZoom());
      });
      view.on("render", () => {
        if (moving.current || initial.still) latest.current.paint(performance.timeOrigin + performance.now());
      });
      view.on("load", () => {
        // Padding set while the style was still loading can be dropped, so the framing is applied again.
        latest.current.frame();
        view.jumpTo({ center: view.getCenter() });
        void feedLand(view, isLive, () => {
          // The first fit can run before MapLibre can measure the globe on a slow start; it is checked again here,
          // while the chart is still hidden.
          latest.current.frame();
          setDrawn(true);
        });
        void feedAirports(view, isLive);
      });
    };
    void start();
    return () => {
      live = false;
      made?.remove();
      map.current = null;
    };
  }, [chart, map, moving, initial, latest]);

  return drawn;
}
