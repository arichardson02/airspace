import type {
  CockpitValue,
  CoopMessage,
  SimClock,
  GroupPeer,
  McduPress,
  ServerSignalingMessage,
  Signal,
} from "@fs-career/contracts";
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
  const controls = json.controls.slice(0, MAX_FLIGHT_CONTROLS).map((value) => Number(value));
  return { type: "flight", time: json.time, state, input: json.input, controls };
}

// Bounds on what a peer can make us hold, whatever it sends.
const MAX_FLIGHT_CONTROLS = 64;
const MAX_VALUES = 5_000;
const MAX_KEY_LENGTH = 100;
const MAX_TEXT_LENGTH = 200;

/** A flight message before its state and controls are read. */
interface FlightMessage {
  type: "flight";
  time: number;
  state: object;
  input: boolean;
  controls: unknown[];
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
    typeof json.input === "boolean" &&
    "controls" in json &&
    Array.isArray(json.controls)
  );
}

/** Any co-op message other than a flight message. */
function isOtherCoopMessage(json: unknown): json is Exclude<CoopMessage, { type: "flight" }> {
  if (!isObject(json) || !("type" in json)) return false;
  switch (json.type) {
    case "control":
      return "flyer" in json && typeof json.flyer === "string" && "epoch" in json && typeof json.epoch === "number";
    case "dual-input":
      return true;
    case "hello":
      return isHello(json);
    case "mcdu":
      return "press" in json && isPress(json.press);
    case "mcdu-history":
      return "presses" in json && isList(json.presses, isPress);
    case "heartbeat":
      return true;
    case "clock":
      return "clock" in json && isClock(json.clock);
    default:
      return isCockpitMessage(json) || isSpawnMessage(json);
  }
}

// A host's saved flight is a few hundred lines; a full state dump tens of kilobytes.
const MAX_FLT_LENGTH = 512_000;
const MAX_PATH_LENGTH = 260;

function isSpawnMessage(
  json: object & { type: unknown },
): json is Extract<CoopMessage, { type: "flight-request" | "flight-file" }> {
  if (json.type === "flight-request") return true;
  return (
    json.type === "flight-file" &&
    "flt" in json &&
    isText(json.flt, MAX_FLT_LENGTH) &&
    "aircraftPaths" in json &&
    Array.isArray(json.aircraftPaths) &&
    json.aircraftPaths.length <= 4 &&
    json.aircraftPaths.every((path) => isText(path, MAX_PATH_LENGTH))
  );
}

function isCockpitMessage(
  json: object & { type: unknown },
): json is Extract<CoopMessage, { type: "cockpit" | "cockpit-snapshot" | "cockpit-action" }> {
  switch (json.type) {
    case "cockpit":
      return "changes" in json && isList(json.changes, isCockpitValue);
    case "cockpit-snapshot":
      return "values" in json && isList(json.values, isCockpitValue);
    case "cockpit-action":
      return "key" in json && isText(json.key, MAX_KEY_LENGTH) && "data" in json && typeof json.data === "number";
    default:
      return false;
  }
}

function isObject(json: unknown): json is object {
  return typeof json === "object" && json !== null;
}

function isText(json: unknown, maxLength: number): json is string {
  return typeof json === "string" && json.length <= maxLength;
}

function isList<T>(json: unknown, isItem: (item: unknown) => item is T): json is T[] {
  return Array.isArray(json) && json.length <= MAX_VALUES && json.every((item) => isItem(item));
}

function isHello(json: unknown): json is Extract<CoopMessage, { type: "hello" }> {
  return (
    isObject(json) &&
    "protocol" in json &&
    typeof json.protocol === "number" &&
    "aircraft" in json &&
    isText(json.aircraft, MAX_TEXT_LENGTH) &&
    "profile" in json &&
    (json.profile === null || isText(json.profile, MAX_KEY_LENGTH)) &&
    "profileVersion" in json &&
    typeof json.profileVersion === "number" &&
    "loadedAt" in json &&
    typeof json.loadedAt === "number" &&
    "mcduPresses" in json &&
    typeof json.mcduPresses === "number" &&
    hasWhereabouts(json)
  );
}

/** The hello's aircraft title and position, both null at the sim's menus. */
function hasWhereabouts(
  json: unknown,
): json is { title: string | null; position: { latitude: number; longitude: number } | null } {
  return (
    isObject(json) &&
    "title" in json &&
    (json.title === null || isText(json.title, MAX_PATH_LENGTH)) &&
    "position" in json &&
    (json.position === null || isPosition(json.position))
  );
}

function isPosition(json: unknown): json is { latitude: number; longitude: number } {
  return (
    isObject(json) &&
    "latitude" in json &&
    typeof json.latitude === "number" &&
    "longitude" in json &&
    typeof json.longitude === "number"
  );
}

function isCockpitValue(json: unknown): json is CockpitValue {
  return (
    isObject(json) &&
    "key" in json &&
    isText(json.key, MAX_KEY_LENGTH) &&
    "value" in json &&
    typeof json.value === "number" &&
    "seq" in json &&
    typeof json.seq === "number"
  );
}

function isPress(json: unknown): json is McduPress {
  return (
    isObject(json) &&
    "side" in json &&
    (json.side === "left" || json.side === "right") &&
    "key" in json &&
    isText(json.key, MAX_KEY_LENGTH)
  );
}

const CLOCK_KEYS = ["year", "dayOfYear", "secondsOfDay"] as const satisfies readonly (keyof SimClock)[];

function isClock(json: unknown): json is SimClock {
  if (!isObject(json)) return false;
  const values = new Map<string, unknown>(Object.entries(json));
  return CLOCK_KEYS.every((key) => isNumber(values.get(key)));
}

function isNumber(json: unknown): json is number {
  return typeof json === "number";
}
