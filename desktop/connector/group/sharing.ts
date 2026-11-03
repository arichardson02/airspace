import { COOP_PROTOCOL, type CockpitStatus, type CoopMessage, type McduPress } from "@fs-career/contracts";
import type { CockpitIo } from "../aircraft/cockpit-io.js";
import type { DetectedAircraft } from "../aircraft/detect.js";
import type { AircraftProfile, FmsLink } from "../aircraft/profile.js";
import type { ClockLink } from "../clock/clock.js";
import type { SimCode } from "../sim-code.js";
import { startCockpitSync, type CockpitSync } from "./cockpit-sync.js";

// Everything shared in co-op beyond the aircraft's motion: the cockpit, the MCDU, and the host's clock.

// The host's clock is re-sent this often.
const CLOCK_EVERY_MS = 60_000;
// A co-pilot whose connector says nothing about its aircraft by then is running an older Airspace.
const HELLO_TIMEOUT_MS = 5_000;
// Replayed MCDU history is pressed at this pace, so the FMS keeps up.
const HISTORY_PRESS_MS = 150;

type Hello = Extract<CoopMessage, { type: "hello" }>;
export type SharingMessage = Extract<
  CoopMessage,
  { type: "hello" | "cockpit" | "cockpit-snapshot" | "cockpit-action" | "mcdu" | "mcdu-history" | "clock" }
>;

/** The pieces of one simulator connection that sharing uses. */
export interface CoopSim {
  io: CockpitIo;
  aircraft(): DetectedAircraft | undefined;
  fms(): FmsLink | undefined;
  clock: ClockLink;
  simCode: SimCode;
}

export interface Sharing {
  /** A co-pilot connected; `host` is whether we were in the group first. */
  onPeerConnected(host: boolean): void;
  onPeerLeft(): void;
  onAircraftChanged(): void;
  onMcduPress(press: McduPress): void;
  receive(from: string, message: SharingMessage): void;
  /** The profile's flyer-only controls, for the flight message. */
  flightControls(): number[];
  /** Writes the pilot flying's flyer-only controls, when both aircraft use the same profile. */
  applyFlightControls(values: readonly number[]): void;
  status(): CockpitStatus | undefined;
  stop(): void;
}

export function startSharing(options: {
  sim: CoopSim;
  self: string;
  send: (message: CoopMessage) => void;
  /** The status changed. */
  changed: () => void;
}): Sharing {
  const { sim, self, send, changed } = options;
  let peer: Hello | undefined;
  let peerId = "";
  let peerConnected = false;
  let helloLate = false;
  let sync: CockpitSync | undefined;
  let profile: AircraftProfile | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let helloTimer: ReturnType<typeof setTimeout> | undefined;
  const historyTimers: ReturnType<typeof setTimeout>[] = [];

  const compatible = (): boolean => {
    const aircraft = sim.aircraft();
    return (
      peer !== undefined &&
      aircraft !== undefined &&
      peer.protocol === COOP_PROTOCOL &&
      profileId(aircraft) !== null &&
      peer.profile === aircraft.profile.id &&
      peer.profileVersion === aircraft.profile.version
    );
  };

  const sendHello = () => {
    const aircraft = sim.aircraft();
    if (!aircraft || !peerConnected) return;
    send({
      type: "hello",
      protocol: COOP_PROTOCOL,
      aircraft: aircraft.profile.name || aircraft.identity.title,
      profile: profileId(aircraft),
      profileVersion: aircraft.profile.version,
      loadedAt: aircraft.loadedAt,
      mcduPresses: sim.fms()?.history().length ?? 0,
    });
  };

  // Reading follows the loaded aircraft for as long as we're in the group; the cockpit sync only runs between
  // equal profiles.
  const readAircraft = () => {
    const aircraft = sim.aircraft();
    if (!aircraft || aircraft.profile === profile) return;
    profile = aircraft.profile;
    sim.io.start(profile, {
      onValue: (control, value) => sync?.handlers.onValue(control, value),
      onAction: (action, data) => sync?.handlers.onAction(action, data),
    });
  };

  const reconsider = () => {
    const aircraft = sim.aircraft();
    const should = compatible();
    if (!should || !aircraft) {
      sync?.stop();
      sync = undefined;
      changed();
      return;
    }
    if (sync) return;
    sync = startCockpitSync({ io: sim.io, profile: aircraft.profile, self, send });
    // The aircraft loaded first is the one whose cockpit both start from; on a tie, the lower pilot id's.
    const ours =
      peer !== undefined &&
      (aircraft.loadedAt < peer.loadedAt || (aircraft.loadedAt === peer.loadedAt && self < peerId));
    if (ours) send({ type: "cockpit-snapshot", values: sync.snapshot() });
    // A co-pilot whose FMS hasn't been touched catches up on ours.
    const history = sim.fms()?.history() ?? [];
    if (peer?.mcduPresses === 0 && history.length > 0) send({ type: "mcdu-history", presses: [...history] });
    changed();
  };

  const sendClock = () => {
    const clock = sim.clock.current();
    if (clock) send({ type: "clock", clock });
  };

  const notes = (): string[] => {
    const aircraft = sim.aircraft();
    const result: string[] = [];
    if (!sync) result.push(motionOnlyReason(aircraft, peer, helloLate));
    const fms = sim.fms();
    if (sync && fms?.state() === "simbridge-missing") result.push("MCDU sync needs FlyByWire SimBridge running");
    if (sync && fms?.state() === "not-linked") result.push("MCDU sync: turn on SimBridge in the flyPad's settings");
    const usesSimCode = aircraft?.profile.areas.some((area) =>
      area.controls.some((control) => control.write.kind === "h-event"),
    );
    if (sync && usesSimCode === true && sim.simCode.state() === "missing") {
      result.push("ECAM panel sync starts after you restart Flight Simulator");
    }
    return result;
  };

  readAircraft();

  return {
    onPeerConnected(host) {
      peerConnected = true;
      sendHello();
      helloTimer = setTimeout(() => {
        helloLate = peer === undefined;
        changed();
      }, HELLO_TIMEOUT_MS);
      if (!host) return;
      sendClock();
      clockTimer = setInterval(sendClock, CLOCK_EVERY_MS);
    },
    onPeerLeft() {
      peerConnected = false;
      peer = undefined;
      clearInterval(clockTimer);
      clearTimeout(helloTimer);
      reconsider();
    },
    onAircraftChanged() {
      readAircraft();
      sync?.stop();
      sync = undefined;
      sendHello();
      reconsider();
    },
    onMcduPress(press) {
      if (sync) send({ type: "mcdu", press });
    },
    receive(from, message) {
      switch (message.type) {
        case "hello":
          peer = message;
          peerId = from;
          helloLate = false;
          reconsider();
          break;
        case "cockpit":
        case "cockpit-snapshot":
        case "cockpit-action":
          sync?.receive(from, message);
          break;
        case "mcdu":
          if (sync) sim.fms()?.replay(message.press);
          break;
        case "mcdu-history":
          message.presses.forEach((press, i) => {
            historyTimers.push(
              setTimeout(() => {
                if (sync) sim.fms()?.replay(press);
              }, i * HISTORY_PRESS_MS),
            );
          });
          break;
        case "clock":
          sim.clock.matchHost(message.clock);
          break;
      }
    },
    flightControls: () => sim.io.flightControls(),
    applyFlightControls(values) {
      const aircraft = sim.aircraft();
      if (!aircraft || !peer || peer.profile !== profileId(aircraft)) return;
      if (values.length !== aircraft.profile.flightControls.length) return;
      sim.io.applyFlightControls(values);
    },
    status() {
      const aircraft = sim.aircraft();
      if (!aircraft || !peerConnected) return undefined;
      return { aircraft: aircraft.profile.name || aircraft.identity.title, synced: sync !== undefined, notes: notes() };
    },
    stop() {
      sync?.stop();
      sync = undefined;
      sim.io.stop();
      clearInterval(clockTimer);
      clearTimeout(helloTimer);
      for (const timer of historyTimers) clearTimeout(timer);
    },
  };
}

/** The profile id peers compare, or null for an aircraft whose cockpit doesn't sync (the generic profile). */
function profileId(aircraft: DetectedAircraft | undefined): string | null {
  return aircraft === undefined || aircraft.profile.areas.length === 0 ? null : aircraft.profile.id;
}

function motionOnlyReason(aircraft: DetectedAircraft | undefined, peer: Hello | undefined, helloLate: boolean): string {
  if (!peer)
    return helloLate ? "Only the motion is shared: your co-pilot needs to update Airspace" : "Connecting the cockpits";
  if (peer.protocol !== COOP_PROTOCOL) return "Only the motion is shared: one of you needs to update Airspace";
  if (aircraft?.profile.areas.length === 0)
    return "Only the motion is shared: this aircraft's cockpit isn't supported yet";
  if (peer.profile !== aircraft?.profile.id)
    return `Only the motion is shared: your co-pilot is in the ${peer.aircraft}`;
  return "Only the motion is shared: one of you needs to update Airspace";
}
