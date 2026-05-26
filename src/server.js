import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import {
  SETTINGS,
  VALERIO_LABELS,
  getAttackPool,
  getDefensePool,
  getDraftCost,
  scoreFightPlan,
  shuffle,
  validateValerioPlan
} from "./game.js";
import { CLIENT_EVENT_NAMES, CLIENT_EVENTS, SERVER_EVENTS } from "./shared/events.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT ?? 3000);
const isDev = process.env.NODE_ENV !== "production";

const cardData = JSON.parse(await readFile(path.join(publicDir, "data", "cards.json"), "utf8"));
const cards = readCards(cardData);
const cardsById = new Map(cards.map((card) => [card.id, card]));

const clients = new Map();
const clientsBySocketId = new Map();
const lobbies = new Map();
let timerController;
let lobbyManager;

const nextApp = next({ dev: isDev, dir: rootDir });
const nextHandler = nextApp.getRequestHandler();

await nextApp.prepare();

const server = http.createServer((request, response) => {
  nextHandler(request, response);
});

const io = new SocketIOServer(server, {
  cors: {
    origin: true
  }
});

io.on("connection", (socket) => {
  const client = new ClientSession(socket, `Player ${clients.size + 1}`);
  clients.set(client.id, client);
  clientsBySocketId.set(socket.id, client);

  socket.emit(SERVER_EVENTS.HELLO, { type: SERVER_EVENTS.HELLO, selfId: client.id });
  sendState(client);
  broadcastLobbyList();

  for (const eventName of [...CLIENT_EVENT_NAMES, "submitPlay", "submitFight"]) {
    socket.on(eventName, (payload = {}, ack) => {
      if (eventName === CLIENT_EVENTS.LATENCY_PROBE) {
        if (typeof ack === "function") {
          ack({ receivedAt: Date.now() });
        }
        return;
      }

      handleMessage(client, { type: eventName, payload });
    });
  }

  socket.on("disconnect", () => disconnectClient(client));
});

server.listen(port, "0.0.0.0", () => {
  console.log("valeverce");
  console.log(`Local:   http://localhost:${port}`);
  for (const address of getLanAddresses()) {
    console.log(`Network: http://${address}:${port}`);
  }
});

class ClientSession {
  constructor(socket, fallbackName) {
    this.id = makeId("p", 8);
    this.name = fallbackName;
    this.lobbyId = null;
    this.socket = socket;
  }
}

class TimerController {
  schedule(lobby, phase, delayMs, callback) {
    this.clear(lobby);
    const deadlineAt = Date.now() + delayMs;
    lobby.deadlineAt = deadlineAt;
    lobby.actionTimer = setTimeout(() => callback(deadlineAt), delayMs);
  }

  clear(lobby) {
    if (lobby.actionTimer) {
      clearTimeout(lobby.actionTimer);
    }
    lobby.actionTimer = null;
    lobby.deadlineAt = null;
  }
}

class LobbyState {
  constructor({ id, hostId }) {
    this.id = id;
    this.hostId = hostId;
    this.phase = "lobby";
    this.round = 0;
    this.settings = {
      pickTimerEnabled: true,
      pickTimerSeconds: SETTINGS.actionSeconds,
      draftSize: SETTINGS.draftSize,
      draftBudget: SETTINGS.draftBudget
    };
    this.playerOrder = [hostId];
    this.activePair = [];
    this.pairCursor = 0;
    this.draft = null;
    this.actionTimer = null;
    this.deadlineAt = null;
    this.chat = [];
    this.players = new Map();
    this.lastResult = null;
    this.winnerId = null;
  }
}

class LobbyManager {
  constructor({ clients, lobbies }) {
    this.clients = clients;
    this.lobbies = lobbies;
  }

  attachClient(client, lobbyId) {
    client.lobbyId = lobbyId;
    client.socket.join(lobbyId);
  }

  detachClient(client, lobbyId) {
    client.socket.leave(lobbyId);
    client.lobbyId = null;
  }

  getClientLobby(client) {
    return client.lobbyId ? this.lobbies.get(client.lobbyId) : null;
  }

  broadcastLobby(lobby) {
    const room = io.sockets.adapter.rooms.get(lobby.id);
    for (const socketId of room ?? []) {
      const client = clientsBySocketId.get(socketId);
      if (client) {
        sendState(client);
      }
    }
    this.broadcastLobbyList();
  }

  broadcastLobbyList() {
    for (const client of this.clients.values()) {
      if (!client.lobbyId) {
        sendState(client);
      }
    }
  }
}

timerController = new TimerController();
lobbyManager = new LobbyManager({ clients, lobbies });

function readCards(data) {
  const cardsList = Array.isArray(data) ? data : data.cards;
  if (!Array.isArray(cardsList)) {
    throw new Error("public/data/cards.json deve essere un array o un oggetto con cards[]");
  }

  return cardsList;
}

function handleMessage(client, message) {
  const payload = message.payload ?? {};

  switch (message.type) {
    case CLIENT_EVENTS.SET_NAME:
      client.name = sanitizeName(payload.name);
      updatePlayerName(client);
      broadcastClientScope(client);
      break;
    case CLIENT_EVENTS.CREATE_LOBBY:
      leaveLobby(client, { broadcast: false });
      createLobby(client);
      broadcastAllStates();
      break;
    case CLIENT_EVENTS.JOIN_LOBBY:
      leaveLobby(client, { broadcast: false });
      joinLobby(client, String(payload.lobbyId ?? ""));
      broadcastAllStates();
      break;
    case CLIENT_EVENTS.LEAVE_LOBBY:
      leaveLobby(client);
      break;
    case CLIENT_EVENTS.UPDATE_LOBBY_SETTINGS:
      updateLobbySettings(client, payload);
      break;
    case CLIENT_EVENTS.START_GAME:
      startGame(client);
      break;
    case CLIENT_EVENTS.DRAFT_CARD:
      draftCard(client, String(payload.cardId ?? ""));
      break;
    case CLIENT_EVENTS.SELECT_CARD:
      selectCard(client, String(payload.cardId ?? ""));
      break;
    case CLIENT_EVENTS.SUBMIT_PLAN:
      submitPlan(client, payload);
      break;
    case "submitFight":
      sendError(client, "Protocollo aggiornato: usa submitPlan");
      break;
    case "submitPlay":
      if (getClientLobby(client)?.phase === "select") {
        selectCard(client, String(payload.cardId ?? ""));
      } else if (getClientLobby(client)?.phase === "plan") {
        submitPlan(client, payload);
      } else {
        sendError(client, "Azione non valida in questa fase");
      }
      break;
    case CLIENT_EVENTS.NEXT_ROUND:
      startNextRound(client);
      break;
    case CLIENT_EVENTS.RESTART_LOBBY:
      restartLobby(client);
      break;
    case CLIENT_EVENTS.SEND_CHAT:
      sendChat(client, String(payload.text ?? ""));
      break;
    default:
      sendError(client, "Azione sconosciuta");
  }
}

function createLobby(client) {
  const lobbyId = makeLobbyId();
  const lobby = new LobbyState({ id: lobbyId, hostId: client.id });

  lobby.players.set(client.id, makePlayer(client));
  pushChat(lobby, { kind: "system", text: `${client.name} ha creato la lobby` });
  lobbies.set(lobbyId, lobby);
  lobbyManager.attachClient(client, lobbyId);
}

function joinLobby(client, lobbyId) {
  const normalizedId = lobbyId.trim().toUpperCase();
  const lobby = lobbies.get(normalizedId);

  if (!lobby) {
    sendError(client, "Lobby non trovata");
    return;
  }

  if (lobby.phase !== "lobby") {
    sendError(client, "Partita gia iniziata");
    return;
  }

  if (lobby.players.size >= SETTINGS.maxPlayers) {
    sendError(client, "Lobby piena");
    return;
  }

  lobby.players.set(client.id, makePlayer(client));
  lobby.playerOrder.push(client.id);
  pushChat(lobby, { kind: "system", text: `${client.name} entra in lobby` });
  lobbyManager.attachClient(client, lobby.id);
}

function updateLobbySettings(client, payload) {
  const lobby = getClientLobby(client);
  if (!lobby || lobby.hostId !== client.id) {
    sendError(client, "Solo l'host puo modificare i setting");
    return;
  }

  if (lobby.phase !== "lobby") {
    sendError(client, "Puoi modificare i setting solo in lobby");
    return;
  }

  const pickTimerEnabled =
    typeof payload.pickTimerEnabled === "boolean" ? payload.pickTimerEnabled : Boolean(lobby.settings.pickTimerEnabled);
  const pickTimerSeconds = clampInteger(payload.pickTimerSeconds, 10, 60, lobby.settings.pickTimerSeconds);
  const draftSize = clampInteger(payload.draftSize, 3, 10, lobby.settings.draftSize);
  const minDraftBudget = getMinDraftBudget(draftSize);
  const maxDraftBudget = getMaxDraftBudget(draftSize);
  const draftBudgetValue = Number.isFinite(Number(payload.draftBudget)) ? payload.draftBudget : lobby.settings.draftBudget;
  const draftBudget = clampInteger(draftBudgetValue, minDraftBudget, maxDraftBudget, SETTINGS.draftBudget);

  lobby.settings = {
    pickTimerEnabled,
    pickTimerSeconds,
    draftSize,
    draftBudget
  };

  broadcastLobbyState(lobby);
}

function startGame(client) {
  const lobby = getClientLobby(client);
  if (!lobby || lobby.hostId !== client.id) {
    sendError(client, "Solo l'host puo iniziare");
    return;
  }

  if (lobby.players.size < SETTINGS.minPlayers) {
    sendError(client, `Servono almeno ${SETTINGS.minPlayers} player`);
    return;
  }

  for (const player of lobby.players.values()) {
    resetPlayerForGame(player);
  }

  lobby.round = 0;
  lobby.winnerId = null;
  lobby.lastResult = null;
  lobby.activePair = [];
  lobby.pairCursor = 0;
  lobby.playerOrder = lobby.playerOrder.filter((playerId) => lobby.players.has(playerId));
  lobby.draft = {
    pool: shuffle(cards.map((card) => card.id)),
    taken: [],
    pickIndex: 0,
    order: [...lobby.playerOrder],
    target: lobby.settings.draftSize,
    budget: lobby.settings.draftBudget
  };
  lobby.phase = "draft";
  scheduleActionTimer(lobby, "draft");
  pushChat(lobby, {
    kind: "system",
    text: `Draft iniziato: ${lobby.settings.draftSize} carte max, budget ${lobby.settings.draftBudget}`
  });
  broadcastLobbyState(lobby);
}

function draftCard(client, cardId) {
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
}

function selectCard(client, cardId) {
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
}

function submitPlan(client, payload) {
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
}

function sendChat(client, text) {
  const lobby = getClientLobby(client);
  if (!lobby) {
    sendError(client, "Entra in una lobby per chattare");
    return;
  }

  const cleanText = sanitizeChatText(text);
  if (!cleanText) {
    return;
  }

  pushChat(lobby, {
    kind: "user",
    playerId: client.id,
    name: client.name,
    text: cleanText
  });
  broadcastLobbyState(lobby);
}

function startNextRound(client) {
  const lobby = getClientLobby(client);
  if (!lobby || lobby.hostId !== client.id) {
    sendError(client, "Solo l'host puo avanzare");
    return;
  }

  if (lobby.phase !== "reveal") {
    sendError(client, "Il turno non e finito");
    return;
  }

  startRound(lobby);
}

function restartLobby(client) {
  const lobby = getClientLobby(client);
  if (!lobby || lobby.hostId !== client.id) {
    sendError(client, "Solo l'host puo resettare");
    return;
  }

  lobby.phase = "lobby";
  lobby.round = 0;
  lobby.activePair = [];
  lobby.pairCursor = 0;
  lobby.draft = null;
  clearActionTimer(lobby);
  lobby.lastResult = null;
  lobby.winnerId = null;

  for (const player of lobby.players.values()) {
    resetPlayerForGame(player);
  }

  broadcastLobbyState(lobby);
}

function startRound(lobby) {
  const alivePlayers = getAlivePlayers(lobby);
  if (alivePlayers.length < SETTINGS.minPlayers) {
    lobby.phase = "ended";
    lobby.winnerId = alivePlayers[0]?.id ?? null;
    clearActionTimer(lobby);
    broadcastLobbyState(lobby);
    return;
  }

  tickCooldowns(lobby);

  const activePair = pickActivePair(lobby);
  if (activePair.length < SETTINGS.minPlayers) {
    lobby.phase = "ended";
    lobby.winnerId = alivePlayers[0]?.id ?? null;
    clearActionTimer(lobby);
    broadcastLobbyState(lobby);
    return;
  }

  lobby.phase = "select";
  lobby.round += 1;
  lobby.activePair = activePair;
  lobby.lastResult = null;

  for (const player of lobby.players.values()) {
    player.selected = null;
  }

  pushChat(lobby, {
    kind: "system",
    text: `Duello ${lobby.round}: ${lobby.players.get(activePair[0])?.name} vs ${lobby.players.get(activePair[1])?.name}`
  });

  scheduleActionTimer(lobby, "select");
  broadcastLobbyState(lobby);
}

function enterPlan(lobby) {
  lobby.phase = "plan";
  clearActionTimer(lobby);

  for (const player of getActiveDuelists(lobby)) {
    if (player.selected) {
      player.selected.attacks = null;
      player.selected.defenses = null;
      player.selected.useActive = null;
    }
  }
}

function advanceRoundIfReady(lobby) {
  const activePlayers = getActiveDuelists(lobby);
  if (activePlayers.length < SETTINGS.minPlayers) {
    return;
  }

  if (lobby.phase === "select" && activePlayers.every((player) => player.selected?.cardId)) {
    enterPlan(lobby);
  }

  if (lobby.phase === "plan" && activePlayers.every((player) => hasSubmittedPlan(player))) {
    resolveRound(lobby);
  }
}

function resolveRound(lobby) {
  const duelists = getActiveDuelists(lobby);
  if (duelists.length < SETTINGS.minPlayers) {
    return;
  }

  const before = new Map(
    duelists.map((player) => [
      player.id,
      {
        health: player.health,
        mana: player.mana
      }
    ])
  );
  const scores = duelists.map((player, index) => {
    const opponent = duelists[index === 0 ? 1 : 0];
    const card = cardsById.get(player.selected.cardId);
    const opponentCard = cardsById.get(opponent.selected.cardId);
    const detail = scoreFightPlan({
      attacker: player,
      defender: opponent,
      attackerCard: card,
      defenderCard: opponentCard,
      attacks: player.selected.attacks,
      ownDefenses: player.selected.defenses,
      enemyDefenses: opponent.selected.defenses,
      enemyAttacks: opponent.selected.attacks,
      useActive: player.selected.useActive,
      mana: player.mana
    });

    return { player, opponent, card, opponentCard, detail };
  });

  const highestBreach = Math.max(...scores.map((score) => score.detail.breach));
  const contenders = scores.filter((score) => score.detail.breach === highestBreach);
  const isTie = contenders.length > 1;
  const winner = isTie ? null : contenders[0];
  const damageTaken = new Map(duelists.map((player) => [player.id, 0]));

  for (const score of scores) {
    score.player.mana = Math.max(0, score.player.mana - score.detail.manaCost);
    score.player.cooldowns[score.card.id] = SETTINGS.cardCooldownRounds + 1;
  }

  if (winner) {
    const loser = winner.opponent;
    const damage = winner.detail.finalDamage;
    loser.health = Math.max(0, loser.health - damage);
    damageTaken.set(loser.id, damage);
  }

  for (const player of duelists) {
    player.mana = Math.min(SETTINGS.maxMana, player.mana + SETTINGS.roundManaGain);
    if (player.health <= 0) {
      player.alive = false;
    }
  }

  const stillAlive = getAlivePlayers(lobby);
  const gameWinner = stillAlive.length === 1 ? stillAlive[0] : null;

  lobby.lastResult = {
    round: lobby.round,
    activePair: lobby.activePair,
    winnerId: winner?.player.id ?? null,
    isTie,
    summary: makeRoundSummary(scores, winner, isTie, damageTaken),
    plays: scores.map((score) => {
      const healthBefore = before.get(score.player.id).health;
      const manaBefore = before.get(score.player.id).mana;
      const actualFinalDamage = winner?.player.id === score.player.id ? score.detail.finalDamage : 0;

      return {
        playerId: score.player.id,
        playerName: score.player.name,
        cardId: score.card.id,
        cardName: score.card.name,
        card: score.card,

        attacks: score.player.selected.attacks,
        defenses: score.player.selected.defenses,

        attackPool: score.detail.attackPool,
        defensePool: score.detail.defensePool,

        breach: score.detail.breach,
        breachBeforeTrait: score.detail.breachBeforeTrait,
        normalDamageCap: score.detail.normalDamageCap,
        normalDamage: score.detail.normalDamage,
        activeDamage: score.detail.activeDamage,
        finalDamage: actualFinalDamage,
        potentialFinalDamage: score.detail.finalDamage,
        damageTaken: damageTaken.get(score.player.id) ?? 0,

        useActive: score.detail.useActive,
        activeApplied: score.detail.activeApplied,
        manaCost: score.detail.manaCost,

        traitApplied: score.detail.traitApplied,
        traitNotes: score.detail.traitNotes,
        activeNotes: score.detail.activeNotes,
        defenseTraitNotes: score.detail.defenseTraitNotes,

        attackLines: score.detail.attackLines,

        healthBefore,
        healthAfter: score.player.health,
        manaBefore,
        manaAfter: score.player.mana,
        manaGain: SETTINGS.roundManaGain,
        cooldown: score.player.cooldowns[score.card.id] ?? 0,

        outcome: winner ? (score.player.id === winner.player.id ? "win" : "lose") : "tie"
      };
    })
  };

  lobby.phase = gameWinner ? "ended" : "reveal";
  lobby.winnerId = gameWinner?.id ?? null;
  clearActionTimer(lobby);
  pushChat(lobby, {
    kind: "system",
    text: winner
      ? `${winner.player.name} vince il duello ${lobby.round} e infligge ${damageTaken.get(winner.opponent.id)} PV`
      : `Duello ${lobby.round} in pareggio: nessun danno PV`
  });
}

function leaveLobby(client, options = { broadcast: true }) {
  const lobby = getClientLobby(client);
  if (!lobby) {
    client.lobbyId = null;
    if (options.broadcast) {
      sendState(client);
    }
    return;
  }

  lobby.players.delete(client.id);
  lobby.playerOrder = lobby.playerOrder.filter((playerId) => playerId !== client.id);
  if (lobby.draft) {
    lobby.draft.order = lobby.draft.order.filter((playerId) => playerId !== client.id);
  }
  lobbyManager.detachClient(client, lobby.id);

  if (lobby.players.size === 0) {
    clearActionTimer(lobby);
    lobbies.delete(lobby.id);
  } else {
    if (lobby.hostId === client.id) {
      lobby.hostId = lobby.players.keys().next().value;
    }

    const stillAlive = getAlivePlayers(lobby);
    if (lobby.phase === "draft") {
      if (lobby.players.size < SETTINGS.minPlayers) {
        lobby.phase = "lobby";
        lobby.draft = null;
        clearActionTimer(lobby);
      } else {
        finishOrAdvanceDraft(lobby);
      }
    } else if (["select", "plan", "reveal"].includes(lobby.phase) && stillAlive.length <= 1) {
      lobby.phase = "ended";
      lobby.winnerId = stillAlive[0]?.id ?? null;
      clearActionTimer(lobby);
    } else {
      advanceRoundIfReady(lobby);
    }
  }

  if (options.broadcast) {
    broadcastAllStates();
  }
}

function disconnectClient(client) {
  if (!clients.has(client.id)) {
    return;
  }

  leaveLobby(client, { broadcast: false });
  clients.delete(client.id);
  clientsBySocketId.delete(client.socket.id);
  broadcastAllStates();
}

function updatePlayerName(client) {
  const lobby = getClientLobby(client);
  const player = lobby?.players.get(client.id);
  if (player) {
    player.name = client.name;
  }
}

function makePlayer(client) {
  return {
    id: client.id,
    name: client.name,
    health: SETTINGS.startingHealth,
    mana: SETTINGS.startingMana,
    deck: [],
    draftSpent: 0,
    cooldowns: {},
    alive: true,
    selected: null
  };
}

function resetPlayerForGame(player) {
  player.health = SETTINGS.startingHealth;
  player.mana = SETTINGS.startingMana;
  player.deck = [];
  player.draftSpent = 0;
  player.cooldowns = {};
  player.alive = true;
  player.selected = null;
}

function getClientLobby(client) {
  return lobbyManager.getClientLobby(client);
}

function isActiveDuelist(lobby, playerId) {
  return lobby.activePair.includes(playerId);
}

function getActiveDuelists(lobby) {
  return lobby.activePair.map((playerId) => lobby.players.get(playerId)).filter(Boolean);
}

function getAlivePlayers(lobby) {
  return [...lobby.players.values()].filter((player) => player.alive);
}

function pickActivePair(lobby) {
  const orderedAliveIds = lobby.playerOrder.filter((playerId) => {
    const player = lobby.players.get(playerId);
    return player?.alive && player.deck.length > 0;
  });

  if (orderedAliveIds.length < SETTINGS.minPlayers) {
    return [];
  }

  const startIndex = lobby.pairCursor % orderedAliveIds.length;
  const pair = [orderedAliveIds[startIndex], orderedAliveIds[(startIndex + 1) % orderedAliveIds.length]];
  lobby.pairCursor = (startIndex + 1) % orderedAliveIds.length;
  return pair;
}

function getCurrentDrafterId(lobby) {
  if (!lobby.draft || isDraftComplete(lobby)) {
    return null;
  }

  for (let offset = 0; offset < lobby.draft.order.length; offset += 1) {
    const index = (lobby.draft.pickIndex + offset) % lobby.draft.order.length;
    const playerId = lobby.draft.order[index];
    const player = lobby.players.get(playerId);
    if (player && !isPlayerDraftDone(lobby, player)) {
      return playerId;
    }
  }

  return null;
}

function finishOrAdvanceDraft(lobby) {
  if (isDraftComplete(lobby)) {
    pushChat(lobby, { kind: "system", text: "Draft completato, si entra nei duelli" });
    startRound(lobby);
    return;
  }

  advanceDraftTurn(lobby);
  scheduleActionTimer(lobby, "draft");
  broadcastLobbyState(lobby);
}

function advanceDraftTurn(lobby) {
  if (!lobby.draft) {
    return;
  }

  lobby.draft.pickIndex = (lobby.draft.pickIndex + 1) % lobby.draft.order.length;
  const currentId = getCurrentDrafterId(lobby);
  const currentIndex = lobby.draft.order.indexOf(currentId);
  if (currentIndex >= 0) {
    lobby.draft.pickIndex = currentIndex;
  }
}

function isDraftComplete(lobby) {
  return Boolean(
    lobby.draft &&
      lobby.draft.order
        .filter((playerId) => lobby.players.has(playerId))
        .every((playerId) => isPlayerDraftDone(lobby, lobby.players.get(playerId)))
  );
}

function isPlayerDraftDone(lobby, player) {
  return (
    !player ||
    player.deck.length >= lobby.draft.target ||
    player.draftSpent >= lobby.draft.budget ||
    !findAffordableDraftCard(lobby, player)
  );
}

function canPlayerDraftCard(lobby, player, card) {
  if (!card || !cardsById.has(card.id) || !lobby.draft.pool.includes(card.id) || lobby.draft.taken.includes(card.id)) {
    return { ok: false, error: "Carta non disponibile" };
  }

  if (player.deck.length >= lobby.draft.target) {
    return { ok: false, error: "Hai gia completato il draft" };
  }

  const cost = getDraftCost(card);
  if (player.draftSpent + cost > lobby.draft.budget) {
    return { ok: false, error: `Budget insufficiente (${cost} richiesti)` };
  }

  return { ok: true, error: "" };
}

function findAffordableDraftCard(lobby, player) {
  return lobby.draft?.pool.find((cardId) => {
    const card = cardsById.get(cardId);
    return canPlayerDraftCard(lobby, player, card).ok;
  });
}

function scheduleActionTimer(lobby, phase) {
  timerController.clear(lobby);
  if (!["draft", "select"].includes(phase)) {
    return;
  }

  if (phase === "draft" && !lobby.settings.pickTimerEnabled) {
    return;
  }

  const delaySeconds = phase === "draft" ? lobby.settings.pickTimerSeconds : SETTINGS.actionSeconds;

  timerController.schedule(lobby, phase, delaySeconds * 1000, (deadlineAt) => {
    handleActionTimeout(lobby.id, phase, deadlineAt);
  });
}

function clearActionTimer(lobby) {
  timerController.clear(lobby);
}

function handleActionTimeout(lobbyId, phase, deadlineAt) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || lobby.phase !== phase || lobby.deadlineAt !== deadlineAt) {
    return;
  }

  if (phase === "draft") {
    autoDraftCard(lobby);
    return;
  }

  autoSelectCards(lobby);
}

function autoDraftCard(lobby) {
  const currentPlayerId = getCurrentDrafterId(lobby);
  const player = currentPlayerId ? lobby.players.get(currentPlayerId) : null;
  const cardId = player ? findAffordableDraftCard(lobby, player) : null;
  const card = cardId ? cardsById.get(cardId) : null;

  if (!player || !card) {
    finishOrAdvanceDraft(lobby);
    return;
  }

  player.deck.push(card.id);
  player.draftSpent += getDraftCost(card);
  lobby.draft.taken.push(card.id);
  pushChat(lobby, {
    kind: "system",
    text: `Timer scaduto: ${player.name} drafta ${card.name}`
  });

  finishOrAdvanceDraft(lobby);
}

function autoSelectCards(lobby) {
  for (const player of getActiveDuelists(lobby)) {
    if (!player.selected?.cardId) {
      const cardId = findSelectableCardId(player);
      if (cardId) {
        player.selected = {
          cardId,
          attacks: null,
          defenses: null,
          useActive: null
        };
        pushChat(lobby, {
          kind: "system",
          text: `Timer scaduto: ${player.name} sceglie ${cardsById.get(cardId)?.name ?? "una carta"}`
        });
      }
    }
  }

  advanceRoundIfReady(lobby);
  if (lobby.phase === "select") {
    scheduleActionTimer(lobby, "select");
  }
  broadcastLobbyState(lobby);
}

function findSelectableCardId(player) {
  return player.deck.find((cardId) => Number(player.cooldowns[cardId] ?? 0) <= 0 && cardsById.has(cardId));
}

function tickCooldowns(lobby) {
  for (const player of lobby.players.values()) {
    for (const [cardId, turns] of Object.entries(player.cooldowns)) {
      const nextTurns = Number(turns) - 1;
      if (nextTurns <= 0) {
        delete player.cooldowns[cardId];
      } else {
        player.cooldowns[cardId] = nextTurns;
      }
    }
  }
}

function hasSubmittedPlan(player) {
  return Boolean(
    player.selected?.attacks &&
      player.selected?.defenses &&
      player.selected?.useActive !== null &&
      player.selected?.useActive !== undefined
  );
}

function normalizePlan(payload) {
  return {
    attacks: normalizeDistribution(payload.attacks),
    defenses: normalizeDistribution(payload.defenses),
    useActive: Boolean(payload.useActive)
  };
}

function normalizeDistribution(distribution) {
  return Object.fromEntries(
    Object.entries(distribution ?? {})
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => value !== 0)
  );
}

function makeRoundSummary(scores, winner, isTie, damageTaken) {
  const [first, second] = scores;
  const reason = isTie
    ? `Breccia pari (${first.detail.breach}-${second.detail.breach}). Nessuno perde PV.`
    : `${winner.player.name} supera ${winner.opponent.name} in Breccia (${winner.detail.breach}-${scores.find((score) => score.player.id === winner.opponent.id).detail.breach}) e infligge ${damageTaken.get(winner.opponent.id)} PV.`;

  return {
    reason,
    damage: winner ? damageTaken.get(winner.opponent.id) : 0,
    lines: scores.flatMap((score) => [
      {
        playerId: score.player.id,
        text: `${score.player.name}: Breccia ${score.detail.breach}, cap ${score.detail.normalDamageCap}, danno potenziale ${score.detail.finalDamage}`
      },
      ...score.detail.attackLines.map((line) => ({
        playerId: score.player.id,
        stat: line.stat,
        text: `${score.player.name} ${line.stat}: ${line.attackPoints} + ${line.attackerValerio} - ${line.defenderValerio} - ${line.defensePoints} = ${line.lineDamage}`
      }))
    ])
  };
}

function broadcastAllStates() {
  for (const client of clients.values()) {
    sendState(client);
  }
}

function broadcastClientScope(client) {
  const lobby = getClientLobby(client);
  if (lobby) {
    broadcastLobbyState(lobby);
  } else {
    sendState(client);
    broadcastLobbyList();
  }
}

function broadcastLobbyState(lobby) {
  lobbyManager.broadcastLobby(lobby);
}

function broadcastLobbyList() {
  lobbyManager.broadcastLobbyList();
}

function sendState(client) {
  const lobby = getClientLobby(client);
  send(client, {
    type: "state",
    selfId: client.id,
    settings: SETTINGS,
    valerioLabels: VALERIO_LABELS,
    onlinePlayers: clients.size,
    lobbies: serializeLobbyList(),
    lobby: lobby ? serializeLobby(lobby, client.id) : null
  });
}

function serializeLobbyList() {
  return [...lobbies.values()].map((lobby) => ({
    id: lobby.id,
    phase: lobby.phase,
    hostName: lobby.players.get(lobby.hostId)?.name ?? "Host",
    players: lobby.players.size,
    maxPlayers: SETTINGS.maxPlayers,
    isJoinable: lobby.phase === "lobby" && lobby.players.size < SETTINGS.maxPlayers,
    round: lobby.round,
    names: [...lobby.players.values()].map((player) => player.name)
  }));
}

function serializeLobby(lobby, selfId) {
  const self = lobby.players.get(selfId);
  const currentDrafterId = getCurrentDrafterId(lobby);

  return {
    id: lobby.id,
    hostId: lobby.hostId,
    phase: lobby.phase,
    round: lobby.round,
    settings: lobby.settings,
    activePair: lobby.activePair,
    deadlineAt: lobby.deadlineAt,
    draft: serializeDraft(lobby, currentDrafterId, selfId),
    chat: lobby.chat,
    lastResult: lobby.lastResult,
    winnerId: lobby.winnerId,
    players: [...lobby.players.values()].map((player) => serializePlayer(lobby, player, selfId, currentDrafterId)),
    self: self ? serializeSelf(lobby, self, currentDrafterId) : null
  };
}

function serializePlayer(lobby, player, viewerId, currentDrafterId) {
  const selectedCard = shouldRevealSelectedCard(lobby, player, viewerId) ? cardsById.get(player.selected.cardId) : null;
  const showPlan = shouldRevealPlan(lobby, player, viewerId);
  const draftBudget = lobby.draft?.budget ?? lobby.settings.draftBudget;

  return {
    id: player.id,
    name: player.name,
    health: player.health,
    maxHealth: SETTINGS.maxHealth,
    mana: player.mana,
    deck: player.deck.map((cardId) => cardsById.get(cardId)).filter(Boolean),
    deckCount: player.deck.length,
    draftCount: player.deck.length,
    draftSpent: player.draftSpent,
    draftBudget,
    draftBudgetRemaining: Math.max(0, draftBudget - player.draftSpent),
    cooldowns: player.cooldowns,
    alive: player.alive,
    isActive: isActiveDuelist(lobby, player.id),
    isCurrentDrafter: currentDrafterId === player.id,
    hasSelected: Boolean(player.selected?.cardId),
    hasSubmittedPlan: hasSubmittedPlan(player),
    selectedCard,
    selected: selectedCard
      ? {
          cardId: player.selected.cardId,
          attacks: showPlan ? player.selected.attacks : null,
          defenses: showPlan ? player.selected.defenses : null,
          useActive: showPlan ? player.selected.useActive : null,
          attackPool: getAttackPool(selectedCard),
          defensePool: getDefensePool(selectedCard)
        }
      : null,
    isHost: player.id === lobby.hostId
  };
}

function serializeSelf(lobby, self, currentDrafterId) {
  const selectedCard = self.selected?.cardId ? cardsById.get(self.selected.cardId) : null;
  const draftBudget = lobby.draft?.budget ?? lobby.settings.draftBudget;
  return {
    id: self.id,
    name: self.name,
    health: self.health,
    maxHealth: SETTINGS.maxHealth,
    mana: self.mana,
    deck: self.deck.map((cardId) => cardsById.get(cardId)).filter(Boolean),
    deckCount: self.deck.length,
    draftSpent: self.draftSpent,
    draftBudget,
    draftBudgetRemaining: Math.max(0, draftBudget - self.draftSpent),
    cooldowns: self.cooldowns,
    selected: self.selected
      ? {
          ...self.selected,
          selectedCard,
          attackPool: selectedCard ? getAttackPool(selectedCard) : 0,
          defensePool: selectedCard ? getDefensePool(selectedCard) : 0
        }
      : null,
    isActive: isActiveDuelist(lobby, self.id),
    isCurrentDrafter: currentDrafterId === self.id,
    alive: self.alive
  };
}

function serializeDraft(lobby, currentDrafterId, selfId) {
  if (!lobby.draft) {
    return null;
  }

  const self = lobby.players.get(selfId);
  return {
    target: lobby.draft.target,
    budget: lobby.draft.budget,
    currentPlayerId: currentDrafterId,
    taken: lobby.draft.taken,
    pool: lobby.draft.pool.map((cardId) => {
      const card = cardsById.get(cardId);
      const takenBy = [...lobby.players.values()].find((player) => player.deck.includes(cardId));
      const cost = getDraftCost(card);
      const canPick = Boolean(!takenBy && self && currentDrafterId === selfId && canPlayerDraftCard(lobby, self, card).ok);
      return {
        card,
        cost,
        attackPool: getAttackPool(card),
        defensePool: getDefensePool(card),
        takenBy: takenBy?.id ?? null,
        takenByName: takenBy?.name ?? null,
        isAvailable: !takenBy,
        canPick,
        canAfford: Boolean(self && self.draftSpent + cost <= lobby.draft.budget)
      };
    })
  };
}

function shouldRevealSelectedCard(lobby, player, viewerId) {
  if (!player.selected?.cardId) {
    return false;
  }

  return player.id === viewerId || ["plan", "reveal", "ended"].includes(lobby.phase);
}

function shouldRevealPlan(lobby, player, viewerId) {
  if (!hasSubmittedPlan(player)) {
    return false;
  }

  return player.id === viewerId || ["reveal", "ended"].includes(lobby.phase);
}

function pushChat(lobby, entry) {
  lobby.chat.push({
    id: makeId("m", 6),
    createdAt: new Date().toISOString(),
    kind: entry.kind ?? "user",
    playerId: entry.playerId ?? null,
    name: entry.name ?? null,
    text: String(entry.text ?? "").slice(0, 260)
  });

  if (lobby.chat.length > 80) {
    lobby.chat = lobby.chat.slice(-80);
  }
}

function sendError(client, message) {
  send(client, { type: SERVER_EVENTS.ERROR, message });
}

function send(client, payload) {
  if (!client.socket.connected) {
    return;
  }

  client.socket.emit(payload.type, payload);
}

function sanitizeName(name) {
  const trimmed = String(name ?? "").trim().slice(0, 18);
  return trimmed || "Player";
}

function sanitizeChatText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function getMinDraftBudget(draftSize) {
  return draftSize * 2;
}

function getMaxDraftBudget(draftSize) {
  return draftSize * 6;
}

function makeLobbyId() {
  let lobbyId;
  do {
    lobbyId = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (lobbies.has(lobbyId));
  return lobbyId;
}

function makeId(prefix, size) {
  return `${prefix}_${crypto.randomBytes(size).toString("hex")}`;
}

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}
