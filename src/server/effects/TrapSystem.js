export class TrapSystem {
  constructor({ cardsById, effectApplicator, makeId }) {
    this.cardsById = cardsById;
    this.effectApplicator = effectApplicator;
    this.makeId = makeId;
  }

  armTrap({ lobby, player, card }) {
    player.armedTraps.push({
      id: this.makeId("trap", 5),
      ownerId: player.id,
      cardId: card.id,
      armedRound: lobby.round,
      trigger: card.trigger ?? { type: "enemy_attacks" }
    });
  }

  triggerArmedTraps(lobby, duelists, publicLog, privateLog, context = { type: "combat" }) {
    for (const player of duelists) {
      const opponent = duelists.find((duelist) => duelist.id !== player.id);
      if (!opponent || !player.armedTraps.length) {
        continue;
      }

      const remainingTraps = [];
      for (const trap of player.armedTraps) {
        const card = this.cardsById.get(trap.cardId);
        if (!card || trap.armedRound >= lobby.round || !this.shouldTriggerTrap(trap, opponent, context)) {
          remainingTraps.push(trap);
          continue;
        }

        this.effectApplicator.addPublicLog(publicLog, lobby, `${player.name} rivela una trappola segreta.`);
        this.effectApplicator.addPrivateLog(privateLog, player.id, `La tua trappola ${card.name} si attiva.`);
        this.effectApplicator.applyCard({
          lobby,
          sourcePlayer: player,
          targetPlayer: opponent,
          card,
          publicLog,
          privateLog,
          source: "trap"
        });
        player.utilityDiscard.push(card.id);
      }

      player.armedTraps = remainingTraps;
    }
  }

  triggerUtilityTraps(lobby, utilityPlayer, publicLog, privateLog) {
    const duelists = lobby.activePair.map((playerId) => lobby.players.get(playerId)).filter(Boolean);
    for (const owner of duelists) {
      if (owner.id === utilityPlayer.id || !owner.armedTraps.length) {
        continue;
      }

      const remainingTraps = [];
      for (const trap of owner.armedTraps) {
        const card = this.cardsById.get(trap.cardId);
        if (
          !card ||
          trap.armedRound >= lobby.round ||
          !this.shouldTriggerTrap(trap, utilityPlayer, { type: "utility" })
        ) {
          remainingTraps.push(trap);
          continue;
        }

        this.effectApplicator.addPublicLog(publicLog, lobby, `${owner.name} rivela una trappola segreta.`);
        this.effectApplicator.addPrivateLog(privateLog, owner.id, `La tua trappola ${card.name} si attiva.`);
        this.effectApplicator.applyCard({
          lobby,
          sourcePlayer: owner,
          targetPlayer: utilityPlayer,
          card,
          publicLog,
          privateLog,
          source: "trap"
        });
        owner.utilityDiscard.push(card.id);
      }

      owner.armedTraps = remainingTraps;
    }
  }

  shouldTriggerTrap(trap, opponent, context) {
    const triggerType = trap.trigger?.type ?? "enemy_attacks";
    const opponentActiveEffects = this.getSelectedActiveEffectTypes(opponent);

    if (triggerType === "enemy_uses_utility") {
      return context.type === "utility";
    }

    if (triggerType === "enemy_uses_active") {
      return Boolean(opponent.selected?.useActive);
    }

    if (triggerType === "enemy_attacks") {
      return Boolean(opponent.selected?.attacks && Object.values(opponent.selected.attacks).some((value) => Number(value) > 0));
    }

    if (triggerType === "enemy_draws") {
      return opponentActiveEffects.includes("draw_cards");
    }

    if (triggerType === "enemy_focuses") {
      return opponentActiveEffects.some((type) => ["heal", "mana_bonus", "draw_cards"].includes(type));
    }

    if (triggerType === "enemy_controls") {
      return opponentActiveEffects.some((type) =>
        ["swap_card", "swap_card_from_deck", "swap_selected_card", "steal_card", "swap_deck"].includes(type)
      );
    }

    return false;
  }

  getSelectedActiveEffectTypes(player) {
    if (!player.selected?.useActive) {
      return [];
    }

    const card = this.cardsById.get(player.selected.cardId);
    const effects = Array.isArray(card?.active?.effects)
      ? card.active.effects
      : card?.active?.effect
        ? [card.active.effect]
        : [];
    return effects.map((effect) => String(effect.type ?? "")).filter(Boolean);
  }
}
