const MAX_UTILITY_DECK_SIZE = 8;
const STARTING_UTILITY_HAND_SIZE = 3;
const UTILITY_CARD_TYPES = Object.freeze(["utility", "defense", "trap"]);

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

    if (!lobby || !player || !["select", "plan", "reveal"].includes(lobby.phase)) {
      sendError(client, "Non puoi scegliere il mazzo utility ora");
      return;
    }

    if (!isActiveDuelist(lobby, client.id)) {
      sendError(client, "Scegli il mazzo utility solo quando sei nel duello");
      return;
    }

    if (player.utilityDeckReady) {
      sendError(client, "Mazzo utility gia selezionato");
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
    if (!card || !UTILITY_CARD_TYPES.includes(card.type)) {
      return { ok: false, error: "Il mazzo utility accetta solo utility, defense e trap" };
    }
  }

  return { ok: true, error: "" };
}
