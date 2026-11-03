---
name: design-system
description: Airspace's shared visual design and the ui/ package — the monotone palette, Inter only, the three skeuomorphic depths (surface, well, surface-button) and paper key, per-card art textures, instruments and the map globe, shell and cards, view transitions, quint-ease motion, reduced motion, and real-data-only empty states. Use for any UI, styling, layout, copy on screen, animation or component work on the website or desktop app, and any change inside ui/.
---

# Design system

Shared through `ui/` (`@fs-career/ui/theme.css`, components in `ui/src/`) so the website and the desktop app
look the same.

- Monotone: ink `#0b0d10`, paper `#f6f7f9`, muted `#8a8f98`, line `#22262c`. Emphasis is weight, size or
  inversion, never a second colour; errors get weight, not red. The Discord pill is the one exception.
- Inter is the only typeface (`ui/fonts`). Headings use the `display` utility (semibold, tight tracking) and
  Title Case.
- Soft, clean skeuomorphism in three depths lit from above: cards are raised (`surface`), anything read or
  typed into inside them is sunk (`well`: rows, tab tracks, fields, bars), and controls are raised keys
  (`surface-button`, and `surface-paper` for the paper pill). No flat `bg-paper/6` boxes.
- Every card has its own quiet light or texture (`Glow`, `Beam`, `Hatch`, `Grid` or its instrument), and art never
  sits sharp under text: `text-veil` frosts it there.
- Pill buttons (`ActionButton`, `buttonClass`), dark glass panels (`Panel`), rises with the quint ease
  (`[0.22, 1, 0.36, 1]`), and `MotionConfig reducedMotion="user"`.
- Signed-in screens use the app shell in `ui/src/shell`: sidebar with grouped items and a gliding selected
  marker, the pilot's name at the foot, a headline with the name muted, and cards that are a label, a value
  and one fact that never wraps. The web app adds a page bar; the desktop app doesn't. No chips, badges,
  counts or icon tiles. Card art is a live instrument from `@fs-career/ui/instruments`, never an icon.
- Pages show only real data. Empty states say what will appear ("Nothing yet"), never placeholder numbers.
- Copy is plain: no em dashes (use a hyphen), no filler, no slogans. The landing page title is "Airspace";
  signed-in pages are "Airspace · Page".

## The `ui` package

The design the website and the desktop app share. It ships TypeScript source (`transpilePackages` in the
frontend, Vite in the desktop app), so changes show up live in both.

- `theme.css` (`@fs-career/ui/theme.css`): colour tokens, font, the `display` utility and the three depths, all lit
  from above: `surface` (a raised card, the sidebar marker), `well` (sunk into a card: rows, tracks, fields,
  readouts) and `surface-button` (a raised key: the ghost button, the selected tab in a `well` track), with
  `surface-paper` the paper key for the main action. `text-veil` frosts a card's art where it runs under the text;
  `StatCard` adds it whenever the card has art. `skeleton` is a loading placeholder, `trace` a faint light circling an
  element's border while it waits on the pilot, and the `::view-transition` rules style `screenTransition` and
  `logoTransition` (`src/motion/motion.ts`), the props for React's `<ViewTransition>`.
- `fonts/`: Inter.
- `src/primitives/`: `button.tsx` (`ActionButton`, `buttonClass`), `field.tsx`, `panel.tsx`.
- `src/brand/`: `logo.tsx` and `mark.tsx`, drawn in `currentColor`.
- `src/motion/`: `motion.ts` (`ease`, `rise`), `intro.tsx` (the drawn-on mark opening, `INTRO_SECONDS`,
  `useIntroDone`), `flight-map.tsx` and its `world-dots.json`. `pnpm --filter @fs-career/ui world-dots`
  regenerates the dots.
- `src/shell/`: the signed-in app's frame, shared by the dashboard and the desktop app. `sidebar.tsx` has
  `Sidebar`, `SidebarSection`, `SidebarItem` (gliding marker, takes the app's router link), `SidebarAccount` (the
  pilot's card with the settings gear beside it), `Avatar` and `firstName`; `page.tsx` has `PageBar`, `Page`,
  `CardGrid` and `StatCard` (label, value, one-line fact, optional background and art, and a `size`: `md` is 220px
  tall for a strip of art like `DayChart` or `RankLadder`, `lg` is 280px for an instrument that needs room to read);
  `settings.tsx` has `AccountHeader`, `SettingsGroup` and `SettingsRow`, which both settings pages are built from.
- `src/instruments/` (`@fs-career/ui/instruments`): card art that takes live data and animates to it, given to
  `StatCard` as `background` or `art`. Each instrument card has its own quiet treatment rather than one texture
  everywhere: `Beam` (a smooth diagonal corner light, under `Cockpit`) and `Hatch` (diagonal hatching, under
  `AltitudeTape`); `Grid` (a dot grid lit from the top-right corner, for list cards); `Glow` (a smooth radial light) is for cards with no instrument, like the Simulator card and empty
  states. The live-map card uses `MapBackdrop` from `src/map`. `Scope` is a radar bleeding off the
  right edge. `AltitudeTape` (a PFD tape under a rolling readout) and `Cockpit` (who has control) stand in `Pitched`
  perspective. `WindField` is one canvas. `DayChart` is the day's flights across the day with row rules (no axis or
  clock line; the bars' states show where the day is), and `RouteChart` is the last flight's great circle over the real coastline (fitted into the
  card's right part, worked out once per route and size; `from` and `to` are places with a code, lon and lat); both
  fill the card themselves, so they go in as `background`. `RankLadder` is a track whose link to the next rank fills
  with `progress`, with a light behind the current rank. They move with motion values, CSS animations or one canvas
  loop, never a React render per frame; loops stop off screen and in a hidden tab, nothing carries an SVG filter, and
  every one honours reduced motion. `svg.ts` holds what they share (`round`, `clamp`, `useSvgId`, `seeded`,
  `follow`, `useShown`) and `dots.tsx` the dot. A gauge fed by a stream of readings (the altitude tape) moves through
  `useReading` (`reading.ts`), which keeps going at the reading's measured rate between updates instead of a spring
  lurching at each one. The website's `/lab` shows them with knobs.
- `src/map/` (`@fs-career/ui/map`): `Map`, the live map, and `MapBackdrop`, the one globe every card shows (the
  landing page, the dashboard, the desktop app): a huge still globe past the card's right edge, 1.6 card heights in
  radius, its limb crossing the card 42% in and `focus` turned to 74% across, with `pilots` on it. It lays the map out
  wider than the card, centred on the globe, and uses `Map`'s `globeRadius` (zoom to whatever draws the globe that
  size) and `anchor` (turn the globe until a place lands at a given x), both measured from MapLibre's own projection.
  - `Map` is MapLibre GL (`maplibre-gl`, fetched only when a map mounts; its worker file is pointed at with
    `new URL(..., import.meta.url)`, which both bundlers copy). Zoomed out it is a globe that flattens as it zooms in
    (`projection="mercator"` keeps it flat); `zoom` is a MapLibre zoom level from `MIN_ZOOM` to `MAX_ZOOM`. MapLibre
    handles wheel, pinch, drag and flick, north up with no tilt, and takes the wheel from Lenis (`data-lenis-prevent`);
    `onViewChange` reports the view after a viewer's gesture. The chart is drawn from OpenFreeMap's vector tiles
    (OpenStreetMap in the OpenMapTiles schema) in our own style, `style.ts`. Zoomed out it is the globe: no sea of
    its own (the page shows through), the Natural Earth land as a faint wash with a hairline coast, a faint
    graticule, and the limb with a soft light inside it, drawn by `draw.ts`. From `GLOBE_FROM` to `GLOBE_UNTIL` it
    turns into the tiles' chart: ink sea, the land wash, finer coast, faint borders, and airports, whose runways,
    taxiways and aprons appear from zoom 10. No roads, buildings or places. Airports are not drawn on the whole globe. Self-hosting the tiles later means pointing `TILES` there at a file in the same schema. The data's credits
    sit behind a small "i" on the live map; a card's still picture (`MapBackdrop`) carries none and leads there.
  - Routes, trails and aircraft are one canvas over MapLibre (`draw.ts`, labels as cached bitmaps from `label.ts`),
    placed with `map.project` and left out over the globe's horizon. It is drawn after each MapLibre frame while the
    map moves, and by one animation frame loop while it is still, so aircraft glide without MapLibre redrawing the
    chart. Aircraft are drawn a little more than the slowest recent gap between fixes in the past, on a smooth curve
    through the last few timestamped fixes (along the route line when the pilot has one), at exact sub-pixel positions,
    so a 1 Hz feed looks continuous. Zoomed out past a continent they are points with no routes or trails, and only
    club pilots and the viewer are named.
  - Airports: the major ones the sim ships, open large and medium airports with an ICAO code from OurAirports (public
    domain), in `src/map/airports/large.json` and `medium.json`, rebuilt by `pnpm --filter @fs-career/ui airports`.
    Each is its own chunk (`airports.ts`: `loadAirports`, `useAirports`). The map shows only these, as a GeoJSON
    source: large ones as dots from the world view and rings past a continent, medium ones from a region, ICAO codes
    placed by MapLibre with large ones first.
  - The Natural Earth 50m land (`land-50m.json`, copied from `world-atlas` by `pnpm --filter @fs-career/ui basemap`)
    is the globe's land and `RouteChart`'s coast. `land.ts` fetches it as its own chunk the first time one draws.
- `src/cn.ts`: the class merger.
- Apps import by name (`@fs-career/ui/button`, `@fs-career/ui/intro`); the folders are hidden by the
  `exports` map in `package.json`, so add an entry there for anything new.
- Something belongs here when both apps use it. Anything only one app uses stays in that app.
- A change here affects both apps: check the website and the desktop window.
