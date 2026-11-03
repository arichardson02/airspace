// Copies the Natural Earth 50m land outline from world-atlas into src/map as minified TopoJSON, for the cards drawn
// on the real coast. The file is already quantized, so this keeps the topology as is. Run when world-atlas changes:
//
//   pnpm --filter @fs-career/ui basemap
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

const out = new URL("../src/map/", import.meta.url);
mkdirSync(out, { recursive: true });

const source = new URL(import.meta.resolve("world-atlas/land-50m.json"));
const topology: unknown = JSON.parse(readFileSync(source, "utf8"));
const file = new URL("land-50m.json", out);
writeFileSync(file, JSON.stringify(topology));
console.log(`land-50m.json ${(statSync(file).size / 1024).toFixed(1)} KB`);
