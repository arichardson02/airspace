import { open, Protocol, SimConnectException } from "node-simconnect";
import { BackendClient } from "./backend-client.js";
import { config } from "./config.js";
import { startGroupFlight } from "./group/group-flight.js";
import { trackPosition } from "./track/position-tracker.js";

const backend = new BackendClient(config.backendUrl, config.flushIntervalMs);
let leaveGroup: (() => void) | undefined;

async function shutdown(exitCode: number): Promise<never> {
  leaveGroup?.();
  await backend.stop();
  process.exit(exitCode);
}

async function main(): Promise<void> {
  // KittyHawk is the lowest protocol MSFS 2020 supports; MSFS 2024 accepts it too.
  const { recvOpen, handle } = await open(config.appName, Protocol.KittyHawk);

  console.log(
    `Connected to ${recvOpen.applicationName} ` +
      `${recvOpen.applicationVersionMajor}.${recvOpen.applicationVersionMinor}`,
  );

  backend.start();
  backend.send("connector.hello", {
    connectorVersion: config.connectorVersion,
    sim: {
      name: recvOpen.applicationName,
      versionMajor: recvOpen.applicationVersionMajor,
      versionMinor: recvOpen.applicationVersionMinor,
    },
  });

  // trackPosition(handle, backend);
  if (config.groupCode) leaveGroup = await startGroupFlight(handle, { ...config, groupCode: config.groupCode });

  handle.on("exception", (ex) => {
    console.warn(`SimConnect exception: ${SimConnectException[ex.exception]}`);
  });

  handle.on("error", (err) => {
    console.error("SimConnect error:", err);
  });

  handle.on("quit", () => {
    console.log("Simulator quit");
    void shutdown(0);
  });

  handle.on("close", () => {
    console.log("Connection closed");
    void shutdown(0);
  });

  process.on("SIGINT", () => {
    handle.close();
    void shutdown(0);
  });
}

main().catch((err: unknown) => {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;

  if (code === "ECONNREFUSED") {
    console.error("Failed to connect to SimConnect: is the simulator running?");
  } else {
    console.error("Failed to connect to SimConnect:", err);
  }

  process.exit(1);
});
