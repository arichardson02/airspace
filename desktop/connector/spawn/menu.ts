import { WebSocketServer, type WebSocket } from "ws";

// The link to Flight Simulator's menus. The desktop app installs a package (desktop/sim-package) that adds a small
// script to three menu pages; each page connects here on 127.0.0.1 and says which it is, and takes three commands.
// That drives the menus with the sim in the background, with no focus, clicks or keystrokes.

/** The sim-package script connects to this port (PORT in desktop/sim-package/airspace-menu.js). */
const MENU_PORT = 8391;

/** The main menu (FlowBar), the World Map, and READY TO FLY after a flight loads. */
export type MenuPage = "main-menu" | "world-map" | "ready-to-fly";

/** What each page can do: open the World Map tile, press FLY, press READY TO FLY. */
export type MenuCommand = "open-world-map" | "launch-flight" | "ready-to-fly";

export interface MenuLink {
  /** Whether a page of this kind is open (loaded, with our script connected). */
  has(page: MenuPage): boolean;
  send(page: MenuPage, command: MenuCommand): void;
  /** Called when a page connects or closes; returns a function that stops listening. */
  onChange(listener: () => void): () => void;
}

const isMenuPage = (value: unknown): value is MenuPage =>
  value === "main-menu" || value === "world-map" || value === "ready-to-fly";

function isPageMessage(json: unknown): json is { page: MenuPage } {
  return typeof json === "object" && json !== null && "page" in json && isMenuPage(json.page);
}

/** The page a connecting script says it is: `{"page": "main-menu"}`. */
function parsePage(text: string): MenuPage | undefined {
  try {
    const json: unknown = JSON.parse(text);
    return isPageMessage(json) ? json.page : undefined;
  } catch {
    return undefined;
  }
}

let link: MenuLink | undefined;

/** The one menu link for the app, started on first use; it lasts as long as the app. */
export function menuLink(): MenuLink {
  link ??= startMenuLink();
  return link;
}

function startMenuLink(): MenuLink {
  const pages = new Map<WebSocket, MenuPage>();
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };

  const server = new WebSocketServer({ host: "127.0.0.1", port: MENU_PORT });
  server.on("error", (error) => {
    console.warn(`The sim menu link isn't available: ${error.message}`);
  });
  server.on("connection", (socket) => {
    socket.on("message", (data) => {
      const bytes = Array.isArray(data) ? Buffer.concat(data) : new Uint8Array(data);
      const page = parsePage(new TextDecoder().decode(bytes));
      if (page === undefined || pages.has(socket)) return;
      pages.set(socket, page);
      changed();
    });
    socket.on("close", () => {
      if (pages.delete(socket)) changed();
    });
  });

  return {
    has: (page) => [...pages.values()].includes(page),
    send(page, command) {
      for (const [socket, kind] of pages) if (kind === page) socket.send(command);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
