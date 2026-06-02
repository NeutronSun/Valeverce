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
  normalizeCards,
  scoreFightPlan,
  shuffle,
  validateValerioPlan
} from "./game.js";
import { createDraftCardAction } from "./server/actions/createDraftCardAction.js";
import { createPassEffectWindowAction } from "./server/actions/createPassEffectWindowAction.js";
import { createPlayEffectCardAction } from "./server/actions/createPlayEffectCardAction.js";
import { createResolveRoundAction } from "./server/actions/createResolveRoundAction.js";
import { createSelectCardAction } from "./server/actions/createSelectCardAction.js";
import { createSelectUtilityDeckAction } from "./server/actions/createSelectUtilityDeckAction.js";
import { createSubmitPlanAction } from "./server/actions/createSubmitPlanAction.js";
import { EffectApplicator } from "./server/effects/EffectApplicator.js";
import { EffectWindowSystem } from "./server/effects/EffectWindowSystem.js";
import { TrapSystem } from "./server/effects/TrapSystem.js";
import { LobbyManager } from "./server/lobby/LobbyManager.js";
import { LobbySerializer } from "./server/lobby/LobbySerializer.js";
import { LobbyState } from "./server/lobby/LobbyState.js";
import { ClientSession } from "./server/socket/ClientSession.js";
import { TimerController } from "./server/timer/TimerController.js";
import { AuthService } from "./server/auth/AuthService.js";
import { CardCatalogRepository } from "./server/repositories/CardCatalogRepository.js";
import { CLIENT_EVENT_NAMES, CLIENT_EVENTS, SERVER_EVENTS } from "./shared/events.js";
import { PlayerProfile } from "./shared/profile/PlayerProfile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT ?? 3001);
const isDev = process.env.NODE_ENV !== "production";

const VALEVERCE_SETTINGS = Object.freeze({
  startingHealth: 50,
  maxHealth: 50,
  startingMana: 10,
  maxMana: 10,
  roundManaGain: 0,
  startingEnergy: 2,
  maxEnergy: 5,
  handSize: 4,
  energyDeckSize: 3
});

const cardData = JSON.parse(await readFile(path.join(publicDir, "data", "cards.json"), "utf8"));
const cards = readCards(cardData);
const cardsById = new Map(cards.map((card) => [card.id, card]));

const clients = new Map();
const clientsBySocketId = new Map();
const lobbies = new Map();
const profilesByClientId = new Map();
const cardCatalogRepository = new CardCatalogRepository();
let timerController;
let lobbyManager;
let lobbySerializer;
let draftCard;
let selectUtilityDeck;
let selectCard;
let submitPlan;
let resolveRound;
let playEffectCard;
let passEffectWindow;

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
  void handleConnection(socket);
});

void syncCardCatalog();

async function handleConnection(socket) {
  const auth = await resolveSocketAuth(socket);
  const client = new ClientSession(socket, auth?.profile?.username ?? `Player ${clients.size + 1}`, makeId);
  client.accountId = auth?.account?.id ?? null;
  client.profile = PlayerProfile.from(auth?.profile ?? null, client.name).toJSON();
  client.name = client.profile.username;
  clients.set(client.id, client);
  clientsBySocketId.set(socket.id, client);
  profilesByClientId.set(client.id, client.profile);

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
}

server.listen(port, "0.0.0.0", () => {
  console.log("valeverce");
  console.log(`Local:   http://localhost:${port}`);
  for (const address of getLanAddresses()) {
    console.log(`Network: http://${address}:${port}`);
  }
});

timerController = new TimerController();
lobbySerializer = new LobbySerializer({
  SETTINGS,
  VALERIO_LABELS,
  clients,
  lobbies,
  profilesByClientId,
  cardsById,
  getClientLobby,
  getCurrentDrafterId,
  isActiveDuelist,
  hasSubmittedPlan,
  canPlayerDraftCard,
  getAttackPool,
  getDefensePool,
  getDraftCost
});
lobbyManager = new LobbyManager({ clients, lobbies, io, clientsBySocketId, sendState });
const effectApplicator = new EffectApplicator({ SETTINGS, cardsById, shuffle });
const trapSystem = new TrapSystem({ cardsById, effectApplicator, makeId });
const effectWindowSystem = new EffectWindowSystem({
  cardsById,
  effectApplicator,
  trapSystem,
  getAlivePlayers,
  SETTINGS
});
draftCard = createDraftCardAction({
  getClientLobby,
  sendError,
  getCurrentDrafterId,
  cardsById,
  canPlayerDraftCard,
  getDraftCost,
  pushChat,
  finishOrAdvanceDraft
});
selectUtilityDeck = createSelectUtilityDeckAction({
  getClientLobby,
  sendError,
  isActiveDuelist,
  cardsById,
  cardMoveApplicator: effectApplicator.cardMoves,
  broadcastLobbyState
});
selectCard = createSelectCardAction({
  getClientLobby,
  sendError,
  isActiveDuelist,
  cardsById,
  ensureUtilityDeckReady: assignFallbackUtilityDeck,
  advanceRoundIfReady,
  broadcastLobbyState
});
submitPlan = createSubmitPlanAction({
  getClientLobby,
  sendError,
  isActiveDuelist,
  hasSubmittedPlan,
  cardsById,
  normalizePlan,
  validateValerioPlan,
  advanceRoundIfReady,
  broadcastLobbyState
});
resolveRound = createResolveRoundAction({
  getActiveDuelists,
  SETTINGS,
  cardsById,
  scoreFightPlan,
  getAlivePlayers,
  makeRoundSummary,
  clearActionTimer,
  pushChat,
  trapSystem,
  effectWindowSystem
});
playEffectCard = createPlayEffectCardAction({
  getClientLobby,
  sendError,
  effectWindowSystem,
  broadcastLobbyState
});
passEffectWindow = createPassEffectWindowAction({
  getClientLobby,
  sendError,
  effectWindowSystem,
  broadcastLobbyState
});

function readCards(data) {
  const cardsList = Array.isArray(data) ? data : data.cards;
  if (!Array.isArray(cardsList)) {
    throw new Error("public/data/cards.json deve essere un array o un oggetto con cards[]");
  }

  return normalizeCards(cardsList);
}

async function syncCardCatalog() {
  try {
    await cardCatalogRepository.syncCards(cards);
  } catch (error) {
    console.error("Mongo cardCatalog non sincronizzato", error?.message ?? error);
  }
}

async function resolveSocketAuth(socket) {
  try {
    return await AuthService.getAuthSnapshotFromCookieHeader(socket.handshake.headers.cookie);
  } catch (error) {
    console.error("Sessione socket non letta", error?.message ?? error);
    return null;
  }
}

function handleMessage(client, message) {
  const payload = message.payload ?? {};

  switch (message.type) {
    case CLIENT_EVENTS.SET_NAME:
      client.name = sanitizeName(payload.name);
      upsertClientProfile(client, { ...getClientProfile(client), username: client.name });
      updatePlayerName(client);
      broadcastClientScope(client);
      break;
    case CLIENT_EVENTS.UPSERT_PROFILE:
      upsertClientProfile(client, payload.profile ?? payload);
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
    case CLIENT_EVENTS.SELECT_UTILITY_DECK:
      selectUtilityDeck(client, payload);
      break;
    case CLIENT_EVENTS.SELECT_CARD:
      selectCard(client, String(payload.cardId ?? ""));
      break;
    case CLIENT_EVENTS.SUBMIT_PLAN:
      submitPlan(client, payload);
      break;
    case CLIENT_EVENTS.PLAY_EFFECT_CARD:
      playEffectCard(client, payload);
      break;
    case CLIENT_EVENTS.PASS_EFFECT_WINDOW:
      passEffectWindow(client);
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

  const currentTimerSeconds = Number(lobby.settings.pickTimerSeconds ?? SETTINGS.actionSeconds);
  const requestedTimerSeconds = Number(payload.pickTimerSeconds);
  let pickTimerEnabled =
    typeof payload.pickTimerEnabled === "boolean" ? payload.pickTimerEnabled : Boolean(lobby.settings.pickTimerEnabled);
  let pickTimerSeconds = clampInteger(payload.pickTimerSeconds, 0, 60, currentTimerSeconds);
  const draftSize = clampInteger(payload.draftSize, 3, 10, lobby.settings.draftSize ?? SETTINGS.draftSize);
  const draftBudget = clampInteger(
    payload.draftBudget,
    draftSize * 2,
    draftSize * 6,
    lobby.settings.draftBudget ?? SETTINGS.draftBudget
  );

  if (Number.isFinite(requestedTimerSeconds) && requestedTimerSeconds <= 0 && typeof payload.pickTimerEnabled !== "boolean") {
    pickTimerEnabled = false;
  }

  if (pickTimerEnabled && pickTimerSeconds <= 0) {
    pickTimerSeconds = SETTINGS.actionSeconds;
  }

  if (!pickTimerEnabled) {
    pickTimerSeconds = 0;
  }

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
    resetPlayerForGame(player, { preserveDecks: true });
  }

  lobby.round = 0;
  lobby.winnerId = null;
  lobby.lastResult = null;
  lobby.effectWindow = null;
  lobby.progressRecorded = false;
  lobby.activePair = [];
  lobby.pairCursor = 0;
  lobby.playerOrder = lobby.playerOrder.filter((playerId) => lobby.players.has(playerId));

  if ([...lobby.players.values()].every((player) => player.spellDeckReady && player.utilityDeckReady)) {
    for (const player of lobby.players.values()) {
      prepareValeverceDecks(player);
    }
    pushChat(lobby, { kind: "system", text: "Partita avviata con Spell Deck e Energy Deck" });
    startRound(lobby);
    return;
  }

  lobby.draft = {
    pool: shuffle(cards.filter((card) => isSpellDeckCard(card)).map((card) => card.id)),
    taken: [],
    pickIndex: 0,
    order: [...lobby.playerOrder],
    target: getLobbyDraftSize(lobby),
    budget: getLobbyDraftBudget(lobby)
  };
  lobby.phase = "draft";
  scheduleActionTimer(lobby, "draft");
  pushChat(lobby, {
    kind: "system",
    text: `Draft iniziato: ${lobby.draft.target} carte max, budget ${lobby.draft.budget}`
  });
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

  if (lobby.effectWindow?.status === "waiting") {
    effectWindowSystem.forcePassPending(lobby);
    if (lobby.phase === "ended") {
      persistLobbyProgress(lobby);
      broadcastLobbyState(lobby);
      return;
    }
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
  lobby.effectWindow = null;
  lobby.progressRecorded = false;

  for (const player of lobby.players.values()) {
    resetPlayerForGame(player);
  }

  broadcastLobbyState(lobby);
}

function startRound(lobby) {
  const alivePlayers = getAlivePlayers(lobby);
  if (alivePlayers.length < SETTINGS.minPlayers) {
    finishLobby(lobby, alivePlayers[0]?.id ?? null);
    broadcastLobbyState(lobby);
    return;
  }

  tickCooldowns(lobby);
  if (lobby.round > 0) {
    for (const player of lobby.players.values()) {
      prepareNextSpellHand(player);
      player.mana = Math.min(player.maxMana ?? SETTINGS.maxMana, player.mana + VALEVERCE_SETTINGS.roundManaGain);
      player.energyUsedThisRound = false;
      player.activeUsedThisRound = false;
    }
  }

  const activePair = pickActivePair(lobby);
  if (activePair.length < SETTINGS.minPlayers) {
    finishLobby(lobby, alivePlayers[0]?.id ?? null);
    broadcastLobbyState(lobby);
    return;
  }

  lobby.phase = "select";
  lobby.round += 1;
  lobby.activePair = activePair;
  lobby.lastResult = null;
  lobby.effectWindow = null;

  for (const player of lobby.players.values()) {
    player.selected = null;
    player.energyUsedThisRound = false;
    player.activeUsedThisRound = false;
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
      player.selected.intent = null;
      player.selected.energyCardId = null;
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
      finishLobby(lobby, stillAlive[0]?.id ?? null);
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
  profilesByClientId.delete(client.id);
  broadcastAllStates();
}

function updatePlayerName(client) {
  const lobby = getClientLobby(client);
  const player = lobby?.players.get(client.id);
  if (player) {
    player.name = client.name;
    player.profile = getClientProfile(client);
  }
}

function upsertClientProfile(client, profileInput) {
  const profile = PlayerProfile.from(profileInput, client.name).toJSON();
  client.profile = profile;
  client.name = profile.username;
  profilesByClientId.set(client.id, profile);
  updatePlayerProfile(client);
  persistClientProfile(client, profile);
}

function updatePlayerProfile(client) {
  const lobby = getClientLobby(client);
  const player = lobby?.players.get(client.id);
  if (player) {
    player.name = client.name;
    player.profile = getClientProfile(client);
  }
}

function getClientProfile(client) {
  const profile = client.profile ?? profilesByClientId.get(client.id);
  if (profile) {
    return PlayerProfile.from(profile, client.name).toJSON();
  }

  const fallbackProfile = PlayerProfile.from(null, client.name).toJSON();
  client.profile = fallbackProfile;
  profilesByClientId.set(client.id, fallbackProfile);
  return fallbackProfile;
}

function makePlayer(client) {
  return {
    id: client.id,
    accountId: client.accountId,
    name: client.name,
    profile: getClientProfile(client),
    health: SETTINGS.startingHealth,
    maxHealth: SETTINGS.maxHealth,
    mana: SETTINGS.startingMana,
    maxMana: SETTINGS.maxMana,
    energy: 0,
    maxEnergy: VALEVERCE_SETTINGS.maxEnergy,
    deck: [],
    spellDeck: [],
    spellDeckReady: false,
    spellDrawPile: [],
    spellHand: [],
    spellDiscard: [],
    draftSpent: 0,
    cooldowns: {},
    alive: true,
    selected: null,
    utilityDeck: [],
    utilityDeckReady: false,
    utilityDrawPile: [],
    utilityHand: [],
    utilityDiscard: [],
    armedTraps: [],
    energyUsedThisRound: false,
    activeUsedThisRound: false,
    privateEffectLog: []
  };
}

function persistClientProfile(client, profile) {
  if (!client.accountId) {
    return;
  }

  void persistClientProfileAsync(client, profile);
}

async function persistClientProfileAsync(client, profile) {
  try {
    await AuthService.saveProfileForAccountId(client.accountId, profile, client.name);
  } catch (error) {
    console.error("Profilo account non salvato", error?.message ?? error);
  }
}

function resetPlayerForGame(player, options = {}) {
  const preservedSpellDeck = options.preserveDecks ? [...(player.spellDeck?.length ? player.spellDeck : player.deck)] : [];
  const preservedEnergyDeck = options.preserveDecks ? [...(player.utilityDeck ?? [])] : [];
  const hadSpellDeck = options.preserveDecks && Boolean(player.spellDeckReady && preservedSpellDeck.length);
  const hadUtilityDeck = options.preserveDecks && Boolean(player.utilityDeckReady && preservedEnergyDeck.length);

  player.health = hadSpellDeck ? VALEVERCE_SETTINGS.startingHealth : SETTINGS.startingHealth;
  player.maxHealth = hadSpellDeck ? VALEVERCE_SETTINGS.maxHealth : SETTINGS.maxHealth;
  player.mana = hadSpellDeck ? VALEVERCE_SETTINGS.startingMana : SETTINGS.startingMana;
  player.maxMana = hadSpellDeck ? VALEVERCE_SETTINGS.maxMana : SETTINGS.maxMana;
  player.energy = hadSpellDeck ? VALEVERCE_SETTINGS.startingEnergy : 0;
  player.maxEnergy = VALEVERCE_SETTINGS.maxEnergy;
  player.deck = hadSpellDeck ? [...preservedSpellDeck] : [];
  player.spellDeck = hadSpellDeck ? preservedSpellDeck : [];
  player.spellDeckReady = hadSpellDeck;
  player.spellDrawPile = [];
  player.spellHand = [];
  player.spellDiscard = [];
  player.draftSpent = 0;
  player.cooldowns = {};
  player.alive = true;
  player.selected = null;
  player.utilityDeck = hadUtilityDeck ? preservedEnergyDeck : [];
  player.utilityDeckReady = hadUtilityDeck;
  player.utilityDrawPile = [];
  player.utilityHand = hadUtilityDeck ? [...preservedEnergyDeck] : [];
  player.utilityDiscard = [];
  player.armedTraps = [];
  player.energyUsedThisRound = false;
  player.activeUsedThisRound = false;
  player.privateEffectLog = [];
}

function finishLobby(lobby, winnerId) {
  lobby.phase = "ended";
  lobby.winnerId = winnerId;
  clearActionTimer(lobby);
  persistLobbyProgress(lobby);
}

function persistLobbyProgress(lobby) {
  if (lobby.progressRecorded) {
    return;
  }

  lobby.progressRecorded = true;
  void persistLobbyProgressAsync(lobby);
}

async function persistLobbyProgressAsync(lobby) {
  try {
    const isTie = !lobby.winnerId;
    for (const player of lobby.players.values()) {
      if (player.accountId) {
        await AuthService.recordGameFinishedForAccount(player.accountId, {
          won: Boolean(lobby.winnerId && player.id === lobby.winnerId),
          tied: isTie
        });
      }
    }
  } catch (error) {
    console.error("Progressi lobby non salvati", error?.message ?? error);
  }
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
    player.draftSpent >= getLobbyDraftBudget(lobby) ||
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
  if (player.draftSpent + cost > getLobbyDraftBudget(lobby)) {
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

  const actionSeconds = getLobbyActionSeconds(lobby);
  if (!actionSeconds) {
    return;
  }

  timerController.schedule(lobby, phase, actionSeconds * 1000, (deadlineAt) => {
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
      if (!player.utilityDeckReady) {
        assignFallbackUtilityDeck(player);
        pushChat(lobby, {
          kind: "system",
          text: `Timer scaduto: ${player.name} riceve un deck utility automatico`
        });
      }

      const cardId = findSelectableCardId(player);
      if (cardId) {
        player.selected = {
          cardId,
          attacks: null,
          defenses: null,
          useActive: null,
          intent: null,
          energyCardId: null
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

function assignFallbackUtilityDeck(player) {
  const fallbackDeck = shuffle(cards.filter((card) => isEnergyDeckCard(card)).map((card) => card.id)).slice(
    0,
    VALEVERCE_SETTINGS.energyDeckSize
  );
  player.utilityDeck = fallbackDeck;
  player.utilityDrawPile = [...fallbackDeck];
  player.utilityHand = [...fallbackDeck];
  player.utilityDiscard = [];
  player.utilityDeckReady = true;
}

function findSelectableCardId(player) {
  return player.deck.find((cardId) => Number(player.cooldowns[cardId] ?? 0) <= 0 && cardsById.has(cardId));
}

function prepareValeverceDecks(player) {
  player.spellDrawPile = shuffle(player.spellDeck);
  player.spellHand = [];
  player.spellDiscard = [];
  drawSpellCards(player, VALEVERCE_SETTINGS.handSize);
  syncSpellHand(player);
  player.utilityDrawPile = [...player.utilityDeck];
  player.utilityHand = [...player.utilityDeck];
  player.utilityDiscard = [];
}

function prepareNextSpellHand(player) {
  if (player.selected?.cardId) {
    removeCardId(player.spellHand, player.selected.cardId);
    player.spellDiscard.push(player.selected.cardId);
  }

  drawSpellCards(player, Math.max(0, VALEVERCE_SETTINGS.handSize - player.spellHand.length));
  syncSpellHand(player);
}

function drawSpellCards(player, count) {
  for (let index = 0; index < count; index += 1) {
    if (!player.spellDrawPile.length) {
      break;
    }

    const cardId = player.spellDrawPile.shift();
    if (cardId) {
      player.spellHand.push(cardId);
    }
  }
}

function syncSpellHand(player) {
  player.deck = [...(player.spellHand ?? [])];
}

function removeCardId(cardIds, cardId) {
  const index = cardIds.indexOf(cardId);
  if (index >= 0) {
    cardIds.splice(index, 1);
  }
}

function isSpellDeckCard(card) {
  if (card?.deckType) {
    return card.deckType === "spell";
  }

  return ["attack", "defense"].includes(card?.type) && card?.usesCombat !== false;
}

function isEnergyDeckCard(card) {
  if (card?.deckType) {
    return card.deckType === "energy";
  }

  return ["utility", "trap"].includes(card?.type) && Number.isInteger(card?.energyCost);
}

function getLobbyActionSeconds(lobby) {
  if (!lobby.settings?.pickTimerEnabled) {
    return 0;
  }

  return Math.max(0, Number(lobby.settings.pickTimerSeconds ?? SETTINGS.actionSeconds));
}

function getLobbyDraftSize(lobby) {
  return Math.max(1, Number(lobby.settings?.draftSize ?? SETTINGS.draftSize));
}

function getLobbyDraftBudget(lobby) {
  return Math.max(0, Number(lobby.draft?.budget ?? lobby.settings?.draftBudget ?? SETTINGS.draftBudget));
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
      player.selected?.useActive !== undefined &&
      player.selected?.intent
  );
}

function normalizePlan(payload) {
  return {
    intent: normalizeIntent(payload.intent),
    attacks: normalizeDistribution(payload.attacks),
    defenses: normalizeDistribution(payload.defenses),
    useActive: Boolean(payload.useActive),
    energyCardId: payload.energyCardId ? String(payload.energyCardId) : null
  };
}

function normalizeIntent(intent) {
  const value = String(intent ?? "attack").toLowerCase();
  return ["attack", "defense", "focus"].includes(value) ? value : "attack";
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
  send(client, lobbySerializer.serializeState(client));
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
  const nextValue = Number.isFinite(number) ? number : Number(fallback);
  const safeValue = Number.isFinite(nextValue) ? nextValue : min;
  return Math.max(min, Math.min(max, Math.round(safeValue)));
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
