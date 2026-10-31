# Airspace

Airspace (airspace.club) is a career app for Microsoft Flight Simulator 2020. Pilots install a desktop app that
connects to the simulator, sign in with their Airspace account, and fly. Their flights feed jobs, a logbook and
a shared-cockpit co-op mode, where two pilots fly one aircraft together.

This file is the one guide to the repo for people and coding agents. Keep it current when something it
describes changes.

## Repo layout

One pnpm workspace (`pnpm-workspace.yaml`, one `pnpm-lock.yaml`). Each package has its own `package.json`, and
packages depend on each other with `"workspace:*"`.

| Package      | What it is                                                                      | Runs where           |
| ------------ | ------------------------------------------------------------------------------- | -------------------- |
| `backend/`   | NestJS API: sign-in (Better Auth), connector ingest, co-op signaling, Postgres  | App Platform, `/api` |
| `frontend/`  | Next.js site: marketing page, sign-in pages, the signed-in app under `/app`     | App Platform, `/`    |
| `desktop/`   | Electron app pilots install; runs the connector and shows its window            | Pilots' Windows PCs  |
| `connector/` | The simulator connector: SimConnect, sign-in, backend client, co-op. Also a CLI | Inside `desktop/`    |
| `contracts/` | Types and zod schemas shared by backend, connector and desktop                  | Library              |
| `ui/`        | The shared design: theme tokens, Inter, buttons, fields, logo, panel            | Library              |
| `infra/`     | Terraform for DigitalOcean (App Platform app, managed Postgres)                 | HCP Terraform        |

Dependencies between them: `backend`, `connector` and `desktop` use `contracts`; `frontend` and `desktop` use
`ui`; `desktop` bundles `connector`'s source.

## Getting started

Requires Node 24, pnpm 12 (`packageManager` pins it) and Docker.

```sh
pnpm install                     # everything, from the repo root
docker compose up -d             # local Postgres 18 (compose.yaml)
pnpm --filter backend db:migrate
pnpm --filter backend start:dev  # http://localhost:3000/api
pnpm --filter frontend dev       # http://localhost:3001, proxies /api to the backend
pnpm --filter desktop dev        # the desktop app, with the connector inside
```

`contracts` builds on install (its `prepare` script); run `pnpm --filter @fs-career/contracts dev` to rebuild
it while changing it. `ui` is used as source, so its changes show up live.

### Environment files

- `backend/.env`: `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL`
  (`http://localhost:3001` locally, the origin the browser uses), optional `RESEND_API_KEY` (without it, email
  links are printed to the backend console), optional `DATABASE_CA_CERT`.
- `connector/.env`: `BACKEND_URL` (e.g. `http://localhost:3000/api` or `https://airspace.club/api`) and, for the
  terminal connector only, `GROUP_CODE`. There is deliberately no `connector/.env.example`: edit `.env` directly.
  The desktop app in development reads this file too.
- `frontend`: `BACKEND_URL` (defaults to `http://localhost:3000`).

### Repo-wide commands (run at the root)

| Command                 | Does                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `pnpm lint`             | oxlint over every package, with type-aware rules (`.oxlintrc.json`) |
| `pnpm format`           | Prettier over every package (`.prettierrc.json`)                    |
| `pnpm format:check`     | Fails if anything isn't formatted                                   |
| `pnpm --filter <pkg> …` | Any package's script, e.g. `pnpm --filter connector typecheck`      |

There is one lint config, one format config and one `.gitignore` for the whole repo; packages don't have their own.

## backend (NestJS)

- Everything is served under `/api` (`app.setGlobalPrefix('api')`), and the App Platform ingress keeps the
  prefix. Better Auth matches its routes on the full path, so this must stay.
- **Auth is on by default.** `AuthModule` from `@thallesp/nestjs-better-auth` registers a global guard; mark
  public routes with `@AllowAnonymous()` (only `/api/health` today) and read the user with `@Session()`.
  `main.ts` creates the app with `bodyParser: false`, which Better Auth needs.
- `src/auth/`: `auth.ts` (Better Auth config), `auth.schema.ts` (its tables), `email.ts` (Resend sender).
- `src/ingest/`: `POST /api/v1/ingest` takes batches of connector messages (oRPC contract from `contracts`).
  Each message type has a handler folder under `handlers/` with its `*.handler.ts` and `*.schema.ts`; register
  new handlers in `IngestModule`. Batches run in one transaction, and `(connector_session_id, seq)` makes
  retries idempotent. Sessions belong to the signed-in user.
- `src/group/group.gateway.ts`: the co-op signaling WebSocket at `/api/group`. It authenticates the upgrade
  request from the session, takes the pilot's identity from it (clients can't claim one), and relays WebRTC
  offers between the pilots in a group. Flight data never goes through the server.
- `src/database/`: the pg pool and Drizzle providers (`DRIZZLE`), and `migrate.ts` for production migrations.

## Database conventions

Postgres 18, Drizzle ORM, migrations generated by drizzle-kit.

- **Schemas live next to the code that owns them**, in `*.schema.ts` files anywhere under `backend/src`
  (`drizzle.config.ts` picks them all up). An ingest handler owns its tables; auth owns its own.
- **Naming:** table names are plural snake_case (`connector_sessions`, `positions`, `users`); SQL columns are
  snake_case and the Drizzle keys camelCase (`altitudeFt: doublePrecision("altitude_ft")`). Index names are
  `<table>_<columns>_idx`. Units go in the name (`_ft`, `_kts`, `_fpm`, `_lbs`, `_deg`).
- **Types:** `text` ids, `timestamp(…, { withTimezone: true })` for every time, `doublePrecision` for
  measurements. Foreign keys to `users` cascade on delete.
- **Migrations:** change a schema, then `pnpm --filter backend db:generate`, review the SQL in
  `backend/drizzle/`, commit it, and `db:migrate` locally. Never edit a migration that has been deployed.
  In production the `migrate` pre-deploy job (`node dist/database/migrate.js`) applies them before each
  release goes live.
- Better Auth's tables (`users`, `sessions`, `accounts`, `verifications`, `device_codes`) follow the same
  conventions through the Drizzle adapter (`usePlural: true`).

## Auth (Better Auth, our own database)

- Email and password only, with email verification required. Resend sends from `no-reply@airspace.club`.
  Sessions last 30 days and renew daily.
- **Website:** cookies on the site's own origin. In production the ingress routes `/api` to the backend; in
  development Next rewrites `/api/*` to it. Server components read the session through
  `frontend/lib/session.ts` (`requireUser()`).
- **Desktop app and connector:** sign in with a device code. The app shows a code, the pilot approves it at
  `airspace.club/device`, and the connector gets a session token (client ID `airspace-connector`) that it
  sends as `Authorization: Bearer`. It's saved in `%APPDATA%\Airspace\credentials.json`.
- Only the app pages need sign-in on the website. The marketing page stays public.

## frontend (Next.js)

**This is not the Next.js you know.** Next 16 has breaking changes to APIs, conventions and file structure. Read
the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next code, and heed deprecation
notices. (`agentRules: false` in `next.config.ts` stops `next dev` re-creating a separate AGENTS.md for this.)

- `cacheComponents` and `partialPrefetching` are on: anything that reads cookies or the session must sit inside
  a `<Suspense>` boundary. `proxy.ts` (formerly middleware) does an optimistic redirect to `/login` for
  `/app` and `/device`; pages check the session for real.
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

## connector

The part that talks to the simulator. It runs inside the desktop app, or on its own in a terminal
(`pnpm --filter connector start`, which prints the sign-in code and joins `GROUP_CODE`).

- `src/app/`: `controller.ts` (the `Connector` class: keeps the pilot signed in, reconnects to the simulator
  every 5 s, joins and leaves co-op groups), `status.ts` (the `ConnectorStatus` snapshot the window shows),
  `create.ts` (wires it to the real backend, SimConnect and co-op server), `commands.ts` (validates window
  commands).
- `src/auth/sign-in.ts` device-code sign-in; `src/backend-client.ts` batched ingest with retries;
  `src/track/` position tracking (currently switched off).
- `src/group/` and `src/flight/`: shared-cockpit co-op over peer-to-peer WebRTC (`node-datachannel`). The pilot
  flying streams their aircraft's state every frame; the other pilot's aircraft is frozen and follows it.
  Whoever moves their controls deliberately takes over, unless both are moving (dual input).
- SimConnect setup (data definitions, event mappings) happens once per simulator connection, because it can't
  be registered twice; joining a group only adds a session on top.
- MSFS 2020 only for now (SimConnect protocol KittyHawk). Everyone in a group flies the same aircraft.
- Window ↔ connector types are in `contracts/src/desktop.ts`: the connector sends a full `ConnectorStatus` on
  every change, the window sends `ConnectorCommand`s. New features add to the status and commands.

## desktop (Electron)

- `electron/main.ts` runs the connector in the main process, opens a frameless window, and passes status and
  commands over IPC. `electron/preload.ts` exposes only `window.airspace`; the page has no Node access.
  Closing the window quits the app; only one copy can run.
- `src/` is a Vite + React page in the website's design: sign-in, Home, Co-op and Settings.
- `pnpm --filter desktop dev` serves the page with hot reload and rebuilds and restarts Electron when
  `electron/` or the connector changes.
- `pnpm --filter desktop build` bundles the main process and connector with esbuild (so the app ships without
  `node_modules`), builds the page, and writes `desktop/release/Airspace Setup <version>.exe`, a per-user NSIS
  installer, built for `https://airspace.club/api` (`RELEASE_BACKEND_URL` overrides it).
  `node-datachannel`'s native addon ships beside the app in `resources/`. The installer isn't code-signed yet,
  so Windows shows "Windows protected your PC" (More info, then Run anyway).
- Not built yet: auto-update, a tray icon, start with Windows, release CI.

## Design system

Shared through `ui/` (`@fs-career/ui/theme.css`, components in `ui/src/`) so the website and the desktop app
look the same.

- Monotone: ink `#0b0d10`, paper `#f6f7f9`, muted `#8a8f98`, line `#22262c`. Emphasis is weight, size or
  inversion, never a second colour; errors get weight, not red.
- Inter is the only typeface (`ui/fonts`). Headings use the `display` utility (semibold, tight tracking).
- Pill buttons (`ActionButton`, `buttonClass`), dark glass panels (`Panel`), quiet cards (`border-paper/10
bg-paper/[0.03]`), rises with the quint ease (`[0.22, 1, 0.36, 1]`), and `MotionConfig reducedMotion="user"`.
- Pages show only real data. Empty states say what will appear ("Nothing yet"), never placeholder numbers.

## Infrastructure and deploys

DigitalOcean App Platform, managed by Terraform in `infra/` with state in HCP Terraform (organization
`fs-careers`, workspace `fs-career`).

- One domain, `airspace.club` (DNS at Namecheap: `@` ALIAS and `www` CNAME to the app's ondigitalocean.app
  host). The frontend serves `/`, and the backend serves `/api` with the prefix kept.
- Components: `backend` and `frontend` services (both built from the repo root with their Dockerfiles), a
  `migrate` pre-deploy job, a managed Postgres cluster (`fs-career-db`, database `fs_career`) firewalled to the
  app, and a DigitalOcean project grouping them.
- **Code deploys on every push to `main`.** Terraform is only for infrastructure changes.
- Running Terraform: export `DIGITALOCEAN_TOKEN`, `TF_CLOUD_ORGANIZATION=fs-careers` and
  `TF_WORKSPACE=fs-career`, then `terraform init`, `plan` and `apply` in `infra/`. Settings and secrets
  (`github_repo`, `better_auth_secret`, `resend_api_key`, `database_trusted_ips`) go in the uncommitted
  `infra/terraform.tfvars` (copy `terraform.tfvars.example`). `terraform init -backend=false && terraform
validate` checks the config without credentials.
- **Backend env changes need an extra step.** DigitalOcean only returns SECRET env values encrypted, so the
  backend and migrate env are in `ignore_changes`. To change them, remove that block, apply, and put it back.
- First-time setup: connect GitHub to DigitalOcean (Apps → Create App → GitHub), create a DigitalOcean API token,
  create the HCP organization and workspace (local execution, or remote with `DIGITALOCEAN_TOKEN` set there),
  then `terraform login`.

## Working conventions

- TypeScript everywhere, ESM, strict mode. Format with Prettier (double quotes, 120 columns) and keep
  `pnpm lint` clean.
- Comments explain why, not what, and read like the surrounding code. Match the naming and idiom around you.
- Commits use conventional messages scoped to the package: `feat(connector): …`, `fix(backend): …`.
- Tests are scaffolding: write them to confirm a flow, then delete them. There's no committed test suite or
  `test` script.
- Windows checkouts use CRLF in the working tree and LF in git; Prettier keeps whatever a file has
  (`endOfLine: "auto"`).
