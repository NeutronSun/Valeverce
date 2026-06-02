export function createResolveRoundAction({
  getActiveDuelists,
  SETTINGS,
  cardsById,
  scoreFightPlan,
  getAlivePlayers,
  makeRoundSummary,
  clearActionTimer,
  pushChat,
  trapSystem,
  effectWindowSystem
}) {
  return function resolveRound(lobby) {
    const duelists = getActiveDuelists(lobby);
    if (duelists.length < SETTINGS.minPlayers) {
      return;
    }

    const before = new Map(
      duelists.map((player) => [
        player.id,
        {
          health: player.health,
          mana: player.mana,
          energy: player.energy
        }
      ])
    );
    const scores = duelists.map((player, index) => {
      const opponent = duelists[index === 0 ? 1 : 0];
      const card = cardsById.get(player.selected.cardId);
      const opponentCard = cardsById.get(opponent.selected.cardId);
      const detail = scoreFightPlan({
        attacker: player,
        defender: opponent,
        attackerCard: card,
        defenderCard: opponentCard,
        attacks: player.selected.attacks,
        ownDefenses: player.selected.defenses,
        enemyDefenses: opponent.selected.defenses,
        enemyAttacks: opponent.selected.attacks,
        useActive: player.selected.useActive,
        mana: player.mana
      });

      return {
        player,
        opponent,
        card,
        opponentCard,
        detail,
        intent: player.selected.intent ?? "attack"
      };
    });

    const damageTaken = new Map(duelists.map((player) => [player.id, 0]));
    const dealtDamage = new Map(duelists.map((player) => [player.id, 0]));
    const publicLog = [];
    const privateLog = new Map();

    for (const score of scores) {
      score.player.mana = Math.max(0, score.player.mana - score.detail.manaCost);
      score.player.cooldowns[score.card.id] = SETTINGS.cardCooldownRounds + 1;
      resolveEnergyCard(score, lobby, cardsById, trapSystem, effectWindowSystem, publicLog, privateLog);
    }

    for (const score of scores) {
      const opponentScore = scores.find((item) => item.player.id === score.opponent.id);
      const damage = getIntentDamage(score, opponentScore);
      if (damage <= 0) {
        continue;
      }

      score.opponent.health = Math.max(0, score.opponent.health - damage);
      damageTaken.set(score.opponent.id, (damageTaken.get(score.opponent.id) ?? 0) + damage);
      dealtDamage.set(score.player.id, (dealtDamage.get(score.player.id) ?? 0) + damage);
    }

    for (const player of duelists) {
      if (player.selected?.intent === "focus") {
        const gain = (damageTaken.get(player.id) ?? 0) > 0 ? 1 : 2;
        player.energy = Math.min(player.maxEnergy ?? 5, Number(player.energy ?? 0) + gain);
      }
      player.alive = player.health > 0;
    }

    const highestDamage = Math.max(...scores.map((score) => dealtDamage.get(score.player.id) ?? 0));
    const contenders = scores.filter((score) => (dealtDamage.get(score.player.id) ?? 0) === highestDamage);
    const isTie = highestDamage <= 0 || contenders.length > 1;
    const winner = isTie ? null : contenders[0];

    lobby.lastResult = {
      round: lobby.round,
      activePair: lobby.activePair,
      winnerId: winner?.player.id ?? null,
      isTie,
      summary: makeRoundSummary(scores, winner, isTie, damageTaken),
      plays: scores.map((score) => {
        const snapshot = before.get(score.player.id);
        const actualFinalDamage = dealtDamage.get(score.player.id) ?? 0;

        return {
          playerId: score.player.id,
          playerName: score.player.name,
          cardId: score.card.id,
          cardName: score.card.name,
          card: score.card,

          attacks: score.player.selected.attacks,
          defenses: score.player.selected.defenses,
          intent: score.intent,
          energyCardId: score.player.selected.energyCardId ?? null,

          attackPool: score.detail.attackPool,
          defensePool: score.detail.defensePool,

          breach: score.detail.breach,
          breachBeforeTrait: score.detail.breachBeforeTrait,
          normalDamageCap: score.detail.normalDamageCap,
          normalDamage: score.detail.normalDamage,
          activeDamage: score.detail.activeDamage,
          finalDamage: actualFinalDamage,
          potentialFinalDamage: score.detail.finalDamage,
          damageTaken: damageTaken.get(score.player.id) ?? 0,

          useActive: score.detail.useActive,
          activeApplied: score.detail.activeApplied,
          manaCost: score.detail.manaCost,

          traitApplied: score.detail.traitApplied,
          traitNotes: score.detail.traitNotes,
          activeNotes: score.detail.activeNotes,
          defenseTraitNotes: score.detail.defenseTraitNotes,

          attackLines: score.detail.attackLines,

          healthBefore: snapshot.health,
          healthAfter: score.player.health,
          manaBefore: snapshot.mana,
          manaAfter: score.player.mana,
          energyBefore: snapshot.energy,
          energyAfter: score.player.energy,
          manaGain: 0,
          cooldown: score.player.cooldowns[score.card.id] ?? 0,

          outcome: winner ? (score.player.id === winner.player.id ? "win" : "lose") : "tie"
        };
      }),
      effectLog: publicLog
    };

    trapSystem.triggerArmedTraps(lobby, duelists, publicLog, privateLog);
    syncLastResultResources(lobby);
    if (duelists.every((player) => player.spellDeckReady)) {
      lobby.effectWindow = null;
      for (const [playerId, entries] of privateLog.entries()) {
        const player = lobby.players.get(playerId);
        if (player) {
          player.privateEffectLog = [...(player.privateEffectLog ?? []), ...entries].slice(-20);
        }
      }
    } else {
      effectWindowSystem.open(lobby, duelists, publicLog, privateLog);
    }

    lobby.phase = "reveal";
    lobby.winnerId = null;
    clearActionTimer(lobby);
    pushChat(lobby, {
      kind: "system",
      text: winner
        ? `${winner.player.name} vince il duello ${lobby.round} e infligge ${dealtDamage.get(winner.player.id)} PV`
        : `Duello ${lobby.round} in pareggio: nessun danno PV`
    });
  };
}

function getIntentDamage(score, opponentScore) {
  const opponentIntent = opponentScore?.intent ?? "attack";
  if (score.intent !== "attack") {
    return 0;
  }

  if (opponentIntent === "focus") {
    return Math.max(1, score.detail.finalDamage);
  }

  return score.detail.finalDamage;
}

function resolveEnergyCard(score, lobby, cardsById, trapSystem, effectWindowSystem, publicLog, privateLog) {
  const cardId = score.player.selected.energyCardId;
  if (!cardId) {
    return;
  }

  const card = cardsById.get(cardId);
  const energyCost = Number(card?.energyCost ?? card?.active?.cost ?? 0);
  if (!card || !score.player.utilityHand?.includes(cardId) || energyCost > Number(score.player.energy ?? 0)) {
    return;
  }

  if (!effectWindowSystem.effectApplicator.cardMoves.removeFromHand(score.player, cardId)) {
    return;
  }
  score.player.energy = Math.max(0, Number(score.player.energy ?? 0) - energyCost);
  score.player.energyUsedThisRound = true;

  if (card.type === "trap") {
    resolveDecisionTrap(score, lobby, card, trapSystem, effectWindowSystem, publicLog, privateLog);
    score.player.utilityDiscard.push(cardId);
    return;
  }

  effectWindowSystem.effectApplicator.applyCard({
    lobby,
    sourcePlayer: score.player,
    targetPlayer: score.opponent,
    card,
    publicLog,
    privateLog,
    source: "energy"
  });
  score.player.utilityDiscard.push(cardId);
}

function syncLastResultResources(lobby) {
  if (!Array.isArray(lobby.lastResult?.plays)) {
    return;
  }

  for (const play of lobby.lastResult.plays) {
    const player = lobby.players.get(play.playerId);
    if (!player) {
      continue;
    }

    play.healthAfter = player.health;
    play.manaAfter = player.mana;
    play.energyAfter = player.energy;
  }
}

function resolveDecisionTrap(score, lobby, card, trapSystem, effectWindowSystem, publicLog, privateLog) {
  const trap = {
    id: `decision_${lobby.round}_${score.player.id}`,
    ownerId: score.player.id,
    cardId: card.id,
    armedRound: lobby.round - 1,
    trigger: card.trigger ?? { type: "enemy_attacks" }
  };

  if (!trapSystem.shouldTriggerTrap(trap, score.opponent, { type: "combat" })) {
    effectWindowSystem.effectApplicator.addPublicLog(
      publicLog,
      lobby,
      `${score.player.name} rivela ${card.name}, ma il trigger non scatta.`
    );
    return;
  }

  effectWindowSystem.effectApplicator.addPublicLog(publicLog, lobby, `${score.player.name} rivela ${card.name}.`);
  effectWindowSystem.effectApplicator.applyCard({
    lobby,
    sourcePlayer: score.player,
    targetPlayer: score.opponent,
    card,
    publicLog,
    privateLog,
    source: "energy"
  });
}
