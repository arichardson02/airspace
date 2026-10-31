import type { SimConnectConnection } from "node-simconnect";
import type { CoopMessage, GroupPeer } from "@fs-career/contracts";
import { watchControls } from "../flight/controls.js";
import { connectFlightState } from "../flight/flight-state.js";
import { createFollower } from "../flight/follower.js";
import { type GroupSession, joinGroup } from "./group-session.js";

interface GroupFlightOptions {
  signalingUrl: string;
  groupCode: string;
  token: string;
  /** The signed-in pilot; their user ID is the pilot ID. */
  pilot: GroupPeer;
}

const SEND_INTERVAL_MS = 1000 / 60;
const DUAL_INPUT_WARNING_MS = 2_000;

/**
 * Flies one aircraft between two pilots. The pilot flying runs the real flight and streams it; the other
 * pilot's aircraft is frozen and follows. Whoever deliberately moves their flight controls takes over,
 * unless the pilot flying is moving theirs too. Returns a function to leave.
 */
export async function startGroupFlight(
  handle: SimConnectConnection,
  options: GroupFlightOptions,
): Promise<() => void> {
  const self = options.pilot.pilotId;
  // Pilot IDs are user IDs; logs show names instead.
  const names = new Map([[self, options.pilot.name]]);
  // Peers only connect after the join is sent, by which time the session is assigned.
  let session: GroupSession | undefined;
  let flyer = self;
  // Counts handovers so a late control message can't undo a newer one.
  let epoch = 0;
  let flyerMoving = false;
  let lastSentAt = 0;
  let lastWarnedAt = 0;

  const send = (message: CoopMessage, fast = false) => session?.broadcast(message, { fast });

  const warnDualInput = (now: number): boolean => {
    if (now - lastWarnedAt < DUAL_INPUT_WARNING_MS) return false;
    lastWarnedAt = now;
    console.warn("DUAL INPUT");
    return true;
  };

  const controls = watchControls(handle);
  const write = connectFlightState(handle, (state) => {
    const now = Date.now();
    const input = controls.poll(now);

    if (flyer === self) {
      if (now - lastSentAt < SEND_INTERVAL_MS) return;
      lastSentAt = now;
      send({ type: "flight", time: now, state, input: input.moving }, true);
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
  });
  const follower = createFollower(handle, write);

  function setFlyer(pilotId: string, newEpoch: number) {
    const wasFlying = flyer === self;
    flyer = pilotId;
    epoch = newEpoch;
    flyerMoving = false;

    const flying = flyer === self;
    if (flying === wasFlying) return;
    controls.setBlocked(!flying);
    if (flying) follower.stop();
    else follower.start();
    console.log(flying ? "You have control" : `${names.get(flyer) ?? flyer} has control`);
  }

  // Never leave the aircraft frozen from an earlier run.
  follower.stop();

  session = await joinGroup(options.signalingUrl, options.groupCode, options.token, options.pilot, {
    onPeerConnected: (peer, joinedBeforeUs) => {
      names.set(peer.pilotId, peer.name);
      console.log(`Connected to ${peer.name}`);
      // The pilot already in the group keeps flying; the newcomer follows.
      if (joinedBeforeUs) setFlyer(peer.pilotId, 0);
    },
    onPeerLeft: (pilotId) => {
      console.log(`${names.get(pilotId) ?? pilotId} left the group`);
      setFlyer(self, 0);
    },
    onMessage: (pilotId, raw) => {
      const message = raw as CoopMessage;
      switch (message.type) {
        case "flight":
          if (pilotId !== flyer) break;
          flyerMoving = message.input;
          follower.receive(message.time, message.state);
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
      }
    },
  });

  console.log(`Joined group ${options.groupCode} as ${options.pilot.name}`);
  return () => {
    session.leave();
    setFlyer(self, 0);
  };
}
