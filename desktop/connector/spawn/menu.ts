import { WebSocketServer, type WebSocket } from "ws";

// The link to Flight Simulator's menus. The desktop app installs a package (desktop/sim-package) that adds a small
// script to three menu pages; each page connects here on 127.0.0.1 and says which it is, and takes three commands.
// That drives the menus with the sim in the background, with no focus, clicks or keystrokes. The main menu page also
// reads and writes the sim's stored data (GetStoredData), where aircraft keep settings such as a SimBrief ID; the
// World Map page can't see it.

/** The sim-package script connects to this port (PORT in desktop/sim-package/airspace-menu.ts). */
const MENU_PORT = 8391;
const READ_TIMEOUT_MS = 3_000;

/** The main menu (FlowBar), the World Map, and READY TO FLY after a flight loads. */
export type MenuPage = "main-menu" | "world-map" | "ready-to-fly";

/** What each page can do: open the World Map tile, press FLY, press READY TO FLY. */
export type MenuCommand = "open-world-map" | "launch-flight" | "ready-to-fly";

/** Stored-data values by key; null is a key with nothing stored. */
export type StoredValues = Readonly<Record<string, string | null>>;

/** What the main menu page is asked to do with stored data; it answers with the keys' values. */
type StoredRequest = { read: readonly string[] } | { write: [string, string | null][] };

export interface MenuLink {
  /** Whether a page of this kind is open (loaded, with our script connected). */
  has(page: MenuPage): boolean;
  send(page: MenuPage, command: MenuCommand): void;
  /** Reads stored data through the main menu page; undefined when it isn't open or doesn't answer. */
  read(keys: readonly string[]): Promise<StoredValues | undefined>;
  /** Writes stored data through the main menu page (null deletes the key); false when it isn't open. */
  write(values: StoredValues): Promise<boolean>;
  /** Called when a page connects or closes; returns a function that stops listening. */
  onChange(listener: () => void): () => void;
}

const isMenuPage = (value: unknown): value is MenuPage =>
  value === "main-menu" || value === "world-map" || value === "ready-to-fly";

function isPageMessage(json: unknown): json is { page: MenuPage } {
  return typeof json === "object" && json !== null && "page" in json && isMenuPage(json.page);
}

function isStoredValue(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isStoredValues(json: unknown): json is StoredValues {
  return typeof json === "object" && json !== null && Object.values(json).every(isStoredValue);
}

function isStoredPair(json: unknown): json is [string, string | null] {
  return Array.isArray(json) && json.length === 2 && typeof json[0] === "string" && isStoredValue(json[1]);
}

/** The page's answer: [key, value] pairs, since the sim's browser engine may lack Object.entries. */
function isStoredMessage(json: unknown): json is { stored: [string, string | null][] } {
  return (
    typeof json === "object" &&
    json !== null &&
    "stored" in json &&
    Array.isArray(json.stored) &&
    json.stored.every(isStoredPair)
  );
}

/** What a page sends: which page it is when it connects, or stored values it was asked for. */
function parse(text: string): { page: MenuPage } | { stored: StoredValues } | undefined {
  try {
    const json: unknown = JSON.parse(text);
    if (isPageMessage(json)) return json;
    return isStoredMessage(json) ? { stored: Object.fromEntries(json.stored) } : undefined;
  } catch {
    return undefined;
  }
}

let link: MenuLink | undefined;
let menuScript: string | undefined;

/** The menu code (built from sim-package/airspace-menu.ts) sent to each page's loader as it connects. */
export function setMenuScript(code: string): void {
  menuScript = code;
}

/** The one menu link for the app, started on first use; it lasts as long as the app. */
export function menuLink(): MenuLink {
  link ??= startMenuLink();
  return link;
}

function startMenuLink(): MenuLink {
  const pages = new Map<WebSocket, MenuPage>();
  const listeners = new Set<() => void>();
  // Replies to stored-data requests, in the order they were asked.
  const waiting: ((values: StoredValues) => void)[] = [];
  const changed = () => {
    for (const listener of listeners) listener();
  };
  const mainMenu = () => [...pages].find(([, page]) => page === "main-menu")?.[0];

  const server = new WebSocketServer({ host: "127.0.0.1", port: MENU_PORT });
  server.on("error", (error) => {
    console.warn(`The sim menu link isn't available: ${error.message}`);
  });
  server.on("connection", (socket) => {
    socket.on("message", (data) => {
      const bytes = Array.isArray(data) ? Buffer.concat(data) : new Uint8Array(data);
      const message = parse(new TextDecoder().decode(bytes));
      if (message === undefined) return;
      if ("stored" in message) {
        waiting.shift()?.(message.stored);
        return;
      }
      if (pages.has(socket)) return;
      pages.set(socket, message.page);
      if (menuScript !== undefined) socket.send(JSON.stringify({ script: menuScript }));
      changed();
    });
    socket.on("close", () => {
      if (pages.delete(socket)) changed();
    });
  });

  const ask = (request: StoredRequest): Promise<StoredValues | undefined> => {
    const socket = mainMenu();
    if (socket === undefined) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      const answer = (values: StoredValues) => {
        clearTimeout(timer);
        resolve(values);
      };
      const timer = setTimeout(() => {
        waiting.splice(waiting.indexOf(answer), 1);
        resolve(undefined);
      }, READ_TIMEOUT_MS);
      waiting.push(answer);
      socket.send(JSON.stringify(request));
    });
  };

  return {
    has: (page) => [...pages.values()].includes(page),
    send(page, command) {
      for (const [socket, kind] of pages) if (kind === page) socket.send(command);
    },
    read: (keys) => ask({ read: keys }),
    // As pairs: the sim's browser engine may lack Object.entries to read an object back.
    write: async (values) => (await ask({ write: Object.entries(values) })) !== undefined,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
