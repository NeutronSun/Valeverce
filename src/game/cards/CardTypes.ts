import type { EffectTiming } from "../constants/EffectTiming";
import type { RoundIntent } from "../round/RoundIntent";
import type { CardEffect } from "../systems/effects/EffectTypes";
import type { ValerioKey, ValerioMap } from "../../shared/types";

export const CARD_TYPES = {
  ATTACK: "attack",
  UTILITY: "utility",
  TRAP: "trap",
  DEFENSE: "defense"
} as const;

export type CardType = (typeof CARD_TYPES)[keyof typeof CARD_TYPES];

export const CARD_ROLES = CARD_TYPES;

export type CardRole = CardType;

export const TRAP_TRIGGERS = {
  ENEMY_ATTACKS: "enemy_attacks",
  ENEMY_USES_ACTIVE: "enemy_uses_active",
  ENEMY_USES_UTILITY: "enemy_uses_utility",
  ENEMY_DRAWS: "enemy_draws",
  ENEMY_FOCUSES: "enemy_focuses",
  ENEMY_CONTROLS: "enemy_controls"
} as const;

export type TrapTriggerType = (typeof TRAP_TRIGGERS)[keyof typeof TRAP_TRIGGERS];

export type TrapTrigger = {
  type: TrapTriggerType;
  intent?: RoundIntent;
  stat?: ValerioKey;
};

export type CardCombat = {
  attackPower: number;
  defensePower: number;
  draftCost: number;
};

export type Ability = {
  name: string;
  cost?: number;
  timing?: EffectTiming;
  text?: string;
  effect?: CardEffect;
  effects: CardEffect[];
  [key: string]: unknown;
};

export type RawAbility = {
  name?: string;
  cost?: number;
  timing?: EffectTiming;
  text?: string;
  effect?: CardEffect;
  effects?: CardEffect[];
  [key: string]: unknown;
};

export type Card = {
  id: string;
  name: string;
  type?: CardType;
  role?: CardRole;
  image?: string;
  rarity?: string;
  allowedIntents?: RoundIntent[];
  effects?: CardEffect[];
  guardBonus?: number;
  trigger?: TrapTrigger;
  valerio: ValerioMap;
  special?: Partial<Record<ValerioKey, number>>;
  combat: CardCombat;
  active?: Ability;
  passive?: Ability;
  [key: string]: unknown;
};

export type RawCard = {
  id?: string;
  name?: string;
  type?: CardType;
  role?: CardRole;
  image?: string;
  rarity?: string;
  allowedIntents?: RoundIntent[];
  effects?: CardEffect[];
  guardBonus?: number;
  trigger?: TrapTrigger;
  valerio?: Partial<Record<ValerioKey, number>>;
  special?: Partial<Record<ValerioKey, number>>;
  combat?: Partial<CardCombat>;
  active?: RawAbility;
  passive?: RawAbility;
  [key: string]: unknown;
};

export type ValerioPlan = {
  attacks?: Partial<Record<ValerioKey, number>> | null;
  defenses?: Partial<Record<ValerioKey, number>> | null;
  useActive?: boolean | null;
};
