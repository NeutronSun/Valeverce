export function createDraftCardAction({
  getClientLobby,
  sendError,
  getCurrentDrafterId,
  cardsById,
  canPlayerDraftCard,
  getDraftCost,
  pushChat,
  finishOrAdvanceDraft
}) {
  return function draftCard(client, cardId) {
    const lobby = getClientLobby(client);
    const player = lobby?.players.get(client.id);

    if (!lobby || !player || lobby.phase !== "draft" || !lobby.draft) {
      sendError(client, "Non puoi draftare ora");
      return;
    }

    if (getCurrentDrafterId(lobby) !== client.id) {
      sendError(client, "Non e il tuo turno di draft");
      return;
    }

    const card = cardsById.get(cardId);
    const availability = canPlayerDraftCard(lobby, player, card);
    if (!availability.ok) {
      sendError(client, availability.error);
      return;
    }

    player.deck.push(cardId);
    player.draftSpent += getDraftCost(card);
    lobby.draft.taken.push(cardId);
    pushChat(lobby, {
      kind: "system",
      text: `${player.name} drafta ${card.name} (${getDraftCost(card)} budget)`
    });

    finishOrAdvanceDraft(lobby);
  };
}
