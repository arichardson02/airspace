// Runs inside Flight Simulator's menu pages: the desktop app installs a package that adds it to the main menu
// (FlowBar), the World Map and READY TO FLY. It connects to the app on 127.0.0.1 and lets it drive the menus while
// the sim is in the background, taking only these three commands. Built to ES2017 for the sim's browser engine.

// Globals of the menu pages: Coherent GT's bridge to the game, and Asobo's menu flow (common.js).
declare const Coherent: { trigger(event: string, ...args: unknown[]): void };
declare function LaunchFlowEvent(eventName: string, ...args: unknown[]): void;
// The sim's stored data, where aircraft keep settings (the A32NX's SimBrief ID); readable from the main menu.
declare function GetStoredData(key: string): string | null;
declare function SetStoredData(key: string, value: string): void;
declare function DeleteStoredData(key: string): void;

/** A main-menu tile; pressing it the game's way sends its widget id, which changes every launch. */
interface WidgetMenuButton extends HTMLElement {
  onValidate(): void;
}

// MENU_PORT in desktop/connector/spawn/menu.ts.
const PORT = 8391;
const RECONNECT_MS = 3_000;

const PAGES = new Map([
  ["/Pages/FlowBar/FlowBarPage.html", "main-menu"],
  ["/Pages/FlightPlanning/FlightPlanningPage.html", "world-map"],
  ["/Pages/MissionStartup/MissionStartup.html", "ready-to-fly"],
]);

function isWidgetMenuButton(element: HTMLElement): element is WidgetMenuButton {
  return "onValidate" in element && typeof element.onValidate === "function";
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

/** Presses the World Map tile, found by its picture (or its English title). */
function openWorldMap(): void {
  for (const tile of document.querySelectorAll<HTMLElement>("widget-menu-button")) {
    const isWorldMap = tile.innerHTML.includes("worldmap") || tile.textContent.includes("WORLD MAP");
    if (isWorldMap && tile.offsetParent !== null && isWidgetMenuButton(tile)) {
      tile.onValidate();
      return;
    }
  }
}

const COMMANDS = new Map<string, () => void>([
  ["open-world-map", openWorldMap],
  // The World Map's FLY button fires this.
  [
    "launch-flight",
    () => {
      Coherent.trigger("LAUNCH_FLIGHT");
    },
  ],
  // READY TO FLY's button goes through the menu flow; it only works from its own page, once the flight has loaded.
  [
    "ready-to-fly",
    () => {
      if (document.querySelector("#FlyButton") !== null) LaunchFlowEvent("END_BRIEFING");
    },
  ],
]);

function isStoredValue(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isReadRequest(json: unknown): json is { read: unknown[] } {
  return typeof json === "object" && json !== null && "read" in json && Array.isArray(json.read);
}

function isWriteRequest(json: unknown): json is { write: Record<string, string | null> } {
  return (
    typeof json === "object" &&
    json !== null &&
    "write" in json &&
    typeof json.write === "object" &&
    json.write !== null &&
    Object.values(json.write).every(isStoredValue)
  );
}

function storedValues(keys: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(keys.map((key) => [key, GetStoredData(key)]));
}

/** `{"read": [keys]}` or `{"write": {key: value}}` (null deletes); answered with the keys' values. */
function storedReply(text: string): Record<string, string | null> | undefined {
  const json: unknown = JSON.parse(text);
  if (isReadRequest(json)) return storedValues(json.read.filter(isText));
  if (!isWriteRequest(json)) return undefined;
  for (const [key, value] of Object.entries(json.write)) {
    if (value === null) DeleteStoredData(key);
    else SetStoredData(key, value);
  }
  return storedValues(Object.keys(json.write));
}

function connect(page: string): void {
  const socket = new WebSocket(`ws://127.0.0.1:${PORT}`);
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ page }));
  });
  socket.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (!isText(event.data)) return;
    if (!event.data.startsWith("{")) {
      COMMANDS.get(event.data)?.();
      return;
    }
    // Stored data only reads back on the main menu page.
    if (page !== "main-menu") return;
    const stored = storedReply(event.data);
    if (stored !== undefined) socket.send(JSON.stringify({ stored }));
  });
  socket.addEventListener("close", () => {
    setTimeout(() => {
      connect(page);
    }, RECONNECT_MS);
  });
}

const page = PAGES.get(location.pathname);
if (page !== undefined) connect(page);
