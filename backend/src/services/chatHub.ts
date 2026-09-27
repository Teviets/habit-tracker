import WebSocket from 'ws';

class ChatHub {
  private readonly rooms = new Map<string, Set<WebSocket>>();

  join(conversationId: string, socket: WebSocket) {
    const room = this.rooms.get(conversationId) ?? new Set<WebSocket>();
    room.add(socket);
    this.rooms.set(conversationId, room);
  }

  leave(conversationId: string, socket: WebSocket) {
    const room = this.rooms.get(conversationId);
    room?.delete(socket);
    if (room?.size === 0) this.rooms.delete(conversationId);
  }

  broadcast(conversationId: string, payload: unknown) {
    const encoded = JSON.stringify(payload);
    for (const socket of this.rooms.get(conversationId) ?? []) {
      if (socket.readyState === WebSocket.OPEN) socket.send(encoded);
    }
  }
}

export const chatHub = new ChatHub();
