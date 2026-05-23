import { io } from "socket.io-client";

const lobbyId = process.argv[2];
const holdMs = Number(process.argv[3] ?? 15000);
const url = process.env.BOT_URL ?? "http://localhost:3000";
const valerioKeys = ["V", "A", "L", "E", "R", "I", "O"];

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
  const card = firstSelectableCard(selectState);
  send(bot, "selectCard", { cardId: card.id });
}

const planState = await waitFor(bot, (state) => state.lobby?.phase === "plan", 30000);
console.log(`bot ready in ${planState.lobby.id}`);

await new Promise((resolve) => setTimeout(resolve, holdMs));
const latest = bot.states.at(-1);
if (latest?.lobby?.phase === "plan" && latest.lobby.self.isActive && !latest.lobby.self.selected?.attacks) {
  send(bot, "submitPlan", makePlanPayload(latest.lobby.self.selected.selectedCard));
}
await new Promise((resolve) => setTimeout(resolve, 500));
bot.socket.close();

async function connectPlayer(name) {
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false
  });
  const client = {
    socket,
    states: [],
    waiters: []
  };

  socket.on("state", (message) => {
    if (message.type === "state") {
      client.states.push(message);
      for (const waiter of client.waiters.splice(0)) {
        waiter();
      }
    }
  });

  socket.on("error", (message) => {
    throw new Error(message.message);
  });

  await new Promise((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });

  send(client, "setName", { name });
  await waitFor(client, (state) => state.selfId);
  return client;
}

function send(client, type, payload = {}) {
  client.socket.emit(type, payload);
}

async function runDraft(client) {
  while (true) {
    const state = await waitFor(client, (nextState) => ["draft", "select"].includes(nextState.lobby?.phase), 30000);
    if (state.lobby.phase === "select") {
      return;
    }

    if (state.lobby.self.isCurrentDrafter) {
      const pick = state.lobby.draft.pool.find((item) => item.canPick)?.card.id;
      if (pick) {
        send(client, "draftCard", { cardId: pick });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
}

function firstSelectableCard(state) {
  const self = state.lobby.self;
  const card = self.deck.find((candidate) => Number(self.cooldowns?.[candidate.id] ?? 0) <= 0);
  if (!card) {
    throw new Error("No selectable card");
  }
  return card;
}

function makePlanPayload(card) {
  return {
    attacks: distribute(topStats(card, ["V", "A", "I", "O"]), attackPool(card)),
    defenses: distribute(topStats(card, ["L", "E", "R", "V"]), defensePool(card)),
    useActive: false
  };
}

function topStats(card, preferred) {
  const valerio = card.valerio ?? {};
  return [...valerioKeys]
    .sort((left, right) => {
      const diff = Number(valerio[right] ?? 0) - Number(valerio[left] ?? 0);
      if (diff !== 0) return diff;
      return preferred.indexOf(left) - preferred.indexOf(right);
    })
    .slice(0, 3);
}

function distribute(stats, pool) {
  const base = Math.floor(pool / stats.length);
  let rest = pool - base * stats.length;
  return Object.fromEntries(
    stats.map((stat) => {
      const value = base + (rest > 0 ? 1 : 0);
      rest -= 1;
      return [stat, value];
    })
  );
}

function attackPool(card) {
  return Math.floor((20 * Number(card.combat?.attackPower ?? 0)) / 100);
}

function defensePool(card) {
  return Math.floor((20 * Number(card.combat?.defensePower ?? 0)) / 100);
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
