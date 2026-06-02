export function createPlayEffectCardAction({ getClientLobby, sendError, effectWindowSystem, broadcastLobbyState }) {
  return function playEffectCard(client, payload) {
    const lobby = getClientLobby(client);
    const player = lobby?.players.get(client.id);
    const result = effectWindowSystem.playCard(
      lobby,
      player,
      String(payload?.cardId ?? ""),
      payload?.targetPlayerId ? String(payload.targetPlayerId) : null
    );

    if (!result.ok) {
      sendError(client, result.error);
      return;
    }

    broadcastLobbyState(lobby);
  };
}
