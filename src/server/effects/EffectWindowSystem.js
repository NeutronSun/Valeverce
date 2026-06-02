export class EffectWindowSystem {
  constructor({ cardsById, effectApplicator, trapSystem, getAlivePlayers, SETTINGS }) {
    this.cardsById = cardsById;
    this.effectApplicator = effectApplicator;
    this.trapSystem = trapSystem;
    this.getAlivePlayers = getAlivePlayers;
    this.SETTINGS = SETTINGS;
  }

  open(lobby, duelists, publicLog = [], privateLog = new Map()) {
    this.flushPrivateLogs(lobby, privateLog);
    this.syncLastResultResources(lobby);
    lobby.effectWindow = {
      id: `effect_${lobby.round}`,
      round: lobby.round,
      status: "waiting",
      playerIds: duelists.map((player) => player.id),
      submissions: {},
      publicLog
    };
  }

  playCard(lobby, player, cardId, targetPlayerId) {
    const validation = this.validateWindowAction(lobby, player);
    if (!validation.ok) {
      return validation;
    }

    if (!player.utilityHand.includes(cardId)) {
      return { ok: false, error: "Carta utility non disponibile" };
    }

    const card = this.cardsById.get(cardId);
    if (!card || card.type === "attack") {
      return { ok: false, error: "Puoi giocare solo carte utility, defense o trap" };
    }

    const targetPlayer = this.resolveTargetPlayer(lobby, player, targetPlayerId, card);
    if (this.effectApplicator.cardNeedsTarget(card) && !targetPlayer) {
      return { ok: false, error: "Scegli un bersaglio valido" };
    }

    const publicLog = lobby.effectWindow.publicLog;
    const privateLog = new Map();
    if (card.type === "trap") {
      this.effectApplicator.cardMoves.removeFromHand(player, card.id);
      this.trapSystem.armTrap({ lobby, player, card });
      this.effectApplicator.addPublicLog(publicLog, lobby, `${player.name} arma una trappola coperta per il prossimo round.`);
      this.effectApplicator.addPrivateLog(privateLog, player.id, `Hai armato ${card.name}.`);
      lobby.effectWindow.submissions[player.id] = {
        type: "trap",
        cardId: card.id,
        targetPlayerId: targetPlayer?.id ?? null
      };
    } else {
      this.trapSystem.triggerUtilityTraps(lobby, player, publicLog, privateLog);
      this.effectApplicator.cardMoves.discardFromHand(player, card.id);
      this.effectApplicator.applyCard({
        lobby,
        sourcePlayer: player,
        targetPlayer,
        card,
        publicLog,
        privateLog,
        source: "utility"
      });
      lobby.effectWindow.submissions[player.id] = {
        type: "card",
        cardId: card.id,
        targetPlayerId: targetPlayer?.id ?? null
      };
    }

    this.flushPrivateLogs(lobby, privateLog);
    this.syncLastResultResources(lobby);
    this.closeIfReady(lobby);
    return { ok: true, error: "" };
  }

  pass(lobby, player) {
    const validation = this.validateWindowAction(lobby, player);
    if (!validation.ok) {
      return validation;
    }

    lobby.effectWindow.submissions[player.id] = {
      type: "pass",
      cardId: null,
      targetPlayerId: null
    };
    this.effectApplicator.addPublicLog(lobby.effectWindow.publicLog, lobby, `${player.name} passa la finestra effetti.`);
    this.closeIfReady(lobby);
    return { ok: true, error: "" };
  }

  forcePassPending(lobby) {
    if (lobby.effectWindow?.status !== "waiting") {
      return;
    }

    for (const playerId of lobby.effectWindow.playerIds) {
      if (lobby.effectWindow.submissions[playerId]) {
        continue;
      }

      const player = lobby.players.get(playerId);
      lobby.effectWindow.submissions[playerId] = {
        type: "pass",
        cardId: null,
        targetPlayerId: null
      };
      if (player) {
        this.effectApplicator.addPublicLog(lobby.effectWindow.publicLog, lobby, `${player.name} passa automaticamente.`);
      }
    }

    this.closeIfReady(lobby);
  }

  validateWindowAction(lobby, player) {
    if (!lobby || !player || lobby.phase !== "reveal" || lobby.effectWindow?.status !== "waiting") {
      return { ok: false, error: "Non puoi usare utility ora" };
    }

    if (!lobby.effectWindow.playerIds.includes(player.id)) {
      return { ok: false, error: "Non sei nel duello corrente" };
    }

    if (lobby.effectWindow.submissions[player.id]) {
      return { ok: false, error: "Hai gia scelto nella finestra effetti" };
    }

    return { ok: true, error: "" };
  }

  resolveTargetPlayer(lobby, player, targetPlayerId, card) {
    const explicitTarget = targetPlayerId ? lobby.players.get(targetPlayerId) : null;
    if (explicitTarget && explicitTarget.id !== player.id && lobby.effectWindow.playerIds.includes(explicitTarget.id)) {
      return explicitTarget;
    }

    if (!this.effectApplicator.cardNeedsTarget(card)) {
      return null;
    }

    const opponentId = lobby.effectWindow.playerIds.find((playerId) => playerId !== player.id);
    return opponentId ? lobby.players.get(opponentId) : null;
  }

  closeIfReady(lobby) {
    const playerIds = lobby.effectWindow?.playerIds ?? [];
    if (!playerIds.length || !playerIds.every((playerId) => lobby.effectWindow.submissions[playerId])) {
      return;
    }

    lobby.effectWindow.status = "closed";
    this.finalizeDeaths(lobby);
    this.syncLastResultResources(lobby);
  }

  finalizeDeaths(lobby) {
    for (const player of lobby.players.values()) {
      if (player.health <= 0) {
        player.alive = false;
      }
    }

    const alivePlayers = this.getAlivePlayers(lobby);
    if (alivePlayers.length <= 1) {
      lobby.phase = "ended";
      lobby.winnerId = alivePlayers[0]?.id ?? null;
    }
  }

  flushPrivateLogs(lobby, privateLog) {
    for (const [playerId, entries] of privateLog.entries()) {
      const player = lobby.players.get(playerId);
      if (player) {
        player.privateEffectLog = [...(player.privateEffectLog ?? []), ...entries].slice(-20);
      }
    }
  }

  syncLastResultResources(lobby) {
    if (!Array.isArray(lobby.lastResult?.plays)) {
      return;
    }

    for (const play of lobby.lastResult.plays) {
      const player = lobby.players.get(play.playerId);
      if (player) {
        play.healthAfter = player.health;
        play.manaAfter = player.mana;
      }
    }
  }
}
