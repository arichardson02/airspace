# Airspace

Airspace (airspace.club) is a career app for Microsoft Flight Simulator 2020. Pilots install a desktop app that
connects to the simulator, sign in with their Airspace account, and fly. Their flights feed jobs, a logbook and
a shared-cockpit co-op mode, where two pilots fly one aircraft together.

This file is the short guide every task needs. Each area has its own guide in `.claude/skills/`, which Claude Code
loads only when a task touches that area; other agents and people can open them directly. Keep them current when
something they describe changes, and keep this file short: detail belongs in the area's guide.

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
it while changing it. `ui` is used as source, so its changes show up live. Each app reads its own `.env`; the
variables are in its area guide.

### Repo-wide commands (run at the root)

| Command                 | Does                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `pnpm lint`             | oxlint over every package, with type-aware rules (`.oxlintrc.json`) |
| `pnpm format`           | Prettier over every package (`.prettierrc.json`)                    |
| `pnpm format:check`     | Fails if anything isn't formatted                                   |
| `pnpm --filter <pkg> …` | Any package's script, e.g. `pnpm --filter connector typecheck`      |

There is one lint config, one format config and one `.gitignore` for the whole repo; packages don't have their own.

## Working conventions

- TypeScript everywhere, ESM, strict mode. Format with Prettier (double quotes, 120 columns) and keep
  `pnpm lint` clean.
- Comments explain why, not what, and read like the surrounding code. Match the naming and idiom around you.
- Commits use conventional messages scoped to the package: `feat(connector): …`, `fix(backend): …`.
- Tests are scaffolding: write them to confirm a flow, then delete them. There's no committed test suite or
  `test` script.
- Windows checkouts use CRLF in the working tree and LF in git; Prettier keeps whatever a file has
  (`endOfLine: "auto"`).
