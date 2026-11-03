import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

// The Natural Earth 50m coastline, for the cards drawn on the real coast (the still globe, the last flight). It is
// fetched as its own chunk the first time one draws, so a page without one pays nothing and one with one is not held
// up parsing 530 KB of JSON before it can paint.
/** Land as GeoJSON: features whose geometry is a MultiPolygon. */
export type Land = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>;

type LandTopology = Topology<{ land: GeometryCollection }>;

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/** The bundled file is plain JSON, so check it is the land topology before handing it to topojson. */
function isLandTopology(value: unknown): value is LandTopology {
  if (!isObject(value) || !("objects" in value) || !isObject(value.objects)) return false;
  return "type" in value && value.type === "Topology" && "land" in value.objects;
}

function decode(topology: LandTopology): Land {
  const features = feature(topology, topology.objects.land).features.flatMap((one) =>
    one.geometry.type === "MultiPolygon" ? [{ ...one, geometry: one.geometry }] : [],
  );
  return { type: "FeatureCollection", features };
}

let decoded: Land | undefined;
let loading: Promise<Land> | undefined;

/** The land, fetched and decoded once. */
export function loadLand(): Promise<Land> {
  return (loading ??= import("./land-50m.json").then(({ default: topology }) => {
    if (!isLandTopology(topology)) throw new Error("land-50m.json isn't a topology with a land object");
    return (decoded = decode(topology));
  }));
}

/** The land, or null until it has loaded. Already loaded, it is there on the first render. */
export function useLand(): Land | null {
  const [land, setLand] = useState(() => decoded ?? null);
  useEffect(() => {
    let live = true;
    void loadLand().then((loaded) => {
      if (live) setLand(loaded);
      return loaded;
    });
    return () => {
      live = false;
    };
  }, []);
  return land;
}

/** A lon/lat window, in degrees. */
export interface Box {
  west: number;
  east: number;
  south: number;
  north: number;
}

interface Part {
  coordinates: GeoJSON.Position[][];
  west: number;
  east: number;
  south: number;
  north: number;
  /** Runs across the antimeridian, so its longitudes cannot be compared with a window's. */
  wraps: boolean;
}

// Each 50m landmass with its bounds, worked out on first use from its outer ring.
const parts = new WeakMap<Land, Part[]>();

/** The landmasses of `land` that could show in `box`, as one shape. Ones that cross the antimeridian are always kept. */
export function landIn(land: Land, { west, east, south, north }: Box): GeoJSON.MultiPolygon {
  let all = parts.get(land);
  if (!all) {
    all = land.features
      .flatMap((one) => one.geometry.coordinates)
      .map((coordinates) => {
        let [w, e, s, n] = [Infinity, -Infinity, Infinity, -Infinity];
        for (const [lon, lat] of coordinates[0]) {
          w = Math.min(w, lon);
          e = Math.max(e, lon);
          s = Math.min(s, lat);
          n = Math.max(n, lat);
        }
        return { coordinates, west: w, east: e, south: s, north: n, wraps: e - w > 180 };
      });
    parts.set(land, all);
  }
  const near = all.filter(
    (p) => p.north >= south && p.south <= north && (p.wraps || (p.east >= west && p.west <= east)),
  );
  return { type: "MultiPolygon", coordinates: near.map((part) => part.coordinates) };
}
