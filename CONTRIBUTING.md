# Contributing to Airspace

## Set up a checkout

Requires Node 24, pnpm 12 (`packageManager` pins it) and Docker.

```sh
pnpm install                     # everything, from the repo root
docker compose up -d             # local Postgres 18 (compose.yaml)
pnpm --filter backend db:migrate
pnpm --filter backend start:dev  # http://localhost:3000/api
pnpm --filter frontend dev       # http://localhost:3001, proxies /api to the backend
pnpm --filter desktop dev        # the desktop app, with the connector inside
```

`pnpm install` also points git at the repo's hooks in `.githooks/`. `contracts` builds on install (its `prepare`
script); run `pnpm --filter @fs-career/contracts dev` to rebuild it while changing it. `ui` is used as source, so
its changes show up live.

Each app reads its own `.env`; the variables are in its guide: [backend](.claude/skills/backend/SKILL.md),
[desktop](.claude/skills/connector/SKILL.md) (`desktop/.env`, read by its connector) and
[frontend](.claude/skills/frontend/SKILL.md).

## Useful commands

Run at the root:

| Command                 | Does                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| `pnpm check`            | The full quality gate (below)                                                   |
| `pnpm lint`             | Oxlint over every package: type-aware and anti-slop rules (`oxlint.config.ts`)  |
| `pnpm format`           | Prettier over every package (`.prettierrc.json`)                                |
| `pnpm format:check`     | Fails if anything isn't formatted                                               |
| `pnpm fallow`           | Dead code, duplicates and complexity (`.fallowrc.json`), failing on any finding |
| `pnpm --filter <pkg> …` | Any package's script, e.g. `pnpm --filter desktop typecheck`                    |

There's one lint config, one format config and one `.gitignore` for the whole repo; packages don't have their own.
Files Fallow can't find as entry points (bundled or run by hand) are listed under `entry` in `.fallowrc.json`.

`pnpm check` runs a frozen-lockfile install, the format check, lint, the desktop (with its connector) and ui
typechecks, the backend and frontend builds, and `pnpm fallow`. The pre-push hook runs it before every push and cancels the push
if it fails. It checks the working tree, so commit or stash unrelated changes first. `git push --no-verify` skips
it, for emergencies only.

## Make a change

Keep the dependency direction intact (it's enforced; see `AGENTS.md`): `contracts` and `ui` import nothing else,
the apps import only what they're allowed to, and the desktop window never imports the connector.

Schema changes go through drizzle-kit migrations; see the [database guide](.claude/skills/database/SKILL.md).
Visual changes follow the [design system](.claude/skills/design-system/SKILL.md).

Commits use conventional messages scoped to the package: `feat(desktop): …`, `fix(backend): …`. Pushing to
`main` deploys the website and API ([infra guide](.claude/skills/infra/SKILL.md)).
