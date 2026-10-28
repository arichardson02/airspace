import {
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod,
  type SimConnectConnection,
} from "node-simconnect";
import type { BackendClient } from "../backend-client.js";

const POSITION_DEFINITION = 1;
const POSITION_REQUEST = 1;
const SIM_STATE_REQUEST = 2;
const SIM_START_EVENT = 1;
const SIM_STOP_EVENT = 2;

// SimConnect returns values in registration order, so the reads in publish() must match.
const POSITION_SIMVARS: [name: string, unit: string][] = [
  ["PLANE LATITUDE", "degrees"],
  ["PLANE LONGITUDE", "degrees"],
  ["PLANE ALTITUDE", "feet"],
  ["PLANE ALT ABOVE GROUND", "feet"],
  ["PLANE HEADING DEGREES TRUE", "degrees"],
  ["GROUND VELOCITY", "knots"],
  ["AIRSPEED INDICATED", "knots"],
  ["VERTICAL SPEED", "feet per minute"],
  ["SIM ON GROUND", "bool"],
  ["FUEL TOTAL QUANTITY WEIGHT", "pounds"],
];

/** Publishes the user aircraft's position once per second while a flight is loaded. */
export function trackPosition(handle: SimConnectConnection, backend: BackendClient): void {
  for (const [name, unit] of POSITION_SIMVARS) {
    handle.addToDataDefinition(POSITION_DEFINITION, name, unit, SimConnectDataType.FLOAT64);
  }

  let inFlight: boolean | undefined;
  const setInFlight = (value: boolean) => {
    if (value === inFlight) return;
    inFlight = value;

    handle.requestDataOnSimObject(
      POSITION_REQUEST,
      POSITION_DEFINITION,
      SimConnectConstants.OBJECT_ID_USER,
      value ? SimConnectPeriod.SECOND : SimConnectPeriod.NEVER,
    );
    console.log(value ? "Flight active: publishing positions" : "No active flight: positions paused");
  };

  handle.on("event", (event) => {
    if (event.clientEventId === SIM_START_EVENT) setInFlight(true);
    if (event.clientEventId === SIM_STOP_EVENT) setInFlight(false);
  });

  handle.on("systemState", (state) => {
    // "Sim" is 1 while a flight is loaded and 0 in the menus.
    if (state.requestID === SIM_STATE_REQUEST) setInFlight(state.dataInteger === 1);
  });

  handle.on("simObjectData", (sample) => {
    if (sample.requestID !== POSITION_REQUEST) return;

    const data = sample.data;
    backend.send("position", {
      latitude: data.readFloat64(),
      longitude: data.readFloat64(),
      altitudeFt: data.readFloat64(),
      altitudeAglFt: data.readFloat64(),
      headingTrueDeg: data.readFloat64(),
      groundSpeedKts: data.readFloat64(),
      indicatedAirspeedKts: data.readFloat64(),
      verticalSpeedFpm: data.readFloat64(),
      onGround: data.readFloat64() !== 0,
      fuelWeightLbs: data.readFloat64(),
    });
  });

  handle.subscribeToSystemEvent(SIM_START_EVENT, "SimStart");
  handle.subscribeToSystemEvent(SIM_STOP_EVENT, "SimStop");
  handle.requestSystemState(SIM_STATE_REQUEST, "Sim");
}
