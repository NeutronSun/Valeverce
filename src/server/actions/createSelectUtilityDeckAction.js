const MAX_UTILITY_DECK_SIZE = 8;
const STARTING_UTILITY_HAND_SIZE = 3;
const SPELL_DECK_SIZE = 10;
const ENERGY_DECK_SIZE = 3;
const ENERGY_CARD_TYPES = Object.freeze(["utility", "trap"]);

export function createSelectUtilityDeckAction({
  getClientLobby,
  sendError,
  isActiveDuelist,
  cardsById,
  cardMoveApplicator,
  broadcastLobbyState
}) {
  return function selectUtilityDeck(client, payload) {
    const lobby = getClientLobby(client);
    const player = lobby?.players.get(client.id);

    if (!lobby || !player || !["lobby", "select", "plan", "reveal"].includes(lobby.phase)) {
      sendError(client, "Non puoi scegliere il mazzo utility ora");
      return;
    }

    if (lobby.phase !== "lobby" && !isActiveDuelist(lobby, client.id)) {
      sendError(client, "Scegli il mazzo utility solo quando sei nel duello");
      return;
    }

    if (player.utilityDeckReady) {
      sendError(client, "Mazzo utility gia selezionato");
      return;
    }

    if (Array.isArray(payload?.spellDeck) || Array.isArray(payload?.energyDeck)) {
      const spellDeck = normalizeDeckIds(payload?.spellDeck);
      const energyDeck = normalizeDeckIds(payload?.energyDeck);
      const validation = validateValeverceDeck(spellDeck, energyDeck, cardsById);
      if (!validation.ok) {
        sendError(client, validation.error);
        return;
      }

      player.deck = [...spellDeck];
      player.spellDeck = [...spellDeck];
      player.spellDrawPile = cardMoveApplicator.shuffle(spellDeck);
      player.spellHand = [];
      player.spellDiscard = [];
      player.spellDeckReady = true;
      player.utilityDeck = energyDeck;
      player.utilityDrawPile = [...energyDeck];
      player.utilityHand = [...energyDeck];
      player.utilityDiscard = [];
      player.utilityDeckReady = true;
      broadcastLobbyState(lobby);
      return;
    }

    const cardIds = normalizeDeckIds(payload?.cardIds);
    const validation = validateUtilityDeck(cardIds, cardsById);
    if (!validation.ok) {
      sendError(client, validation.error);
      return;
    }

    player.utilityDeck = cardIds;
    player.utilityDrawPile = cardMoveApplicator.shuffle(cardIds);
    player.utilityHand = [];
    player.utilityDiscard = [];
    player.utilityDeckReady = true;
    cardMoveApplicator.drawCards(player, STARTING_UTILITY_HAND_SIZE);
    broadcastLobbyState(lobby);
  };
}

function normalizeDeckIds(cardIds) {
  return Array.isArray(cardIds) ? cardIds.map((cardId) => String(cardId ?? "")).filter(Boolean) : [];
}

function validateUtilityDeck(cardIds, cardsById) {
  if (!cardIds.length) {
    return { ok: false, error: "Il mazzo utility deve avere almeno una carta" };
  }

  if (cardIds.length > MAX_UTILITY_DECK_SIZE) {
    return { ok: false, error: `Il mazzo utility puo avere massimo ${MAX_UTILITY_DECK_SIZE} carte` };
  }

  if (new Set(cardIds).size !== cardIds.length) {
    return { ok: false, error: "Il mazzo utility non puo avere duplicati" };
  }

  for (const cardId of cardIds) {
    const card = cardsById.get(cardId);
    if (!card || !isEnergyDeckCard(card)) {
      return { ok: false, error: "Energy Deck accetta solo utility e trap" };
    }
  }

  return { ok: true, error: "" };
}

function validateValeverceDeck(spellDeck, energyDeck, cardsById) {
  if (spellDeck.length !== SPELL_DECK_SIZE) {
    return { ok: false, error: `Spell Deck deve avere ${SPELL_DECK_SIZE} carte` };
  }

  if (energyDeck.length !== ENERGY_DECK_SIZE) {
    return { ok: false, error: `Energy Deck deve avere ${ENERGY_DECK_SIZE} carte` };
  }

  if (new Set(spellDeck).size !== spellDeck.length || new Set(energyDeck).size !== energyDeck.length) {
    return { ok: false, error: "Il deck non puo avere duplicati" };
  }

  for (const cardId of spellDeck) {
    const card = cardsById.get(cardId);
    if (!card || !isSpellDeckCard(card)) {
      return { ok: false, error: "Spell Deck accetta solo carte spell/combat" };
    }
  }

  for (const cardId of energyDeck) {
    const card = cardsById.get(cardId);
    if (!card || !isEnergyDeckCard(card)) {
      return { ok: false, error: "Energy Deck accetta solo trap e utility" };
    }
  }

  return { ok: true, error: "" };
}

function isSpellDeckCard(card) {
  if (card?.deckType) {
    return card.deckType === "spell";
  }

  return ["attack", "defense"].includes(card?.type) && card?.usesCombat !== false;
}

function isEnergyDeckCard(card) {
  if (card?.deckType) {
    return card.deckType === "energy";
  }

  return ENERGY_CARD_TYPES.includes(card?.type) && Number.isInteger(card?.energyCost);
}
