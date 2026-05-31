import type { ValerioKey } from "../../../shared/types";

export type EffectResult = {
  applied: boolean;
  breachBonus: number;
  damageBonus: number;
  damageMultiplier: number;
  attackBonuses: Partial<Record<ValerioKey, number>>;
  attackMultipliers: Partial<Record<ValerioKey, number>>;
  defenseBonuses: Partial<Record<ValerioKey, number>>;
  defenseMultipliers: Partial<Record<ValerioKey, number>>;
  ignoredDefenseStats: ValerioKey[];
  breakDamageCap: boolean;
  manaBonus: number;
  cooldownReduction: number;
  notes: string[];
};

export class EffectResultFactory {
  static empty(): EffectResult {
    return {
      applied: false,
      breachBonus: 0,
      damageBonus: 0,
      damageMultiplier: 1,
      attackBonuses: {},
      attackMultipliers: {},
      defenseBonuses: {},
      defenseMultipliers: {},
      ignoredDefenseStats: [],
      breakDamageCap: false,
      manaBonus: 0,
      cooldownReduction: 0,
      notes: []
    };
  }

  static merge(results: EffectResult[]): EffectResult {
    return results.reduce((merged, result) => ({
      applied: merged.applied || result.applied,
      breachBonus: merged.breachBonus + result.breachBonus,
      damageBonus: merged.damageBonus + result.damageBonus,
      damageMultiplier: merged.damageMultiplier * result.damageMultiplier,
      attackBonuses: EffectResultFactory.mergeStatNumbers(merged.attackBonuses, result.attackBonuses),
      attackMultipliers: EffectResultFactory.mergeStatMultipliers(merged.attackMultipliers, result.attackMultipliers),
      defenseBonuses: EffectResultFactory.mergeStatNumbers(merged.defenseBonuses, result.defenseBonuses),
      defenseMultipliers: EffectResultFactory.mergeStatMultipliers(merged.defenseMultipliers, result.defenseMultipliers),
      ignoredDefenseStats: [...new Set([...merged.ignoredDefenseStats, ...result.ignoredDefenseStats])],
      breakDamageCap: merged.breakDamageCap || result.breakDamageCap,
      manaBonus: merged.manaBonus + result.manaBonus,
      cooldownReduction: merged.cooldownReduction + result.cooldownReduction,
      notes: [...merged.notes, ...result.notes]
    }), EffectResultFactory.empty());
  }

  private static mergeStatNumbers(
    left: Partial<Record<ValerioKey, number>>,
    right: Partial<Record<ValerioKey, number>>
  ): Partial<Record<ValerioKey, number>> {
    const merged = { ...left };

    for (const key of Object.keys(right) as ValerioKey[]) {
      merged[key] = (merged[key] ?? 0) + (right[key] ?? 0);
    }

    return merged;
  }

  private static mergeStatMultipliers(
    left: Partial<Record<ValerioKey, number>>,
    right: Partial<Record<ValerioKey, number>>
  ): Partial<Record<ValerioKey, number>> {
    const merged = { ...left };

    for (const key of Object.keys(right) as ValerioKey[]) {
      merged[key] = (merged[key] ?? 1) * (right[key] ?? 1);
    }

    return merged;
  }
}

