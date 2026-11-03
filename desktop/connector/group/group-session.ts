import { cleanup, PeerConnection, type DataChannel, type DescriptionType } from "node-datachannel";
import type { ClientSignalingMessage, CoopMessage, GroupPeer, Signal } from "@fs-career/contracts";
import { parseCoopMessage, parseServerMessage } from "./messages.js";

const ICE_SERVERS = ["stun:stun.l.google.com:19302"];
// Every peer sends a heartbeat this often on the reliable channel, so a dead link shows up even when nothing else is
// being sent (the follower sends nothing else while the cockpits are still).
const HEARTBEAT_MS = 1_000;
// A peer heard from within this long counts as connected; past it, the link is treated as lost. Only peers that send
// heartbeats are timed out, so an older connector that sends none isn't dropped.
const PEER_TIMEOUT_MS = 5_000;
// The waits before reconnecting to the server after it drops, the last repeating until it's back.
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000];

export interface GroupHandlers {
  onPeerConnected(peer: GroupPeer, joinedBeforeUs: boolean): void;
  /** A peer left the group, or (`lost`) stopped answering; either may connect again later. */
  onPeerLeft(pilotId: string, lost: boolean): void;
  onMessage(pilotId: string, message: CoopMessage): void;
  /** The signaling server ended our session: it's gone, or the pilot joined from somewhere else. */
  onClosed(reason: string): void;
}

export interface GroupSession {
  /** `fast` sends unordered and never resends, for state that's replaced every frame anyway. */
  broadcast(message: CoopMessage, options?: { fast?: boolean }): void;
  leave(): void;
}

interface PeerLink {
  connection: PeerConnection;
  data?: DataChannel;
  fast?: DataChannel;
  /** Whether the reliable channel opened and the peer was reported connected. */
  connected: boolean;
  heardAt: number;
  /** Whether the peer sends heartbeats, so silence from it means the link is gone. */
  beating: boolean;
  /** A peer's candidates can arrive before its description, which libdatachannel rejects, so they wait for it. */
  waitingCandidates?: { candidate: string; mid: string }[];
}

/**
 * Joins a group through the signaling server, then exchanges JSON messages directly with every peer over WebRTC.
 * The server knows who we are from the session token, and tells every peer. Once peers are connected the server is
 * only needed to connect again: if it drops, the session reconnects to it in the background and keeps its peers.
 */
export async function joinGroup(
  signalingUrl: string,
  groupCode: string,
  token: string,
  self: GroupPeer,
  handlers: GroupHandlers,
): Promise<GroupSession> {
  const links = new Map<string, PeerLink>();
  let socket: WebSocket | undefined;
  let opened = false;
  let leaving = false;
  let reconnects = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const send = (message: ClientSignalingMessage) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  // A peer still answering keeps its link when the server announces it again or reports it gone: that only means
  // one side's connection to the server dropped.
  const isLive = (pilotId: string): boolean => {
    const link = links.get(pilotId);
    return link?.data?.isOpen() === true && (!link.beating || Date.now() - link.heardAt < PEER_TIMEOUT_MS);
  };

  const remove = (pilotId: string, report?: { lost: boolean }) => {
    const link = links.get(pilotId);
    if (!link) return;
    links.delete(pilotId);
    link.connection.close();
    if (report && link.connected) handlers.onPeerLeft(pilotId, report.lost);
  };

  const connect = (peer: GroupPeer, initiator: boolean) => {
    if (isLive(peer.pilotId)) return;
    remove(peer.pilotId, { lost: true });
    const connection = new PeerConnection(self.pilotId, { iceServers: ICE_SERVERS });
    const link: PeerLink = { connection, connected: false, heardAt: Date.now(), beating: false, waitingCandidates: [] };
    links.set(peer.pilotId, link);
    connection.onLocalDescription((sdp, type) => {
      send({ type: "signal", to: peer.pilotId, signal: { sdp, type } });
    });
    connection.onLocalCandidate((candidate, mid) => {
      send({ type: "signal", to: peer.pilotId, signal: { candidate, mid } });
    });

    const onOpen = () => {
      link.connected = true;
      link.heardAt = Date.now();
      handlers.onPeerConnected(peer, initiator);
    };
    const attach = (channel: DataChannel) => {
      if (channel.getLabel() === "fast") link.fast = channel;
      else link.data = channel;
      channel.onMessage((data) => {
        link.heardAt = Date.now();
        const message = parseCoopMessage(isText(data) ? data : new TextDecoder().decode(data));
        if (message?.type === "heartbeat") link.beating = true;
        else if (message !== undefined) handlers.onMessage(peer.pilotId, message);
      });
      // The peer closing its end: it left. A link replaced by a newer one closes too, and is already forgotten.
      channel.onClosed(() => {
        if (links.get(peer.pilotId) === link) remove(peer.pilotId, { lost: false });
      });
    };

    // The newcomer opens the channels to every existing member, so two peers never both send an offer.
    // "data" is reliable and ordered, so nothing sent is lost or reordered.
    if (initiator) {
      const channel = connection.createDataChannel("data");
      channel.onOpen(onOpen);
      attach(channel);
      attach(connection.createDataChannel("fast", { unordered: true, maxRetransmits: 0 }));
    } else {
      connection.onDataChannel((channel) => {
        attach(channel);
        if (channel.getLabel() === "data") onOpen();
      });
    }
  };

  const receiveSignal = (from: string, signal: Signal) => {
    const link = links.get(from);
    if (!link) return;
    if ("sdp" in signal) {
      if (!isDescriptionType(signal.type)) return;
      link.connection.setRemoteDescription(signal.sdp, signal.type);
      const waiting = link.waitingCandidates ?? [];
      link.waitingCandidates = undefined;
      for (const { candidate, mid } of waiting) addCandidate(link.connection, candidate, mid);
      return;
    }
    if (link.waitingCandidates) link.waitingCandidates.push(signal);
    else addCandidate(link.connection, signal.candidate, signal.mid);
  };

  const receiveServer = (text: string) => {
    const message = parseServerMessage(text);
    if (message === undefined) return;
    switch (message.type) {
      case "peers":
        for (const peer of message.peers) connect(peer, true);
        break;
      case "peer-joined":
        connect(message.peer, false);
        break;
      case "peer-left":
        if (!isLive(message.pilotId)) remove(message.pilotId, { lost: false });
        break;
      case "signal":
        receiveSignal(message.from, message.signal);
        break;
    }
  };

  const beat = JSON.stringify({ type: "heartbeat" } satisfies CoopMessage);
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [pilotId, link] of links) {
      if (link.data?.isOpen() === true) link.data.sendMessage(beat);
      if (link.connected && link.beating && now - link.heardAt > PEER_TIMEOUT_MS) remove(pilotId, { lost: true });
    }
  }, HEARTBEAT_MS);

  const stop = () => {
    clearInterval(heartbeat);
    clearTimeout(reconnectTimer);
  };

  const reconnect = () => {
    const delay = RECONNECT_DELAYS_MS.at(Math.min(reconnects, RECONNECT_DELAYS_MS.length - 1)) ?? 0;
    reconnects++;
    if (reconnects === 1) console.warn("Lost the connection to the co-op server; reconnecting");
    reconnectTimer = setTimeout(() => {
      // A failed attempt closes too, which schedules the next one.
      openSocket().catch(() => undefined);
    }, delay);
  };

  const onSocketClosed = (closed: WebSocket, event: CloseEvent) => {
    if (leaving || closed !== socket || !opened) return;
    // 4401: the session is gone. 4409: the same pilot joined from somewhere else.
    if (event.code !== 4401 && event.code !== 4409) {
      reconnect();
      return;
    }
    console.warn(`Left the group: ${event.reason}`);
    stop();
    for (const pilotId of links.keys()) remove(pilotId, { lost: true });
    handlers.onClosed(event.reason);
  };

  const openSocket = (): Promise<void> =>
    new Promise((resolve, reject) => {
      // Node's WebSocket (undici) takes headers, unlike the browser's, so the upgrade request carries the token.
      const next = new WebSocket(signalingUrl, { headers: { authorization: `Bearer ${token}` } });
      socket = next;
      next.addEventListener(
        "open",
        () => {
          if (opened && reconnects > 0) console.log("Reconnected to the co-op server");
          opened = true;
          reconnects = 0;
          send({ type: "join", groupCode });
          resolve();
        },
        { once: true },
      );
      next.addEventListener(
        "error",
        () => {
          reject(new Error("Couldn't reach the co-op server"));
        },
        { once: true },
      );
      next.addEventListener("message", (event) => {
        receiveServer(String(event.data));
      });
      next.addEventListener("close", (event) => {
        onSocketClosed(next, event);
      });
    });

  try {
    await openSocket();
  } catch (error) {
    stop();
    throw error;
  }

  return {
    broadcast(message, options) {
      const data = JSON.stringify(message);
      for (const link of links.values()) {
        const channel = options?.fast === true ? link.fast : link.data;
        if (channel?.isOpen() === true) channel.sendMessage(data);
      }
    },
    leave() {
      leaving = true;
      stop();
      for (const pilotId of links.keys()) remove(pilotId);
      socket?.close();
      cleanup();
    },
  };
}

/** Adds a peer's candidate. libdatachannel throws on one it can't use; that candidate is skipped, not fatal. */
function addCandidate(connection: PeerConnection, candidate: string, mid: string): void {
  try {
    connection.addRemoteCandidate(candidate, mid);
  } catch (error) {
    console.warn(`Skipped a co-op connection candidate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Peers only send JSON text; binary messages arrive as a Buffer or ArrayBuffer.
function isText(data: string | Buffer | ArrayBuffer): data is string {
  return typeof data === "string";
}

function isDescriptionType(type: string): type is DescriptionType {
  switch (type) {
    case "unspec":
    case "offer":
    case "answer":
    case "pranswer":
    case "rollback":
      return true;
    default:
      return false;
  }
}
