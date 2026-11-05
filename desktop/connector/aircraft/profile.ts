import type { McduPress } from "@fs-career/contracts";
import type { SimConnectConnection } from "node-simconnect";

// An aircraft profile says how to read and set every control in one aircraft's cockpit and how each one syncs
// between the two pilots. Profiles share these helpers but are otherwise free to do what their aircraft needs:
// every aircraft keeps its cockpit differently.

/** A value in the sim: one of the aircraft's own L:vars, or a standard simvar. */
export type Datum = { kind: "lvar"; name: string } | { kind: "simvar"; name: string; unit: string };

export const lvar = (name: string): Datum => ({ kind: "lvar", name });

export const simvar = (name: string, unit = "number"): Datum => ({ kind: "simvar", name, unit });

/** What a custom write can do in the sim. */
export interface WriteContext {
  /** Sends a K or custom event (`A32NX.FCU_HDG_SET`) to the aircraft. */
  event(name: string, data?: number): void;
  /** The latest value of another control or aux value, by key. */
  value(key: string): number | undefined;
  /** Writes an L:var or simvar. */
  set(datum: Datum, value: number): void;
  /** Runs calculator code inside the sim (to fire H:events), through the in-sim module. */
  calculator(code: string): void;
}

/** How a value gets into the sim. Separate from how it's read: some switches only work through their event. */
export type Write =
  // Write the value to the control's own datum, or to `target`.
  | { kind: "datum"; target?: Datum }
  // Send an event with `value * scale + offset` as its data.
  | { kind: "event"; name: string; scale: number; offset: number }
  // Send the event (with `data`) only when the control isn't already at the target: a toggle.
  | { kind: "toggle"; name: string; data: number }
  // Set `target` to 1 and back to 0 after `holdMs`, only when the control isn't already at the target: pressing a
  // momentary pushbutton that flips the state.
  | { kind: "pulse"; target: Datum; holdMs: number }
  // Set an input event (`B:` events); `fallback` is used when the sim doesn't list it.
  | { kind: "input-event"; name: string; fallback?: Write }
  // Fire an H:event inside the sim (press, then release if given), only when the control isn't already at the
  // target if `whenDifferent`. Needs the in-sim module.
  | { kind: "h-event"; press: string; release?: string; whenDifferent: boolean }
  | { kind: "custom"; apply: (value: number, sim: WriteContext) => void };

export const toDatum = (target?: Datum): Write => (target ? { kind: "datum", target } : { kind: "datum" });

export const event = (name: string, scaling: { scale?: number; offset?: number } = {}): Write => ({
  kind: "event",
  name,
  scale: scaling.scale ?? 1,
  offset: scaling.offset ?? 0,
});

export const toggle = (name: string, data = 0): Write => ({ kind: "toggle", name, data });

export const pulse = (target: Datum, holdMs = 150): Write => ({ kind: "pulse", target, holdMs });

export const inputEvent = (name: string, fallback?: Write): Write =>
  fallback ? { kind: "input-event", name, fallback } : { kind: "input-event", name };

export const hEvent = (press: string, options: { release?: string; whenDifferent?: boolean } = {}): Write =>
  options.release === undefined
    ? { kind: "h-event", press, whenDifferent: options.whenDifferent ?? false }
    : { kind: "h-event", press, release: options.release, whenDifferent: options.whenDifferent ?? false };

export const custom = (apply: (value: number, sim: WriteContext) => void): Write => ({ kind: "custom", apply });

export interface Control {
  /** Stable id on the wire, e.g. `ovhd.elec.bat1`. */
  key: string;
  read: Datum;
  /**
   * The value is bit N (ARINC numbering, from 1) of `read`, an ARINC 429 word: FlyByWire stores those as the float32
   * bit pattern of the word's value, plus its sign/status matrix times 2^32.
   */
  arincBit?: number;
  write: Write;
  /** `momentary`: a button with no lasting state. Its press (a rise from 0) is replayed as a press. */
  kind?: "state" | "momentary";
  /** Changes smaller than this aren't synced. Also SimConnect's epsilon for reporting a change. */
  tolerance?: number;
  /** The most changes per second sent for a continuous control (a knob); the last value is always sent. */
  rateHz?: number;
  /** Only rises are synced, because the aircraft resets the switch itself (APU START). */
  risingOnly?: boolean;
  /** Synced only while another control or aux value equals `equals` (an FCU value while it isn't dashed). */
  only?: { key: string; equals: number };
  /** Can't be undone (fire agents, IDG disconnect); worth knowing when testing in the sim. */
  irreversible?: boolean;
  /**
   * A setting the host's aircraft decides (a flyPad option): only the host's value is sent, and the other side is
   * set back to it whenever its own changes.
   */
  fromHost?: boolean;
}

/** Controls grouped by panel, in the order they come alive when the aircraft powers up. */
export interface Area {
  name: string;
  controls: Control[];
}

/** An event watched on one side and replayed on the other: a press with no lasting state (an FCU knob push). */
export interface Action {
  key: string;
  event: string;
}

/** The aircraft as SimConnect describes it. */
export interface AircraftIdentity {
  title: string;
  atcModel: string;
  /** Each profile's `identity` datums, by datum name. */
  values: ReadonlyMap<string, number>;
}

export type McduLinkState = "linked" | "not-linked" | "simbridge-missing";

/** The FMS's link to the other pilot's FMS: key presses go both ways. */
export interface FmsLink {
  replay(press: McduPress): void;
  /** Every key pressed on either side since the aircraft loaded. */
  history(): readonly McduPress[];
  state(): McduLinkState;
  stop(): void;
}

export interface FmsSync {
  start(handle: SimConnectConnection, handlers: { onPress(press: McduPress): void; onState(): void }): FmsLink;
}

export interface AircraftProfile {
  id: string;
  /** Bumped when the profile's keys or meanings change; cockpits only sync between equal versions. */
  version: number;
  /** Shown to the pilot, e.g. "A320neo (FlyByWire)". Empty uses the aircraft's title. */
  name: string;
  /** Datums `matches` needs besides the title and ATC model. */
  identity: Datum[];
  matches(identity: AircraftIdentity): boolean;
  areas: Area[];
  /** Values read for custom writes and `only` conditions, by key; not synced themselves. */
  aux: Readonly<Record<string, Datum>>;
  actions: Action[];
  /** Controls only the pilot flying sets (thrust levers, trim, fuel); sent every frame and written on the follower. */
  flightControls: Control[];
  fms?: FmsSync;
  /**
   * The sim's stored-data keys (GetStoredData) naming the account the aircraft downloads flight plans with. In co-op
   * the co-pilot borrows the captain's, so a mirrored uplink loads the captain's plan.
   */
  flightPlanAccount?: readonly string[];
}

/** The SimConnect name of a datum. */
export const datumName = (datum: Datum): string => (datum.kind === "lvar" ? `L:${datum.name}` : datum.name);

export const datumUnit = (datum: Datum): string => (datum.kind === "lvar" ? "number" : datum.unit);

/** Builds one control per entry of `items`: for left/right and 1/2 families of the same switch. */
export function family<T>(items: readonly T[], build: (item: T) => Control): Control[] {
  return items.map((item) => build(item));
}
