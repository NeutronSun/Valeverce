import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { HealEffectData } from "../EffectTypes";

export class HealEffect implements EffectHandler<HealEffectData> {
  readonly type = "heal";

  resolve(effect: HealEffectData): EffectResult {
    const healAmount = Math.max(0, effect.value);

    return {
      ...EffectResultFactory.empty(),
      applied: healAmount > 0,
      healAmount,
      notes: healAmount > 0 ? [`+${healAmount} PV`] : []
    };
  }
}
