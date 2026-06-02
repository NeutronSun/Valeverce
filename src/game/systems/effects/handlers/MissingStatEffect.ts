import type { EffectContext } from "../EffectContext";
import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { MissingStatEffectData } from "../EffectTypes";

export class MissingStatEffect implements EffectHandler<MissingStatEffectData> {
  readonly type = "missing";

  resolve(effect: MissingStatEffectData, context: EffectContext): EffectResult {
    const selectedAttack = context.selfPlan?.attacks?.[effect.stat];
    const selectedDefense = context.selfPlan?.defenses?.[effect.stat];

    if (selectedAttack || selectedDefense) {
      return EffectResultFactory.empty();
    }

    return {
      ...EffectResultFactory.empty(),
      applied: true,
      breachBonus: effect.value,
      notes: [`+${effect.value} senza ${effect.stat}`]
    };
  }
}
