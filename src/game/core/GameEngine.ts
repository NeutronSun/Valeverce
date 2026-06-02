import type { GameAction } from "./GameAction";
import type { GameMode } from "./GameMode";

export class GameEngine<TState = unknown> {
  readonly mode: GameMode<TState>;

  constructor(mode: GameMode<TState>) {
    this.mode = mode;
  }

  execute(state: TState, action: GameAction): TState {
    const phase = this.mode.getPhase(state);
    const system = this.mode.systems[phase];
    if (!system) {
      throw new Error(`No game system registered for phase ${phase}`);
    }
    return system.handle(state, action);
  }
}
