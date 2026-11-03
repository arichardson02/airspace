<p align="center">
  <a href="https://airspace.club">
    <img src="docs/images/banner.svg" alt="airspace" width="100%">
  </a>
</p>

<h3 align="center">A new dynamic for your MSFS pilot.</h3>

<p align="center">
  <a href="https://airspace.club"><b>airspace.club</b></a> ·
  <a href="#develop">Develop</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

Airspace is an app for Microsoft Flight Simulator. A desktop app connects to the simulator, and your
flights turn into jobs, a logbook and ranks, shared with your club. Two pilots can also fly one aircraft together
in a shared cockpit.

## Develop

```sh
pnpm install                         # also turns on the pre-push quality gate
docker compose up -d                 # Postgres
pnpm --filter backend db:migrate
pnpm --filter backend start:dev      # API on :3000
pnpm --filter frontend dev           # website on :3001
pnpm --filter desktop dev            # desktop app
```

- [Contributing](CONTRIBUTING.md): setup, environment files, commands, and `pnpm check`, the quality gate that
  runs before every push
- [Agent guide](AGENTS.md): the rules for AI agents, package boundaries and the implementation standard
- Area guides: [backend](.claude/skills/backend/SKILL.md), [database](.claude/skills/database/SKILL.md),
  [auth](.claude/skills/auth/SKILL.md), [frontend](.claude/skills/frontend/SKILL.md),
  [connector](.claude/skills/connector/SKILL.md), [desktop](.claude/skills/desktop/SKILL.md),
  [design system](.claude/skills/design-system/SKILL.md), [infra and deploys](.claude/skills/infra/SKILL.md)

| Package      | What it is                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `backend/`   | NestJS API: auth, ingest, co-op signaling, Postgres via Drizzle                                |
| `frontend/`  | Next.js website: marketing page, sign-in pages, signed-in dashboard                            |
| `desktop/`   | Electron app pilots install; its connector talks to the simulator (SimConnect, sign-in, co-op) |
| `contracts/` | Types and zod schemas shared by the backend and desktop app                                    |
| `ui/`        | Shared design: theme, Inter, buttons, fields, logo                                             |
| `infra/`     | Terraform for DigitalOcean                                                                     |
