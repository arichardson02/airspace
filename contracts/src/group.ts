// Signaling for peer-to-peer co-op groups. Group data goes directly between connectors, never through the server.

/** A signed-in pilot. The server fills this in from their session, so it can't be spoofed. */
export interface GroupPeer {
  /** The pilot's user id. */
  pilotId: string;
  name: string;
}

// WebRTC handshake payloads relayed between two connectors.
export type Signal = { sdp: string; type: string } | { candidate: string; mid: string };

export type ClientSignalingMessage =
  { type: "join"; groupCode: string } | { type: "signal"; to: string; signal: Signal };

export type ServerSignalingMessage =
  | { type: "peers"; peers: GroupPeer[] }
  | { type: "peer-joined"; peer: GroupPeer }
  | { type: "peer-left"; pilotId: string }
  | { type: "signal"; from: string; signal: Signal };

/** The flying aircraft's motion, copied into the follower's frozen aircraft. Degrees, feet and feet per second. */
export interface FlightState {
  latitude: number;
  longitude: number;
  altitude: number;
  pitch: number;
  bank: number;
  heading: number;
  headingGyro: number;
  gForce: number;
  verticalSpeed: number;
  velocityBodyY: number;
  velocityBodyZ: number;
  velocityWorldX: number;
  velocityWorldZ: number;
  elevator: number;
  aileron: number;
  rudder: number;
  /** 1 while the aircraft is on the ground (SIM ON GROUND), else 0. */
  onGround: number;
}

/** Bumped whenever the co-op messages change in a way an older connector can't follow. */
export const COOP_PROTOCOL = 3;

/** One cockpit control's value. `seq` orders changes to the same control; the higher one wins. */
export interface CockpitValue {
  key: string;
  value: number;
  seq: number;
}

export type McduSide = "left" | "right";

export interface McduPress {
  side: McduSide;
  key: string;
}

/** The host's date and time, which the other pilot's sim is set to. */
export interface SimClock {
  year: number;
  dayOfYear: number;
  /** Seconds since midnight, UTC. */
  secondsOfDay: number;
}

// Sent directly between the two pilots' connectors during a co-op flight.
export type CoopMessage =
  // Sent every frame by the pilot flying; `input` is true while they're moving their flight controls. `controls` are
  // the aircraft profile's flyer-only controls (thrust levers, pitch trim, fuel), in the profile's order.
  | { type: "flight"; time: number; state: FlightState; input: boolean; controls: number[] }
  // Announces who is flying. A higher epoch replaces a lower one.
  | { type: "control"; flyer: string; epoch: number }
  // Both pilots moved their controls at once; the pilot flying kept control.
  | { type: "dual-input" }
  // Sent when a peer connects and whenever the aircraft changes. Cockpits only sync between equal profiles.
  | {
      type: "hello";
      protocol: number;
      aircraft: string;
      profile: string | null;
      profileVersion: number;
      /** When the aircraft finished loading (epoch ms); the older aircraft's cockpit is the one both start from. */
      loadedAt: number;
      /** MCDU keys pressed since the aircraft loaded, so a pilot joining late can catch the FMS up. */
      mcduPresses: number;
    }
  // Cockpit controls the pilot changed, batched.
  | { type: "cockpit"; changes: CockpitValue[] }
  // Every cockpit control, sent once by the pilot whose aircraft loaded first.
  | { type: "cockpit-snapshot"; values: CockpitValue[] }
  // A cockpit button press that has no lasting state to sync (an FCU knob push, an EFIS pushbutton), with the
  // event's data so it's replayed exactly.
  | { type: "cockpit-action"; key: string; data: number }
  | { type: "mcdu"; press: McduPress }
  // Every MCDU key pressed so far, for a pilot whose FMS hasn't been touched yet.
  | { type: "mcdu-history"; presses: McduPress[] }
  // The host's date and time, sent on join and every minute.
  | { type: "clock"; clock: SimClock };
