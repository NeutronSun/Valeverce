export const CLIENT_EVENTS = Object.freeze({
  SET_NAME: "setName",
  CREATE_LOBBY: "createLobby",
  JOIN_LOBBY: "joinLobby",
  LEAVE_LOBBY: "leaveLobby",
  START_GAME: "startGame",
  DRAFT_CARD: "draftCard",
  SELECT_CARD: "selectCard",
  SUBMIT_PLAN: "submitPlan",
  NEXT_ROUND: "nextRound",
  RESTART_LOBBY: "restartLobby",
  SEND_CHAT: "sendChat",
  LATENCY_PROBE: "latencyProbe"
});

export const SERVER_EVENTS = Object.freeze({
  HELLO: "hello",
  STATE: "state",
  ERROR: "error",
  LOBBY_LIST: "lobbyList"
});

export const CLIENT_EVENT_NAMES = Object.freeze(Object.values(CLIENT_EVENTS));
export const SERVER_EVENT_NAMES = Object.freeze(Object.values(SERVER_EVENTS));
