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
          mana: player.mana
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

      return { player, opponent, card, opponentCard, detail };
    });

    const highestBreach = Math.max(...scores.map((score) => score.detail.breach));
    const contenders = scores.filter((score) => score.detail.breach === highestBreach);
    const isTie = contenders.length > 1;
    const winner = isTie ? null : contenders[0];
    const damageTaken = new Map(duelists.map((player) => [player.id, 0]));

    for (const score of scores) {
      score.player.mana = Math.max(0, score.player.mana - score.detail.manaCost);
      score.player.cooldowns[score.card.id] = SETTINGS.cardCooldownRounds + 1;
    }

    if (winner) {
      const loser = winner.opponent;
      const damage = winner.detail.finalDamage;
      loser.health = Math.max(0, loser.health - damage);
      damageTaken.set(loser.id, damage);
    }

    for (const player of duelists) {
      player.mana = Math.min(SETTINGS.maxMana, player.mana + SETTINGS.roundManaGain);
    }

    lobby.lastResult = {
      round: lobby.round,
      activePair: lobby.activePair,
      winnerId: winner?.player.id ?? null,
      isTie,
      summary: makeRoundSummary(scores, winner, isTie, damageTaken),
      plays: scores.map((score) => {
        const healthBefore = before.get(score.player.id).health;
        const manaBefore = before.get(score.player.id).mana;
        const actualFinalDamage = winner?.player.id === score.player.id ? score.detail.finalDamage : 0;

        return {
          playerId: score.player.id,
          playerName: score.player.name,
          cardId: score.card.id,
          cardName: score.card.name,
          card: score.card,

          attacks: score.player.selected.attacks,
          defenses: score.player.selected.defenses,

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

          healthBefore,
          healthAfter: score.player.health,
          manaBefore,
          manaAfter: score.player.mana,
          manaGain: SETTINGS.roundManaGain,
          cooldown: score.player.cooldowns[score.card.id] ?? 0,

          outcome: winner ? (score.player.id === winner.player.id ? "win" : "lose") : "tie"
        };
      })
    };

    const publicLog = [];
    const privateLog = new Map();
    trapSystem.triggerArmedTraps(lobby, duelists, publicLog, privateLog);
    effectWindowSystem.open(lobby, duelists, publicLog, privateLog);

    lobby.phase = "reveal";
    lobby.winnerId = null;
    clearActionTimer(lobby);
    pushChat(lobby, {
      kind: "system",
      text: winner
        ? `${winner.player.name} vince il duello ${lobby.round} e infligge ${damageTaken.get(winner.opponent.id)} PV`
        : `Duello ${lobby.round} in pareggio: nessun danno PV`
    });
  };
}
