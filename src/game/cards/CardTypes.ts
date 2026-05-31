import type { EffectTiming } from "../constants/EffectTiming";
import type { CardEffect } from "../systems/effects/EffectTypes";
import type { ValerioKey, ValerioMap } from "../../shared/types";

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
  image?: string;
  rarity?: string;
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
  image?: string;
  rarity?: string;
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

