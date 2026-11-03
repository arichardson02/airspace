import type { SimConnectConnection } from "node-simconnect";
import type { CockpitStatus, CoopMessage, FlightState, GroupPeer } from "@fs-career/contracts";
import { createCockpitIo } from "../aircraft/cockpit-io.js";
import { watchAircraft } from "../aircraft/detect.js";
import type { AircraftProfile, FmsLink } from "../aircraft/profile.js";
import { watchClock } from "../clock/clock.js";
import { watchControls } from "../flight/controls.js";
import { connectFlightState } from "../flight/flight-state.js";
import { createFollower } from "../flight/follower.js";
import { connectSimCode } from "../sim-code.js";
import { createSimEvents } from "../sim-ids.js";
import { type GroupSession, joinGroup } from "./group-session.js";
import { startSharing, type CoopSim, type Sharing } from "./sharing.js";

export interface CoopUpdate {
  /** Everyone else connected. */
  peers: GroupPeer[];
  /** The pilot ID of whoever is flying. */
  flyer: string;
  /** When both pilots last moved their controls at once. */
  dualInputAt?: number;
  /** What's shared beyond the motion, once a co-pilot is connected. */
  cockpit?: CockpitStatus;
}

export interface CoopJoinOptions {
  groupCode: string;
  token: string;
  /** The signed-in pilot; their user ID is the pilot ID. */
  pilot: GroupPeer;
  onChange(update: CoopUpdate): void;
  /** The group ended without us leaving, e.g. the connection to the co-op server dropped. */
  onEnded(reason: string): void;
}

export interface Coop {
  /** Joins a group; resolves once the co-op server accepted us, with a function to leave. */
  join(options: CoopJoinOptions): Promise<{ leave(): void }>;
}

const SEND_INTERVAL_MS = 1000 / 60;
const DUAL_INPUT_WARNING_MS = 2_000;

/**
 * Flies one aircraft between two pilots. The pilot flying runs the real flight and streams it; the other
 * pilot's aircraft is frozen and follows. Whoever deliberately moves their flight controls takes over,
 * unless the pilot flying is moving theirs too.
 *
 * The SimConnect setup happens once per connection, since data definitions and event mappings can't be
 * registered twice; each join only adds a group session on top.
 */
export function createCoop(handle: SimConnectConnection, signalingUrl: string): Coop {
  let onFrame: ((state: FlightState) => void) | undefined;
  let sharing: Sharing | undefined;
  let notify: (() => void) | undefined;
  const controls = watchControls(handle);
  const flightState = connectFlightState(handle, (state) => onFrame?.(state));
  const follower = createFollower(handle, flightState.write);
  const events = createSimEvents(handle);
  const simCode = connectSimCode(handle, () => notify?.());

  // The FMS link follows the loaded aircraft, so its key history covers everything since the aircraft loaded.
  let fms: FmsLink | undefined;
  let fmsProfile: AircraftProfile | undefined;
  const detector = watchAircraft(handle, (aircraft) => {
    if (aircraft.profile !== fmsProfile) {
      fms?.stop();
      fmsProfile = aircraft.profile;
      fms = aircraft.profile.fms?.start(handle, {
        onPress: (press) => sharing?.onMcduPress(press),
        onState: () => notify?.(),
      });
    }
    sharing?.onAircraftChanged();
  });
  const sim: CoopSim = {
    io: createCockpitIo(handle, events, simCode),
    aircraft: () => detector.current(),
    fms: () => fms,
    clock: watchClock(handle, events),
    simCode,
  };

  // Never leave the aircraft frozen from an earlier run.
  follower.stop();

  return {
    async join(options) {
      if (onFrame) throw new Error("Already in a group");

      const self = options.pilot.pilotId;
      // Pilot IDs are user IDs; logs show names instead.
      const names = new Map([[self, options.pilot.name]]);
      const peers = new Map<string, GroupPeer>();
      // Peers only connect after the join is sent, by which time the session is assigned.
      let session: GroupSession | undefined;
      let ended = false;
      let flyer = self;
      // Counts handovers so a late control message can't undo a newer one.
      let epoch = 0;
      let flyerMoving = false;
      let lastSentAt = 0;
      let lastWarnedAt = 0;
      let dualInputAt: number | undefined;

      const send = (message: CoopMessage, fast = false) => session?.broadcast(message, { fast });
      const changed = () => {
        if (ended) return;
        const cockpit = sharing?.status();
        const update = { peers: [...peers.values()], flyer, dualInputAt };
        options.onChange(cockpit ? { ...update, cockpit } : update);
      };
      sharing = startSharing({ sim, self, send: (message) => send(message), changed });
      notify = changed;

      const warnDualInput = (now: number): boolean => {
        if (now - lastWarnedAt < DUAL_INPUT_WARNING_MS) return false;
        lastWarnedAt = now;
        dualInputAt = now;
        console.warn("DUAL INPUT");
        changed();
        return true;
      };

      const setFlyer = (pilotId: string, newEpoch: number) => {
        const wasFlying = flyer === self;
        const wasFlyer = flyer;
        flyer = pilotId;
        epoch = newEpoch;
        flyerMoving = false;
        if (flyer !== wasFlyer) changed();

        const flying = flyer === self;
        if (flying === wasFlying) return;
        controls.setBlocked(!flying);
        if (flying) follower.stop();
        else follower.start();
        console.log(flying ? "You have control" : `${names.get(flyer) ?? flyer} has control`);
      };

      const end = () => {
        setFlyer(self, 0);
        ended = true;
        onFrame = undefined;
        flightState.setReading(false);
        sharing?.stop();
        sharing = undefined;
        notify = undefined;
      };

      onFrame = (state) => {
        const now = Date.now();
        const input = controls.poll(now);

        if (flyer === self) {
          if (now - lastSentAt < SEND_INTERVAL_MS) return;
          lastSentAt = now;
          const flightControls = sharing?.flightControls() ?? [];
          send({ type: "flight", time: now, state, input: input.moving, controls: flightControls }, true);
          return;
        }

        if (input.grabbing && flyerMoving) {
          if (warnDualInput(now)) send({ type: "dual-input" });
        } else if (input.grabbing) {
          setFlyer(self, epoch + 1);
          send({ type: "control", flyer: self, epoch });
          return;
        }
        follower.onFrame();
      };
      flightState.setReading(true);

      try {
        session = await joinGroup(signalingUrl, options.groupCode, options.token, options.pilot, {
          onPeerConnected: (peer, joinedBeforeUs) => {
            names.set(peer.pilotId, peer.name);
            peers.set(peer.pilotId, peer);
            console.log(`Connected to ${peer.name}`);
            changed();
            // The pilot already in the group keeps flying and hosts; the newcomer follows.
            if (joinedBeforeUs) setFlyer(peer.pilotId, 0);
            sharing?.onPeerConnected(!joinedBeforeUs);
          },
          onPeerLeft: (pilotId) => {
            console.log(`${names.get(pilotId) ?? pilotId} left the group`);
            peers.delete(pilotId);
            sharing?.onPeerLeft();
            changed();
            setFlyer(self, 0);
          },
          onMessage: (pilotId, message) => {
            switch (message.type) {
              case "flight":
                if (pilotId !== flyer) break;
                flyerMoving = message.input;
                follower.receive(message.time, message.state);
                sharing?.applyFlightControls(message.controls);
                break;
              case "control":
                // Equal epochs mean both took control at once; the lower pilot ID wins on both sides.
                if (message.epoch > epoch || (message.epoch === epoch && message.flyer < flyer)) {
                  setFlyer(message.flyer, message.epoch);
                }
                break;
              case "dual-input":
                warnDualInput(Date.now());
                break;
              case "hello":
              case "cockpit":
              case "cockpit-snapshot":
              case "cockpit-action":
              case "mcdu":
              case "mcdu-history":
              case "clock":
                sharing?.receive(pilotId, message);
                break;
            }
          },
          onClosed: (reason) => {
            if (ended) return;
            end();
            options.onEnded(reason);
          },
        });
      } catch (err) {
        end();
        throw err;
      }

      console.log(`Joined group ${options.groupCode} as ${options.pilot.name}`);
      changed();
      return {
        leave() {
          if (ended) return;
          end();
          session.leave();
        },
      };
    },
  };
}
