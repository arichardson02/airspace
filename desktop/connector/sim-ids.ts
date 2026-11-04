import { EventFlag, SimConnectConstants, type NotificationPriority, type SimConnectConnection } from "node-simconnect";

// SimConnect ids are per connection and every module shares the one connection, so their ranges live here. MSFS
// rejects an id that's registered twice, which is why each module claims its own.

/** Data definition ids (`addToDataDefinition`). 1-9 are the position tracker's. */
export const DEFINITION = {
  flight: 10,
  /** The follower's writes: everything in the air; on the ground, what leaves the aircraft on its wheels. */
  flightAir: 11,
  flightGround: 12,
  identity: 200,
  cockpit: 300,
  /** L:vars and simvars a profile writes but doesn't read. */
  cockpitWrites: 301,
  flightControls: 302,
  mcdu: 303,
  clock: 400,
  /** MobiFlight's client-data channels (client-data definitions share the id space). */
  mobiflightCommand: 500,
  mobiflightResponse: 501,
  clientCommand: 502,
  clientResponse: 503,
  /** The co-pilot's camera, set to the co-pilot's seat after spawning. */
  seat: 600,
} as const;

/** Data request ids (`requestDataOnSimObject`, `requestSystemState`, `requestClientData`). 1-9 are the tracker's. */
export const REQUEST = {
  flight: 10,
  identity: 200,
  cockpit: 300,
  flightControls: 302,
  mcdu: 303,
  clock: 400,
  inputEvents: 410,
  mobiflightResponse: 501,
  clientResponse: 503,
  /** The AircraftLoaded system state: the loaded aircraft's aircraft.cfg path. */
  aircraftLoaded: 600,
} as const;

/** Client data area ids (`mapClientDataNameToID`). */
export const CLIENT_DATA = {
  mobiflightCommand: 1,
  mobiflightResponse: 2,
  clientCommand: 3,
  clientResponse: 4,
} as const;

/** Notification group ids. 20 and 21 are the flight controls' watch and block groups. */
const GROUP = {
  /** Cockpit events watched to replay on the other side; never maskable, so the aircraft still gets them. */
  observe: 22,
} as const;

// Client event ids 10-12 are the follower's freeze events and 20-31 the flight controls'; names mapped on demand
// start here.
const FIRST_NAMED_EVENT = 1000;

// SAFETY: 1 is NotificationPriority.HIGHEST. node-simconnect declares it as a const enum, which has no runtime value
// under esbuild, so the number stands in for it.
// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- const enum with no runtime value; see above
const PRIORITY_HIGHEST = 1 as NotificationPriority;

/** Sim events by name: mapped once per connection, since MSFS rejects mapping the same id twice. */
export interface SimEvents {
  /** Sends `name` to the user aircraft with `data` (an integer; negatives travel as two's complement). */
  transmit(name: string, data?: number): void;
  /** Calls `listener` whenever the sim fires `name`, for whatever reason, without stopping it. */
  observe(name: string, listener: (data: number) => void): void;
  /** The event's client id once it's been used, to match an exception back to it. */
  idOf(name: string): number | undefined;
}

export function createSimEvents(handle: SimConnectConnection): SimEvents {
  const ids = new Map<string, number>();
  const listeners = new Map<number, ((data: number) => void)[]>();
  let next = FIRST_NAMED_EVENT;
  let observing = false;

  const idFor = (name: string): number => {
    const known = ids.get(name);
    if (known !== undefined) return known;
    const id = next++;
    ids.set(name, id);
    handle.mapClientEventToSimEvent(id, name);
    return id;
  };

  handle.on("event", (event) => {
    for (const listener of listeners.get(event.clientEventId) ?? []) listener(event.data | 0);
  });

  return {
    transmit(name, data = 0) {
      handle.transmitClientEvent(
        SimConnectConstants.OBJECT_ID_USER,
        idFor(name),
        // The event's data is an unsigned 32-bit number on the wire.
        data >>> 0,
        PRIORITY_HIGHEST,
        EventFlag.EVENT_FLAG_GROUPID_IS_PRIORITY,
      );
    },
    observe(name, listener) {
      const id = idFor(name);
      const existing = listeners.get(id);
      if (existing) {
        existing.push(listener);
        return;
      }
      listeners.set(id, [listener]);
      handle.addClientEventToNotificationGroup(GROUP.observe, id, false);
      if (!observing) {
        observing = true;
        handle.setNotificationGroupPriority(GROUP.observe, PRIORITY_HIGHEST);
      }
    },
    idOf: (name) => ids.get(name),
  };
}
