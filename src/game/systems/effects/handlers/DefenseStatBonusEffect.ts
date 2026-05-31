import type { EffectContext } from "../EffectContext";
import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { DefenseStatBonusEffectData } from "../EffectTypes";

export class DefenseStatBonusEffect implements EffectHandler<DefenseStatBonusEffectData> {
  readonly type = "defense-stat-bonus";

  resolve(effect: DefenseStatBonusEffectData, context: EffectContext): EffectResult {
    const selectedDefense = context.selfPlan?.defenses?.[effect.stat];

    if (!selectedDefense) {
      return EffectResultFactory.empty();
    }

    return {
      ...EffectResultFactory.empty(),
      applied: true,
      defenseBonuses: {
        [effect.stat]: effect.value
      },
      notes: [`+${effect.value} difesa su ${effect.stat}`]
    };
  }
}

