import type { ClientEventPayloads, ServerEventPayloads } from "./types";

const CLIENT_EVENTS_DATA = {
  SET_NAME: "setName",
  UPSERT_PROFILE: "upsertProfile",
  CREATE_LOBBY: "createLobby",
  JOIN_LOBBY: "joinLobby",
  LEAVE_LOBBY: "leaveLobby",
  UPDATE_LOBBY_SETTINGS: "updateLobbySettings",
  START_GAME: "startGame",
  DRAFT_CARD: "draftCard",
  SELECT_UTILITY_DECK: "selectUtilityDeck",
  SELECT_CARD: "selectCard",
  SUBMIT_PLAN: "submitPlan",
  PLAY_EFFECT_CARD: "playEffectCard",
  PASS_EFFECT_WINDOW: "passEffectWindow",
  NEXT_ROUND: "nextRound",
  RESTART_LOBBY: "restartLobby",
  SEND_CHAT: "sendChat",
  LATENCY_PROBE: "latencyProbe"
} as const satisfies Record<string, keyof ClientEventPayloads>;

const SERVER_EVENTS_DATA = {
  HELLO: "hello",
  STATE: "state",
  ERROR: "error",
  LOBBY_LIST: "lobbyList"
} as const satisfies Record<string, keyof ServerEventPayloads>;

export const CLIENT_EVENTS = Object.freeze(CLIENT_EVENTS_DATA);
export const SERVER_EVENTS = Object.freeze(SERVER_EVENTS_DATA);

export type ClientEventName = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];
export type ServerEventName = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];

export const CLIENT_EVENT_NAMES = Object.freeze(Object.values(CLIENT_EVENTS)) as readonly ClientEventName[];
export const SERVER_EVENT_NAMES = Object.freeze(Object.values(SERVER_EVENTS)) as readonly ServerEventName[];
