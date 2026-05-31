import type { EffectContext } from "../EffectContext";
import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { ContainsStatEffectData } from "../EffectTypes";

export class ContainsStatEffect implements EffectHandler<ContainsStatEffectData> {
  readonly type = "contains";

  resolve(effect: ContainsStatEffectData, context: EffectContext): EffectResult {
    const selectedAttack = context.selfPlan?.attacks?.[effect.stat];
    const selectedDefense = context.selfPlan?.defenses?.[effect.stat];

    if (!selectedAttack && !selectedDefense) {
      return EffectResultFactory.empty();
    }

    return {
      ...EffectResultFactory.empty(),
      applied: true,
      breachBonus: effect.value,
      notes: [`+${effect.value} per ${effect.stat}`]
    };
  }
}
