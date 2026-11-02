---
name: connector
description: Airspace's simulator connector in connector/ — the Connector controller, SimConnect setup for MSFS 2020, device-code sign-in, the batched backend ingest client, position tracking, and shared-cockpit co-op over peer-to-peer WebRTC (node-datachannel). Use when working on SimConnect, flight data, co-op/group flying, control takeover, ConnectorStatus or ConnectorCommand, or running the terminal connector.
---

# connector

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

## Environment

`connector/.env`: `BACKEND_URL` (e.g. `http://localhost:3000/api` or `https://airspace.club/api`) and, for the
terminal connector only, `GROUP_CODE`. There is deliberately no `connector/.env.example`: edit `.env` directly.
The desktop app in development reads this file too.
