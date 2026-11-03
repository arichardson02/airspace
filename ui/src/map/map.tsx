"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useRef, type ReactElement, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import type { Map as MapLibre } from "maplibre-gl";
import { cn } from "../cn";
import { useEaseTo, useFraming } from "./framing";
import type { Pilot, Route, LonLat } from "./types";
import { useMapLibre } from "./use-maplibre";
import { useOverlay } from "./use-overlay";
import { useSize } from "./use-size";

// The data's licence asks for this wherever the map is shown.
const ATTRIBUTION = [
  { label: "OpenFreeMap", href: "https://openfreemap.org" },
  { label: "© OpenMapTiles", href: "https://www.openmaptiles.org/" },
  { label: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
];

interface MapProps {
  /** The longitude and latitude in the middle of the map. A change eases the map there. */
  center: LonLat;
  /** A MapLibre zoom level (see MIN_ZOOM). A change eases the map there. */
  zoom?: number;
  /** "globe" is a globe zoomed out that flattens as it zooms in; "mercator" is flat throughout. */
  projection?: "globe" | "mercator";
  /** Called once the viewer has wheeled, pinched or dragged, with the view the map came to. Pass it back as props. */
  onViewChange?: (center: LonLat, zoom: number) => void;
  pilots: Pilot[];
  routes?: Route[];
  /** The viewer's own pilot: ringed and labelled "You". */
  youId?: string;
  /**
   * Off, the map is a picture for a card's background: no gestures, the wheel scrolls the page, and no credits
   * (the live map the card leads to carries them).
   */
  interactive?: boolean;
  /** How far across the box `center` sits, 0 to 1. A card puts it to the right, clear of its text. */
  focusAt?: number;
  /** The globe's radius on screen in pixels, in place of `zoom`: the map zooms to whatever draws it that size. */
  globeRadius?: number;
  /** A place to land this many pixels across the box: the globe turns east or west until it does. */
  anchor?: { point: LonLat; x: number };
  className?: string;
}

function Credits(): ReactElement {
  return (
    <div className="group absolute right-2 bottom-2 flex items-center gap-2 text-[10px] text-paper/40">
      <p className="hidden gap-1.5 group-focus-within:flex group-hover:flex">
        {ATTRIBUTION.map(({ label, href }) => (
          <a key={href} href={href} target="_blank" rel="noreferrer" className="hover:text-paper/80">
            {label}
          </a>
        ))}
      </p>
      <button
        type="button"
        aria-label="Map data credits"
        className="grid size-4 place-items-center rounded-full border border-paper/20 font-semibold italic leading-none"
      >
        i
      </button>
    </div>
  );
}

// A live map of pilots. MapLibre draws the chart on the GPU from OpenFreeMap's vector tiles in our own style
// (style.ts): land, water, borders, and the sim's airports with their runways as you zoom in. It handles the wheel,
// pinch, drag and flick. Routes, trails and aircraft are one canvas over it, drawn by draw.ts: in step with MapLibre's
// own frames while the map moves, and by one animation frame loop while it is still, so aircraft glide at their own
// pace without making MapLibre redraw the chart. Aircraft are drawn a moment in the past on a smooth curve through the
// last few fixes (see tracks.ts). MapLibre itself is fetched only when a map mounts.
export function Map(props: MapProps): ReactElement {
  const view = useLiveMap(props);
  return <Frame {...view} className={props.className} />;
}

interface LiveMap {
  box: RefObject<HTMLDivElement | null>;
  chart: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  /** The chart has drawn its first tiles. */
  shown: boolean;
  interactive: boolean;
}

// Everything the map is made of, wired together; `Frame` is the markup it fills.
function useLiveMap({
  center,
  zoom = 5,
  projection = "globe",
  onViewChange,
  pilots,
  routes = [],
  youId,
  interactive = true,
  focusAt = 0.5,
  globeRadius,
  anchor,
}: MapProps): LiveMap {
  const still = useReducedMotion() === true;
  const [ref, { width, height }] = useSize();
  const chart = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const map = useRef<MapLibre | null>(null);
  // While MapLibre is moving the view, the aircraft are drawn after each of its frames, so they never lag the chart.
  const moving = useRef(false);

  const paint = useOverlay(ref, canvas, map, moving, { pilots, routes, youId, still, width, height });
  const frame = useFraming(map, { focusAt, width, height, globeRadius, anchor });
  const drawn = useMapLibre(
    chart,
    map,
    moving,
    { projection, center, zoom, globeRadius, interactive, still },
    { frame, paint, onViewChange },
  );
  useEaseTo(map, center, zoom, still, globeRadius);

  return { box: ref, chart, canvas, width, height, shown: drawn, interactive };
}

interface FrameProps extends LiveMap {
  className?: string;
}

function Frame({ box, chart, canvas, width, height, shown, interactive, className }: FrameProps): ReactElement {
  return (
    <div
      ref={box}
      // The wheel zooms the map: Lenis (the website's smooth scroll) must not also scroll the page.
      data-lenis-prevent={interactive || undefined}
      style={interactive ? { overscrollBehavior: "contain" } : undefined}
      className={cn("relative size-full overflow-hidden text-paper", className)}
    >
      {/* MapLibre makes its container position: relative, so it fills the box by size rather than by inset. */}
      <div
        ref={chart}
        className="size-full transition-opacity duration-700 ease-out-quint"
        style={{ opacity: shown ? 1 : 0 }}
      />
      {width > 0 && (
        // The limb and pilots wait for the chart and fade in with it, so the globe never shows in one look and then
        // settles into another when its tiles arrive.
        <canvas
          ref={canvas}
          aria-hidden
          style={{ width, height, opacity: shown ? 1 : 0 }}
          className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out-quint"
        />
      )}
      {/* The credits the map data requires, folded into a small "i" on the live map. A card's picture of the map
          leads to it. */}
      {interactive && <Credits />}
    </div>
  );
}
