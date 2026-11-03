"use client";

import type { ReactElement } from "react";
import { Map } from "./map";
import type { LonLat, Pilot } from "./types";
import { useSize } from "./use-size";

// A globe this many card heights across in radius, its limb crossing the card this far in from the left, and the
// focus placed this far across the card.
const RADIUS = 1.6;
const LIMB = 0.42;
const FOCUS = 0.74;

interface MapBackdropProps {
  /** The place turned into view on the right of the card. */
  focus?: LonLat;
  pilots?: Pilot[];
}

const NONE: Pilot[] = [];

/**
 * The live map as a card's `background`: a huge still globe past the card's right edge, its limb arcing through the
 * card and `focus` turned into view, with the pilots on it.
 */
export function MapBackdrop({ focus = [-122.3, 47.5], pilots = NONE }: MapBackdropProps): ReactElement {
  const [ref, { width, height }] = useSize();
  const radius = height * RADIUS;
  // The globe's centre sits past the card's right edge, so the map is laid out wider than the card, centred there,
  // and the card cuts it off.
  const cx = width * LIMB + radius;
  // The focus sits about this far west of the globe's centre, so it lands at FOCUS across the card; the map's
  // perspective bends it a little, and `anchor` turns the globe the rest of the way.
  const west = (Math.asin(Math.min(1, (cx - width * FOCUS) / radius)) * 180) / Math.PI;

  return (
    <div ref={ref} className="relative size-full overflow-hidden">
      {height > 0 && (
        <div className="absolute top-0 left-0 h-full" style={{ width: 2 * cx }}>
          <Map
            center={[focus[0] + west, focus[1]]}
            globeRadius={radius}
            anchor={{ point: focus, x: width * FOCUS }}
            pilots={pilots}
            interactive={false}
          />
        </div>
      )}
    </div>
  );
}
