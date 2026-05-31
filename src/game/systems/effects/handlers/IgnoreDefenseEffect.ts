import type { EffectContext } from "../EffectContext";
import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { IgnoreDefenseEffectData } from "../EffectTypes";
import type { ValerioKey } from "../../../../shared/types";

export class IgnoreDefenseEffect implements EffectHandler<IgnoreDefenseEffectData> {
  readonly type = "ignore-defense";

  resolve(effect: IgnoreDefenseEffectData, context: EffectContext): EffectResult {
    const ignoredDefenseStats = this.getIgnoredDefenseStats(effect, context);

    return {
      ...EffectResultFactory.empty(),
      applied: ignoredDefenseStats.length > 0,
      ignoredDefenseStats,
      notes: ignoredDefenseStats.length ? ["Ignora difese selezionate"] : []
    };
  }

  private getIgnoredDefenseStats(effect: IgnoreDefenseEffectData, context: EffectContext): ValerioKey[] {
    if (effect.stats?.length) {
      return effect.stats;
    }

    const attacks = context.selfPlan?.attacks ?? {};
    const enemyDefenses = context.enemyPlan?.defenses ?? {};

    if (effect.stat && Object.hasOwn(attacks, effect.stat)) {
      return [effect.stat];
    }

    const count = Number(effect.count ?? 0);
    if (count <= 0) {
      return [];
    }

    return (Object.keys(attacks) as ValerioKey[])
      .sort((left, right) => Number(enemyDefenses[right] ?? 0) - Number(enemyDefenses[left] ?? 0))
      .slice(0, count);
  }
}

