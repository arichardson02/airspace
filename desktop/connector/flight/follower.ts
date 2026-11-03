import { SnapshotInterpolation } from "@geckos.io/snapshot-interpolation";
import { EventFlag, SimConnectConstants, type NotificationPriority, type SimConnectConnection } from "node-simconnect";
import type { FlightState } from "@fs-career/contracts";
import { buildFlightState, FLIGHT_KEYS } from "./flight-state.js";

const FIRST_FREEZE_EVENT = 10;
const FREEZE_EVENTS = ["FREEZE_LATITUDE_LONGITUDE_SET", "FREEZE_ALTITUDE_SET", "FREEZE_ATTITUDE_SET"];
// SAFETY: 1 is NotificationPriority.HIGHEST. node-simconnect declares it as a const enum, which has no runtime
// value under tsx, so the number stands in for it.
// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- const enum with no runtime value; see above
const PRIORITY_HIGHEST = 1 as NotificationPriority;

// Angles blend the short way around (359° → 1°). They're blended under one-letter keys because the library
// skips angle keys longer than one character (geckosio/snapshot-interpolation#20).
const ANGLE_KEYS = { pitch: "p", bank: "b", heading: "h", headingGyro: "g" } as const;
const INTERPOLATED_KEYS = [
  ...FLIGHT_KEYS.filter((key) => !(key in ANGLE_KEYS)),
  ...Object.values(ANGLE_KEYS).map((key) => `${key}(deg)`),
].join(" ");

// When updates stop (a stutter on the flyer's sim or lost packets), the aircraft keeps moving the way the last two
// states were going for up to this long, then holds until updates resume.
const MAX_EXTRAPOLATION_MS = 500;
const HEADINGS = ["heading", "headingGyro"] as const;

// On the ground below this the follower is left on its wheels (only its position is frozen), so its sim knows it's
// on the ground. Faster, on the takeoff and landing roll, it follows exactly as in the air, so the rotation and the
// flare match the flyer's. The gap between the two keeps it from flipping back and forth.
const GROUND_ENTER_KTS = 25;
const GROUND_LEAVE_KTS = 35;
const KTS_PER_FPS = 0.592484;

function followsOnGround(wasOnGround: boolean, state: FlightState): boolean {
  // A missing value (NaN) counts as in the air, which follows as before.
  if (!(state.onGround >= 0.5)) return false;
  const speedKts = Math.hypot(state.velocityWorldX, state.velocityWorldZ) * KTS_PER_FPS;
  return speedKts < (wasOnGround ? GROUND_LEAVE_KTS : GROUND_ENTER_KTS);
}

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

export function createFollower(
  handle: SimConnectConnection,
  write: (state: FlightState, ground: boolean) => void,
): Follower {
  FREEZE_EVENTS.forEach((name, i) => handle.mapClientEventToSimEvent(FIRST_FREEZE_EVENT + i, name));

  // Position, then altitude and attitude, in FREEZE_EVENTS order.
  const setFrozen = (position: boolean, altitudeAndAttitude: boolean) => {
    [position, altitudeAndAttitude, altitudeAndAttitude].forEach((frozen, i) =>
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
  // Undefined until the first state arrives: the aircraft isn't frozen before then, so a parked one stays on its
  // wheels (its systems don't see it leave the ground) and a flying one carries on for those few frames.
  let onGround: boolean | undefined;

  const follow = (state: FlightState) => {
    const next = followsOnGround(onGround === true, state);
    if (next !== onGround) {
      onGround = next;
      setFrozen(true, !next);
    }
    write(state, next);
  };

  return {
    start() {
      // A fresh buffer, so states from an earlier turn following aren't blended in.
      interpolation = new SnapshotInterpolation();
      previous = latest = undefined;
      onGround = undefined;
    },
    stop() {
      interpolation = undefined;
      onGround = undefined;
      setFrozen(false, false);
    },
    receive(time, state) {
      if (!interpolation) return;
      const entity = {
        id: "aircraft",
        ...state,
        p: state.pitch,
        b: state.bank,
        h: state.heading,
        g: state.headingGyro,
      };
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
        // Only numbers go into the snapshots, so every value comes back out as one.
        const blended = snapshot.state[0];
        const state = buildFlightState((key) => Number(blended[key]));
        follow({
          ...state,
          pitch: Number(blended.p),
          bank: Number(blended.b),
          heading: Number(blended.h),
          headingGyro: Number(blended.g),
        });
        return;
      }

      // Nothing to blend: either still filling the buffer, or the updates have run out.
      if (!previous || !latest) return;
      const target = SnapshotInterpolation.Now() - interpolation.timeOffset - interpolation.interpolationBuffer.get();
      const aheadMs = Math.min(target - latest.time, MAX_EXTRAPOLATION_MS);
      if (aheadMs > 0) follow(extrapolate(previous, latest, aheadMs));
    },
  };
}
