---
name: backend
description: Airspace's NestJS API in backend/ — routes under /api, the global auth guard, connector ingest handlers (POST /api/v1/ingest), the co-op signaling WebSocket and the database providers. Use when adding or changing endpoints, ingest message handlers, the group gateway, or backend env.
---

# backend (NestJS)

- Everything is served under `/api` (`app.setGlobalPrefix('api')`), and the App Platform ingress keeps the
  prefix. Better Auth matches its routes on the full path, so this must stay.
- **Auth is on by default.** `AuthModule` from `@thallesp/nestjs-better-auth` registers a global guard; mark
  public routes with `@AllowAnonymous()` (only `/api/health` today) and read the user with `@Session()`.
  `main.ts` creates the app with `bodyParser: false`, which Better Auth needs.
- `src/auth/`: `auth.ts` (Better Auth config), `auth.schema.ts` (its tables), `email.ts` (Resend sender). More in
  the `auth` guide.
- `src/ingest/`: `POST /api/v1/ingest` takes batches of connector messages (oRPC contract from `contracts`).
  Each message type has a handler folder under `handlers/` with its `*.handler.ts` and `*.schema.ts`; register
  new handlers in `IngestModule`. Batches run in one transaction, and `(connector_session_id, seq)` makes
  retries idempotent. Sessions belong to the signed-in user.
- `src/group/group.gateway.ts`: the co-op signaling WebSocket at `/api/group`. It authenticates the upgrade
  request from the session, takes the pilot's identity from it (clients can't claim one), and relays WebRTC
  offers between the pilots in a group. Flight data never goes through the server.
- `src/database/`: the pg pool and Drizzle providers (`DRIZZLE`), and `migrate.ts` for production migrations.
  Table and migration conventions are in the `database` guide.

## Environment

`backend/.env`: `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL`
(`http://localhost:3001` locally, the origin the browser uses), optional `RESEND_API_KEY` (without it, email
links are printed to the backend console), optional `DATABASE_CA_CERT`. Changing production env has an extra
step; see the `infra` guide.
