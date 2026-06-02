export function createSelectCardAction({
  getClientLobby,
  sendError,
  isActiveDuelist,
  cardsById,
  ensureUtilityDeckReady,
  advanceRoundIfReady,
  broadcastLobbyState
}) {
  return function selectCard(client, cardId) {
    const lobby = getClientLobby(client);
    const player = lobby?.players.get(client.id);

    if (!lobby || !player || lobby.phase !== "select") {
      sendError(client, "Non puoi scegliere una carta ora");
      return;
    }

    if (!isActiveDuelist(lobby, client.id)) {
      sendError(client, "Sei spettatore per questo duello");
      return;
    }

    if (!player.alive) {
      sendError(client, "Sei fuori dalla partita");
      return;
    }

    if (!player.utilityDeckReady) {
      ensureUtilityDeckReady?.(player);
    }

    if (!player.deck.includes(cardId) || !cardsById.has(cardId)) {
      sendError(client, "Carta non valida");
      return;
    }

    if (Number(player.cooldowns[cardId] ?? 0) > 0) {
      sendError(client, "Carta in cooldown");
      return;
    }

    if (player.selected?.cardId) {
      sendError(client, "Hai gia scelto la carta");
      return;
    }

    player.selected = {
      cardId,
      attacks: null,
      defenses: null,
      useActive: null
    };
    advanceRoundIfReady(lobby);
    broadcastLobbyState(lobby);
  };
}
