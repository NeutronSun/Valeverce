export const GAME_PHASES = Object.freeze({
  LOBBY: "lobby",
  DRAFT: "draft",
  SELECT: "select",
  PLAN: "plan",
  REVEAL: "reveal",
  ENDED: "ended"
});

export const GAME_PHASE_NAMES = Object.freeze(Object.values(GAME_PHASES));
