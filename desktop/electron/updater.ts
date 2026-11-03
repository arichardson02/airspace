import { app } from "electron";
import { autoUpdater } from "electron-updater";
import type { StatusStore } from "../connector/app/status.js";

// GitHub Releases is checked on launch and then this often.
const checkEveryMs = 4 * 60 * 60 * 1000;

/** Keeps the app on the latest release: checks for one, downloads it in the background, and installs it on quit. */
export function startUpdater(status: StatusStore): void {
  // Only a packaged app has the app-update.yml that says where releases are published.
  if (!app.isPackaged) return;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.on("update-available", (info) => {
    status.update({ update: { state: "downloading", version: info.version, percent: 0 } });
  });
  autoUpdater.on("download-progress", (progress) => {
    const update = status.get().update;
    const percent = Math.floor(progress.percent);
    // Each status change re-renders the window, so only whole-percent steps are worth one.
    if (update.state === "downloading" && percent !== update.percent) status.update({ update: { ...update, percent } });
  });
  autoUpdater.on("update-downloaded", (info) => {
    status.update({ update: { state: "ready", version: info.version } });
  });
  // The updater logs its own errors to the console (and so to main.log), but throws any nobody listens for. A
  // failed check or download is tried again at the next check.
  autoUpdater.on("error", () => {
    if (status.get().update.state === "downloading") status.update({ update: { state: "none" } });
  });

  async function check(): Promise<void> {
    // A download under way, or one waiting to install, needs no new check.
    if (status.get().update.state !== "none") return;
    try {
      const result = await autoUpdater.checkForUpdates();
      await result?.downloadPromise;
    } catch {
      // The error listener has logged it.
    }
  }
  void check();
  setInterval(() => {
    void check();
  }, checkEveryMs);
}

/**
 * Installs the downloaded update and relaunches into it. Call it only once the connector has stopped: the installer
 * closes whatever is still running.
 */
export function installUpdate(): void {
  // The connector has already stopped, so if the installer can't start, quit rather than stay half alive.
  autoUpdater.once("error", () => {
    app.quit();
  });
  autoUpdater.quitAndInstall(true, true);
}
