import nodeDataChannel, { type DataChannel, type DescriptionType, type PeerConnection } from "node-datachannel";
import type { ClientSignalingMessage, GroupPeer, ServerSignalingMessage } from "@fs-career/contracts";

const ICE_SERVERS = ["stun:stun.l.google.com:19302"];

export interface GroupHandlers {
  onPeerConnected(peer: GroupPeer, joinedBeforeUs: boolean): void;
  onPeerLeft(pilotId: string): void;
  onMessage(pilotId: string, message: unknown): void;
}

export interface GroupSession {
  /** `fast` sends unordered and never resends, for state that's replaced every frame anyway. */
  broadcast(message: unknown, options?: { fast?: boolean }): void;
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
  // Node's WebSocket (undici) accepts headers, unlike the browser's, so the upgrade request carries the
  // token. @types/node only declares the protocols form of this argument.
  const init = { headers: { authorization: `Bearer ${token}` } };
  const socket = new WebSocket(signalingUrl, init as unknown as ConstructorParameters<typeof WebSocket>[1]);
  const connections = new Map<string, PeerConnection>();
  const channels = new Map<string, DataChannel>();
  const fastChannels = new Map<string, DataChannel>();

  const send = (message: ClientSignalingMessage) => socket.send(JSON.stringify(message));

  const connect = (peer: GroupPeer, initiator: boolean) => {
    const connection = new nodeDataChannel.PeerConnection(self.pilotId, { iceServers: ICE_SERVERS });
    connections.set(peer.pilotId, connection);
    connection.onLocalDescription((sdp, type) => send({ type: "signal", to: peer.pilotId, signal: { sdp, type } }));
    connection.onLocalCandidate((candidate, mid) => send({ type: "signal", to: peer.pilotId, signal: { candidate, mid } }));

    const attach = (channel: DataChannel) => {
      (channel.getLabel() === "fast" ? fastChannels : channels).set(peer.pilotId, channel);
      channel.onMessage((message) => handlers.onMessage(peer.pilotId, JSON.parse(String(message))));
    };

    // The newcomer opens the channels to every existing member, so two peers never both send an offer.
    // "data" is reliable and ordered, so nothing sent is lost or reordered.
    if (initiator) {
      const channel = connection.createDataChannel("data");
      channel.onOpen(() => handlers.onPeerConnected(peer, true));
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
    channels.delete(pilotId);
    fastChannels.delete(pilotId);
    handlers.onPeerLeft(pilotId);
  };

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as ServerSignalingMessage;

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
      case "signal": {
        const connection = connections.get(message.from);
        if (!connection) break;
        if ("sdp" in message.signal) {
          connection.setRemoteDescription(message.signal.sdp, message.signal.type as DescriptionType);
        } else {
          connection.addRemoteCandidate(message.signal.candidate, message.signal.mid);
        }
        break;
      }
    }
  });

  socket.addEventListener("close", (event) => {
    // 4401: the session is gone. 4409: the same pilot joined from somewhere else.
    if (event.code === 4401 || event.code === 4409) console.warn(`Left the group: ${event.reason}`);
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  send({ type: "join", groupCode });

  return {
    broadcast(message, options) {
      const data = JSON.stringify(message);
      for (const channel of (options?.fast ? fastChannels : channels).values()) {
        if (channel.isOpen()) channel.sendMessage(data);
      }
    },
    leave() {
      for (const pilotId of [...connections.keys()]) disconnect(pilotId);
      socket.close();
      nodeDataChannel.cleanup();
    },
  };
}
