import type { ValerioKey } from "../../../shared/types";

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
  | ContainsStatEffectData;

export type UnknownCardEffect = {
  type: string;
  [key: string]: unknown;
};

export type CardEffect = KnownCardEffect | UnknownCardEffect;

