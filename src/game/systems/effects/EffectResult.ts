import type { ValerioKey } from "../../../shared/types";
import type { CardMoveRequest } from "./EffectTypes";

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
  healAmount: number;
  manaBonus: number;
  drawAmount: number;
  cooldownReduction: number;
  cardMoves: CardMoveRequest[];
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
      healAmount: 0,
      manaBonus: 0,
      drawAmount: 0,
      cooldownReduction: 0,
      cardMoves: [],
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
      healAmount: merged.healAmount + result.healAmount,
      manaBonus: merged.manaBonus + result.manaBonus,
      drawAmount: merged.drawAmount + result.drawAmount,
      cooldownReduction: merged.cooldownReduction + result.cooldownReduction,
      cardMoves: [...merged.cardMoves, ...result.cardMoves],
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
