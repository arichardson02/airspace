// Samples the Natural Earth land polygons on a grid and writes the points that fall on
// land to lib/world-dots.json, for the dot map behind the hero. Run once:
//
//   node scripts/world-dots.mts
//
// Coordinates are equirectangular on a 1000 x 500 canvas, rounded to whole pixels.
import { readFileSync, writeFileSync } from "node:fs";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

type LandTopology = Topology<{ land: GeometryCollection }>;

const WIDTH = 1000;
const HEIGHT = 500;
const STEP = 7;

/** world-atlas ships plain JSON, so check it's the land topology before handing it to topojson. */
function isLandTopology(value: unknown): value is LandTopology {
  if (typeof value !== "object" || value === null || !("type" in value) || value.type !== "Topology") return false;
  if (!("objects" in value) || typeof value.objects !== "object" || value.objects === null) return false;
  return "land" in value.objects;
}

const land: unknown = JSON.parse(readFileSync(new URL(import.meta.resolve("world-atlas/land-110m.json")), "utf8"));
if (!isLandTopology(land)) throw new Error("world-atlas/land-110m.json isn't a topology with a land object");

const polygons = feature(land, land.objects.land);
const dots: [number, number][] = [];

for (let y = STEP / 2; y < HEIGHT; y += STEP) {
  for (let x = STEP / 2; x < WIDTH; x += STEP) {
    const lon = (x / WIDTH) * 360 - 180;
    const lat = 90 - (y / HEIGHT) * 180;
    if (geoContains(polygons, [lon, lat])) dots.push([Math.round(x), Math.round(y)]);
  }
}

writeFileSync(new URL("../lib/world-dots.json", import.meta.url), JSON.stringify(dots));
console.log(`${dots.length} dots`);
