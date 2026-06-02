import type { ValerioKey } from "../../../shared/types";

export type EffectTarget = "self" | "enemy" | "chosen_card";

export type CardZone = "deck" | "hand" | "selected" | "discard";

export type CardSelection = "random_hand" | "random_deck" | "chosen_hand" | "chosen_deck" | "selected_card";

export type CardMoveRequest = {
  kind: "draw_cards" | "swap_deck" | "swap_card" | "swap_card_from_deck" | "swap_selected_card" | "steal_card";
  target?: EffectTarget;
  value?: number;
  source?: CardZone;
  destination?: CardZone;
  selection?: CardSelection;
  targetCardId?: string;
};

export type BaseCardEffect = {
  type: string;
};

export type DamageEffectData = {
  type: "damage";
  value: number;
};

export type BreakCapEffectData = {
  type: "break-cap";
};

export type IgnoreDefenseEffectData = {
  type: "ignore-defense";
  stats?: ValerioKey[];
  stat?: ValerioKey;
  count?: number;
};

export type ScoreLegacyEffectData = {
  type: "score";
  value?: number;
};

export type AttackStatBonusEffectData = {
  type: "attack-stat-bonus";
  stat: ValerioKey;
  value: number;
};

export type DefenseStatBonusEffectData = {
  type: "defense-stat-bonus";
  stat: ValerioKey;
  value: number;
};

export type FlatDamageEffectData = {
  type: "flat-damage";
  value: number;
};

export type DefenseHitBonusEffectData = {
  type: "defense-hit-bonus";
  count?: number;
  value: number;
};

export type MissingStatEffectData = {
  type: "missing";
  stat: ValerioKey;
  value: number;
};

export type ContainsStatEffectData = {
  type: "contains";
  stat: ValerioKey;
  value: number;
};

export type HealEffectData = {
  type: "heal";
  target?: EffectTarget;
  value: number;
};

export type ManaBonusEffectData = {
  type: "mana_bonus";
  target?: EffectTarget;
  value: number;
};

export type DrawCardsEffectData = {
  type: "draw_cards";
  target?: EffectTarget;
  value: number;
  source?: CardZone;
};

export type SwapDeckEffectData = {
  type: "swap_deck";
  target?: EffectTarget;
};

export type SwapCardEffectData = {
  type: "swap_card";
  target?: EffectTarget;
  source?: CardZone;
  destination?: CardZone;
  selection?: CardSelection;
  targetCardId?: string;
};

export type SwapCardFromDeckEffectData = {
  type: "swap_card_from_deck";
  target?: EffectTarget;
  selection?: "random_deck" | "chosen_deck";
  targetCardId?: string;
};

export type SwapSelectedCardEffectData = {
  type: "swap_selected_card";
  target?: EffectTarget;
  selection?: CardSelection;
  targetCardId?: string;
};

export type StealCardEffectData = {
  type: "steal_card";
  target?: "enemy";
  selection?: "random_hand" | "chosen_hand" | "random_deck" | "chosen_deck";
  targetCardId?: string;
};

export type KnownCardEffect =
  | DamageEffectData
  | BreakCapEffectData
  | IgnoreDefenseEffectData
  | ScoreLegacyEffectData
  | AttackStatBonusEffectData
  | DefenseStatBonusEffectData
  | FlatDamageEffectData
  | DefenseHitBonusEffectData
  | MissingStatEffectData
  | ContainsStatEffectData
  | HealEffectData
  | ManaBonusEffectData
  | DrawCardsEffectData
  | SwapDeckEffectData
  | SwapCardEffectData
  | SwapCardFromDeckEffectData
  | SwapSelectedCardEffectData
  | StealCardEffectData;

export type UnknownCardEffect = {
  type: string;
  [key: string]: unknown;
};

export type CardEffect = KnownCardEffect | UnknownCardEffect;
