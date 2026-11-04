import type { SimConnectConnection } from "node-simconnect";
import { loadFlight } from "./flight-file.js";
import type { MenuLink } from "./menu.js";

// Takes the co-pilot's sim into a flight, as a pilot would through the menus: the flight file sets the World Map's
// aircraft, airport and parking, then the menu script opens the World Map, presses FLY and, once the flight has
// loaded, READY TO FLY. In a flight, the flight file reloads it straight away and only READY TO FLY is left.

// FLY is pressed this long after the World Map is opened, then again until the menus close.
const STEP_MS = 3_000;
const LAUNCH_TRIES = 5;
// READY TO FLY only answers once the flight has loaded, so it's pressed until its page closes.
const READY_TOO_LONG_MS = 60_000;
// Without a READY TO FLY page by then, the flight loaded without one (or the menu package isn't installed).
const LOAD_TIMEOUT_MS = 120_000;

export type SpawnState =
  | { stage: "loading" }
  /** The menu script isn't there (first install needs a sim restart) or didn't get through: the pilot clicks. */
  | { stage: "needs-clicks"; what: "world-map" | "ready" }
  | { stage: "done" };

export interface Spawn {
  stop(): void;
}

export function spawnInto(options: {
  handle: SimConnectConnection;
  menu: MenuLink;
  flt: string;
  onState: (state: SpawnState) => void;
}): Spawn {
  const { handle, menu, flt, onState } = options;
  const started = Date.now();
  const scripted = menu.has("main-menu") || menu.has("world-map");
  let launches = 0;
  let lastSent = started;
  let readySince: number | undefined;
  let finished = false;

  loadFlight(handle, flt);
  if (menu.has("main-menu")) menu.send("main-menu", "open-world-map");
  onState(scripted ? { stage: "loading" } : { stage: "needs-clicks", what: "world-map" });

  const finish = () => {
    finished = true;
    clearInterval(timer);
    onState({ stage: "done" });
  };

  const atMenus = (now: number) => {
    if (now - lastSent < STEP_MS) return;
    if (launches >= LAUNCH_TRIES) {
      onState({ stage: "needs-clicks", what: "world-map" });
      return;
    }
    menu.send("world-map", "launch-flight");
    launches++;
    lastSent = now;
  };

  const atReady = (now: number) => {
    readySince ??= now;
    if (now - lastSent >= STEP_MS) {
      menu.send("ready-to-fly", "ready-to-fly");
      lastSent = now;
    }
    if (now - readySince > READY_TOO_LONG_MS) onState({ stage: "needs-clicks", what: "ready" });
  };

  const timer = setInterval(() => {
    if (finished) return;
    const now = Date.now();
    if (menu.has("ready-to-fly")) atReady(now);
    else if (readySince !== undefined) finish();
    else if (menu.has("main-menu")) atMenus(now);
    else if (now - started > LOAD_TIMEOUT_MS) finish();
  }, 1_000);

  return {
    stop() {
      finished = true;
      clearInterval(timer);
    },
  };
}
