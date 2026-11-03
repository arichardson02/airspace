// Builds the map's airports from OurAirports (public domain, https://ourairports.com/data/), split by size so a map
// only fetches the ones it is zoomed in far enough to show. Only the major ones: open large and medium airports with
// a four-letter ICAO code, which Microsoft Flight Simulator ships worldwide. Small strips, local codes, heliports,
// seaplane bases and closed fields are left out. Run when you want fresher data:
//
//   pnpm --filter @fs-career/ui airports
import { mkdirSync, statSync, writeFileSync } from "node:fs";

const SOURCE = "https://davidmegginson.github.io/ourairports-data/airports.csv";
// About 11 m: finer than any map zoom needs.
const DECIMALS = 4;

type Size = "large" | "medium";
type Row = [code: string, name: string, lon: number, lat: number];

const out = new URL("../src/map/airports/", import.meta.url);
mkdirSync(out, { recursive: true });

function sizeOf(type: string | undefined): Size | undefined {
  if (type === "large_airport") return "large";
  if (type === "medium_airport") return "medium";
  return undefined;
}

// One CSV row into fields, honouring quotes and doubled quotes inside them.
function fields(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (quoted) {
      if (c === '"' && line.charAt(i + 1) === '"') {
        value += '"';
        i++;
      } else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      values.push(value);
      value = "";
    } else value += c;
  }
  values.push(value);
  return values;
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE}: ${response.status}`);
const [header = "", ...rows] = (await response.text()).split(/\r?\n/).filter(Boolean);
const names = fields(header);
const column = (name: string): number => {
  const index = names.indexOf(name);
  if (index < 0) throw new Error(`${SOURCE} has no ${name} column`);
  return index;
};
const [type, ident, name, longitude, latitude] = [
  column("type"),
  column("ident"),
  column("name"),
  column("longitude_deg"),
  column("latitude_deg"),
];

const tiers: Record<Size, Row[]> = { large: [], medium: [] };
for (const row of rows) {
  const f = fields(row);
  const size = sizeOf(f[type]);
  const code = f[ident] ?? "";
  if (size === undefined || !/^[A-Z]{4}$/.test(code)) continue;
  const lon = Number(Number(f[longitude]).toFixed(DECIMALS));
  const lat = Number(Number(f[latitude]).toFixed(DECIMALS));
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
  tiers[size].push([code, f[name] ?? "", lon, lat]);
}

for (const size of ["large", "medium"] as const) {
  const list = tiers[size].toSorted((a, b) => (a[0] < b[0] ? -1 : 1));
  const file = new URL(`${size}.json`, out);
  writeFileSync(file, JSON.stringify(list));
  console.log(`${size}.json ${list.length} airports, ${(statSync(file).size / 1024).toFixed(0)} KB`);
}
