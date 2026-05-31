export function createSubmitPlanAction({
  getClientLobby,
  sendError,
  isActiveDuelist,
  hasSubmittedPlan,
  cardsById,
  normalizePlan,
  validateValerioPlan,
  advanceRoundIfReady,
  broadcastLobbyState
}) {
  return function submitPlan(client, payload) {
    const lobby = getClientLobby(client);
    const player = lobby?.players.get(client.id);

    if (!lobby || !player || lobby.phase !== "plan") {
      sendError(client, "Non puoi confermare un piano ora");
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

    if (!player.selected?.cardId) {
      sendError(client, "Non hai scelto una carta");
      return;
    }

    if (hasSubmittedPlan(player)) {
      sendError(client, "Hai gia confermato il piano");
      return;
    }

    const card = cardsById.get(player.selected.cardId);
    const plan = normalizePlan(payload);
    const validation = validateValerioPlan(plan, card);
    if (!validation.ok) {
      sendError(client, validation.error);
      return;
    }

    if (plan.useActive && Number(card.active?.cost ?? 0) > player.mana) {
      sendError(client, "Mana insufficiente");
      return;
    }

    player.selected.attacks = plan.attacks;
    player.selected.defenses = plan.defenses;
    player.selected.useActive = plan.useActive;
    advanceRoundIfReady(lobby);
    broadcastLobbyState(lobby);
  };
}
