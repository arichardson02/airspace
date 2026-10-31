import { open, Protocol, SimConnectException } from "node-simconnect";
import { ensureSignedIn, signOut, type SignedIn } from "./auth/sign-in.js";
import { BackendClient } from "./backend-client.js";
import { config } from "./config.js";
import { startGroupFlight } from "./group/group-flight.js";
import { trackPosition } from "./track/position-tracker.js";

let backend: BackendClient | undefined;
let leaveGroup: (() => void) | undefined;

async function shutdown(exitCode: number): Promise<never> {
  leaveGroup?.();
  await backend?.stop();
  process.exit(exitCode);
}

async function main({ token, pilot }: SignedIn): Promise<void> {
  backend = new BackendClient(config.backendUrl, config.flushIntervalMs, token, () => {
    console.error("Your sign-in is no longer valid. Restart the connector to sign in again.");
    void signOut().then(() => shutdown(1));
  });

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
  if (config.groupCode) {
    leaveGroup = await startGroupFlight(handle, {
      signalingUrl: config.signalingUrl,
      groupCode: config.groupCode,
      token,
      pilot: { pilotId: pilot.id, name: pilot.name },
    });
  }

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

// Signing in comes first, so the code to approve shows up before waiting on the sim.
const signedIn = await ensureSignedIn(config.backendUrl).catch((err: unknown) => {
  console.error("Sign-in failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
console.log(`Signed in as ${signedIn.pilot.name} (${signedIn.pilot.email})`);

main(signedIn).catch((err: unknown) => {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;

  if (code === "ECONNREFUSED") {
    console.error("Failed to connect to SimConnect: is the simulator running?");
  } else {
    console.error("Failed to connect to SimConnect:", err);
  }

  process.exit(1);
});
