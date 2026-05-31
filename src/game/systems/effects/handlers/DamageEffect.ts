import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { DamageEffectData } from "../EffectTypes";

export class DamageEffect implements EffectHandler<DamageEffectData> {
  readonly type = "damage";

  resolve(effect: DamageEffectData): EffectResult {
    return {
      ...EffectResultFactory.empty(),
      applied: true,
      damageBonus: effect.value,
      notes: [`+${effect.value} danni`]
    };
  }
}

