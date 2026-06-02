import type { EffectContext } from "./EffectContext";
import { EffectResultFactory, type EffectResult } from "./EffectResult";
import type { EffectRegistry } from "./EffectRegistry";
import type { CardEffect } from "./EffectTypes";

export class EffectResolver {
  private readonly registry: EffectRegistry;

  constructor(registry: EffectRegistry) {
    this.registry = registry;
  }

  resolveMany(effects: CardEffect[], context: EffectContext): EffectResult {
    const results: EffectResult[] = [];

    for (const effect of effects) {
      results.push(this.resolve(effect, context));
    }

    return EffectResultFactory.merge(results);
  }

  resolve(effect: CardEffect, context: EffectContext): EffectResult {
    const handler = this.registry.get(effect.type);

    if (!handler) {
      return EffectResultFactory.empty();
    }

    return handler.resolve(effect, context);
  }
}

