export class LobbyManager {
  constructor({ clients, lobbies, io, clientsBySocketId, sendState }) {
    this.clients = clients;
    this.lobbies = lobbies;
    this.io = io;
    this.clientsBySocketId = clientsBySocketId;
    this.sendState = sendState;
  }

  attachClient(client, lobbyId) {
    client.lobbyId = lobbyId;
    client.socket.join(lobbyId);
  }

  detachClient(client, lobbyId) {
    client.socket.leave(lobbyId);
    client.lobbyId = null;
  }

  getClientLobby(client) {
    return client.lobbyId ? this.lobbies.get(client.lobbyId) : null;
  }

  broadcastLobby(lobby) {
    const room = this.io.sockets.adapter.rooms.get(lobby.id);
    for (const socketId of room ?? []) {
      const client = this.clientsBySocketId.get(socketId);
      if (client) {
        this.sendState(client);
      }
    }
    this.broadcastLobbyList();
  }

  broadcastLobbyList() {
    for (const client of this.clients.values()) {
      if (!client.lobbyId) {
        this.sendState(client);
      }
    }
  }
}
