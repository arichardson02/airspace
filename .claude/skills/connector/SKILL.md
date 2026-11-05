---
name: connector
description: Airspace's simulator connector in desktop/connector/ — the Connector controller, SimConnect setup for MSFS 2020, device-code sign-in, the batched backend ingest client, position tracking, shared-cockpit co-op over peer-to-peer WebRTC (node-datachannel), per-aircraft cockpit profiles and cockpit sync (FBW A32NX first), MCDU sync through SimBridge, the in-sim module (MobiFlight WASM) for H:events, and the host's clock. Use when working on SimConnect, flight data, co-op/group flying, control takeover, aircraft profiles, cockpit or MCDU sync, ConnectorStatus or ConnectorCommand.
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
  streams their aircraft's state every frame; the other pilot's aircraft is frozen and follows it. On the ground below 25 kt only its position is frozen and its altitude and attitude are left to the sim, so it stays on its wheels and its systems know it's on the ground (ground power, weight on wheels); faster, it follows exactly as in the air. Whoever moves
  their controls deliberately takes over, unless both are moving (dual input). `group/messages.ts` checks every
  message from the co-op server and the other pilot before it's used. A session lives on the direct link alone: the co-op server only introduces peers, so when
  the connection to it drops the session keeps its peers and reconnects to it in the background. Peers send a
  heartbeat every second, and one silent for 5 s is treated as lost.
- SimConnect setup (data definitions, event mappings) happens once per simulator connection, because it can't
  be registered twice; joining a group only adds a session on top. `sim-ids.ts` holds every id range, and
  `createSimEvents` maps event names once per connection.
- **Aircraft profiles** (`aircraft/`): `profile.ts` is the vocabulary (`Control` = how to read a cockpit control and
  how to set it: its own variable, an event, a toggle, a momentary press, an input event, an H:event through the
  in-sim module, or custom code); `detect.ts` works out the loaded aircraft every 2 s (by ATC model and the
  aircraft's own variables, since liveries change the title); `profiles.ts` lists them, and anything unmatched uses
  `generic.ts` (motion and thrust levers only); `cockpit-io.ts` reads a profile's controls (changes only, tagged)
  and writes them. The A32NX profile is `aircraft/a32nx/` (one file per panel group, `mcdu.ts`, `flight-controls.ts`
  for what only the pilot flying sets). Adding an aircraft: [adding-an-aircraft.md](adding-an-aircraft.md).
- **Cockpit sync** (`group/cockpit-sync.ts`, `group/sharing.ts`): only controls the pilot touches sync, never their
  effects (each sim computes those). Changes go both ways regardless of who flies, batched every 50 ms; the newest
  change per control wins (`seq`, ties to the lower pilot id), and a value we set isn't sent back when it reads back.
  Peers exchange a `hello` (aircraft, profile id and version); cockpits sync only between equal profiles, else only
  the motion is shared and the window says why. The aircraft loaded first sends a snapshot. Controls marked `fromHost` (the A32NX's flyPad options, `aircraft/a32nx/flypad.ts`) are the host's: only the host sends them, and the other side is set back to the host's value when its own changes. The pilot flying's
  flyer-only controls ride in the flight message every frame.
- **MCDU** (`aircraft/a32nx/mcdu.ts`): presses are seen through each key's push-animation L:var and replayed through
  FlyByWire SimBridge (`ws://127.0.0.1:8380/interfaces/v1/mcdu`), which both pilots run with SimBridge turned on in
  the flyPad. Presses since the aircraft loaded are kept, so a co-pilot joining late with an untouched FMS gets them
  replayed.
- **In-sim module** (`sim-code.ts`): MobiFlight's WASM module runs calculator code inside the sim, the only way to
  fire H:events (the A32NX's ECAM control panel). The desktop app installs it into the Community folder
  (`electron/sim-module.ts`); MSFS loads it at its next start.
- **Time** (`clock/`, separate from aircraft): the host (whoever was in the group first) sends its date and time on
  join and every minute, and the other sim's clock is set to it when it's off by more than a minute. Weather isn't
  synced: MSFS 2020 doesn't let outside apps set it.
- **Co-pilot spawn** (`group/spawning.ts`, `spawn/`, any aircraft): when the host's hello shows the co-pilot isn't in
  the host's flight (at the menus, another aircraft, or more than 2 km away), the co-pilot sends `flight-request`. The
  host `flightSave`s and sends `flight-file`. The co-pilot builds a spawn file (`spawn/flight-file.ts`) from the host's
  non-state sections (aircraft, `ATC_Aircraft.0` parking, position, time, weather, fuel, payload) plus the state
  sections of its own aircraft's state file (`apron.flt` at a gate). Loading the host's full state breaks complex
  aircraft, and dropping the state raised the A32NX's gear. It then `flightLoad`s it and drives the menus through
  `spawn/menu.ts`: a WebSocket on 127.0.0.1:8391 that the menu script (`desktop/sim-package/airspace-menu.ts`) in three
  menu pages connects to. The script opens the World Map tile, presses FLY (`LAUNCH_FLIGHT`) and READY TO FLY
  (`LaunchFlowEvent("END_BRIEFING")` from its own page, retried until loaded), all with the sim in the background.
  `spawn/seat.ts` sets the co-pilot camera about a second after `CAMERA STATE` reaches the cockpit, from
  `cameras.cfg`. The host's SimBrief pilot ID (their Airspace account setting, saved on the website and fetched
  fresh when the flight is sent) travels with the flight file. The co-pilot's sim writes it to each profile's
  `simbriefPilotIdKey` (the A32NX's flyPad SimBrief ID, in the sim's stored data) through the main menu while
  spawning (`spawn/account.ts`), so a mirrored INIT uplink loads the host's plan. The co-pilot's own value goes
  back once the session ends; until then it's kept in `%APPDATA%/Airspace/borrowed-flight-plan-account.json`.
  Without the menu script the Co-op page says
  what to click. `msfs-paths.ts` finds Community, Official and the game's core packages (Store `XboxGames`, Steam).
- MSFS 2020 only for now (SimConnect protocol KittyHawk). Everyone in a group flies the same aircraft.
- Window ↔ connector types are in `contracts/src/desktop.ts`: the connector sends a full `ConnectorStatus` on
  every change, the window sends commands, which the main process parses with `windowCommandSchema` and passes on
  as `ConnectorCommand`s. The status's `update` belongs to the main process's updater, not the connector. New
  features add to the status and commands.
- Fallow keeps it a separate zone: `desktop/electron` may import it, the window (`desktop/src`) may not.

## Environment

`desktop/.env`: `BACKEND_URL` (e.g. `http://localhost:3000/api` or `https://airspace.club/api`), read in
development. There is deliberately no `.env.example`: edit `.env` directly. Release builds bake their settings in
instead.
