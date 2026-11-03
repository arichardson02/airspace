---
name: frontend
description: Airspace's Next.js 16 website in frontend/ — the marketing home page and its sections, sign-in pages under (auth)/, the signed-in app under /app on the shared shell, cacheComponents and Suspense rules, proxy.ts, typed routes, and the motion helpers (Lenis, scroll reveals, roll-stack, counters, Seam dividers). Use when writing or changing any Next.js page, component, route or frontend config.
---

# frontend (Next.js)

**This is not the Next.js you know.** Next 16 has breaking changes to APIs, conventions and file structure. Read
the relevant guide in `node_modules/next/dist/docs/` before writing Next code, and heed deprecation notices.
(`agentRules: false` in `next.config.ts` stops `next dev` creating an `AGENTS.md` here.)

- `cacheComponents` and `partialPrefetching` are on: anything that reads cookies or the session must sit inside
  a `<Suspense>` boundary. `proxy.ts` (formerly middleware) does an optimistic redirect to `/login` for
  `/app` and `/device`; pages check the session for real.
- Typed routes: run `npx next typegen` after adding a route.
- Layout: `app/` (pages; `(auth)/` holds login, signup, password reset and device approval; `app/app/` is the signed-in
  app on the shared shell: `shell.tsx` lists its pages and groups (Settings opens from the gear beside the pilot's
  name), each page under it is a route, and pages with no data yet use `empty-page.tsx`; the Overview leads with the Live
  map card on the MapLibre globe (`MapBackdrop`), then Co-op drawn by `Cockpit` and the Connector and Logbook
  cards; Live Map (`app/app/map/`) is the full interactive map), `components/` (navbar, footer, motion helpers,
  app mock-ups; `sections/` is the home page in order; its sections alternate `ink` and `ink-2`, and each change of
  tone is a `Seam` (`components/seam.tsx`), a halftone or line-density pattern drawn once on a canvas), `config/site.ts`, `lib/` (session, auth client, hooks),
  `public/demo/` (sim shots for the mock-ups).
- Motion: scrolling goes through Lenis. Reveals follow the scrollbar (`components/scroll-group.tsx`), cycling
  content rolls through `components/roll-stack.tsx`, numbers glide through `components/counter.tsx`, and the
  Tour scenes play on timers from `lib/use-phases.ts`. All of it drops to a plain state when the visitor prefers
  reduced motion.
- Links to a home page section use `SectionLink` (`components/section-link.tsx`), which scrolls without
  putting `#section` in the address bar. Don't use a bare `#id` href.
- `/lab` shows every `@fs-career/ui/instruments` component and the live map (zoom, traffic, and a fly toggle that feeds
  it like a real stream), with knobs to drive them. It 404s in production.
- Production builds a standalone server (`output: "standalone"`); see `Dockerfile`.
- Logo, mark, buttons, fields and `cn` come straight from `@fs-career/ui`; only what the website alone uses lives here.
  Look and feel is in the `design-system` guide.
