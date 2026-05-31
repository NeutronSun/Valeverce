import type { EffectContext } from "../EffectContext";
import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { DefenseHitBonusEffectData } from "../EffectTypes";
import type { ValerioKey } from "../../../../shared/types";

export class DefenseHitBonusEffect implements EffectHandler<DefenseHitBonusEffectData> {
  readonly type = "defense-hit-bonus";

  resolve(effect: DefenseHitBonusEffectData, context: EffectContext): EffectResult {
    const enemyAttacks = context.enemyPlan?.attacks ?? {};
    const selfDefenses = context.selfPlan?.defenses ?? {};
    const requiredHits = Number(effect.count ?? 0);
    const hits = (Object.keys(selfDefenses) as ValerioKey[]).filter((stat) => {
      return Object.hasOwn(enemyAttacks, stat);
    }).length;

    if (hits < requiredHits) {
      return EffectResultFactory.empty();
    }

    return {
      ...EffectResultFactory.empty(),
      applied: true,
      breachBonus: effect.value,
      notes: [`+${effect.value} Breccia, ${hits} difese colpite`]
    };
  }
}
