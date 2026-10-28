import { SnapshotInterpolation } from "@geckos.io/snapshot-interpolation";
import {
  EventFlag,
  SimConnectConstants,
  type NotificationPriority,
  type SimConnectConnection,
} from "node-simconnect";
import type { FlightState } from "@fs-career/contracts";
import { FLIGHT_KEYS } from "./flight-state.js";

const FIRST_FREEZE_EVENT = 10;
const FREEZE_EVENTS = ["FREEZE_LATITUDE_LONGITUDE_SET", "FREEZE_ALTITUDE_SET", "FREEZE_ATTITUDE_SET"];
// node-simconnect declares NotificationPriority as a const enum, which has no runtime value under tsx.
const PRIORITY_HIGHEST = 1 as NotificationPriority;

// Angles blend the short way around (359° → 1°). They're blended under one-letter keys because the library
// skips angle keys longer than one character (geckosio/snapshot-interpolation#20).
const ANGLE_KEYS = { pitch: "p", bank: "b", heading: "h", headingGyro: "g" } as const;
const INTERPOLATED_KEYS = [
  ...FLIGHT_KEYS.filter((key) => !(key in ANGLE_KEYS)),
  ...Object.values(ANGLE_KEYS).map((key) => `${key}(deg)`),
].join(" ");

type Blended = FlightState & Record<(typeof ANGLE_KEYS)[keyof typeof ANGLE_KEYS], number>;

// When updates stop (a stutter on the flyer's sim or lost packets), the aircraft keeps moving the way the last two
// states were going for up to this long, then holds until updates resume.
const MAX_EXTRAPOLATION_MS = 500;
const HEADINGS = ["heading", "headingGyro"] as const;

interface Received {
  time: number;
  state: FlightState;
}

function extrapolate(previous: Received, latest: Received, aheadMs: number): FlightState {
  const scale = aheadMs / (latest.time - previous.time);
  const step = (key: keyof FlightState) => (latest.state[key] - previous.state[key]) * scale;
  const state = { ...latest.state };
  state.latitude += step("latitude");
  state.longitude += step("longitude");
  state.altitude += step("altitude");
  for (const key of HEADINGS) {
    const turn = ((latest.state[key] - previous.state[key] + 540) % 360) - 180;
    state[key] = (latest.state[key] + turn * scale + 360) % 360;
  }
  return state;
}

export interface Follower {
  /** Freezes the aircraft so only the flyer's states move it. */
  start(): void;
  /** Unfreezes the aircraft; it carries on from the last state written. */
  stop(): void;
  receive(time: number, state: FlightState): void;
  /** Writes the flyer's state as of about 100 ms ago. Call once per sim frame. */
  onFrame(): void;
}

export function createFollower(handle: SimConnectConnection, write: (state: FlightState) => void): Follower {
  FREEZE_EVENTS.forEach((name, i) => handle.mapClientEventToSimEvent(FIRST_FREEZE_EVENT + i, name));

  const setFrozen = (frozen: boolean) => {
    FREEZE_EVENTS.forEach((_, i) =>
      handle.transmitClientEvent(
        SimConnectConstants.OBJECT_ID_USER,
        FIRST_FREEZE_EVENT + i,
        frozen ? 1 : 0,
        PRIORITY_HIGHEST,
        EventFlag.EVENT_FLAG_GROUPID_IS_PRIORITY,
      ),
    );
  };

  let interpolation: SnapshotInterpolation | undefined;
  let previous: Received | undefined;
  let latest: Received | undefined;

  return {
    start() {
      // A fresh buffer, so states from an earlier turn following aren't blended in.
      interpolation = new SnapshotInterpolation();
      previous = latest = undefined;
      setFrozen(true);
    },
    stop() {
      interpolation = undefined;
      setFrozen(false);
    },
    receive(time, state) {
      if (!interpolation) return;
      const entity = { id: "aircraft", ...state, p: state.pitch, b: state.bank, h: state.heading, g: state.headingGyro };
      interpolation.snapshot.add({ id: SnapshotInterpolation.NewId(), time, state: [entity] });
      // The fast channel can reorder; only newer states move the extrapolation on.
      if (!latest || time > latest.time) {
        previous = latest;
        latest = { time, state };
      }
    },
    onFrame() {
      if (!interpolation) return;
      const snapshot = interpolation.calcInterpolation(INTERPOLATED_KEYS);
      if (snapshot) {
        const blended = snapshot.state[0] as unknown as Blended;
        write({ ...blended, pitch: blended.p, bank: blended.b, heading: blended.h, headingGyro: blended.g });
        return;
      }

      // Nothing to blend: either still filling the buffer, or the updates have run out.
      if (!previous || !latest) return;
      const target = SnapshotInterpolation.Now() - interpolation.timeOffset - interpolation.interpolationBuffer.get();
      const aheadMs = Math.min(target - latest.time, MAX_EXTRAPOLATION_MS);
      if (aheadMs > 0) write(extrapolate(previous, latest, aheadMs));
    },
  };
}
