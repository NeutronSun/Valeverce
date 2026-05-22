const url = process.env.SMOKE_URL ?? "ws://localhost:3000";

const playerOne = await connectPlayer("Smoke One");
const playerTwo = await connectPlayer("Smoke Two");

send(playerOne, "createLobby");
const lobbyId = await waitFor(playerOne, (state) => state.lobby?.id).then((state) => state.lobby.id);

send(playerTwo, "joinLobby", { lobbyId });
await waitFor(playerTwo, (state) => state.lobby?.id === lobbyId && state.lobby.players.length === 2);

send(playerOne, "startGame");
await runDraft(playerOne, playerTwo);

const stateOne = await waitFor(playerOne, (state) => state.lobby?.phase === "select");
const stateTwo = await waitFor(playerTwo, (state) => state.lobby?.phase === "select");

send(playerOne, "selectCard", { cardId: stateOne.lobby.self.deck[0].id });
send(playerTwo, "selectCard", { cardId: stateTwo.lobby.self.deck[0].id });

await waitFor(playerOne, (state) => state.lobby?.phase === "fight" && state.lobby.players.every((player) => player.selectedCard));
await waitFor(playerTwo, (state) => state.lobby?.phase === "fight" && state.lobby.players.every((player) => player.selectedCard));

send(playerOne, "submitFight", { useActive: false });
send(playerTwo, "submitFight", { useActive: false });

const reveal = await waitFor(playerOne, (state) => ["reveal", "ended"].includes(state.lobby?.phase));

if (!reveal.lobby.lastResult) {
  throw new Error("Missing result in reveal state");
}

console.log(`ok lobby=${lobbyId} phase=${reveal.lobby.phase} winner=${reveal.lobby.lastResult.winnerId ?? "tie"}`);

playerOne.ws.close();
playerTwo.ws.close();

async function connectPlayer(name) {
  const ws = new WebSocket(url);
  const client = {
    name,
    ws,
    states: [],
    waiters: []
  };

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "state") {
      client.states.push(message);
      for (const waiter of client.waiters.splice(0)) {
        waiter();
      }
    }
    if (message.type === "error") {
      throw new Error(message.message);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  send(client, "setName", { name });
  await waitFor(client, (state) => state.selfId);
  return client;
}

function send(client, type, payload = {}) {
  client.ws.send(JSON.stringify({ type, payload }));
}

async function runDraft(...players) {
  await waitFor(players[0], (state) => state.lobby?.phase === "draft");

  while (true) {
    const state = await waitFor(players[0], (nextState) => ["draft", "select"].includes(nextState.lobby?.phase), 10000);
    if (state.lobby.phase === "select") {
      return;
    }

    const currentPlayerId = state.lobby.draft.currentPlayerId;
    const player = players.find((candidate) => candidate.states.at(-1)?.selfId === currentPlayerId) ?? players[0];
    const playerState = await waitFor(
      player,
      (nextState) => nextState.lobby?.phase === "draft" && nextState.lobby.draft.currentPlayerId === currentPlayerId,
      10000
    );
    const pick = playerState.lobby.draft.pool.find((item) => item.isAvailable)?.card.id;
    if (!pick) {
      throw new Error("No draft pick available");
    }
    send(player, "draftCard", { cardId: pick });
    const takenCount = state.lobby.draft.taken.length;
    await waitFor(
      players[0],
      (nextState) =>
        nextState.lobby?.phase === "select" ||
        (nextState.lobby?.phase === "draft" && nextState.lobby.draft.taken.length > takenCount),
      10000
    );
  }
}

async function waitFor(client, predicate, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const latest = client.states.at(-1);
    if (latest && predicate(latest)) {
      return latest;
    }

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 50);
      client.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  throw new Error(`Timed out waiting for ${client.name}`);
}
