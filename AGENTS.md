# Working on Airspace

Airspace (airspace.club) is a career app for Microsoft Flight Simulator 2020. Pilots install a desktop app that
connects to the simulator, sign in with their Airspace account, and fly. Their flights feed jobs, a logbook and
a shared-cockpit co-op mode, where two pilots fly one aircraft together. Describe only what the code does today;
never present a planned feature as built.

This file holds the rules every task needs. Setup and commands for people are in `CONTRIBUTING.md`. Each area has
its own guide in `.claude/skills/`, which Claude Code loads only when a task touches that area; other agents can
open them directly. Keep them current when something they describe changes, and keep this file short.

## Start here

1. Read the area guide for what you're changing before changing it. Direct user instructions take precedence.
2. Work only in the assigned scope. Don't weaken, bypass or relabel a failing check. Raise contradictions instead
   of silently redesigning around them.
3. Check `git status` before editing and preserve unrelated work; several agents may be changing the repo at once.

## Area guides

| Guide                                                  | Read it when working on                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| [backend](.claude/skills/backend/SKILL.md)             | The NestJS API: routes, ingest handlers, co-op signaling gateway |
| [database](.claude/skills/database/SKILL.md)           | Drizzle schemas, tables, migrations, naming                      |
| [auth](.claude/skills/auth/SKILL.md)                   | Sign-in, sessions, device codes, email, Better Auth              |
| [frontend](.claude/skills/frontend/SKILL.md)           | The Next.js site: pages, `/app`, motion, marketing sections      |
| [connector](.claude/skills/connector/SKILL.md)         | SimConnect, the backend client, co-op over WebRTC                |
| [desktop](.claude/skills/desktop/SKILL.md)             | The Electron app, its window, IPC and the installer              |
| [design-system](.claude/skills/design-system/SKILL.md) | Anything visual on the website or desktop app; `ui/`             |
| [infra](.claude/skills/infra/SKILL.md)                 | Deploys, Terraform, DigitalOcean, DNS, production env            |

Tool skill: `fallow` (dead code, duplication, boundaries and changed-code audits), copied from the pinned
`fallow` package's `skills/fallow/`; recopy it when that version changes.

## Repo layout and boundaries

One pnpm workspace. Each package has its own `package.json`; packages depend on each other with `"workspace:*"`.

| Package      | What it is                                                                     | Runs where           |
| ------------ | ------------------------------------------------------------------------------ | -------------------- |
| `backend/`   | NestJS API: sign-in (Better Auth), connector ingest, co-op signaling, Postgres | App Platform, `/api` |
| `frontend/`  | Next.js site: marketing page, sign-in pages, the signed-in app under `/app`    | App Platform, `/`    |
| `desktop/`   | Electron app pilots install; its `connector/` talks to the simulator           | Pilots' Windows PCs  |
| `contracts/` | Types and zod schemas shared by backend and desktop                            | Library              |
| `ui/`        | The shared design: theme tokens, Inter, buttons, fields, logo, panel           | Library              |
| `infra/`     | Terraform for DigitalOcean (App Platform app, managed Postgres)                | HCP Terraform        |

Fallow enforces the dependency direction (`boundaries` in `.fallowrc.json`):

- `contracts` and `ui` import no other package.
- `backend` and `desktop/connector` may use `contracts`; `frontend` may use `ui`.
- `desktop/electron` (main process) may use `contracts` and `desktop/connector`; `desktop/src` (the window) may use
  `contracts` and `ui`, never the connector or Node APIs. It talks to the main process only through
  `window.airspace`.
- `desktop/sim-package` runs inside the simulator's menus and imports nothing. Only its loader is installed into the
  sim (changing it needs a sim restart); the menu code is sent at runtime.
- Flight data never goes through the server; co-op streams peer to peer.

## Implementation standard

- Prefer the smallest complete change. Avoid compatibility aliases, speculative extension points, and wrappers
  around a single call.
- Parse untrusted values (request bodies, IPC messages, WebSocket and data-channel messages, `.env`) once at the
  boundary with zod, and keep the resulting type. Don't widen known values and cast them back later.
- Avoid type assertions. When one is unavoidable, put a `// SAFETY:` comment directly above it that names the
  invariant that was checked.
- Make invalid states hard to represent with focused types and explicit state transitions.
- Exported functions and components declare their return types.
- Comments explain why: invariants, ownership, wire compatibility, a surprising constraint. Delete narration that
  repeats the code. Match the naming and idiom around you.
- Keep diffs focused. Delete superseded code and dead exports in the same change. Don't add a dependency when a
  small local implementation is clear.

Oxlint (`oxlint.config.ts`) runs strict type-aware rules plus the vendored `anti-slop` rules
(`tools/oxlint/anti-slop/`), and fails on warnings. Treat a failure as evidence of a design or boundary problem
first. Use a narrow exception only when the code documents a real invariant the rule can't see, and never add a
disable comment just to get a check through. Fallow suppressions need a reason
(`// fallow-ignore-next-line <rule> -- <why>`).

Use the `fallow` skill for dead-code, duplication, boundary or changed-code audits. Agent runs use JSON and quiet
output. Never run its watch mode, enable telemetry, or apply `fallow fix` before reviewing a dry run, and check
that removed dependencies aren't referenced by name in config (as `@tailwindcss/turbopack` is in
`next.config.ts`).

## Conventions

- TypeScript everywhere, ESM, strict mode. Prettier: double quotes, 120 columns.
- Commits use conventional messages scoped to the package: `feat(desktop): …`, `fix(backend): …`.
- Tests are scaffolding: write them to confirm a flow, then delete them. There's no committed test suite or
  `test` script.
- Windows checkouts use CRLF in the working tree and LF in git; Prettier keeps whatever a file has.

## Quality gate

`pnpm check` is the gate: a frozen-lockfile install, `format:check`, `lint`, the desktop (with its connector) and
ui typechecks, the backend and frontend builds, and `pnpm fallow` (dead code, duplicates and complexity, failing on
any finding). Run the narrowest relevant check while iterating and `pnpm check` before handing off.

It runs in two places:

- **Before every push**, from `.githooks/pre-push`. A failure cancels the push. Never skip it with `--no-verify`;
  fix what fails, or ask.
- **When a Claude Code session ends** with changes, from the Stop hook in `.claude/settings.json`
  (`scripts/agent-quality-gate.ts`). If it reports a failed or unverified state, report that as the blocker and
  don't call the work verified.

## Writing

Use plain, specific prose in docs, guides and commit messages. Keep claims tied to code that exists.
