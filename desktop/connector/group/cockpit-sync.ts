import type { CockpitValue, CoopMessage } from "@fs-career/contracts";
import type { CockpitHandlers, CockpitIo } from "../aircraft/cockpit-io.js";
import type { Action, AircraftProfile, Control } from "../aircraft/profile.js";

// Keeps two cockpits' controls equal: what one pilot changes is sent and set on the other side. Only controls the
// pilot touches are synced, so each sim still computes everything that follows from them.

// Changes are batched this often on the reliable channel.
const FLUSH_MS = 50;
// A value we set comes back as a reading within this long; that reading isn't a change of the pilot's.
const ECHO_MS = 1_000;
// A snapshot is applied in chunks this size per flush, so the aircraft's systems keep up.
const SNAPSHOT_CHUNK = 20;
// After a snapshot the cockpit settles (systems react to what was set) before its own changes count again.
const SETTLE_MS = 2_000;

/** Whether a reading is a change of the pilot's: a press for momentary controls, a rise for rising-only ones. */
const isChange = (control: Control, before: number, value: number): boolean =>
  control.kind === "momentary" ? value > 0 && before === 0 : control.risingOnly !== true || value > before;

type CockpitMessage = Extract<CoopMessage, { type: "cockpit" | "cockpit-snapshot" | "cockpit-action" }>;

export interface CockpitSync {
  /** What the cockpit reading reports to; whoever reads the cockpit passes its values and actions here. */
  handlers: CockpitHandlers;
  /** A cockpit message from the pilot `from`. */
  receive(from: string, message: CockpitMessage): void;
  /** Every control's current value, for a co-pilot whose cockpit should start from ours. */
  snapshot(): CockpitValue[];
  stop(): void;
}

export function startCockpitSync(options: {
  io: CockpitIo;
  profile: AircraftProfile;
  /** Our pilot id, which breaks ties between changes made at the same moment. */
  self: string;
  send: (message: CoopMessage) => void;
}): CockpitSync {
  const { io, profile, self, send } = options;
  const controls = profile.areas.flatMap((area) => area.controls);
  const byKey = new Map(controls.map((control) => [control.key, control]));
  const actions = new Map(profile.actions.map((action) => [action.key, action]));

  // The newest change seen per control: the higher `seq` wins, and on a tie the lower pilot id, on both sides.
  const latest = new Map<string, { seq: number; pilot: string }>();
  const applied = new Map<string, { value: number; at: number }>();
  // When a momentary control was last pressed from the network: its press reads back here as a rise of our own.
  const replayedPress = new Map<string, number>();
  // What each control read last. The cockpit is read from before the sync starts, and only changes are reported, so
  // it starts from those readings; otherwise a control's first change would pass for its first reading.
  const seen = new Map<string, number>();
  for (const control of controls) {
    const value = io.value(control.key);
    if (value !== undefined) seen.set(control.key, value);
  }
  const pending = new Map<string, CockpitValue>();
  const sentAt = new Map<string, number>();
  const replaying = new Map<string, number>();
  let snapshotQueue: CockpitValue[] = [];
  let quietUntil = 0;

  const active = (control: Control) => control.only === undefined || io.value(control.only.key) === control.only.equals;

  // A value (or press) set from the network reads back here; that reading isn't the pilot's.
  const isEcho = (control: Control, value: number, now: number): boolean => {
    if (control.kind === "momentary") {
      const replayed = replayedPress.get(control.key);
      if (replayed === undefined || now - replayed >= ECHO_MS) return false;
      replayedPress.delete(control.key);
      return true;
    }
    const echo = applied.get(control.key);
    if (!echo || now - echo.at >= ECHO_MS || Math.abs(value - echo.value) > (control.tolerance ?? 0)) return false;
    applied.delete(control.key);
    return true;
  };

  const onValue = (control: Control, value: number) => {
    const before = seen.get(control.key);
    seen.set(control.key, value);
    const now = Date.now();
    // The first reading of each control isn't a change.
    if (before === undefined || now < quietUntil || snapshotQueue.length > 0) return;

    if (!active(control) || !isChange(control, before, value) || isEcho(control, value, now)) return;

    const seq = (latest.get(control.key)?.seq ?? 0) + 1;
    latest.set(control.key, { seq, pilot: self });
    pending.set(control.key, { key: control.key, value, seq });
  };

  const onAction = (action: Action, data: number) => {
    const replays = replaying.get(action.key) ?? 0;
    if (replays > 0) {
      replaying.set(action.key, replays - 1);
      return;
    }
    send({ type: "cockpit-action", key: action.key, data });
  };

  const apply = (control: Control, value: number) => {
    if (!active(control)) return;
    if (control.kind === "momentary") {
      replayedPress.set(control.key, Date.now());
      io.press(control);
      return;
    }
    applied.set(control.key, { value, at: Date.now() });
    io.write(control, value);
  };

  const accept = (from: string, change: CockpitValue): Control | undefined => {
    const control = byKey.get(change.key);
    if (!control || !Number.isFinite(change.value) || !Number.isFinite(change.seq)) return undefined;
    const current = latest.get(change.key);
    if (current && (change.seq < current.seq || (change.seq === current.seq && from >= current.pilot))) {
      return undefined;
    }
    latest.set(change.key, { seq: change.seq, pilot: from });
    return control;
  };

  const flush = () => {
    const now = Date.now();
    const batch: CockpitValue[] = [];
    for (const [key, change] of pending) {
      const rateHz = byKey.get(key)?.rateHz;
      if (rateHz !== undefined && now - (sentAt.get(key) ?? 0) < 1000 / rateHz) continue;
      batch.push(change);
      pending.delete(key);
      sentAt.set(key, now);
    }
    if (batch.length > 0) send({ type: "cockpit", changes: batch });

    if (snapshotQueue.length === 0) return;
    for (const value of snapshotQueue.splice(0, SNAPSHOT_CHUNK)) {
      const control = byKey.get(value.key);
      if (control) apply(control, value.value);
    }
    if (snapshotQueue.length === 0) quietUntil = Date.now() + SETTLE_MS;
  };
  const timer = setInterval(flush, FLUSH_MS);

  // Snapshot values in the profile's power-up order, so systems come alive in the order a crew would bring them up.
  const order = new Map(controls.map((control, index) => [control.key, index]));

  return {
    handlers: { onValue, onAction },
    receive(from, message) {
      switch (message.type) {
        case "cockpit":
          for (const change of message.changes) {
            const control = accept(from, change);
            if (control) apply(control, change.value);
          }
          break;
        case "cockpit-snapshot":
          snapshotQueue = message.values
            .filter((value) => accept(from, value) !== undefined)
            .toSorted((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
          break;
        case "cockpit-action": {
          const action = actions.get(message.key);
          if (!action || !Number.isFinite(message.data)) break;
          replaying.set(action.key, (replaying.get(action.key) ?? 0) + 1);
          io.replay(action, message.data);
          break;
        }
      }
    },
    snapshot() {
      return controls
        .filter((control) => control.kind !== "momentary" && control.risingOnly !== true && active(control))
        .flatMap((control) => {
          const value = seen.get(control.key);
          return value === undefined ? [] : [{ key: control.key, value, seq: latest.get(control.key)?.seq ?? 0 }];
        });
    },
    stop() {
      clearInterval(timer);
    },
  };
}
