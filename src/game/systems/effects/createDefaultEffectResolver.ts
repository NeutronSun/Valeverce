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
import { HealEffect } from "./handlers/HealEffect";
import { ManaBonusEffect } from "./handlers/ManaBonusEffect";
import { DrawCardsEffect } from "./handlers/DrawCardsEffect";
import { SwapDeckEffect } from "./handlers/SwapDeckEffect";
import { SwapCardEffect } from "./handlers/SwapCardEffect";
import { SwapCardFromDeckEffect } from "./handlers/SwapCardFromDeckEffect";
import { SwapSelectedCardEffect } from "./handlers/SwapSelectedCardEffect";
import { StealCardEffect } from "./handlers/StealCardEffect";
import { EffectRegistry } from "./EffectRegistry";
import { EffectResolver } from "./EffectResolver";

export function createDefaultEffectResolver(): EffectResolver {
  const registry = new EffectRegistry();
  const breakCapEffect = new BreakCapEffect();
  const ignoreDefenseEffect = new IgnoreDefenseEffect();
  const manaBonusEffect = new ManaBonusEffect();
  const drawCardsEffect = new DrawCardsEffect();

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
  registry.register(new HealEffect());
  registry.register(manaBonusEffect);
  registry.register(drawCardsEffect);
  registry.register(new SwapDeckEffect());
  registry.register(new SwapCardEffect());
  registry.register(new SwapCardFromDeckEffect());
  registry.register(new SwapSelectedCardEffect());
  registry.register(new StealCardEffect());
  registry.registerAlias("highest-selected", breakCapEffect);
  registry.registerAlias("selected-stat", ignoreDefenseEffect);
  registry.registerAlias("mana-bonus", manaBonusEffect);
  registry.registerAlias("draw-cards", drawCardsEffect);

  return new EffectResolver(registry);
}
