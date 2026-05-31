import type { GameRules } from "../../rules/GameRules";
import type { Card, ValerioPlan } from "../../cards/CardTypes";
import type { EffectTiming } from "../../constants/EffectTiming";
import type { ValerioKey } from "../../../shared/types";

export type PlayerState = {
  id: string;
  name?: string;
  health?: number;
  mana?: number;
  deck?: Card[];
  cooldowns?: Record<string, number>;
  selected?: ValerioPlan | null;
  [key: string]: unknown;
};

export type GameState = {
  phase?: string;
  round?: number;
  players?: PlayerState[];
  [key: string]: unknown;
};

export type EffectContext = {
  timing: EffectTiming;
  self: PlayerState;
  enemy: PlayerState;
  selfCard?: Card;
  enemyCard?: Card;
  selfPlan?: ValerioPlan;
  enemyPlan?: ValerioPlan;
  rules: GameRules;
  state: GameState;
  targetCardId?: string;
  targetPlayerId?: string;
  targetStat?: ValerioKey;
};

