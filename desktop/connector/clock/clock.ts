import { SimConnectConstants, SimConnectDataType, SimConnectPeriod, type SimConnectConnection } from "node-simconnect";
import type { SimClock } from "@fs-career/contracts";
import { DEFINITION, REQUEST, type SimEvents } from "../sim-ids.js";

// The sim's date and time, the same for every aircraft. In co-op the host's clock is the reference, and the other
// sim's clock is set to it.

const CLOCK_SIMVARS: [key: keyof SimClock, name: string, unit: string][] = [
  ["year", "ZULU YEAR", "number"],
  ["dayOfYear", "ZULU DAY OF YEAR", "number"],
  ["secondsOfDay", "ZULU TIME", "seconds"],
];

// The clock is only set when it's off by more than this, so the two sims don't keep nudging each other.
const TIME_TOLERANCE_S = 60;

export interface ClockLink {
  /** This sim's latest date and time, once read. */
  current(): SimClock | undefined;
  /** Sets this sim's clock to the host's. */
  matchHost(host: SimClock): void;
}

export function watchClock(handle: SimConnectConnection, events: SimEvents): ClockLink {
  for (const [, name, unit] of CLOCK_SIMVARS) {
    handle.addToDataDefinition(DEFINITION.clock, name, unit, SimConnectDataType.FLOAT64);
  }
  let current: SimClock | undefined;
  handle.on("simObjectData", (sample) => {
    if (sample.requestID !== REQUEST.clock) return;
    const values = new Map(CLOCK_SIMVARS.map(([key]) => [key, sample.data.readFloat64()]));
    const read = (key: keyof SimClock) => values.get(key) ?? 0;
    current = { year: read("year"), dayOfYear: read("dayOfYear"), secondsOfDay: read("secondsOfDay") };
  });
  handle.requestDataOnSimObject(
    REQUEST.clock,
    DEFINITION.clock,
    SimConnectConstants.OBJECT_ID_USER,
    SimConnectPeriod.SECOND,
  );

  return {
    current: () => current,
    matchHost(host) {
      if (current) matchClock(current, host, events);
    },
  };
}

function matchClock(local: SimClock, host: SimClock, events: SimEvents): void {
  const sameDay = local.year === host.year && local.dayOfYear === host.dayOfYear;
  if (sameDay && Math.abs(local.secondsOfDay - host.secondsOfDay) <= TIME_TOLERANCE_S) return;
  if (local.year !== host.year) events.transmit("ZULU_YEAR_SET", Math.round(host.year));
  if (local.dayOfYear !== host.dayOfYear) events.transmit("ZULU_DAY_SET", Math.round(host.dayOfYear));
  const minutes = Math.floor(host.secondsOfDay / 60);
  events.transmit("ZULU_HOURS_SET", Math.floor(minutes / 60));
  events.transmit("ZULU_MINUTES_SET", minutes % 60);
  console.log(
    `Set the sim's clock to the host's (${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}Z)`,
  );
}
