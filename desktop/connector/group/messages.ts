import type { CoopMessage, GroupPeer, ServerSignalingMessage, Signal } from "@fs-career/contracts";
import { buildFlightState } from "../flight/flight-state.js";

// The co-op server and peers send JSON. It's checked here as it arrives, and anything that isn't a message the
// connector understands is dropped.

/** Decodes a message from the co-op server; undefined when it isn't one. */
export function parseServerMessage(text: string): ServerSignalingMessage | undefined {
  const json: unknown = JSON.parse(text);
  return isServerMessage(json) ? json : undefined;
}

/** Decodes a message from the other pilot's connector; undefined when it isn't one. */
export function parseCoopMessage(text: string): CoopMessage | undefined {
  const json: unknown = JSON.parse(text);
  if (!isFlightMessage(json)) return isOtherCoopMessage(json) ? json : undefined;

  // JSON turns a NaN or infinite value into null, so each value is read back the way writing it into the
  // aircraft reads it: null becomes 0 and a missing value NaN.
  const values = new Map<string, unknown>(Object.entries(json.state));
  const state = buildFlightState((key) => Number(values.get(key)));
  return { type: "flight", time: json.time, state, input: json.input };
}

/** A flight message before its state is read. */
interface FlightMessage {
  type: "flight";
  time: number;
  state: object;
  input: boolean;
}

function isServerMessage(json: unknown): json is ServerSignalingMessage {
  if (typeof json !== "object" || json === null || !("type" in json)) return false;
  switch (json.type) {
    case "peers":
      return "peers" in json && Array.isArray(json.peers) && json.peers.every((peer) => isPeer(peer));
    case "peer-joined":
      return "peer" in json && isPeer(json.peer);
    case "peer-left":
      return "pilotId" in json && typeof json.pilotId === "string";
    case "signal":
      return "from" in json && typeof json.from === "string" && "signal" in json && isSignal(json.signal);
    default:
      return false;
  }
}

function isPeer(json: unknown): json is GroupPeer {
  return (
    typeof json === "object" &&
    json !== null &&
    "pilotId" in json &&
    typeof json.pilotId === "string" &&
    "name" in json &&
    typeof json.name === "string"
  );
}

function isSignal(json: unknown): json is Signal {
  if (typeof json !== "object" || json === null) return false;
  if ("sdp" in json) return typeof json.sdp === "string" && "type" in json && typeof json.type === "string";
  return "candidate" in json && typeof json.candidate === "string" && "mid" in json && typeof json.mid === "string";
}

function isFlightMessage(json: unknown): json is FlightMessage {
  return (
    typeof json === "object" &&
    json !== null &&
    "type" in json &&
    json.type === "flight" &&
    "time" in json &&
    typeof json.time === "number" &&
    "state" in json &&
    typeof json.state === "object" &&
    json.state !== null &&
    "input" in json &&
    typeof json.input === "boolean"
  );
}

/** Any co-op message other than a flight message. */
function isOtherCoopMessage(json: unknown): json is Exclude<CoopMessage, { type: "flight" }> {
  if (typeof json !== "object" || json === null || !("type" in json)) return false;
  switch (json.type) {
    case "control":
      return "flyer" in json && typeof json.flyer === "string" && "epoch" in json && typeof json.epoch === "number";
    case "dual-input":
      return true;
    default:
      return false;
  }
}
