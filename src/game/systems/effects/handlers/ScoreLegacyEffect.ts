import { EFFECT_TIMINGS } from "../../../constants/EffectTiming";
import type { EffectContext } from "../EffectContext";
import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { ScoreLegacyEffectData } from "../EffectTypes";

export class ScoreLegacyEffect implements EffectHandler<ScoreLegacyEffectData> {
  readonly type = "score";

  resolve(effect: ScoreLegacyEffectData, context: EffectContext): EffectResult {
    const value = Number(effect.value ?? 0);

    if (!value) {
      return EffectResultFactory.empty();
    }

    if (context.timing === EFFECT_TIMINGS.BEFORE_FIGHT) {
      return {
        ...EffectResultFactory.empty(),
        applied: true,
        damageBonus: value,
        notes: [`+${value} danni oltre cap`]
      };
    }

    return {
      ...EffectResultFactory.empty(),
      applied: true,
      breachBonus: value,
      notes: [`+${value} Breccia`]
    };
  }
}
