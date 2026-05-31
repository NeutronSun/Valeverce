import { BreakCapEffect } from "./handlers/BreakCapEffect";
import { DamageEffect } from "./handlers/DamageEffect";
import { IgnoreDefenseEffect } from "./handlers/IgnoreDefenseEffect";
import { ScoreLegacyEffect } from "./handlers/ScoreLegacyEffect";
import { AttackStatBonusEffect } from "./handlers/AttackStatBonusEffect";
import { DefenseStatBonusEffect } from "./handlers/DefenseStatBonusEffect";
import { FlatDamageEffect } from "./handlers/FlatDamageEffect";
import { DefenseHitBonusEffect } from "./handlers/DefenseHitBonusEffect";
import { MissingStatEffect } from "./handlers/MissingStatEffect";
import { ContainsStatEffect } from "./handlers/ContainsStatEffect";
import { EffectRegistry } from "./EffectRegistry";
import { EffectResolver } from "./EffectResolver";

export function createDefaultEffectResolver(): EffectResolver {
  const registry = new EffectRegistry();
  const breakCapEffect = new BreakCapEffect();
  const ignoreDefenseEffect = new IgnoreDefenseEffect();

  registry.register(new DamageEffect());
  registry.register(breakCapEffect);
  registry.register(ignoreDefenseEffect);
  registry.register(new ScoreLegacyEffect());
  registry.register(new AttackStatBonusEffect());
  registry.register(new DefenseStatBonusEffect());
  registry.register(new FlatDamageEffect());
  registry.register(new DefenseHitBonusEffect());
  registry.register(new MissingStatEffect());
  registry.register(new ContainsStatEffect());
  registry.registerAlias("highest-selected", breakCapEffect);
  registry.registerAlias("selected-stat", ignoreDefenseEffect);

  return new EffectResolver(registry);
}
