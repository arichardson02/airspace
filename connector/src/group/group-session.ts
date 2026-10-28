import nodeDataChannel, { type DataChannel, type DescriptionType, type PeerConnection } from "node-datachannel";
import type { ClientSignalingMessage, GroupPeer, ServerSignalingMessage } from "@fs-career/contracts";

const ICE_SERVERS = ["stun:stun.l.google.com:19302"];

export interface GroupHandlers {
  onPeerConnected(pilotId: string, joinedBeforeUs: boolean): void;
  onPeerLeft(pilotId: string): void;
  onMessage(pilotId: string, message: unknown): void;
}

export interface GroupSession {
  /** `fast` sends unordered and never resends, for state that's replaced every frame anyway. */
  broadcast(message: unknown, options?: { fast?: boolean }): void;
  leave(): void;
}

/** Joins a group through the signaling server, then exchanges JSON messages directly with every peer over WebRTC. */
export async function joinGroup(
  signalingUrl: string,
  groupCode: string,
  self: GroupPeer,
  handlers: GroupHandlers,
): Promise<GroupSession> {
  const socket = new WebSocket(signalingUrl);
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
      channel.onOpen(() => handlers.onPeerConnected(peer.pilotId, true));
      attach(channel);
      attach(connection.createDataChannel("fast", { unordered: true, maxRetransmits: 0 }));
    } else {
      connection.onDataChannel((channel) => {
        attach(channel);
        if (channel.getLabel() === "data") handlers.onPeerConnected(peer.pilotId, false);
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

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  send({ type: "join", groupCode, peer: self });

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
