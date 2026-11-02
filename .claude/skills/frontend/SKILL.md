---
name: frontend
description: Airspace's Next.js 16 website in frontend/ — the marketing home page, sign-in pages under (auth)/, the signed-in dashboard under /app, cacheComponents and Suspense rules, proxy.ts, typed routes, and the motion helpers (Lenis, scroll reveals, roll-stack, counters). Use when writing or changing any Next.js page, component, route or frontend config.
---

# frontend (Next.js)

**This is not the Next.js you know.** Next 16 has breaking changes to APIs, conventions and file structure. Read
the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next code, and heed deprecation
notices. (`agentRules: false` in `next.config.ts` stops `next dev` re-creating a separate AGENTS.md for this.)

- `cacheComponents` and `partialPrefetching` are on: anything that reads cookies or the session must sit inside
  a `<Suspense>` boundary. `proxy.ts` (formerly middleware) does an optimistic redirect to `/login` for
  `/app` and `/device`; pages check the session for real (see the `auth` guide).
- Typed routes: run `npx next typegen` after adding a route.
- Layout: `app/` (pages; `(auth)/` holds login, signup, password reset and device approval; `app/app/` is the
  signed-in dashboard), `components/` (navbar, footer, motion helpers, app mock-ups; `sections/` is the home page
  in order), `config/site.ts`, `lib/` (session, auth client, hooks), `public/brand/` (logo SVGs),
  `public/demo/` (sim shots for the mock-ups), `scripts/` (generates `lib/world-dots.json` for the hero map).
- Motion: scrolling goes through Lenis. Reveals follow the scrollbar (`components/scroll-group.tsx`), cycling
  content rolls through `components/roll-stack.tsx`, numbers glide through `components/counter.tsx`, and the
  Tour scenes play on timers from `lib/use-phases.ts`. All of it drops to a plain state when the visitor prefers
  reduced motion.
- Production builds a standalone server (`output: "standalone"`); see `frontend/Dockerfile`.
- Env: `BACKEND_URL` (defaults to `http://localhost:3000`).
- Visual rules (colours, type, buttons, panels, empty states) are in the `design-system` guide.
