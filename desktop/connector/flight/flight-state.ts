import {
  RawBuffer,
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod,
  type SimConnectConnection,
} from "node-simconnect";
import type { FlightState } from "@fs-career/contracts";

import { DEFINITION, REQUEST } from "../sim-ids.js";

const FLIGHT_REQUEST = REQUEST.flight;

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
  // Read only: the follower uses it to choose how to write.
  ["onGround", "SIM ON GROUND", "bool"],
];

// Written into a follower in the air: the whole state, with its position and attitude frozen.
const AIR_KEYS = FLIGHT_SIMVARS.map(([key]) => key).filter((key) => key !== "onGround");
// Written into a follower on the ground: its altitude and attitude stay with the sim, so its wheels stay on the
// ground and the aircraft counts as on the ground (ground power, weight on wheels, warnings).
const GROUND_KEYS: readonly (keyof FlightState)[] = [
  "latitude",
  "longitude",
  "heading",
  "headingGyro",
  "velocityBodyZ",
  "velocityWorldX",
  "velocityWorldZ",
  "elevator",
  "aileron",
  "rudder",
];

export const FLIGHT_KEYS = FLIGHT_SIMVARS.map(([key]) => key);

// Gives each new state every key up front, so it can be filled in by key.
const EMPTY_FLIGHT_STATE: FlightState = {
  latitude: 0,
  longitude: 0,
  altitude: 0,
  pitch: 0,
  bank: 0,
  heading: 0,
  headingGyro: 0,
  gForce: 0,
  verticalSpeed: 0,
  velocityBodyY: 0,
  velocityBodyZ: 0,
  velocityWorldX: 0,
  velocityWorldZ: 0,
  elevator: 0,
  aileron: 0,
  rudder: 0,
  onGround: 0,
};

/** Builds a state from `read`, which is called for each value in the order SimConnect sends them. */
export function buildFlightState(read: (key: keyof FlightState) => number): FlightState {
  const state = { ...EMPTY_FLIGHT_STATE };
  for (const [key] of FLIGHT_SIMVARS) state[key] = read(key);
  return state;
}

export interface FlightStateLink {
  /** Writes a state into the user aircraft: all of it, or on the `ground` only what keeps it on its wheels. */
  write: (state: FlightState, ground: boolean) => void;
  /** Starts or stops reading the flight state every sim frame. */
  setReading(reading: boolean): void;
}

/** Reads the user aircraft's flight state every sim frame while reading, and writes states into it. */
export function connectFlightState(
  handle: SimConnectConnection,
  onFrame: (state: FlightState) => void,
): FlightStateLink {
  const simvars = new Map(FLIGHT_SIMVARS.map(([key, name, unit]) => [key, { name, unit }]));
  const define = (definition: number, keys: readonly (keyof FlightState)[]) => {
    for (const key of keys) {
      const simvar = simvars.get(key);
      if (simvar) handle.addToDataDefinition(definition, simvar.name, simvar.unit, SimConnectDataType.FLOAT64);
    }
  };
  define(DEFINITION.flight, FLIGHT_KEYS);
  define(DEFINITION.flightAir, AIR_KEYS);
  define(DEFINITION.flightGround, GROUND_KEYS);

  handle.on("simObjectData", (sample) => {
    if (sample.requestID !== FLIGHT_REQUEST) return;

    onFrame(buildFlightState(() => sample.data.readFloat64()));
  });

  const buffer = new RawBuffer(FLIGHT_SIMVARS.length * 8);
  return {
    write(state, ground) {
      buffer.clear();
      for (const key of ground ? GROUND_KEYS : AIR_KEYS) buffer.writeFloat64(state[key]);
      handle.setDataOnSimObject(
        ground ? DEFINITION.flightGround : DEFINITION.flightAir,
        SimConnectConstants.OBJECT_ID_USER,
        {
          buffer,
          arrayCount: 0,
          tagged: false,
        },
      );
    },
    setReading(reading) {
      handle.requestDataOnSimObject(
        FLIGHT_REQUEST,
        DEFINITION.flight,
        SimConnectConstants.OBJECT_ID_USER,
        reading ? SimConnectPeriod.SIM_FRAME : SimConnectPeriod.NEVER,
      );
    },
  };
}
