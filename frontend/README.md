# Frontend

The Next.js site at airspace.club. For now it is the marketing page; the signed-in app
will live beside it under `app/`.

## Running

```sh
pnpm install
pnpm dev
```

The site runs at `localhost:3000`. `pnpm lint` runs ESLint and `pnpm build` is what the
Docker image and App Platform run.

## Layout

```
app/                  root layout, home page, global CSS, icons
app/fonts/            Inter web files
components/           navbar, footer, intro, buttons, motion helpers, app mock-ups
components/sections/  the home page's sections, in page order
config/site.ts        name, description, Discord link, section list
lib/                  font loader, hooks, map dots
public/brand/         logo SVGs
public/demo/          sample Microsoft Flight Simulator shots for the mock-ups
scripts/              generates lib/world-dots.json for the hero map
```

## Motion

Scrolling goes through Lenis. Reveals follow the scrollbar (`components/scroll-group.tsx`),
cycling content rolls through `components/roll-stack.tsx`, numbers glide through
`components/counter.tsx`, and the Tour scenes play on timers from `lib/use-phases.ts`.
All of it drops to a plain state when the visitor prefers reduced motion.
