import {
  DataRequestFlag,
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod,
  type RecvSimObjectData,
  type SimConnectConnection,
} from "node-simconnect";
import type { McduPress, McduSide } from "@fs-career/contracts";
import { DEFINITION, REQUEST } from "../../sim-ids.js";
import type { FmsLink, FmsSync, McduLinkState } from "../profile.js";

// The MCDUs stay in sync by pressing every key on both sides. A key press is seen through the button's push
// animation (each key sets L:A32NX_MCDU_PUSH_ANIM_<side>_<key> to 1 before firing its H:event, then it decays), and
// replayed through FlyByWire SimBridge, which presses MCDU keys in the sim for us (SimConnect can't fire H:events).

// The keys as the cockpit names them (ModelBehaviorDefs/A32NX/generated/A32NX_Interior_MCDU.xml); the lights that
// share the panel (FAIL, FMGC, IND...) aren't keys.
const KEYS = [
  ...["L", "R"].flatMap((column) => [1, 2, 3, 4, 5, 6].map((row) => `${column}${row}`)),
  "DIR",
  "PROG",
  "PERF",
  "INIT",
  "DATA",
  "FPLN",
  "RAD",
  "FUEL",
  "SEC",
  "ATC",
  "MENU",
  "AIRPORT",
  "DARROW",
  "UARROW",
  "LARROW",
  "RARROW",
  ..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "DOT",
  "PLUSMINUS",
  "SP",
  "SLASH",
  "OVFY",
  "CLR",
];
// Five keys' events are named differently from their animations.
const EVENT_NAMES = new Map([
  ["UARROW", "UP"],
  ["DARROW", "DOWN"],
  ["LARROW", "PREVPAGE"],
  ["RARROW", "NEXTPAGE"],
  ["SLASH", "DIV"],
]);
const KEYS_BY_EVENT = new Map([...EVENT_NAMES].map(([key, name]) => [name, key]));
const SIDES = ["left", "right"] as const satisfies readonly McduSide[];
const DATUMS = SIDES.flatMap((side, i) =>
  KEYS.map((key) => ({ side, key, name: `L:A32NX_MCDU_PUSH_ANIM_${i + 1}_${key}` })),
);

const SIMBRIDGE_URL = "ws://127.0.0.1:8380/interfaces/v1/mcdu";
const RETRY_MS = 5_000;
// SimBridge answers requestUpdate with the screen once the in-sim MCDU is linked to it.
const LINK_TIMEOUT_MS = 3_000;
// A push animation jumps to 1 on a press and decays; a rise this large is a new press.
const PRESS_RISE = 0.05;
// A press we replayed comes back as an animation (and SimBridge echoes our own message) within this long.
const ECHO_MS = 1_000;

const id = (press: McduPress) => `${press.side}:${press.key}`;

export const mcdu: FmsSync = {
  start(handle: SimConnectConnection, handlers): FmsLink {
    const history: McduPress[] = [];
    const echoes = new Map<string, number[]>();
    const sent: { message: string; at: number }[] = [];
    let state: McduLinkState = "simbridge-missing";
    let socket: WebSocket | undefined;
    let stopped = false;
    let linkTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const setState = (next: McduLinkState) => {
      if (next === state) return;
      state = next;
      handlers.onState();
    };
    const expectEcho = (press: McduPress) => {
      const pending = (echoes.get(id(press)) ?? []).filter((until) => until > Date.now());
      echoes.set(id(press), [...pending, Date.now() + ECHO_MS]);
    };
    const isEcho = (press: McduPress) => {
      const pending = (echoes.get(id(press)) ?? []).filter((until) => until > Date.now());
      const echo = pending.length > 0;
      echoes.set(id(press), pending.slice(1));
      return echo;
    };
    const pressed = (press: McduPress) => {
      history.push(press);
      handlers.onPress(press);
    };

    // Push animations, both sides, every frame so quick presses aren't missed.
    DATUMS.forEach((datum, i) => {
      handle.addToDataDefinition(DEFINITION.mcdu, datum.name, "number", SimConnectDataType.FLOAT64, 0, i);
    });
    const last = DATUMS.map(() => 0);
    // Removed on stop: listeners share each sample's buffer, so a second one left behind would read past its end.
    const onData = (sample: RecvSimObjectData) => {
      if (sample.requestID !== REQUEST.mcdu) return;
      const rises: McduPress[] = [];
      for (let i = 0; i < sample.defineCount; i++) {
        const index = Math.max(0, sample.data.readInt32());
        const value = sample.data.readFloat64();
        const datum = DATUMS.at(index);
        const before = last.at(index);
        if (datum === undefined || before === undefined) continue;
        last[index] = value;
        if (value - before > PRESS_RISE) rises.push({ side: datum.side, key: datum.key });
      }
      for (const press of rises) {
        // Typing on the keyboard animates the key on both MCDUs: one press, sent as the left MCDU's.
        const both = press.side === "right" && rises.some((other) => other.side === "left" && other.key === press.key);
        if (both || isEcho(press)) continue;
        pressed(press);
      }
    };
    handle.on("simObjectData", onData);
    handle.requestDataOnSimObject(
      REQUEST.mcdu,
      DEFINITION.mcdu,
      SimConnectConstants.OBJECT_ID_USER,
      SimConnectPeriod.SIM_FRAME,
      DataRequestFlag.DATA_REQUEST_FLAG_CHANGED | DataRequestFlag.DATA_REQUEST_FLAG_TAGGED,
    );

    const send = (message: string) => {
      if (socket?.readyState !== WebSocket.OPEN) return;
      socket.send(message);
      sent.push({ message, at: Date.now() });
    };
    const ownMessage = (message: string) => {
      const now = Date.now();
      const index = sent.findIndex((entry) => entry.message === message && now - entry.at < ECHO_MS);
      while (sent.length > 0 && now - (sent[0]?.at ?? now) >= ECHO_MS) sent.shift();
      if (index < 0) return false;
      sent.splice(index, 1);
      return true;
    };
    // An `event:` we didn't send is a press on a browser or tablet MCDU (SimBridge's remote MCDU). The in-sim key
    // animates too when SimBridge presses it, so that animation is an echo of the same press.
    const onSocketMessage = (message: string) => {
      if (message.startsWith("update:")) {
        clearTimeout(linkTimer);
        setState("linked");
        return;
      }
      if (!message.startsWith("event:") || ownMessage(message)) return;
      const press = parseEvent(message);
      if (!press) return;
      expectEcho(press);
      pressed(press);
    };

    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(SIMBRIDGE_URL);
      socket = ws;
      ws.addEventListener("open", () => {
        setState("not-linked");
        ws.send("requestUpdate");
        linkTimer = setTimeout(() => {
          setState("not-linked");
        }, LINK_TIMEOUT_MS);
      });
      ws.addEventListener("message", (event) => {
        onSocketMessage(String(event.data));
      });
      ws.addEventListener("close", () => {
        clearTimeout(linkTimer);
        if (socket === ws) socket = undefined;
        setState("simbridge-missing");
        if (!stopped) retryTimer = setTimeout(connect, RETRY_MS);
      });
    };
    connect();

    return {
      replay(press) {
        const key = EVENT_NAMES.get(press.key) ?? press.key;
        history.push(press);
        expectEcho(press);
        send(`event:${press.side}:${key}`);
      },
      history: () => history,
      state: () => state,
      stop() {
        stopped = true;
        clearTimeout(linkTimer);
        clearTimeout(retryTimer);
        socket?.close();
        handle.off("simObjectData", onData);
        handle.requestDataOnSimObject(
          REQUEST.mcdu,
          DEFINITION.mcdu,
          SimConnectConstants.OBJECT_ID_USER,
          SimConnectPeriod.NEVER,
        );
        handle.clearDataDefinition(DEFINITION.mcdu);
      },
    };
  },
};

/** `event:left:INIT`, or the older `event:INIT` (the left MCDU), as a press. */
function parseEvent(message: string): McduPress | undefined {
  const parts = message.split(":");
  const side = parts.length === 3 ? parts[1] : "left";
  const name = parts.at(-1) ?? "";
  const key = KEYS_BY_EVENT.get(name) ?? name;
  if ((side !== "left" && side !== "right") || !KEYS.includes(key)) return undefined;
  return { side, key };
}
