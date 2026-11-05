import { app, BrowserWindow, ipcMain, shell } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { windowCommandSchema } from "@fs-career/contracts";
import { createConnector } from "../connector/app/create.js";
import { setMenuScript } from "../connector/spawn/menu.js";
import { logToFile } from "./log.js";
import { installMenuPackage, installSimModule } from "./sim-module.js";
import { installUpdate, startUpdater } from "./updater.js";

// One copy at a time: a second connector would fight the first over the simulator and the co-op group, and a
// second updater over the download. A second copy only hands focus to the first (see second-instance) and quits.
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

if (primary && app.isPackaged) logToFile(join(app.getPath("logs"), "main.log"));

const { connector, status } = createConnector({
  openBrowser: (url) => void shell.openExternal(url),
});

let window: BrowserWindow | undefined;

function createWindow(): void {
  window = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 760,
    minHeight: 520,
    // The title bar is drawn by the page, in the app's own style.
    frame: false,
    backgroundColor: "#0b0d10",
    show: false,
    title: "Airspace",
    // Packaged, the window takes the executable's icon.
    icon: app.isPackaged ? undefined : join(__dirname, "../../build/icon.png"),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });
  window.once("ready-to-show", () => window?.show());
  window.on("closed", () => (window = undefined));

  // Links the page opens go to the pilot's browser, never a new Electron window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  const devServer = process.env.VITE_DEV_SERVER_URL ?? "";
  if (devServer !== "") void window.loadURL(devServer);
  else void window.loadFile(join(__dirname, "../renderer/index.html"));
}

ipcMain.handle("connector:status", () => status.get());
// The page is untrusted input: the schema checks whatever it sends before the connector sees it.
ipcMain.on("connector:command", (_event, value) => {
  const parsed = windowCommandSchema.safeParse(value);
  if (!parsed.success) return;
  if (parsed.data.type === "restart-to-update") restartToUpdate();
  else connector.handle(parsed.data);
});
ipcMain.on("window:minimize", () => window?.minimize());
ipcMain.on("window:close", () => window?.close());
status.subscribe((current) => window?.webContents.send("connector:status", current));

app.on("second-instance", () => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

// Closing the window quits the app, and the connector with it.
app.on("window-all-closed", () => {
  app.quit();
});

// Quitting and restarting to update both stop the connector first; whichever comes second waits on the same stop.
let stopping: Promise<void> | undefined;
let stopped = false;
function stopConnector(): Promise<void> {
  stopping ??= connector.stop().finally(() => {
    stopped = true;
  });
  return stopping;
}

app.on("will-quit", (event) => {
  if (stopped) return;
  // Let the connector leave its group and send what it has queued before exiting.
  event.preventDefault();
  void stopConnector().finally(() => {
    app.quit();
  });
});

// The installer closes the app within a couple of seconds of starting, so the connector stops before it starts. A
// stop that hangs (a slow final upload) still gives way to the install after `installAfterMs`.
const installAfterMs = 10_000;
function restartToUpdate(): void {
  const update = status.get().update;
  if (update.state !== "ready") return;
  // `installing` hides the restart buttons, so the install starts once.
  status.update({ update: { state: "installing", version: update.version } });
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, installAfterMs));
  void Promise.race([stopConnector(), timeout]).finally(installUpdate);
}

async function start(): Promise<void> {
  if (!primary) return;
  try {
    if (app.isPackaged) installSimModule(process.resourcesPath);
    // Built by scripts/dev.mjs in development, so both pilots can run the app from source. The sim only gets the
    // loader; the menu code goes to it at runtime, so changing that never needs a sim restart.
    const scripts = app.isPackaged ? join(process.resourcesPath, "sim-package") : join(__dirname, "../sim-package");
    installMenuPackage(join(scripts, "loader.js"));
    setMenuScript(readFileSync(join(scripts, "airspace-menu.js"), "utf8"));
  } catch {
    // A read-only or missing Community folder only costs the in-sim buttons and the automatic co-op start; the
    // Co-op page then asks the pilot to click through the menus instead.
  }
  await app.whenReady();
  createWindow();
  connector.start();
  startUpdater(status);
}

void start();
