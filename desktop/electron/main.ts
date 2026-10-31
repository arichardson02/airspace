import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { toCommand } from "../../connector/src/app/commands.js";
import { createConnector } from "../../connector/src/app/create.js";
import { logToFile } from "./log.js";

// One copy at a time: a second connector would fight the first over the simulator and the co-op group.
if (!app.requestSingleInstanceLock()) app.quit();

if (app.isPackaged) logToFile(join(app.getPath("logs"), "main.log"));

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

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) void window.loadURL(devServer);
  else void window.loadFile(join(__dirname, "../renderer/index.html"));
}

ipcMain.handle("connector:status", () => status.get());
ipcMain.on("connector:command", (_event, value: unknown) => {
  const command = toCommand(value);
  if (command) connector.handle(command);
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
app.on("window-all-closed", () => app.quit());

let stopped = false;
app.on("will-quit", (event) => {
  if (stopped) return;
  // Let the connector leave its group and send what it has queued before exiting.
  event.preventDefault();
  void connector.stop().finally(() => {
    stopped = true;
    app.quit();
  });
});

void app.whenReady().then(() => {
  createWindow();
  connector.start();
});
