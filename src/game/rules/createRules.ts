import { DEFAULT_RULES } from "./defaultRules";
import type { GameRuleOverrides, GameRules } from "./GameRules";

export function createRules(overrides: GameRuleOverrides = {}): Readonly<GameRules> {
  return Object.freeze({
    ...DEFAULT_RULES,
    ...overrides
  });
}
