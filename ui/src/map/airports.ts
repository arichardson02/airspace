import { useEffect, useState } from "react";
import type { Airport } from "./types";

// The world's major airports from OurAirports (scripts/airports.mts), the large and medium ones with an ICAO code that
// the sim ships, in two sizes. Each size is its own chunk, fetched the first time something shows it.
export type Size = "large" | "medium";
type Row = [code: string, name: string, lon: number, lat: number];

export interface AirportSet {
  size: Size;
  airports: Airport[];
}

const sources: Record<Size, () => Promise<{ default: unknown }>> = {
  large: () => import("./airports/large.json"),
  medium: () => import("./airports/medium.json"),
};
const loaded: Partial<Record<Size, AirportSet>> = {};
const loading: Partial<Record<Size, Promise<AirportSet>>> = {};

function isRow(value: unknown): value is Row {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string" &&
    typeof value[2] === "number" &&
    typeof value[3] === "number"
  );
}

/** The airports of `size`, fetched and decoded once. */
export function loadAirports(size: Size): Promise<AirportSet> {
  return (loading[size] ??= sources[size]().then(({ default: rows }) => {
    if (!Array.isArray(rows) || !rows.every(isRow)) throw new Error(`airports/${size}.json isn't a list of airports`);
    const airports = rows.map(([code, name, lon, lat]) => ({ code, name, lon, lat }));
    return (loaded[size] = { size, airports });
  }));
}

/** The airports of `size`, or null until they have loaded. */
export function useAirports(size: Size): Airport[] | null {
  const [airports, setAirports] = useState(() => loaded[size]?.airports ?? null);
  useEffect(() => {
    let live = true;
    void loadAirports(size).then((set) => {
      if (live) setAirports(set.airports);
      return set;
    });
    return () => {
      live = false;
    };
  }, [size]);
  return airports;
}
