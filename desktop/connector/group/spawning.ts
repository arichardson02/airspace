import type { CoopMessage } from "@fs-career/contracts";
import type { SimConnectConnection } from "node-simconnect";
import { msfsFolders, type MsfsFolders } from "../msfs-paths.js";
import { aircraftPaths, composeSpawnFlight, loadedAircraftPath, saveFlight } from "../spawn/flight-file.js";
import type { AccountKeeper } from "../spawn/account.js";
import type { MenuLink, StoredValues } from "../spawn/menu.js";
import { coPilotView, takeSeat, watchCockpit } from "../spawn/seat.js";
import { spawnInto, type Spawn, type SpawnState } from "../spawn/spawn.js";

// Puts a co-pilot into the host's flight. When the host's hello shows the co-pilot isn't set up in it (still at the
// menus, another aircraft, or another airport), the co-pilot asks; the host saves its flight and sends it; the
// co-pilot's sim loads it, goes through the menus, and takes the right seat. Works for any aircraft both have.

// A co-pilot this far from the host is at another airport, not just another gate.
const SAME_AIRPORT_KM = 2;
// The camera moves to the co-pilot seat this soon after the cockpit appears, and again once the flight has
// started, since the sim can reset the view as it does.
const SEAT_AFTER_MS = [1_000, 4_000];

type Hello = Extract<CoopMessage, { type: "hello" }>;
export type SpawningMessage = Extract<CoopMessage, { type: "flight-request" | "flight-file" }>;
type Position = { latitude: number; longitude: number };

export interface Spawning {
  /** The host's hello arrived; `position` is where our own aircraft was before it started following. */
  onHostHello(hello: Hello, position: Position | undefined, title: string | undefined): void;
  receive(message: SpawningMessage): void;
  /** What the pilot should know about the spawn right now, if anything. */
  note(): string | undefined;
  /** The co-pilot left: a later one is set up again. */
  reset(): void;
  stop(): void;
}

export function startSpawning(options: {
  handle: SimConnectConnection;
  menu: MenuLink;
  accounts: AccountKeeper;
  /** The loaded aircraft's flight-plan account keys (none for most aircraft). */
  flightPlanAccountKeys: () => readonly string[];
  send: (message: CoopMessage) => void;
  changed: () => void;
}): Spawning {
  const { handle, menu, accounts, flightPlanAccountKeys, send, changed } = options;
  const folders = msfsFolders();
  let requested = false;
  let note: string | undefined;
  let spawn: Spawn | undefined;
  let seatTimers: ReturnType<typeof setTimeout>[] = [];
  let stopWatching: (() => void) | undefined;

  // Moves to the co-pilot seat as soon as the camera reaches the cockpit, whenever that is.
  const watchForCockpit = (paths: readonly string[]) => {
    stopWatching?.();
    stopWatching = watchCockpit(handle, () => {
      stopWatching?.();
      stopWatching = undefined;
      seatTimers = SEAT_AFTER_MS.map((delay) =>
        setTimeout(() => {
          sitInCoPilotSeat(handle, folders, paths);
        }, delay),
      );
    });
  };

  const setNote = (next: string | undefined) => {
    note = next;
    changed();
  };

  const sendFlight = async () => {
    try {
      const flt = await saveFlight(handle);
      const paths = folders === undefined ? [] : aircraftPaths(folders, await loadedAircraftPath(handle));
      // Not read yet (Airspace wasn't running while our main menu was open) or not set: nothing to lend.
      const account = accounts.own(flightPlanAccountKeys());
      const known = Object.values(account).some((value) => value !== null && value !== "");
      if (!known && Object.keys(account).length > 0) {
        console.warn("Our SimBrief account isn't known: start Airspace before Flight Simulator to share flight plans");
      }
      send({ type: "flight-file", flt, aircraftPaths: paths, flightPlanAccount: known ? account : {} });
      console.log("Sent our flight to the co-pilot");
    } catch (error) {
      console.warn(
        `Couldn't send our flight to the co-pilot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const onSpawnState = (paths: readonly string[], state: SpawnState) => {
    switch (state.stage) {
      case "loading":
        setNote("Loading the host's flight");
        break;
      case "needs-clicks":
        setNote(
          state.what === "world-map"
            ? "Click WORLD MAP, then FLY: the host's flight is already set up"
            : "Click READY TO FLY",
        );
        break;
      case "done":
        console.log("Spawned into the host's flight");
        setNote(undefined);
        break;
    }
  };

  const loadHostFlight = async (flt: string, paths: readonly string[], account: StoredValues) => {
    if (folders === undefined) {
      setNote("Couldn't find Flight Simulator's packages to load the host's flight");
      return;
    }
    const file = composeSpawnFlight(folders, flt, paths);
    if ("missing" in file) {
      setNote(`Install the ${file.missing} to fly with the host`);
      return;
    }
    // Written through the main menu before the flight launches; a co-pilot already in a flight keeps their own.
    if (Object.keys(account).length > 0) {
      const borrowed = await accounts.borrow(account);
      console.log(
        borrowed
          ? "Using the host's SimBrief account for the flight plan uplink"
          : "Couldn't use the host's SimBrief account: the main menu wasn't open",
      );
    }
    watchForCockpit(paths);
    spawn?.stop();
    spawn = spawnInto({
      handle,
      menu,
      flt: file.flt,
      onState: (state) => {
        onSpawnState(paths, state);
      },
    });
  };

  return {
    onHostHello(hello, position, title) {
      if (requested) return;
      const setUp =
        !menu.has("main-menu") &&
        hello.title !== null &&
        hello.title === title &&
        hello.position !== null &&
        position !== undefined &&
        distanceKm(position, hello.position) < SAME_AIRPORT_KM;
      if (setUp) return;
      requested = true;
      send({ type: "flight-request" });
      setNote("Asking the host for their flight");
    },
    receive(message) {
      if (message.type === "flight-request") void sendFlight();
      else void loadHostFlight(message.flt, message.aircraftPaths, message.flightPlanAccount);
    },
    note: () => note,
    reset() {
      requested = false;
      note = undefined;
      accounts.release();
    },
    stop() {
      spawn?.stop();
      stopWatching?.();
      for (const timer of seatTimers) clearTimeout(timer);
      accounts.release();
    },
  };
}

function sitInCoPilotSeat(
  handle: SimConnectConnection,
  folders: MsfsFolders | undefined,
  paths: readonly string[],
): void {
  const view = folders === undefined ? undefined : coPilotView(folders, paths);
  if (view === undefined) {
    console.warn("This aircraft has no co-pilot camera; staying in the pilot's seat");
    return;
  }
  takeSeat(handle, view);
}

/** Great-circle distance in kilometres. */
function distanceKm(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
