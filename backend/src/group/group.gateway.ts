import type { IncomingMessage } from "node:http";
import { Inject } from "@nestjs/common";
import { type OnGatewayConnection, type OnGatewayDisconnect, WebSocketGateway } from "@nestjs/websockets";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { ClientSignalingMessage, GroupPeer, ServerSignalingMessage, Signal } from "@fs-career/contracts";
import type { Auth } from "../auth/auth.js";

interface Socket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message", listener: (data: Buffer) => void): void;
}

interface Member {
  groupCode: string;
  peer: GroupPeer;
  socket: Socket;
}

/** Close code for a connection without a valid session (4000-4999 are free for apps). */
const UNAUTHORIZED = 4401;

/**
 * Introduces connectors in the same group and relays their WebRTC handshakes. Connectors sign in
 * with their Bearer token on the upgrade request, and their peer identity comes from that session.
 */
@WebSocketGateway({ path: "/api/group" })
export class GroupGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly groups = new Map<string, Map<string, Member>>();
  private readonly members = new Map<Socket, Member>();

  // Nest injects by the runtime class; naming it here keeps the import a value import, not type-only.
  constructor(@Inject(AuthService) private readonly authService: AuthService<Auth>) {}

  handleConnection(socket: Socket, request: IncomingMessage): void {
    const pendingPeer = this.authService.api
      .getSession({ headers: fromNodeHeaders(request.headers) })
      .then((session): GroupPeer | undefined =>
        session ? { pilotId: session.user.id, name: session.user.name } : undefined,
      )
      .catch(() => undefined);

    void closeIfSignedOut(socket, pendingPeer);

    // Listen right away so no message is missed; each one waits for the session check, and they
    // stay in order because they all wait on the same promise.
    socket.on("message", (data) => {
      void this.receive(socket, pendingPeer, data);
    });
  }

  handleDisconnect(socket: Socket): void {
    const member = this.members.get(socket);
    if (member) this.leave(member);
  }

  private async receive(socket: Socket, pendingPeer: Promise<GroupPeer | undefined>, data: Buffer): Promise<void> {
    const peer = await pendingPeer;
    if (!peer) return;
    try {
      this.handleMessage(socket, peer, parseClientMessage(data));
    } catch {
      socket.close(1003, "Invalid message");
    }
  }

  private handleMessage(socket: Socket, peer: GroupPeer, message: ClientSignalingMessage) {
    if (message.type === "join") {
      const group = this.groups.get(message.groupCode) ?? new Map<string, Member>();

      // The same pilot joining again (e.g. a restarted connector) replaces their old connection.
      const previous = group.get(peer.pilotId);
      if (previous) {
        this.leave(previous);
        previous.socket.close(4409, "Joined from another connection");
      }

      // The newcomer gets the current members and starts the connection to each of them.
      send(socket, { type: "peers", peers: [...group.values()].map((member) => member.peer) });
      this.broadcast(message.groupCode, { type: "peer-joined", peer });

      const member = { groupCode: message.groupCode, peer, socket };
      group.set(peer.pilotId, member);
      // Set after leave() above, which removes the group when it empties it.
      this.groups.set(message.groupCode, group);
      this.members.set(socket, member);
      return;
    }

    const sender = this.members.get(socket);
    const target = sender && this.groups.get(sender.groupCode)?.get(message.to);
    if (target) send(target.socket, { type: "signal", from: sender.peer.pilotId, signal: message.signal });
  }

  private leave(member: Member) {
    this.members.delete(member.socket);
    const group = this.groups.get(member.groupCode);
    if (!group || group.get(member.peer.pilotId) !== member) return;

    group.delete(member.peer.pilotId);
    if (group.size === 0) this.groups.delete(member.groupCode);

    this.broadcast(member.groupCode, { type: "peer-left", pilotId: member.peer.pilotId });
  }

  private broadcast(groupCode: string, message: ServerSignalingMessage) {
    for (const member of this.groups.get(groupCode)?.values() ?? []) send(member.socket, message);
  }
}

function send(socket: Socket, message: ServerSignalingMessage) {
  socket.send(JSON.stringify(message));
}

async function closeIfSignedOut(socket: Socket, pendingPeer: Promise<GroupPeer | undefined>): Promise<void> {
  if (!(await pendingPeer)) socket.close(UNAUTHORIZED, "Sign in required");
}

/** Any connector can send anything, so a message is checked before the gateway acts on or relays it. */
function parseClientMessage(data: Buffer): ClientSignalingMessage {
  const message: unknown = JSON.parse(data.toString());
  if (!isClientSignalingMessage(message)) throw new Error("Invalid signaling message");
  return message;
}

function isClientSignalingMessage(value: unknown): value is ClientSignalingMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  if (value.type === "join") return "groupCode" in value && typeof value.groupCode === "string";
  return (
    value.type === "signal" &&
    "to" in value &&
    typeof value.to === "string" &&
    "signal" in value &&
    isSignal(value.signal)
  );
}

function isSignal(value: unknown): value is Signal {
  if (typeof value !== "object" || value === null) return false;
  if ("sdp" in value) return typeof value.sdp === "string" && "type" in value && typeof value.type === "string";
  return "candidate" in value && typeof value.candidate === "string" && "mid" in value && typeof value.mid === "string";
}
