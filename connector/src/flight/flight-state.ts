import {
  RawBuffer,
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod,
  type SimConnectConnection,
} from "node-simconnect";
import type { FlightState } from "@fs-career/contracts";

// IDs 1-9 belong to the position tracker on the same connection.
const FLIGHT_DEFINITION = 10;
const FLIGHT_REQUEST = 10;

// Read and written in this order. The same values YourControls copies; the velocities keep the
// follower's instruments and autopilot working.
const FLIGHT_SIMVARS: [key: keyof FlightState, name: string, unit: string][] = [
  ["latitude", "PLANE LATITUDE", "degrees"],
  ["longitude", "PLANE LONGITUDE", "degrees"],
  ["altitude", "PLANE ALTITUDE", "feet"],
  ["pitch", "PLANE PITCH DEGREES", "degrees"],
  ["bank", "PLANE BANK DEGREES", "degrees"],
  ["heading", "PLANE HEADING DEGREES TRUE", "degrees"],
  ["headingGyro", "PLANE HEADING DEGREES GYRO", "degrees"],
  ["gForce", "G FORCE", "gforce"],
  ["verticalSpeed", "VERTICAL SPEED", "feet per second"],
  ["velocityBodyY", "VELOCITY BODY Y", "feet per second"],
  ["velocityBodyZ", "VELOCITY BODY Z", "feet per second"],
  ["velocityWorldX", "VELOCITY WORLD X", "feet per second"],
  ["velocityWorldZ", "VELOCITY WORLD Z", "feet per second"],
  ["elevator", "ELEVATOR POSITION", "position"],
  ["aileron", "AILERON POSITION", "position"],
  ["rudder", "RUDDER POSITION", "position"],
  // The pilot flying sets the power, so the follower's levers and engines match.
  ["throttle1", "GENERAL ENG THROTTLE LEVER POSITION:1", "percent"],
  ["throttle2", "GENERAL ENG THROTTLE LEVER POSITION:2", "percent"],
];

export const FLIGHT_KEYS = FLIGHT_SIMVARS.map(([key]) => key);

export interface FlightStateLink {
  /** Writes a state into the user aircraft. */
  write: (state: FlightState) => void;
  /** Starts or stops reading the flight state every sim frame. */
  setReading(reading: boolean): void;
}

/** Reads the user aircraft's flight state every sim frame while reading, and writes states into it. */
export function connectFlightState(
  handle: SimConnectConnection,
  onFrame: (state: FlightState) => void,
): FlightStateLink {
  for (const [, name, unit] of FLIGHT_SIMVARS) {
    handle.addToDataDefinition(FLIGHT_DEFINITION, name, unit, SimConnectDataType.FLOAT64);
  }

  handle.on("simObjectData", (sample) => {
    if (sample.requestID !== FLIGHT_REQUEST) return;

    const state = {} as FlightState;
    for (const [key] of FLIGHT_SIMVARS) state[key] = sample.data.readFloat64();
    onFrame(state);
  });

  const buffer = new RawBuffer(FLIGHT_SIMVARS.length * 8);
  return {
    write(state) {
      buffer.clear();
      for (const [key] of FLIGHT_SIMVARS) buffer.writeFloat64(state[key]);
      handle.setDataOnSimObject(FLIGHT_DEFINITION, SimConnectConstants.OBJECT_ID_USER, {
        buffer,
        arrayCount: 0,
        tagged: false,
      });
    },
    setReading(reading) {
      handle.requestDataOnSimObject(
        FLIGHT_REQUEST,
        FLIGHT_DEFINITION,
        SimConnectConstants.OBJECT_ID_USER,
        reading ? SimConnectPeriod.SIM_FRAME : SimConnectPeriod.NEVER,
      );
    },
  };
}
