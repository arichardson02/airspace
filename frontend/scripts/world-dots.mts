// Samples the Natural Earth land polygons on a grid and writes the points that fall on
// land to lib/world-dots.json, for the dot map behind the hero. Run once:
//
//   node scripts/world-dots.mjs
//
// Coordinates are equirectangular on a 1000 x 500 canvas, rounded to whole pixels.
import { writeFileSync } from "node:fs";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import land from "world-atlas/land-110m.json" with { type: "json" };

const WIDTH = 1000;
const HEIGHT = 500;
const STEP = 7;

const polygons = feature(land, land.objects.land);
const dots = [];

for (let y = STEP / 2; y < HEIGHT; y += STEP) {
  for (let x = STEP / 2; x < WIDTH; x += STEP) {
    const lon = (x / WIDTH) * 360 - 180;
    const lat = 90 - (y / HEIGHT) * 180;
    if (geoContains(polygons, [lon, lat])) dots.push([Math.round(x), Math.round(y)]);
  }
}

writeFileSync(new URL("../lib/world-dots.json", import.meta.url), JSON.stringify(dots));
console.log(`${dots.length} dots`);
