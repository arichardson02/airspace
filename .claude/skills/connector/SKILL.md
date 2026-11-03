---
name: connector
description: Airspace's simulator connector in desktop/connector/ — the Connector controller, SimConnect setup for MSFS 2020, device-code sign-in, the batched backend ingest client, position tracking, and shared-cockpit co-op over peer-to-peer WebRTC (node-datachannel). Use when working on SimConnect, flight data, co-op/group flying, control takeover, ConnectorStatus or ConnectorCommand.
---

# connector

The part that talks to the simulator. It lives in `desktop/connector/` and runs in the desktop app's main process;
`desktop/electron/main.ts` creates it with `createConnector()` and passes its status and commands to the window.
It has no Electron imports of its own.

- `app/`: `controller.ts` (the `Connector` class: keeps the pilot signed in, reconnects to the simulator every
  5 s, joins and leaves co-op groups), `status.ts` (the `ConnectorStatus` snapshot the window shows), `create.ts`
  (wires it to the real backend, SimConnect and co-op server).
- `auth/sign-in.ts` device-code sign-in; `backend-client.ts` batched ingest with retries; `track/` position
  tracking (currently switched off).
- `group/` and `flight/`: shared-cockpit co-op over peer-to-peer WebRTC (`node-datachannel`). The pilot flying
  streams their aircraft's state every frame; the other pilot's aircraft is frozen and follows it. Whoever moves
  their controls deliberately takes over, unless both are moving (dual input). `group/messages.ts` checks every
  message from the co-op server and the other pilot before it's used.
- SimConnect setup (data definitions, event mappings) happens once per simulator connection, because it can't
  be registered twice; joining a group only adds a session on top.
- MSFS 2020 only for now (SimConnect protocol KittyHawk). Everyone in a group flies the same aircraft.
- Window ↔ connector types are in `contracts/src/desktop.ts`: the connector sends a full `ConnectorStatus` on
  every change, the window sends `ConnectorCommand`s, which the main process parses with
  `connectorCommandSchema`. New features add to the status and commands.
- Fallow keeps it a separate zone: `desktop/electron` may import it, the window (`desktop/src`) may not.

## Environment

`desktop/.env`: `BACKEND_URL` (e.g. `http://localhost:3000/api` or `https://airspace.club/api`), read in
development. There is deliberately no `.env.example`: edit `.env` directly. Release builds bake their settings in
instead.
