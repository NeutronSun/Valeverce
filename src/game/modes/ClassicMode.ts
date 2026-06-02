import { GAME_PHASES, type GamePhase } from "../core/GamePhase";
import type { GameMode } from "../core/GameMode";
import type { GameSystem } from "../core/GameSystem";
import { DEFAULT_RULES } from "../rules/defaultRules";
import type { GameRuleOverrides, GameRules } from "../rules/GameRules";
import { createRules } from "../rules/createRules";

export interface ClassicModeState {
  readonly phase?: GamePhase;
}

export interface ClassicModeOptions<TState extends ClassicModeState = ClassicModeState> {
  readonly rules?: GameRuleOverrides;
  readonly systems?: Partial<Record<GamePhase, GameSystem<TState>>>;
}

export class ClassicMode<TState extends ClassicModeState = ClassicModeState> implements GameMode<TState> {
  static readonly ID = "classic";

  readonly id = ClassicMode.ID;
  readonly rules: Readonly<GameRules>;
  readonly systems: Readonly<Partial<Record<GamePhase, GameSystem<TState>>>>;

  static create<TState extends ClassicModeState = ClassicModeState>(
    options: ClassicModeOptions<TState> = {}
  ): ClassicMode<TState> {
    return new ClassicMode(options);
  }

  constructor(options: ClassicModeOptions<TState> = {}) {
    this.rules = options.rules ? createRules(options.rules) : DEFAULT_RULES;
    this.systems = Object.freeze({ ...(options.systems ?? {}) });
  }

  getPhase(state: TState): GamePhase {
    return state.phase ?? GAME_PHASES.LOBBY;
  }
}
