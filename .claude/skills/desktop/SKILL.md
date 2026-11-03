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
- Window ↔ connector types are in `contracts/src/desktop.ts` (`ConnectorStatus` in, `ConnectorCommand` out).
- `pnpm --filter desktop dev` serves the page with hot reload and rebuilds and restarts Electron when
  `electron/` or `connector/` changes. In development it reads `desktop/.env`.
- `pnpm --filter desktop build` bundles the main process and connector with esbuild (so the app ships without
  `node_modules`), builds the page, and writes `desktop/release/Airspace Setup <version>.exe`, a per-user NSIS
  installer, built for `https://airspace.club/api` (`RELEASE_BACKEND_URL` overrides it).
  `node-datachannel`'s native addon ships beside the app in `resources/`. The installer isn't code-signed yet,
  so Windows shows "Windows protected your PC" (More info, then Run anyway).
- Not built yet: auto-update, a tray icon, start with Windows, release CI.
