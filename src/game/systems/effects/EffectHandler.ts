import type { EffectContext } from "./EffectContext";
import type { EffectResult } from "./EffectResult";
import type { CardEffect } from "./EffectTypes";

export interface EffectHandler<TEffect extends CardEffect = CardEffect> {
  readonly type: TEffect["type"];

  resolve(effect: TEffect, context: EffectContext): EffectResult;
}

