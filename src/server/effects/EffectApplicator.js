import { CardMoveApplicator } from "./CardMoveApplicator.js";

const EFFECT_TYPES_REQUIRING_TARGET = Object.freeze(["damage", "swap_card", "steal_card", "swap_deck"]);

export class EffectApplicator {
  constructor({ SETTINGS, cardsById, shuffle }) {
    this.SETTINGS = SETTINGS;
    this.cardsById = cardsById;
    this.cardMoves = new CardMoveApplicator({ cardsById, shuffle });
  }

  cardNeedsTarget(card) {
    return this.getCardEffects(card).some(
      (effect) =>
        effect.target === "enemy" ||
        (!effect.target && EFFECT_TYPES_REQUIRING_TARGET.includes(String(effect.type ?? "")))
    );
  }

  applyCard({ lobby, sourcePlayer, targetPlayer, card, publicLog, privateLog, source = "utility" }) {
    const effects = this.getCardEffects(card);
    if (!effects.length) {
      this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}, ma non ha effetti risolvibili.`);
      return;
    }

    for (const effect of effects) {
      this.applyEffect({ lobby, sourcePlayer, targetPlayer, card, effect, publicLog, privateLog, source });
    }
  }

  applyEffect({ lobby, sourcePlayer, targetPlayer, card, effect, publicLog, privateLog, source }) {
    const type = String(effect.type ?? "");
    const resolvedTarget = this.resolveTarget({ lobby, sourcePlayer, targetPlayer, effect });
    const amount = Number(effect.value ?? effect.count ?? 0);

    switch (type) {
      case "heal":
        this.applyHeal({ lobby, sourcePlayer, targetPlayer: resolvedTarget, card, amount, publicLog, privateLog });
        break;
      case "mana_bonus":
        this.applyMana({ lobby, sourcePlayer, targetPlayer: resolvedTarget, card, amount, publicLog });
        break;
      case "damage":
        this.applyDamage({ lobby, sourcePlayer, targetPlayer: resolvedTarget, card, amount, publicLog });
        break;
      case "draw_cards":
        this.applyDraw({ lobby, sourcePlayer, targetPlayer: resolvedTarget, card, amount, publicLog, privateLog });
        break;
      case "swap_card":
        this.applySwapCard({ lobby, sourcePlayer, targetPlayer: resolvedTarget, card, publicLog, privateLog });
        break;
      case "swap_card_from_deck":
      case "swap_selected_card":
        this.applySwapCardFromDeck({ lobby, sourcePlayer, targetPlayer: resolvedTarget, card, publicLog, privateLog });
        break;
      case "steal_card":
        this.applyStealCard({ lobby, sourcePlayer, targetPlayer: resolvedTarget, card, publicLog, privateLog });
        break;
      case "swap_deck":
        this.applySwapDeck({ lobby, sourcePlayer, targetPlayer: resolvedTarget, card, publicLog });
        break;
      default:
        this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} attiva ${card.name}: effetto ${type || "sconosciuto"} ignorato.`);
        break;
    }
  }

  applyHeal({ lobby, sourcePlayer, targetPlayer, card, amount, publicLog, privateLog }) {
    const target = targetPlayer ?? sourcePlayer;
    const healAmount = Math.max(0, amount);
    const before = target.health;
    target.health = Math.min(this.SETTINGS.maxHealth, target.health + healAmount);
    this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}: ${target.name} cura ${target.health - before} PV.`);
  }

  applyMana({ lobby, sourcePlayer, targetPlayer, card, amount, publicLog }) {
    const target = targetPlayer ?? sourcePlayer;
    const manaAmount = Math.max(0, amount);
    const before = target.mana;
    target.mana = Math.min(this.SETTINGS.maxMana, target.mana + manaAmount);
    this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}: ${target.name} prende ${target.mana - before} mana.`);
  }

  applyDamage({ lobby, sourcePlayer, targetPlayer, card, amount, publicLog }) {
    const target = targetPlayer ?? this.getOpponent(lobby, sourcePlayer);
    if (!target) {
      this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}, ma non trova un bersaglio.`);
      return;
    }

    const damage = Math.max(0, amount);
    target.health = Math.max(0, target.health - damage);
    this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}: ${target.name} perde ${damage} PV.`);
  }

  applyDraw({ lobby, sourcePlayer, targetPlayer, card, amount, publicLog, privateLog }) {
    const target = targetPlayer ?? sourcePlayer;
    const drawCount = Math.max(1, amount || 1);
    const drawn = this.cardMoves.drawCards(target, drawCount);
    this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}: ${target.name} pesca ${drawn.length} utility.`);
    if (drawn.length) {
      this.addPrivateLog(privateLog, target.id, `Hai pescato ${drawn.map((cardId) => this.cardMoves.getCardName(cardId)).join(", ")}.`);
    }
  }

  applySwapCard({ lobby, sourcePlayer, targetPlayer, card, publicLog, privateLog }) {
    const target = targetPlayer ?? this.getOpponent(lobby, sourcePlayer);
    if (!target) {
      this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}, ma non trova un bersaglio.`);
      return;
    }

    if (target.id === sourcePlayer.id) {
      this.applySwapCardFromDeck({ lobby, sourcePlayer, targetPlayer: sourcePlayer, card, publicLog, privateLog });
      return;
    }

    const swap = this.cardMoves.swapRandomHandCards(sourcePlayer, target);
    if (!swap) {
      this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}, ma lo swap non ha carte valide.`);
      return;
    }

    this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} scambia una utility coperta con ${target.name}.`);
    this.addPrivateLog(privateLog, sourcePlayer.id, `Hai ricevuto ${this.cardMoves.getCardName(swap.secondCardId)} da ${target.name}.`);
    this.addPrivateLog(privateLog, target.id, `Hai ricevuto ${this.cardMoves.getCardName(swap.firstCardId)} da ${sourcePlayer.name}.`);
  }

  applySwapCardFromDeck({ lobby, sourcePlayer, targetPlayer, card, publicLog, privateLog }) {
    const target = targetPlayer ?? sourcePlayer;
    const swap = this.cardMoves.swapRandomHandCardFromDeck(target);
    if (!swap) {
      this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}, ma non ci sono carte da scambiare col mazzo.`);
      return;
    }

    this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} scambia una utility tra mano e mazzo.`);
    this.addPrivateLog(privateLog, target.id, `Hai messo via ${this.cardMoves.getCardName(swap.handCardId)} e preso ${this.cardMoves.getCardName(swap.deckCardId)}.`);
  }

  applyStealCard({ lobby, sourcePlayer, targetPlayer, card, publicLog, privateLog }) {
    const target = targetPlayer ?? this.getOpponent(lobby, sourcePlayer);
    if (!target) {
      this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}, ma non trova un bersaglio.`);
      return;
    }

    const stolenCardId = this.cardMoves.stealRandomHandCard(sourcePlayer, target);
    if (!stolenCardId) {
      this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} prova a rubare una utility, ma ${target.name} non ha carte in mano.`);
      return;
    }

    this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} ruba una utility coperta a ${target.name}.`);
    this.addPrivateLog(privateLog, sourcePlayer.id, `Hai rubato ${this.cardMoves.getCardName(stolenCardId)} a ${target.name}.`);
    this.addPrivateLog(privateLog, target.id, `${sourcePlayer.name} ti ha rubato una utility coperta.`);
  }

  applySwapDeck({ lobby, sourcePlayer, targetPlayer, card, publicLog }) {
    const target = targetPlayer ?? this.getOpponent(lobby, sourcePlayer);
    if (target && target.id !== sourcePlayer.id) {
      this.cardMoves.swapDrawPiles(sourcePlayer, target);
      this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} scambia il mazzo utility con ${target.name}.`);
      return;
    }

    const moved = this.cardMoves.reshuffleDiscardIntoDeck(sourcePlayer);
    this.addPublicLog(publicLog, lobby, `${sourcePlayer.name} usa ${card.name}: recupera ${moved} utility dagli scarti.`);
  }

  resolveTarget({ lobby, sourcePlayer, targetPlayer, effect }) {
    if (effect.target === "self") {
      return sourcePlayer;
    }

    if (effect.target === "enemy") {
      return targetPlayer ?? this.getOpponent(lobby, sourcePlayer);
    }

    return targetPlayer ?? sourcePlayer;
  }

  getCardEffects(card) {
    return [...this.getAbilityEffects(card?.active), ...this.getAbilityEffects(card?.passive), ...this.getAbilityEffects(card)];
  }

  getAbilityEffects(source) {
    if (!source) {
      return [];
    }

    if (Array.isArray(source.effects)) {
      return source.effects;
    }

    return source.effect ? [source.effect] : [];
  }

  getOpponent(lobby, sourcePlayer) {
    const opponentId = lobby.activePair.find((playerId) => playerId !== sourcePlayer.id);
    return opponentId ? lobby.players.get(opponentId) : null;
  }

  addPublicLog(publicLog, lobby, text) {
    publicLog.push({
      id: `effect_${lobby.round}_${publicLog.length + 1}`,
      round: lobby.round,
      text
    });
  }

  addPrivateLog(privateLog, playerId, text) {
    const entries = privateLog.get(playerId) ?? [];
    entries.push({
      id: `private_${playerId}_${Date.now()}_${entries.length + 1}`,
      text
    });
    privateLog.set(playerId, entries.slice(-20));
  }
}
