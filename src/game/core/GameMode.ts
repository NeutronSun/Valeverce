import type { GameRules } from "../rules/GameRules";
import type { GamePhase } from "./GamePhase";
import type { GameSystem } from "./GameSystem";

export interface GameMode<TState = unknown> {
  readonly id: string;
  readonly rules: Readonly<GameRules>;
  readonly systems: Readonly<Partial<Record<GamePhase, GameSystem<TState>>>>;
  getPhase(state: TState): GamePhase;
}
