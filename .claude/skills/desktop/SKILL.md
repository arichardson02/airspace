---
name: desktop
description: Airspace's Electron desktop app in desktop/ — the main process hosting the connector, the frameless window, preload and IPC (window.airspace), the Vite + React page (sign-in, Home, Co-op, Settings) with its view transitions and Lenis scrolling, dev hot reload, and the esbuild + NSIS installer build. Use when changing the desktop window or its pages, IPC, packaging, the installer, or release builds.
---

# desktop (Electron)

- `electron/main.ts` runs the connector (`desktop/connector/`, see the `connector` guide) in the main process, opens a
  frameless window, and passes status and commands over IPC. `electron/preload.ts` exposes only
  `window.airspace`; the page has no Node access. Closing the window quits the app; only one copy can run.
- `src/` is a Vite + React page on the shared app shell (`@fs-career/ui/shell`, see the `design-system` guide):
  sidebar with Home and Co-op in one unlabelled group, the pilot's card at its foot with the gear that opens
  Settings, and `StatCard`s. There's no page bar; the title bar and the headline name the page. Home's status line
  is the simulator (its name in full weight when connected), then two cards that both open something, each with an
  arrow after its label: "On the Web" on the live map's globe (`MapBackdrop`, the same card art as the website),
  which opens the pilot's dashboard in the browser (the `open-website` command), and Co-op, drawn by `Cockpit`.
  The Co-op page shows the same card once joined. It opens with the same drawn-on mark as the website
  (`@fs-career/ui/intro`), and sign-in sits on the route map: one card that shows a skeleton while the app checks,
  then the code, with a light tracing the code box while it waits for approval. Status updates run in
  `startTransition`, so signing in or out swaps the screens through React's `<ViewTransition>`
  (`screenTransition` from `@fs-career/ui/motion`). The page scrolls through Lenis (`lenis/react`), like the website.
- Window ↔ main process types are in `contracts/src/desktop.ts` (`ConnectorStatus` in, `WindowCommand` out). The
  main process parses commands with `windowCommandSchema`, handles `restart-to-update` itself and passes the rest
  (`ConnectorCommand`) to the connector.
- `pnpm --filter desktop dev` serves the page with hot reload and rebuilds and restarts Electron when
  `electron/` or `connector/` changes. In development it reads `desktop/.env`.
- `pnpm --filter desktop build` bundles the main process and connector with esbuild (so the app ships without
  `node_modules`), builds the page, and writes `desktop/release/Airspace-Setup-<version>.exe`, a per-user NSIS
  installer, with its `.blockmap` and `latest.yml`, built for `https://airspace.club/api` (`RELEASE_BACKEND_URL`
  overrides it). It never publishes (`--publish never`). `node-datachannel`'s native addon ships beside the app in
  `resources/`. The installer isn't code-signed yet, so Windows shows "Windows protected your PC" (More info, then
  Run anyway).
- **Releases:** `.github/workflows/desktop-release.yml` builds on a Windows runner and publishes a GitHub release
  (`desktop-v0.1.<run number>`, marked latest) on every push to `main` that touches `desktop/`, `contracts/`, `ui/`,
  the lockfile, the root `package.json`, `pnpm-workspace.yaml` or the workflow itself, or on demand (from `main`
  only). Any lockfile change releases, even a backend-only dependency bump. The version is set only in that build, never committed. Each release also carries
  `Airspace-Setup.exe`, so `airspace.club/download` always gets the newest installer. Keep the workflow's file name
  (the run number restarts if it changes) and the `appId` (a new one installs as a separate app).
- **Updates:** `electron/updater.ts` (packaged builds only) checks the latest release on launch and every 4 hours,
  downloads it in the background, and writes progress to the status's `update`. Once it's ready the title bar and
  Settings show a restart button (`restart-to-update`); the update turns `installing` and the main process stops the
  connector (waiting at most 10 seconds) before starting the installer, which closes the app. Ignored, it installs
  when the app quits. A downloaded update isn't replaced by a newer release until the app restarts.
- Not built yet: a tray icon, start with Windows.
