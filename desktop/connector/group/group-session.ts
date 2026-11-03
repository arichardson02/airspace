import { cleanup, PeerConnection, type DataChannel, type DescriptionType } from "node-datachannel";
import type { ClientSignalingMessage, CoopMessage, GroupPeer, Signal } from "@fs-career/contracts";
import { parseCoopMessage, parseServerMessage } from "./messages.js";

const ICE_SERVERS = ["stun:stun.l.google.com:19302"];

export interface GroupHandlers {
  onPeerConnected(peer: GroupPeer, joinedBeforeUs: boolean): void;
  onPeerLeft(pilotId: string): void;
  onMessage(pilotId: string, message: CoopMessage): void;
  /** The signaling server dropped us, e.g. because the session ended or the pilot joined elsewhere. */
  onClosed(reason: string): void;
}

export interface GroupSession {
  /** `fast` sends unordered and never resends, for state that's replaced every frame anyway. */
  broadcast(message: CoopMessage, options?: { fast?: boolean }): void;
  leave(): void;
}

/**
 * Joins a group through the signaling server, then exchanges JSON messages directly with every peer over WebRTC.
 * The server knows who we are from the session token, and tells every peer.
 */
export async function joinGroup(
  signalingUrl: string,
  groupCode: string,
  token: string,
  self: GroupPeer,
  handlers: GroupHandlers,
): Promise<GroupSession> {
  // Node's WebSocket (undici) takes headers, unlike the browser's, so the upgrade request carries the token.
  const socket = new WebSocket(signalingUrl, { headers: { authorization: `Bearer ${token}` } });
  const connections = new Map<string, PeerConnection>();
  const channels = new Map<string, DataChannel>();
  const fastChannels = new Map<string, DataChannel>();
  // A peer's candidates can arrive before its description, which libdatachannel rejects, so they wait for it.
  const waitingCandidates = new Map<string, { candidate: string; mid: string }[]>();

  const send = (message: ClientSignalingMessage) => {
    socket.send(JSON.stringify(message));
  };

  const connect = (peer: GroupPeer, initiator: boolean) => {
    const connection = new PeerConnection(self.pilotId, { iceServers: ICE_SERVERS });
    connections.set(peer.pilotId, connection);
    waitingCandidates.set(peer.pilotId, []);
    connection.onLocalDescription((sdp, type) => {
      send({ type: "signal", to: peer.pilotId, signal: { sdp, type } });
    });
    connection.onLocalCandidate((candidate, mid) => {
      send({ type: "signal", to: peer.pilotId, signal: { candidate, mid } });
    });

    const attach = (channel: DataChannel) => {
      (channel.getLabel() === "fast" ? fastChannels : channels).set(peer.pilotId, channel);
      channel.onMessage((data) => {
        const message = parseCoopMessage(isText(data) ? data : new TextDecoder().decode(data));
        if (message !== undefined) handlers.onMessage(peer.pilotId, message);
      });
    };

    // The newcomer opens the channels to every existing member, so two peers never both send an offer.
    // "data" is reliable and ordered, so nothing sent is lost or reordered.
    if (initiator) {
      const channel = connection.createDataChannel("data");
      channel.onOpen(() => {
        handlers.onPeerConnected(peer, true);
      });
      attach(channel);
      attach(connection.createDataChannel("fast", { unordered: true, maxRetransmits: 0 }));
    } else {
      connection.onDataChannel((channel) => {
        attach(channel);
        if (channel.getLabel() === "data") handlers.onPeerConnected(peer, false);
      });
    }
  };

  const disconnect = (pilotId: string) => {
    connections.get(pilotId)?.close();
    connections.delete(pilotId);
    waitingCandidates.delete(pilotId);
    channels.delete(pilotId);
    fastChannels.delete(pilotId);
    handlers.onPeerLeft(pilotId);
  };

  const receiveSignal = (from: string, signal: Signal) => {
    const connection = connections.get(from);
    if (!connection) return;
    if ("sdp" in signal) {
      if (!isDescriptionType(signal.type)) return;
      connection.setRemoteDescription(signal.sdp, signal.type);
      const waiting = waitingCandidates.get(from) ?? [];
      waitingCandidates.delete(from);
      for (const { candidate, mid } of waiting) addCandidate(connection, candidate, mid);
      return;
    }
    const waiting = waitingCandidates.get(from);
    if (waiting) waiting.push(signal);
    else addCandidate(connection, signal.candidate, signal.mid);
  };

  socket.addEventListener("message", (event) => {
    const message = parseServerMessage(String(event.data));
    if (message === undefined) return;

    switch (message.type) {
      case "peers":
        for (const peer of message.peers) connect(peer, true);
        break;
      case "peer-joined":
        connect(message.peer, false);
        break;
      case "peer-left":
        disconnect(message.pilotId);
        break;
      case "signal":
        receiveSignal(message.from, message.signal);
        break;
    }
  });

  let leaving = false;
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener(
      "error",
      () => {
        reject(new Error("Couldn't reach the co-op server"));
      },
      { once: true },
    );
  });

  socket.addEventListener("close", (event) => {
    if (leaving) return;
    // 4401: the session is gone. 4409: the same pilot joined from somewhere else.
    const reason =
      event.code === 4401 || event.code === 4409 ? event.reason : "Lost the connection to the co-op server";
    console.warn(`Left the group: ${reason}`);
    for (const pilotId of connections.keys()) disconnect(pilotId);
    handlers.onClosed(reason);
  });

  await opened;
  send({ type: "join", groupCode });

  return {
    broadcast(message, options) {
      const data = JSON.stringify(message);
      for (const channel of (options?.fast === true ? fastChannels : channels).values()) {
        if (channel.isOpen()) channel.sendMessage(data);
      }
    },
    leave() {
      leaving = true;
      for (const pilotId of connections.keys()) disconnect(pilotId);
      socket.close();
      cleanup();
    },
  };
}

// Peers only send JSON text; binary messages arrive as a Buffer or ArrayBuffer.
/** Adds a peer's candidate. libdatachannel throws on one it can't use; that candidate is skipped, not fatal. */
function addCandidate(connection: PeerConnection, candidate: string, mid: string): void {
  try {
    connection.addRemoteCandidate(candidate, mid);
  } catch (error) {
    console.warn(`Skipped a co-op connection candidate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

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
