export function createPassEffectWindowAction({ getClientLobby, sendError, effectWindowSystem, broadcastLobbyState }) {
  return function passEffectWindow(client) {
    const lobby = getClientLobby(client);
    const player = lobby?.players.get(client.id);
    const result = effectWindowSystem.pass(lobby, player);

    if (!result.ok) {
      sendError(client, result.error);
      return;
    }

    broadcastLobbyState(lobby);
  };
}
