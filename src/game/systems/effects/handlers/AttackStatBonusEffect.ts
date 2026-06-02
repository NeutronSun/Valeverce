import type { EffectContext } from "../EffectContext";
import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { AttackStatBonusEffectData } from "../EffectTypes";

export class AttackStatBonusEffect implements EffectHandler<AttackStatBonusEffectData> {
  readonly type = "attack-stat-bonus";

  resolve(effect: AttackStatBonusEffectData, context: EffectContext): EffectResult {
    const selectedAttack = context.selfPlan?.attacks?.[effect.stat];

    if (!selectedAttack) {
      return EffectResultFactory.empty();
    }

    return {
      ...EffectResultFactory.empty(),
      applied: true,
      breachBonus: effect.value,
      attackBonuses: {
        [effect.stat]: effect.value
      },
      notes: [`+${effect.value} Breccia su ${effect.stat}`]
    };
  }
}
