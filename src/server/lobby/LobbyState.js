import { SETTINGS } from "../../game.js";

export class LobbyState {
  constructor({ id, hostId }) {
    this.id = id;
    this.hostId = hostId;
    this.phase = "lobby";
    this.round = 0;
    this.settings = {
      pickTimerEnabled: true,
      pickTimerSeconds: SETTINGS.actionSeconds
    };
    this.playerOrder = [hostId];
    this.activePair = [];
    this.pairCursor = 0;
    this.draft = null;
    this.actionTimer = null;
    this.deadlineAt = null;
    this.chat = [];
    this.players = new Map();
    this.lastResult = null;
    this.winnerId = null;
    this.effectWindow = null;
  }
}
