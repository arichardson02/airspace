import { open, Protocol, SimConnectException, type SimConnectConnection } from "node-simconnect";
import type { DeviceCode } from "../auth/sign-in.js";
import { ensureSignedIn, signOut } from "../auth/sign-in.js";
import { BackendClient } from "../backend-client.js";
import { config } from "../config.js";
import { createCoop } from "../group/group-flight.js";
import { Connector } from "./controller.js";
import { createStatus, type StatusStore } from "./status.js";

export interface ConnectorOptions {
  openBrowser: (url: string) => void;
  /** Joins this group whenever signed in with the simulator connected. */
  autoJoinGroupCode?: string;
  /** Called with each new sign-in code, besides showing it in the status. */
  onCode?(code: DeviceCode): void;
}

/** Wires the connector to the real backend, simulator and co-op server. Call `connector.start()` to run it. */
export function createConnector(options: ConnectorOptions): {
  connector: Connector<SimConnectConnection>;
  status: StatusStore;
} {
  const status = createStatus(config.connectorVersion);

  const connector = new Connector<SimConnectConnection>({
    status,
    simRetryMs: config.simRetryMs,
    autoJoinGroupCode: options.autoJoinGroupCode,
    signIn: (signal, onCode) =>
      ensureSignedIn(config.backendUrl, {
        signal,
        onCode(code) {
          onCode(code);
          options.onCode?.(code);
        },
      }),
    signOut,
    openBrowser: options.openBrowser,
    async openSim() {
      // KittyHawk is the lowest protocol MSFS 2020 supports; MSFS 2024 accepts it too.
      const { recvOpen, handle } = await open(config.appName, Protocol.KittyHawk);
      handle.on("exception", (ex) => console.warn(`SimConnect exception: ${SimConnectException[ex.exception]}`));
      handle.on("error", (err) => console.error("SimConnect error:", err));
      return {
        name: recvOpen.applicationName,
        versionMajor: recvOpen.applicationVersionMajor,
        versionMinor: recvOpen.applicationVersionMinor,
        handle,
      };
    },
    createBackend: (token, onSignedOut) =>
      new BackendClient(config.backendUrl, config.flushIntervalMs, token, onSignedOut),
    createCoop: (handle) => createCoop(handle, config.signalingUrl),
  });

  return { connector, status };
}
