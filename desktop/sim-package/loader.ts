// The one part of Airspace installed inside Flight Simulator (the airspace-menu package in the Community folder, added
// to the main menu, the World Map and READY TO FLY). It connects to the desktop app on 127.0.0.1 and runs the menu
// code the app sends it (sim-package/airspace-menu.ts), so changing that code needs an app restart, never a sim
// restart. Keep this file small and stable: changing it does need the sim restarted. Built to ES2017 for the sim's
// browser engine.

// MENU_PORT in desktop/connector/spawn/menu.ts.
const PORT = 8391;
const RECONNECT_MS = 3_000;

const PAGES = new Map([
  ["/Pages/FlowBar/FlowBarPage.html", "main-menu"],
  ["/Pages/FlightPlanning/FlightPlanningPage.html", "world-map"],
  ["/Pages/MissionStartup/MissionStartup.html", "ready-to-fly"],
]);

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isScriptMessage(json: unknown): json is { script: string } {
  return typeof json === "object" && json !== null && "script" in json && isText(json.script);
}

function scriptIn(text: string): string | undefined {
  try {
    const json: unknown = JSON.parse(text);
    return isScriptMessage(json) ? json.script : undefined;
  } catch {
    return undefined;
  }
}

function connect(page: string): void {
  const socket = new WebSocket(`ws://127.0.0.1:${PORT}`);
  let started = false;
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ page }));
  });
  // The app answers with the menu code; it runs as a script element and takes over the connection.
  socket.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (started || !isText(event.data)) return;
    const code = scriptIn(event.data);
    if (code === undefined) return;
    started = true;
    const script = document.createElement("script");
    script.textContent = code;
    document.head.append(script);
    window.airspaceMenu?.(socket, page);
  });
  socket.addEventListener("close", () => {
    setTimeout(() => {
      connect(page);
    }, RECONNECT_MS);
  });
}

const page = PAGES.get(location.pathname);
if (page !== undefined) connect(page);
