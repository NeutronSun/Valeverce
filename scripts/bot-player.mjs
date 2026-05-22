const lobbyId = process.argv[2];
const holdMs = Number(process.argv[3] ?? 15000);
const url = process.env.BOT_URL ?? "ws://localhost:3000";

if (!lobbyId) {
  console.error("Usage: node scripts/bot-player.mjs <LOBBY_ID> [holdMs]");
  process.exit(1);
}

const bot = await connectPlayer("Bot Fight");
send(bot, "joinLobby", { lobbyId });
await waitFor(bot, (state) => state.lobby?.id === lobbyId && state.lobby.players.length >= 2);
await runDraft(bot);

const selectState = await waitFor(bot, (state) => state.lobby?.phase === "select", 30000);
if (selectState.lobby.self.isActive) {
  send(bot, "selectCard", { cardId: selectState.lobby.self.deck[0].id });
}

const fightState = await waitFor(bot, (state) => state.lobby?.phase === "fight", 30000);
console.log(`bot ready in ${fightState.lobby.id}`);

await new Promise((resolve) => setTimeout(resolve, holdMs));
if (fightState.lobby.self.isActive) {
  send(bot, "submitFight", { useActive: false });
}
await new Promise((resolve) => setTimeout(resolve, 500));
bot.ws.close();

async function connectPlayer(name) {
  const ws = new WebSocket(url);
  const client = {
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

async function runDraft(client) {
  while (true) {
    const state = await waitFor(client, (nextState) => ["draft", "select"].includes(nextState.lobby?.phase), 30000);
    if (state.lobby.phase === "select") {
      return;
    }

    if (state.lobby.self.isCurrentDrafter) {
      const pick = state.lobby.draft.pool.find((item) => item.isAvailable)?.card.id;
      if (pick) {
        send(client, "draftCard", { cardId: pick });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
}

async function waitFor(client, predicate, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const found = [...client.states].reverse().find(predicate);
    if (found) {
      return found;
    }

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 50);
      client.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  throw new Error("Timed out waiting for bot state");
}
