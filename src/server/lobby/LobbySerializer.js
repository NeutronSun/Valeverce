import { GAME_PHASES } from "../../game/core/GamePhase.js";
import { SERVER_EVENTS } from "../../shared/events.js";

/** @typedef {import("./LobbySerializer").ClientState} ClientState */
/** @typedef {import("./LobbySerializer").LobbySerializerOptions} LobbySerializerOptions */
/** @typedef {import("./LobbySerializer").PlayerState} PlayerState */
/** @typedef {import("./LobbySerializer").SerializedLobbyPayload} SerializedLobbyPayload */
/** @typedef {import("./LobbySerializer").SerializedLobbyState} SerializedLobbyState */
/** @typedef {import("./LobbySerializer").SerializedStatePayload} SerializedStatePayload */

export class LobbySerializer {
  static CARD_REVEAL_PHASES = Object.freeze([GAME_PHASES.PLAN, GAME_PHASES.REVEAL, GAME_PHASES.ENDED]);
  static PLAN_REVEAL_PHASES = Object.freeze([GAME_PHASES.REVEAL, GAME_PHASES.ENDED]);

  /** @param {LobbySerializerOptions} options */
  constructor({
    SETTINGS,
    VALERIO_LABELS,
    clients,
    lobbies,
    cardsById,
    getClientLobby,
    getCurrentDrafterId,
    isActiveDuelist,
    hasSubmittedPlan,
    canPlayerDraftCard,
    getAttackPool,
    getDefensePool,
    getDraftCost
  }) {
    this.SETTINGS = SETTINGS;
    this.VALERIO_LABELS = VALERIO_LABELS;
    this.clients = clients;
    this.lobbies = lobbies;
    this.cardsById = cardsById;
    this.getClientLobby = getClientLobby;
    this.getCurrentDrafterId = getCurrentDrafterId;
    this.isActiveDuelist = isActiveDuelist;
    this.hasSubmittedPlan = hasSubmittedPlan;
    this.canPlayerDraftCard = canPlayerDraftCard;
    this.getAttackPool = getAttackPool;
    this.getDefensePool = getDefensePool;
    this.getDraftCost = getDraftCost;
  }

  /**
   * @param {ClientState} client
   * @returns {SerializedStatePayload}
   */
  serializeState(client) {
    const lobby = this.getClientLobby(client);
    return {
      type: SERVER_EVENTS.STATE,
      selfId: client.id,
      settings: this.SETTINGS,
      valerioLabels: this.VALERIO_LABELS,
      onlinePlayers: this.clients.size,
      lobbies: this.serializeLobbyList(),
      lobby: lobby ? this.serializeLobby(lobby, client.id) : null
    };
  }

  serializeLobbyList() {
    return [...this.lobbies.values()].map((lobby) => ({
      id: lobby.id,
      phase: lobby.phase,
      hostName: lobby.players.get(lobby.hostId)?.name ?? "Host",
      players: lobby.players.size,
      maxPlayers: this.SETTINGS.maxPlayers,
      isJoinable: lobby.phase === GAME_PHASES.LOBBY && lobby.players.size < this.SETTINGS.maxPlayers,
      round: lobby.round,
      names: [...lobby.players.values()].map((player) => player.name)
    }));
  }

  /**
   * @param {SerializedLobbyState} lobby
   * @param {string} selfId
   * @returns {SerializedLobbyPayload}
   */
  serializeLobby(lobby, selfId) {
    const self = lobby.players.get(selfId);
    const currentDrafterId = this.getCurrentDrafterId(lobby);

    return {
      id: lobby.id,
      hostId: lobby.hostId,
      phase: lobby.phase,
      round: lobby.round,
      activePair: lobby.activePair,
      deadlineAt: lobby.deadlineAt,
      draft: this.serializeDraft(lobby, currentDrafterId, selfId),
      chat: lobby.chat,
      lastResult: lobby.lastResult,
      winnerId: lobby.winnerId,
      players: [...lobby.players.values()].map((player) =>
        this.serializePlayer(lobby, player, selfId, currentDrafterId)
      ),
      self: self ? this.serializeSelf(lobby, self, currentDrafterId) : null
    };
  }

  /**
   * @param {SerializedLobbyState} lobby
   * @param {PlayerState} player
   * @param {string} viewerId
   * @param {string | null} currentDrafterId
   */
  serializePlayer(lobby, player, viewerId, currentDrafterId) {
    const selectedCard = this.shouldRevealSelectedCard(lobby, player, viewerId)
      ? this.cardsById.get(player.selected.cardId)
      : null;
    const showPlan = this.shouldRevealPlan(lobby, player, viewerId);

    return {
      id: player.id,
      name: player.name,
      health: player.health,
      maxHealth: this.SETTINGS.maxHealth,
      mana: player.mana,
      deck: player.deck.map((cardId) => this.cardsById.get(cardId)).filter(Boolean),
      deckCount: player.deck.length,
      draftCount: player.deck.length,
      draftSpent: player.draftSpent,
      draftBudget: this.SETTINGS.draftBudget,
      draftBudgetRemaining: Math.max(0, this.SETTINGS.draftBudget - player.draftSpent),
      cooldowns: player.cooldowns,
      alive: player.alive,
      isActive: this.isActiveDuelist(lobby, player.id),
      isCurrentDrafter: currentDrafterId === player.id,
      hasSelected: Boolean(player.selected?.cardId),
      hasSubmittedPlan: this.hasSubmittedPlan(player),
      selectedCard,
      selected: selectedCard
        ? {
            cardId: player.selected.cardId,
            attacks: showPlan ? player.selected.attacks : null,
            defenses: showPlan ? player.selected.defenses : null,
            useActive: showPlan ? player.selected.useActive : null,
            attackPool: this.getAttackPool(selectedCard),
            defensePool: this.getDefensePool(selectedCard)
          }
        : null,
      isHost: player.id === lobby.hostId
    };
  }

  /**
   * @param {SerializedLobbyState} lobby
   * @param {PlayerState} self
   * @param {string | null} currentDrafterId
   */
  serializeSelf(lobby, self, currentDrafterId) {
    const selectedCard = self.selected?.cardId ? this.cardsById.get(self.selected.cardId) : null;
    return {
      id: self.id,
      name: self.name,
      health: self.health,
      maxHealth: this.SETTINGS.maxHealth,
      mana: self.mana,
      deck: self.deck.map((cardId) => this.cardsById.get(cardId)).filter(Boolean),
      deckCount: self.deck.length,
      draftSpent: self.draftSpent,
      draftBudget: this.SETTINGS.draftBudget,
      draftBudgetRemaining: Math.max(0, this.SETTINGS.draftBudget - self.draftSpent),
      cooldowns: self.cooldowns,
      selected: self.selected
        ? {
            ...self.selected,
            selectedCard,
            attackPool: selectedCard ? this.getAttackPool(selectedCard) : 0,
            defensePool: selectedCard ? this.getDefensePool(selectedCard) : 0
          }
        : null,
      isActive: this.isActiveDuelist(lobby, self.id),
      isCurrentDrafter: currentDrafterId === self.id,
      alive: self.alive
    };
  }

  /**
   * @param {SerializedLobbyState} lobby
   * @param {string | null} currentDrafterId
   * @param {string} selfId
   */
  serializeDraft(lobby, currentDrafterId, selfId) {
    if (!lobby.draft) {
      return null;
    }

    const self = lobby.players.get(selfId);
    return {
      target: lobby.draft.target,
      budget: this.SETTINGS.draftBudget,
      currentPlayerId: currentDrafterId,
      taken: lobby.draft.taken,
      pool: lobby.draft.pool.map((cardId) => {
        const card = this.cardsById.get(cardId);
        const takenBy = [...lobby.players.values()].find((player) => player.deck.includes(cardId));
        const cost = this.getDraftCost(card);
        const canPick = Boolean(
          !takenBy && self && currentDrafterId === selfId && this.canPlayerDraftCard(lobby, self, card).ok
        );
        return {
          card,
          cost,
          attackPool: this.getAttackPool(card),
          defensePool: this.getDefensePool(card),
          takenBy: takenBy?.id ?? null,
          takenByName: takenBy?.name ?? null,
          isAvailable: !takenBy,
          canPick,
          canAfford: Boolean(self && self.draftSpent + cost <= this.SETTINGS.draftBudget)
        };
      })
    };
  }

  /**
   * @param {SerializedLobbyState} lobby
   * @param {PlayerState} player
   * @param {string} viewerId
   */
  shouldRevealSelectedCard(lobby, player, viewerId) {
    if (!player.selected?.cardId) {
      return false;
    }

    return player.id === viewerId || LobbySerializer.CARD_REVEAL_PHASES.includes(lobby.phase);
  }

  /**
   * @param {SerializedLobbyState} lobby
   * @param {PlayerState} player
   * @param {string} viewerId
   */
  shouldRevealPlan(lobby, player, viewerId) {
    if (!this.hasSubmittedPlan(player)) {
      return false;
    }

    return player.id === viewerId || LobbySerializer.PLAN_REVEAL_PHASES.includes(lobby.phase);
  }
}
