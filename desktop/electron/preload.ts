import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { ConnectorStatus, WindowCommand } from "@fs-career/contracts";

/** What the window can do, exposed as `window.airspace`. The page never gets Node or Electron itself. */
const airspace = {
  status: (): Promise<ConnectorStatus> => ipcRenderer.invoke("connector:status"),
  onStatus(listener: (status: ConnectorStatus) => void): () => void {
    const handler = (_event: IpcRendererEvent, status: ConnectorStatus): void => {
      listener(status);
    };
    ipcRenderer.on("connector:status", handler);
    return () => {
      ipcRenderer.off("connector:status", handler);
    };
  },
  send: (command: WindowCommand): void => {
    ipcRenderer.send("connector:command", command);
  },
  minimize: (): void => {
    ipcRenderer.send("window:minimize");
  },
  close: (): void => {
    ipcRenderer.send("window:close");
  },
};

export type AirspaceBridge = typeof airspace;

contextBridge.exposeInMainWorld("airspace", airspace);
