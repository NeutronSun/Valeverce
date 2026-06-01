export class CardMoveApplicator {
  constructor({ cardsById, shuffle }) {
    this.cardsById = cardsById;
    this.shuffle = shuffle;
  }

  drawCards(player, count) {
    const drawn = [];
    const drawCount = Math.max(0, Number(count ?? 0));

    for (let index = 0; index < drawCount; index += 1) {
      if (!player.utilityDrawPile.length && player.utilityDiscard.length) {
        player.utilityDrawPile = this.shuffle(player.utilityDiscard);
        player.utilityDiscard = [];
      }

      const cardId = player.utilityDrawPile.shift();
      if (!cardId) {
        break;
      }

      player.utilityHand.push(cardId);
      drawn.push(cardId);
    }

    return drawn;
  }

  discardFromHand(player, cardId) {
    const index = player.utilityHand.indexOf(cardId);
    if (index < 0) {
      return false;
    }

    player.utilityHand.splice(index, 1);
    player.utilityDiscard.push(cardId);
    return true;
  }

  removeFromHand(player, cardId) {
    const index = player.utilityHand.indexOf(cardId);
    if (index < 0) {
      return false;
    }

    player.utilityHand.splice(index, 1);
    return true;
  }

  swapRandomHandCards(firstPlayer, secondPlayer) {
    const firstCardId = this.pickRandomCardId(firstPlayer.utilityHand);
    const secondCardId = this.pickRandomCardId(secondPlayer.utilityHand);
    if (!firstCardId || !secondCardId) {
      return null;
    }

    this.replaceCardId(firstPlayer.utilityHand, firstCardId, secondCardId);
    this.replaceCardId(secondPlayer.utilityHand, secondCardId, firstCardId);

    return {
      firstCardId,
      secondCardId
    };
  }

  swapRandomHandCardFromDeck(player) {
    const handCardId = this.pickRandomCardId(player.utilityHand);
    const deckCardId = this.pickRandomCardId(player.utilityDrawPile);
    if (!handCardId || !deckCardId) {
      return null;
    }

    this.replaceCardId(player.utilityHand, handCardId, deckCardId);
    this.replaceCardId(player.utilityDrawPile, deckCardId, handCardId);

    return {
      handCardId,
      deckCardId
    };
  }

  stealRandomHandCard(sourcePlayer, targetPlayer) {
    const cardId = this.pickRandomCardId(targetPlayer.utilityHand);
    if (!cardId) {
      return null;
    }

    this.removeFromHand(targetPlayer, cardId);
    sourcePlayer.utilityHand.push(cardId);
    return cardId;
  }

  swapDrawPiles(firstPlayer, secondPlayer) {
    const firstPile = firstPlayer.utilityDrawPile;
    firstPlayer.utilityDrawPile = secondPlayer.utilityDrawPile;
    secondPlayer.utilityDrawPile = firstPile;
  }

  reshuffleDiscardIntoDeck(player) {
    if (!player.utilityDiscard.length) {
      return 0;
    }

    const count = player.utilityDiscard.length;
    player.utilityDrawPile = this.shuffle([...player.utilityDrawPile, ...player.utilityDiscard]);
    player.utilityDiscard = [];
    return count;
  }

  getCardName(cardId) {
    return this.cardsById.get(cardId)?.name ?? "carta";
  }

  pickRandomCardId(cardIds) {
    if (!cardIds?.length) {
      return null;
    }

    return cardIds[Math.floor(Math.random() * cardIds.length)];
  }

  replaceCardId(cardIds, oldCardId, newCardId) {
    const index = cardIds.indexOf(oldCardId);
    if (index >= 0) {
      cardIds[index] = newCardId;
    }
  }
}
