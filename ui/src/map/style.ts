import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

// The live map's look, drawn by MapLibre from OpenFreeMap's vector tiles (OpenStreetMap data in the OpenMapTiles
// schema). Only what a pilot needs: land, water and its coastline in hairline, faint country borders, and airports,
// whose runways, taxiways and aprons appear as you zoom in on them. No roads, buildings, places or points of interest.
// Swapping the tiles for a self-hosted file in the same schema changes only TILES.
const TILES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
// The only face OpenFreeMap serves glyphs for. Inter would need its glyphs built and hosted with the tiles.
const FONT = ["Noto Sans Regular"];

// Monotone, like the rest of the app. Zoomed out it is the globe the cards show: no sea of its own, so whatever is
// behind the map shows through, land a faint paper wash with a hairline Natural Earth coast, and a faint 15°
// graticule (the limb and its light are drawn over it, in draw.ts). Zoomed in, past GLOBE_UNTIL, it turns into a
// chart from the tiles: the sea the page's ink, land the same wash laid on it, and the tiles' finer coast.
const WATER = "#0b0d10";
const LAND = "#131518";
const paper = (alpha: number) => `rgba(246, 247, 249, ${alpha})`;
/** From this zoom the globe's own land fades into the tiles' chart, done by GLOBE_UNTIL. */
export const GLOBE_FROM = 4;
export const GLOBE_UNTIL = 5.5;
const toChart = (globe: number, chart: number): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  GLOBE_FROM,
  globe,
  GLOBE_UNTIL,
  chart,
];
export const LAND_SOURCE = "land";

const span = (from: number, to: number): number[] =>
  Array.from({ length: (to - from) / 2.5 + 1 }, (_, i) => from + i * 2.5);

// Meridians and parallels every 15°, stopping short of the poles, where they would bunch into a star.
function graticule() {
  const lines: [number, number][][] = [];
  for (let lon = -180; lon < 180; lon += 15) lines.push(span(-75, 75).map((lat) => [lon, lat]));
  for (let lat = -75; lat <= 75; lat += 15) lines.push(span(-180, 180).map((lon) => [lon, lat]));
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "MultiLineString" as const, coordinates: lines },
  };
}

// A feature's shape, single or multi part.
const AREA: ExpressionSpecification = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
const LINE: ExpressionSpecification = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];

export const AIRPORTS_SOURCE = "airports";

/** The style, as a globe zoomed out (it flattens to mercator as it zooms in) or flat throughout. */
export function airspaceStyle(projection: "globe" | "mercator"): StyleSpecification {
  return {
    version: 8,
    projection: { type: projection },
    // No halo around the globe: its edge is the limb drawn over the map.
    sky: { "atmosphere-blend": 0 },
    glyphs: GLYPHS,
    sources: {
      tiles: { type: "vector", url: TILES },
      graticule: { type: "geojson", data: graticule() },
      // The Natural Earth land (land.ts), set once the map has loaded it.
      [LAND_SOURCE]: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      [AIRPORTS_SOURCE]: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      // The chart's land and sea, nothing on the globe.
      {
        id: "chart-land",
        type: "background",
        minzoom: GLOBE_FROM,
        paint: { "background-color": LAND, "background-opacity": toChart(0, 1) },
      },
      {
        id: "water",
        type: "fill",
        source: "tiles",
        "source-layer": "water",
        minzoom: GLOBE_FROM,
        paint: { "fill-color": WATER, "fill-opacity": toChart(0, 1) },
      },
      {
        id: "graticule",
        type: "line",
        source: "graticule",
        maxzoom: GLOBE_UNTIL,
        paint: { "line-color": paper(0.04), "line-width": 1, "line-opacity": toChart(1, 0) },
      },
      {
        id: "globe-land",
        type: "fill",
        source: LAND_SOURCE,
        maxzoom: GLOBE_UNTIL,
        paint: { "fill-color": paper(0.035), "fill-opacity": toChart(1, 0), "fill-antialias": false },
      },
      {
        id: "globe-coast",
        type: "line",
        source: LAND_SOURCE,
        maxzoom: GLOBE_UNTIL,
        paint: { "line-color": paper(0.2), "line-width": 0.7, "line-opacity": toChart(1, 0) },
      },
      {
        id: "coast",
        type: "line",
        source: "tiles",
        "source-layer": "water",
        minzoom: GLOBE_FROM,
        paint: {
          "line-color": paper(0.24),
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 8, 1],
          "line-opacity": toChart(0, 1),
        },
      },
      {
        id: "borders",
        type: "line",
        source: "tiles",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        minzoom: GLOBE_FROM,
        paint: { "line-color": paper(0.08), "line-width": 0.7, "line-opacity": toChart(0, 1) },
      },
      {
        id: "aprons",
        type: "fill",
        source: "tiles",
        "source-layer": "aeroway",
        minzoom: 12,
        filter: ["all", AREA, ["==", ["get", "class"], "apron"]],
        paint: { "fill-color": paper(0.05) },
      },
      {
        id: "taxiways",
        type: "line",
        source: "tiles",
        "source-layer": "aeroway",
        minzoom: 12,
        filter: ["all", LINE, ["==", ["get", "class"], "taxiway"]],
        paint: {
          "line-color": paper(0.16),
          "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, 0.6, 16, 6],
        },
      },
      {
        id: "runway-areas",
        type: "fill",
        source: "tiles",
        "source-layer": "aeroway",
        filter: ["all", AREA, ["==", ["get", "class"], "runway"]],
        paint: { "fill-color": paper(0.32) },
      },
      {
        id: "runways",
        type: "line",
        source: "tiles",
        "source-layer": "aeroway",
        filter: ["all", LINE, ["==", ["get", "class"], "runway"]],
        paint: {
          "line-color": paper(0.45),
          "line-width": ["interpolate", ["exponential", 2], ["zoom"], 10, 1, 16, 40],
        },
      },
      // The sim's airports from our own list, so only ones a pilot can fly to are marked: none on the whole globe,
      // where thousands of dots would only speckle it; large ones as rings from a continent, medium ones from a
      // region, and the ICAO code once there is room.
      {
        id: "airport-rings",
        type: "circle",
        source: AIRPORTS_SOURCE,
        minzoom: 3.5,
        maxzoom: 12,
        filter: ["any", ["==", ["get", "size"], "large"], [">=", ["zoom"], 5.5]],
        paint: {
          "circle-radius": ["match", ["get", "size"], "large", 3.5, 2.6],
          "circle-color": "rgba(0, 0, 0, 0)",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": ["match", ["get", "size"], "large", paper(0.55), paper(0.4)],
          "circle-pitch-alignment": "map",
        },
      },
      {
        id: "airport-codes",
        type: "symbol",
        source: AIRPORTS_SOURCE,
        minzoom: 4,
        filter: ["any", ["==", ["get", "size"], "large"], [">=", ["zoom"], 6.5]],
        layout: {
          "text-field": ["get", "code"],
          "text-font": FONT,
          "text-size": 10,
          "text-offset": [0, 1.3],
          "text-anchor": "top",
          // Large airports claim the space first.
          "symbol-sort-key": ["match", ["get", "size"], "large", 0, 1],
        },
        paint: { "text-color": ["match", ["get", "size"], "large", paper(0.55), paper(0.4)] },
      },
    ],
  };
}
