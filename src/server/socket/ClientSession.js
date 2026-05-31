export class ClientSession {
  constructor(socket, fallbackName, makeId) {
    this.id = makeId("p", 8);
    this.name = fallbackName;
    this.lobbyId = null;
    this.socket = socket;
  }
}
