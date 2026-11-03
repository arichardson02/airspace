import { ClientDataPeriod, ClientDataRequestFlag, type SimConnectConnection } from "node-simconnect";
import { CLIENT_DATA, DEFINITION, REQUEST } from "./sim-ids.js";

// Runs calculator code inside the sim through MobiFlight's WASM module, which the desktop app installs into the
// Community folder. It's the only way to fire H:events, which some cockpit buttons (the A320's ECAM control panel)
// respond to and SimConnect can't send. Protocol: github.com/MobiFlight/MobiFlight-WASM-Module.

const MESSAGE_SIZE = 1024;
const CLIENT_NAME = "airspace";
// MSFS loads the module at start; if it doesn't answer by then, it isn't installed or loaded.
const ANSWER_TIMEOUT_MS = 5_000;

export type SimCodeState = "loading" | "ready" | "missing";

export interface SimCode {
  /** Runs `code` (e.g. `(>H:A32NX_ECP_ENG_PRESSED)`) inside the sim; dropped until the module is ready. */
  run(code: string): void;
  state(): SimCodeState;
}

export function connectSimCode(handle: SimConnectConnection, onState: () => void): SimCode {
  let state: SimCodeState = "loading";
  const setState = (next: SimCodeState) => {
    if (next === state) return;
    state = next;
    onState();
  };

  const send = (clientDataId: number, definitionId: number, text: string) => {
    const data = Buffer.alloc(MESSAGE_SIZE);
    data.write(text.slice(0, MESSAGE_SIZE - 1), "latin1");
    handle.setClientData(clientDataId, definitionId, 0, 1, MESSAGE_SIZE, data);
  };

  const openChannels = (command: string, response: string, ids: { command: number; response: number }) => {
    handle.mapClientDataNameToID(command, ids.command);
    handle.mapClientDataNameToID(response, ids.response);
  };

  openChannels("MobiFlight.Command", "MobiFlight.Response", {
    command: CLIENT_DATA.mobiflightCommand,
    response: CLIENT_DATA.mobiflightResponse,
  });
  handle.addToClientDataDefinition(DEFINITION.mobiflightCommand, 0, MESSAGE_SIZE);
  handle.addToClientDataDefinition(DEFINITION.mobiflightResponse, 0, MESSAGE_SIZE);
  handle.requestClientData(
    CLIENT_DATA.mobiflightResponse,
    REQUEST.mobiflightResponse,
    DEFINITION.mobiflightResponse,
    ClientDataPeriod.ON_SET,
    ClientDataRequestFlag.CLIENT_DATA_REQUEST_FLAG_DEFAULT,
  );

  handle.on("clientData", (data) => {
    if (data.requestID !== REQUEST.mobiflightResponse) return;
    if (data.data.readString(MESSAGE_SIZE) !== `MF.Clients.Add.${CLIENT_NAME}.Finished`) return;
    // Our own channels exist now.
    openChannels(`${CLIENT_NAME}.Command`, `${CLIENT_NAME}.Response`, {
      command: CLIENT_DATA.clientCommand,
      response: CLIENT_DATA.clientResponse,
    });
    handle.addToClientDataDefinition(DEFINITION.clientCommand, 0, MESSAGE_SIZE);
    setState("ready");
  });

  // The module sometimes drops the first command after a client connects, so a harmless one goes first.
  send(CLIENT_DATA.mobiflightCommand, DEFINITION.mobiflightCommand, "MF.DummyCmd");
  send(CLIENT_DATA.mobiflightCommand, DEFINITION.mobiflightCommand, `MF.Clients.Add.${CLIENT_NAME}`);
  setTimeout(() => {
    if (state === "loading") setState("missing");
  }, ANSWER_TIMEOUT_MS);

  return {
    run(code) {
      if (state === "ready") send(CLIENT_DATA.clientCommand, DEFINITION.clientCommand, `MF.SimVars.Set.${code}`);
    },
    state: () => state,
  };
}
