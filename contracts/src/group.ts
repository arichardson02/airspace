// Signaling for peer-to-peer co-op groups. Group data goes directly between connectors, never through the server.

export interface GroupPeer {
  pilotId: string;
}

// WebRTC handshake payloads relayed between two connectors.
export type Signal = { sdp: string; type: string } | { candidate: string; mid: string };

export type ClientSignalingMessage =
  | { type: "join"; groupCode: string; peer: GroupPeer }
  | { type: "signal"; to: string; signal: Signal };

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
}

// Sent directly between the two pilots' connectors during a co-op flight.
export type CoopMessage =
  // Sent every frame by the pilot flying; `input` is true while they're moving their flight controls.
  | { type: "flight"; time: number; state: FlightState; input: boolean }
  // Announces who is flying. A higher epoch replaces a lower one.
  | { type: "control"; flyer: string; epoch: number }
  // Both pilots moved their controls at once; the pilot flying kept control.
  | { type: "dual-input" };
