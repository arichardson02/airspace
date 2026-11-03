# Airspace

A career app for Microsoft Flight Simulator 2020, at [airspace.club](https://airspace.club). Pilots install the
Airspace desktop app, sign in, and fly; Airspace turns their flights into jobs, a logbook and rank, and lets two
pilots share one cockpit in co-op.

> **Working in this repo:** people start with [CONTRIBUTING.md](CONTRIBUTING.md) (setup, commands, the quality
> gate); AI agents follow [AGENTS.md](AGENTS.md) (rules, boundaries) and the area guides it points to in
> `.claude/skills/`. This README is the overview.

## How it fits together

```
 Pilot's Windows PC                                         airspace.club (DigitalOcean App Platform)
┌──────────────────────────────────────┐                  ┌─────────────────────────────────────────────┐
│ Microsoft Flight Simulator 2020      │                  │ frontend  (Next.js)          /              │
│        ▲ SimConnect                  │   HTTPS + WSS    │   marketing, sign-in, /app dashboard        │
│        ▼                             │ ───────────────▶ │ backend   (NestJS)           /api           │
│ Airspace desktop app (Electron)      │  Bearer token    │   Better Auth, ingest, co-op signaling      │
│   connector in the main process      │                  │        │                                    │
│   window: sign-in, Home, Co-op       │                  │        ▼                                    │
└──────────────────────────────────────┘                  │ Postgres (managed, Drizzle migrations)      │
        ▲                                                  └─────────────────────────────────────────────┘
        │ WebRTC, peer to peer (co-op flight data never goes through the server)
        ▼
 The co-pilot's desktop app
```

- **Signing in:** accounts are email and password (Better Auth, in our own Postgres). The desktop app signs in
  with a device code that the pilot approves on airspace.club/device. More in
  [the auth guide](.claude/skills/auth/SKILL.md).
- **Flights:** the connector reads the simulator over SimConnect and sends batches of messages to
  `POST /api/v1/ingest`, typed by the shared `contracts` package.
- **Co-op:** two pilots join the same group code. The backend only introduces them (WebSocket `/api/group`);
  the aircraft state then streams directly between their apps, and whoever moves their controls flies. More in
  [the connector guide](.claude/skills/connector/SKILL.md).
- **Data:** Postgres tables follow the conventions in
  [the database guide](.claude/skills/database/SKILL.md).

## The repo

A pnpm workspace with one lockfile:

| Package                                              | What it is                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| [`backend/`](.claude/skills/backend/SKILL.md)        | NestJS API: auth, ingest, co-op signaling, Postgres via Drizzle           |
| [`frontend/`](.claude/skills/frontend/SKILL.md)      | Next.js website: marketing page, sign-in pages, signed-in dashboard       |
| [`desktop/`](.claude/skills/desktop/SKILL.md)        | Electron app pilots install; hosts the connector                          |
| [`connector/`](.claude/skills/connector/SKILL.md)    | Simulator connector (SimConnect, sign-in, co-op); also runs in a terminal |
| [`contracts/`](AGENTS.md#repo-layout-and-boundaries) | Types and zod schemas shared by the backend, connector and desktop app    |
| [`ui/`](.claude/skills/design-system/SKILL.md)       | Shared design: theme, Inter, buttons, fields, logo                        |
| [`infra/`](.claude/skills/infra/SKILL.md)            | Terraform for DigitalOcean                                                |

Stack: TypeScript everywhere, Node 24, pnpm 12, NestJS 12, Next.js 16, React 19, Tailwind 4, Electron,
Drizzle with Postgres 18, Better Auth, Oxlint (with the anti-slop rules), Fallow and Prettier. How we write code
is in [AGENTS.md: Implementation standard](AGENTS.md#implementation-standard).

## Quick start

```sh
pnpm install
docker compose up -d                 # Postgres
pnpm --filter backend db:migrate
pnpm --filter backend start:dev      # API on :3000
pnpm --filter frontend dev           # website on :3001
pnpm --filter desktop dev            # desktop app
```

Each app reads its own `.env` (listed in its [area guide](AGENTS.md#area-guides)). `pnpm check` runs the whole
quality gate, and runs before every push ([Useful commands](CONTRIBUTING.md#useful-commands)). Pushing to `main`
deploys the website and API ([Infrastructure and deploys](.claude/skills/infra/SKILL.md)). Full setup is in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Status

Built: accounts and sign-in on the website and desktop app, the desktop app with its installer, connector
ingest, and shared-cockpit co-op. Next up: jobs, the logbook and rank on the dashboard, flight recording,
auto-update and release builds for the desktop app, and code signing.
