import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { ManaBonusEffectData } from "../EffectTypes";

export class ManaBonusEffect implements EffectHandler<ManaBonusEffectData> {
  readonly type = "mana_bonus";

  resolve(effect: ManaBonusEffectData): EffectResult {
    const manaBonus = Math.max(0, effect.value);

    return {
      ...EffectResultFactory.empty(),
      applied: manaBonus > 0,
      manaBonus,
      notes: manaBonus > 0 ? [`+${manaBonus} mana`] : []
    };
  }
}
