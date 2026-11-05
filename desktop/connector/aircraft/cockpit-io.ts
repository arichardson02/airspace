import {
  DataRequestFlag,
  RawBuffer,
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod,
  type SimConnectConnection,
} from "node-simconnect";
import type { SimCode } from "../sim-code.js";
import { DEFINITION, REQUEST, type SimEvents } from "../sim-ids.js";
import {
  datumName,
  datumUnit,
  type Action,
  type AircraftProfile,
  type Control,
  type Datum,
  type Write,
  type WriteContext,
} from "./profile.js";

// How long a momentary button stays pressed.
const PRESS_MS = 150;
// Cockpit values are read every other sim frame: quick enough for switches, light enough for hundreds of L:vars.
const READ_EVERY_FRAMES = 2;

/** One datum in the cockpit definition, shared by every control and aux value that reads it. */
interface Slot {
  datum: Datum;
  controls: Control[];
  auxKeys: string[];
}

export interface CockpitHandlers {
  /** A control's value changed (every control is reported once when reading starts). */
  onValue(control: Control, value: number): void;
  /** A watched event fired, by the pilot or by anything else. */
  onAction(action: Action, data: number): void;
}

/** Reads and sets one aircraft's cockpit as its profile describes. */
export interface CockpitIo {
  start(profile: AircraftProfile, handlers: CockpitHandlers): void;
  stop(): void;
  /** The latest value of a control or aux value. */
  value(key: string): number | undefined;
  write(control: Control, value: number): void;
  /** Presses a momentary control: on, then off after a short hold. */
  press(control: Control): void;
  replay(action: Action, data: number): void;
  /** The profile's flyer-only controls, read every frame. */
  flightControls(): number[];
  /** Writes the pilot flying's flyer-only controls, skipping values that haven't moved. */
  applyFlightControls(values: readonly number[]): void;
}

/** A control's value from its datum's raw reading: the whole value, or one bit of a status word. */
const arincWord = new DataView(new ArrayBuffer(4));

const readValue = (control: Control, raw: number): number => {
  if (control.arincBit === undefined) return raw;
  // The low 32 bits are the float32 holding the word's value; above them sits the sign/status matrix.
  arincWord.setUint32(0, (raw % 2 ** 32) >>> 0);
  return (Math.trunc(arincWord.getFloat32(0)) >>> (control.arincBit - 1)) & 1;
};

// How many request-id generations the reader cycles through (see `requestId`).
const GENERATIONS = 10;

export function createCockpitIo(handle: SimConnectConnection, events: SimEvents, simCode: SimCode): CockpitIo {
  let profile: AircraftProfile | undefined;
  let handlers: CockpitHandlers | undefined;
  let slots: Slot[] = [];
  let slotIds = new Map<string, number>();
  let writeIds = new Map<string, number>();
  const values = new Map<string, number>();
  const inputHashes = new Map<string, bigint>();
  const actionsByEvent = new Map<string, Action>();
  const observed = new Set<string>();
  let flightValues: number[] = [];
  let applied: (number | undefined)[] = [];

  // Definitions with entries: SimConnect rejects clearing or requesting one that has none.
  const defined = new Set<number>();
  const writeBuffer = new RawBuffer(12);
  const setDatum = (datum: Datum, value: number) => {
    const name = datumName(datum);
    let definition: number = DEFINITION.cockpit;
    let id = slotIds.get(name);
    if (id === undefined) {
      definition = DEFINITION.cockpitWrites;
      id = writeIds.get(name);
      if (id === undefined) {
        id = writeIds.size;
        writeIds.set(name, id);
        handle.addToDataDefinition(definition, name, datumUnit(datum), SimConnectDataType.FLOAT64, 0, id);
        defined.add(definition);
      }
    }
    writeBuffer.clear();
    writeBuffer.writeInt32(id);
    writeBuffer.writeFloat64(value);
    handle.setDataOnSimObject(definition, SimConnectConstants.OBJECT_ID_USER, {
      buffer: writeBuffer,
      arrayCount: 1,
      tagged: true,
    });
  };

  const context: WriteContext = {
    event: (name, data) => {
      events.transmit(name, data);
    },
    value: (key) => values.get(key),
    set: setDatum,
    calculator: (code) => {
      simCode.run(code);
    },
  };

  const differs = (control: Control, value: number) => values.get(control.key) !== value;

  const apply = (control: Control, write: Write, value: number): void => {
    switch (write.kind) {
      case "datum":
        setDatum(write.target ?? control.read, value);
        break;
      case "event":
        events.transmit(write.name, Math.round(value * write.scale + write.offset));
        break;
      case "toggle":
        if (differs(control, value)) events.transmit(write.name, write.data);
        break;
      case "pulse":
        if (differs(control, value)) {
          setDatum(write.target, 1);
          setTimeout(() => {
            setDatum(write.target, 0);
          }, write.holdMs);
        }
        break;
      case "input-event": {
        const hash = inputHashes.get(write.name);
        if (hash !== undefined) handle.setInputEvent(hash, value);
        else if (write.fallback) apply(control, write.fallback, value);
        break;
      }
      case "h-event":
        if (write.whenDifferent && !differs(control, value)) break;
        simCode.run(`(>H:${write.press})`);
        if (write.release !== undefined) {
          const release = write.release;
          setTimeout(() => {
            simCode.run(`(>H:${release})`);
          }, PRESS_MS);
        }
        break;
      case "custom":
        write.apply(value, context);
        break;
    }
  };

  // Every start reads with fresh request ids (the base id × 10 + a generation 0-9). A sample still on its way for
  // the previous aircraft's layout then doesn't match and is dropped, instead of being read against the new one.
  let generation = 0;
  const requestId = (base: number) => base * GENERATIONS + generation;

  handle.on("simObjectData", (sample) => {
    if (sample.requestID === requestId(REQUEST.flightControls)) {
      flightValues = (profile?.flightControls ?? []).map(() => sample.data.readFloat64());
      return;
    }
    if (sample.requestID !== requestId(REQUEST.cockpit)) return;
    // Tagged: only the datums that changed, each as its id and value.
    for (let i = 0; i < sample.defineCount; i++) {
      const slot = slots.at(Math.max(0, sample.data.readInt32()));
      const raw = sample.data.readFloat64();
      if (slot === undefined) continue;
      for (const key of slot.auxKeys) values.set(key, raw);
      for (const control of slot.controls) {
        const value = readValue(control, raw);
        if (values.get(control.key) === value) continue;
        values.set(control.key, value);
        handlers?.onValue(control, value);
      }
    }
  });

  handle.on("inputEventsList", (list) => {
    for (const descriptor of list.inputEventDescriptors) inputHashes.set(descriptor.name, descriptor.inputEventIdHash);
  });

  const stopReading = () => {
    const user = SimConnectConstants.OBJECT_ID_USER;
    if (defined.has(DEFINITION.cockpit)) {
      handle.requestDataOnSimObject(requestId(REQUEST.cockpit), DEFINITION.cockpit, user, SimConnectPeriod.NEVER);
    }
    if (defined.has(DEFINITION.flightControls)) {
      handle.requestDataOnSimObject(
        requestId(REQUEST.flightControls),
        DEFINITION.flightControls,
        user,
        SimConnectPeriod.NEVER,
      );
    }
    for (const definition of defined) handle.clearDataDefinition(definition);
    defined.clear();
  };

  return {
    start(next, nextHandlers) {
      if (profile) stopReading();
      generation = (generation + 1) % GENERATIONS;
      profile = next;
      handlers = nextHandlers;
      values.clear();
      actionsByEvent.clear();
      applied = [];
      flightValues = [];
      slots = [];
      slotIds = new Map();
      writeIds = new Map();

      const slotFor = (datum: Datum): Slot => {
        const name = datumName(datum);
        const id = slotIds.get(name);
        const known = id === undefined ? undefined : slots.at(id);
        if (known !== undefined) return known;
        const slot: Slot = { datum, controls: [], auxKeys: [] };
        slotIds.set(name, slots.length);
        slots.push(slot);
        return slot;
      };
      for (const control of next.areas.flatMap((area) => area.controls)) slotFor(control.read).controls.push(control);
      for (const [key, datum] of Object.entries(next.aux)) slotFor(datum).auxKeys.push(key);

      slots.forEach((slot, id) => {
        // A slot reports a change once its most sensitive reader would; bits and aux values need every change.
        const tolerances = slot.controls.map((control) =>
          control.arincBit === undefined ? (control.tolerance ?? 0) : 0,
        );
        const epsilon = slot.auxKeys.length > 0 || tolerances.length === 0 ? 0 : Math.min(...tolerances);
        handle.addToDataDefinition(
          DEFINITION.cockpit,
          datumName(slot.datum),
          datumUnit(slot.datum),
          SimConnectDataType.FLOAT64,
          epsilon,
          id,
        );
        defined.add(DEFINITION.cockpit);
      });
      for (const control of next.flightControls) {
        handle.addToDataDefinition(
          DEFINITION.flightControls,
          datumName(control.read),
          datumUnit(control.read),
          SimConnectDataType.FLOAT64,
        );
        defined.add(DEFINITION.flightControls);
      }

      const user = SimConnectConstants.OBJECT_ID_USER;
      if (defined.has(DEFINITION.cockpit)) {
        handle.requestDataOnSimObject(
          requestId(REQUEST.cockpit),
          DEFINITION.cockpit,
          user,
          SimConnectPeriod.SIM_FRAME,
          DataRequestFlag.DATA_REQUEST_FLAG_CHANGED | DataRequestFlag.DATA_REQUEST_FLAG_TAGGED,
          0,
          READ_EVERY_FRAMES,
        );
      }
      if (next.flightControls.length > 0) {
        handle.requestDataOnSimObject(
          requestId(REQUEST.flightControls),
          DEFINITION.flightControls,
          user,
          SimConnectPeriod.SIM_FRAME,
        );
      }

      const writes = next.areas.flatMap((area) => area.controls.map((control) => control.write));
      if (writes.some((write) => write.kind === "input-event")) handle.enumerateInputEvents(REQUEST.inputEvents);

      for (const action of next.actions) {
        actionsByEvent.set(action.event, action);
        // MSFS can't stop notifying a mapped event without forgetting it, so watching is kept for the connection
        // and only actions of the current profile are reported.
        if (observed.has(action.event)) continue;
        observed.add(action.event);
        events.observe(action.event, (data) => {
          const current = actionsByEvent.get(action.event);
          if (current) handlers?.onAction(current, data);
        });
      }
    },
    stop() {
      if (!profile) return;
      stopReading();
      profile = undefined;
      handlers = undefined;
      actionsByEvent.clear();
    },
    value: (key) => values.get(key),
    write(control, value) {
      apply(control, control.write, value);
    },
    press(control) {
      apply(control, control.write, 1);
      if (control.write.kind !== "datum") return;
      setTimeout(() => {
        apply(control, control.write, 0);
      }, PRESS_MS);
    },
    replay(action, data) {
      events.transmit(action.event, data);
    },
    flightControls: () => [...flightValues],
    applyFlightControls(next) {
      const controls = profile?.flightControls ?? [];
      next.forEach((value, i) => {
        const control = controls.at(i);
        const last = applied.at(i);
        if (control === undefined || (last !== undefined && Math.abs(value - last) <= (control.tolerance ?? 0))) {
          return;
        }
        applied[i] = value;
        apply(control, control.write, value);
      });
    },
  };
}
