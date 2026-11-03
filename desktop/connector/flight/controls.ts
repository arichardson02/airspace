import type { NotificationPriority, SimConnectConnection } from "node-simconnect";

const FIRST_CONTROL_EVENT = 20;
const WATCH_GROUP = 20;
const BLOCK_GROUP = 21;
// node-simconnect declares NotificationPriority as a const enum, which has no runtime value under tsx, so its
// numbers stand in for it.
// SAFETY: 1 is NotificationPriority.HIGHEST.
// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- const enum with no runtime value; see above
const PRIORITY_HIGHEST = 1 as NotificationPriority;
// SAFETY: 10_000_000 is NotificationPriority.HIGHEST_MASKABLE.
// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- const enum with no runtime value; see above
const PRIORITY_HIGHEST_MASKABLE = 10_000_000 as NotificationPriority;

// Hardware stick/yoke/rudder axes report -16383..16383.
const AXIS_EVENTS = [
  "AXIS_ELEVATOR_SET",
  "AXIS_AILERONS_SET",
  "AXIS_RUDDER_SET",
  "ELEVATOR_SET",
  "AILERON_SET",
  "RUDDER_SET",
];
// Keyboard flying sends repeated presses while a key is held.
const KEY_EVENTS = ["ELEV_DOWN", "ELEV_UP", "AILERONS_LEFT", "AILERONS_RIGHT", "RUDDER_LEFT", "RUDDER_RIGHT"];
const EVENTS = [...AXIS_EVENTS, ...KEY_EVENTS];

// Movement counts once an axis is this far from where it rests, as a share of full deflection.
const DEADZONE = 0.08;
// ...and stays moved this long, so bumps and noise don't take control.
const HOLD_MS = 300;
// An axis left in one place this long has a new resting position (an offset stick or pedals).
const REST_SETTLE_MS = 3_000;
const REST_TOLERANCE = 0.02;
// A key press keeps counting as movement until the next repeat arrives.
const KEY_ACTIVE_MS = 150;

interface Axis {
  value: number;
  rest: number;
  steadySince: number;
}

export interface ControlInput {
  /** The pilot is moving their flight controls right now. */
  moving: boolean;
  /** The pilot has been moving them long enough to take control. */
  grabbing: boolean;
}

export interface Controls {
  /** Checks the pilot's flight controls. Call once per sim frame. */
  poll(now: number): ControlInput;
  /** While blocked, the pilot's flight controls are still watched but no longer reach the aircraft. */
  setBlocked(blocked: boolean): void;
}

/** Watches the local pilot's stick/yoke, rudder and keyboard flying. */
export function watchControls(handle: SimConnectConnection): Controls {
  const axes = new Map<number, Axis>();
  let lastKeyAt = 0;
  let movingSince: number | undefined;
  let blocked = false;

  EVENTS.forEach((name, i) => {
    handle.mapClientEventToSimEvent(FIRST_CONTROL_EVENT + i, name);
    handle.addClientEventToNotificationGroup(WATCH_GROUP, FIRST_CONTROL_EVENT + i, false);
  });
  handle.setNotificationGroupPriority(WATCH_GROUP, PRIORITY_HIGHEST);

  handle.on("event", (event) => {
    const index = event.clientEventId - FIRST_CONTROL_EVENT;
    if (index < 0 || index >= EVENTS.length) return;

    const now = Date.now();
    if (index >= AXIS_EVENTS.length) {
      lastKeyAt = now;
      return;
    }

    // Axis values arrive as unsigned 32-bit numbers.
    const value = (event.data | 0) / 16384;
    const axis = axes.get(index);
    if (!axis) {
      axes.set(index, { value, rest: value, steadySince: now });
      return;
    }
    if (Math.abs(value - axis.value) > REST_TOLERANCE) axis.steadySince = now;
    axis.value = value;
  });

  return {
    poll(now) {
      let moving = now - lastKeyAt < KEY_ACTIVE_MS;
      for (const axis of axes.values()) {
        if (now - axis.steadySince > REST_SETTLE_MS) axis.rest = axis.value;
        if (Math.abs(axis.value - axis.rest) > DEADZONE) moving = true;
      }

      if (!moving) movingSince = undefined;
      else movingSince ??= now;
      return { moving, grabbing: movingSince !== undefined && now - movingSince >= HOLD_MS };
    },
    setBlocked(value) {
      if (value === blocked) return;
      blocked = value;
      EVENTS.forEach((name, i) => {
        handle.removeClientEvent(blocked ? WATCH_GROUP : BLOCK_GROUP, FIRST_CONTROL_EVENT + i);
        // MSFS forgets the event's mapping once it's removed from a group, so map it again.
        handle.mapClientEventToSimEvent(FIRST_CONTROL_EVENT + i, name);
        handle.addClientEventToNotificationGroup(blocked ? BLOCK_GROUP : WATCH_GROUP, FIRST_CONTROL_EVENT + i, blocked);
      });
      // Masking only works in a group with a maskable priority.
      if (blocked) handle.setNotificationGroupPriority(BLOCK_GROUP, PRIORITY_HIGHEST_MASKABLE);
    },
  };
}
