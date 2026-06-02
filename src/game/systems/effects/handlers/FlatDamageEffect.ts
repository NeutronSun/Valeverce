import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { FlatDamageEffectData } from "../EffectTypes";

export class FlatDamageEffect implements EffectHandler<FlatDamageEffectData> {
  readonly type = "flat-damage";

  resolve(effect: FlatDamageEffectData): EffectResult {
    return {
      ...EffectResultFactory.empty(),
      applied: effect.value !== 0,
      breachBonus: effect.value,
      notes: [`+${effect.value} Breccia`]
    };
  }
}
