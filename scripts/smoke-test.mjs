import { io } from "socket.io-client";

const url = process.env.SMOKE_URL ?? "http://localhost:3000";
const valerioKeys = ["V", "A", "L", "E", "R", "I", "O"];

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

send(playerOne, "selectCard", { cardId: firstSelectableCard(stateOne).id });
send(playerTwo, "selectCard", { cardId: firstSelectableCard(stateTwo).id });

const planOne = await waitFor(playerOne, (state) => state.lobby?.phase === "plan");
const planTwo = await waitFor(playerTwo, (state) => state.lobby?.phase === "plan");

send(playerOne, "submitPlan", makePlanPayload(planOne.lobby.self.selected.selectedCard));
send(playerTwo, "submitPlan", makePlanPayload(planTwo.lobby.self.selected.selectedCard));

const reveal = await waitFor(playerOne, (state) => ["reveal", "ended"].includes(state.lobby?.phase));

if (!reveal.lobby.lastResult) {
  throw new Error("Missing result in reveal state");
}

if (!reveal.lobby.lastResult.plays.every((play) => play.attackLines?.length === 3)) {
  throw new Error("Missing attack line details");
}

console.log(`ok lobby=${lobbyId} phase=${reveal.lobby.phase} winner=${reveal.lobby.lastResult.winnerId ?? "tie"}`);

playerOne.socket.close();
playerTwo.socket.close();

async function connectPlayer(name) {
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false
  });
  const client = {
    name,
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
    const pick = playerState.lobby.draft.pool.find((item) => item.canPick)?.card.id;
    if (!pick) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
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
