import { EFFECT_TIMINGS } from "../../constants/EffectTiming";
import type { Card } from "../../cards/CardTypes";
import type { EffectContext } from "./EffectContext";
import { EffectResultFactory, type EffectResult } from "./EffectResult";
import type { EffectResolver } from "./EffectResolver";

export class CardEffectResolver {
  private readonly effectResolver: EffectResolver;

  constructor(effectResolver: EffectResolver) {
    this.effectResolver = effectResolver;
  }

  resolveCardEffects(input: {
    card: Card;
    context: EffectContext;
    useActive: boolean;
  }): EffectResult {
    const passive = this.effectResolver.resolveMany(input.card.passive?.effects ?? [], {
      ...input.context,
      timing: EFFECT_TIMINGS.ALWAYS
    });

    const active = input.useActive
      ? this.effectResolver.resolveMany(input.card.active?.effects ?? [], {
          ...input.context,
          timing: EFFECT_TIMINGS.BEFORE_FIGHT
        })
      : EffectResultFactory.empty();

    return EffectResultFactory.merge([passive, active]);
  }
}

