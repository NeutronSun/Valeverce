import type { GameAction } from "./GameAction";
import type { GamePhase } from "./GamePhase";

export interface GameSystem<TState = unknown> {
  readonly phase: GamePhase;
  handle(state: TState, action: GameAction): TState;
}
