import type { GamePhase as SharedGamePhase } from "../../shared/types";

export type GamePhase = SharedGamePhase;

export const GAME_PHASES = Object.freeze({
  LOBBY: "lobby",
  DRAFT: "draft",
  SELECT: "select",
  PLAN: "plan",
  REVEAL: "reveal",
  ENDED: "ended"
} as const satisfies Record<string, GamePhase>);

export const GAME_PHASE_NAMES = Object.freeze(Object.values(GAME_PHASES)) as readonly GamePhase[];
