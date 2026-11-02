---
name: desktop
description: Airspace's Electron desktop app in desktop/ — the main process hosting the connector, the frameless window, preload and IPC (window.airspace), the Vite + React page (sign-in, Home, Co-op, Settings), dev hot reload, and the esbuild + NSIS installer build. Use when changing the desktop window or its pages, IPC, packaging, the installer, or release builds.
---

# desktop (Electron)

- `electron/main.ts` runs the connector in the main process, opens a frameless window, and passes status and
  commands over IPC. `electron/preload.ts` exposes only `window.airspace`; the page has no Node access.
  Closing the window quits the app; only one copy can run.
- `src/` is a Vite + React page in the website's design (see the `design-system` guide): sign-in, Home, Co-op
  and Settings.
- Window ↔ connector types are in `contracts/src/desktop.ts` (`ConnectorStatus` in, `ConnectorCommand` out).
- `pnpm --filter desktop dev` serves the page with hot reload and rebuilds and restarts Electron when
  `electron/` or the connector changes. In development it reads `connector/.env`.
- `pnpm --filter desktop build` bundles the main process and connector with esbuild (so the app ships without
  `node_modules`), builds the page, and writes `desktop/release/Airspace Setup <version>.exe`, a per-user NSIS
  installer, built for `https://airspace.club/api` (`RELEASE_BACKEND_URL` overrides it).
  `node-datachannel`'s native addon ships beside the app in `resources/`. The installer isn't code-signed yet,
  so Windows shows "Windows protected your PC" (More info, then Run anyway).
- Not built yet: auto-update, a tray icon, start with Windows, release CI.
