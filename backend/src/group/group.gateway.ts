import { type OnGatewayConnection, type OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { ClientSignalingMessage, GroupPeer, ServerSignalingMessage } from '@fs-career/contracts';

interface Socket {
  send(data: string): void;
  on(event: 'message', listener: (data: Buffer) => void): void;
}

interface Member {
  groupCode: string;
  peer: GroupPeer;
  socket: Socket;
}

/** Introduces connectors in the same group and relays their WebRTC handshakes. */
@WebSocketGateway({ path: '/group' })
export class GroupGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly groups = new Map<string, Map<string, Member>>();
  private readonly members = new Map<Socket, Member>();

  handleConnection(socket: Socket) {
    socket.on('message', (data) => {
      this.handleMessage(socket, JSON.parse(data.toString()) as ClientSignalingMessage);
    });
  }

  handleDisconnect(socket: Socket) {
    const member = this.members.get(socket);
    if (!member) return;

    this.members.delete(socket);
    const group = this.groups.get(member.groupCode)!;
    group.delete(member.peer.pilotId);
    if (group.size === 0) this.groups.delete(member.groupCode);

    this.broadcast(member.groupCode, { type: 'peer-left', pilotId: member.peer.pilotId });
  }

  private handleMessage(socket: Socket, message: ClientSignalingMessage) {
    if (message.type === 'join') {
      const group = this.groups.get(message.groupCode) ?? new Map<string, Member>();
      this.groups.set(message.groupCode, group);

      // The newcomer gets the current members and starts the connection to each of them.
      send(socket, { type: 'peers', peers: [...group.values()].map((member) => member.peer) });
      this.broadcast(message.groupCode, { type: 'peer-joined', peer: message.peer });

      const member = { groupCode: message.groupCode, peer: message.peer, socket };
      group.set(message.peer.pilotId, member);
      this.members.set(socket, member);
      return;
    }

    const sender = this.members.get(socket);
    const target = sender && this.groups.get(sender.groupCode)?.get(message.to);
    if (target) send(target.socket, { type: 'signal', from: sender.peer.pilotId, signal: message.signal });
  }

  private broadcast(groupCode: string, message: ServerSignalingMessage) {
    for (const member of this.groups.get(groupCode)?.values() ?? []) send(member.socket, message);
  }
}

function send(socket: Socket, message: ServerSignalingMessage) {
  socket.send(JSON.stringify(message));
}
