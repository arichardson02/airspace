// The menu code: the desktop app sends it to the loader (sim-package/loader.ts) in each of Flight Simulator's menu
// pages it's installed in, so it changes with the app and never needs a sim restart. It drives the menus while the
// sim is in the background, taking a few commands over the loader's connection. Built to ES2017 for the sim's
// browser engine.

/** A main-menu tile; pressing it the game's way sends its widget id, which changes every launch. */
interface WidgetMenuButton extends HTMLElement {
  onValidate(): void;
}

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

/** A stored-data key and its value; null is a key with nothing stored. */
type StoredPair = [key: string, value: string | null];

// The sim's browser engine may lack Object.values, entries and fromEntries (an ES2017 build doesn't add them), so
// stored data goes both ways as [key, value] pairs.
function isStoredPair(value: unknown): value is StoredPair {
  return Array.isArray(value) && value.length === 2 && isText(value[0]) && isStoredValue(value[1]);
}

function isWriteRequest(json: unknown): json is { write: StoredPair[] } {
  return (
    typeof json === "object" &&
    json !== null &&
    "write" in json &&
    Array.isArray(json.write) &&
    json.write.every(isStoredPair)
  );
}

function storedValues(keys: readonly string[]): StoredPair[] {
  return keys.map((key): StoredPair => [key, GetStoredData(key)]);
}

/** `{"read": [keys]}` or `{"write": [[key, value]]}` (null deletes); answered with the keys' values. */
function storedReply(text: string): StoredPair[] | undefined {
  const json: unknown = JSON.parse(text);
  if (isReadRequest(json)) return storedValues(json.read.filter(isText));
  if (!isWriteRequest(json)) return undefined;
  for (const [key, value] of json.write) {
    if (value === null) DeleteStoredData(key);
    else SetStoredData(key, value);
  }
  return storedValues(json.write.map(([key]) => key));
}

window.airspaceMenu = (socket, page) => {
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
};
