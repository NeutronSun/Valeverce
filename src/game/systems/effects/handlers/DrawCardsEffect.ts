import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { DrawCardsEffectData } from "../EffectTypes";

export class DrawCardsEffect implements EffectHandler<DrawCardsEffectData> {
  readonly type = "draw_cards";

  resolve(effect: DrawCardsEffectData): EffectResult {
    const drawAmount = Math.max(0, effect.value);

    return {
      ...EffectResultFactory.empty(),
      applied: drawAmount > 0,
      drawAmount,
      cardMoves: drawAmount > 0
        ? [{
            kind: "draw_cards",
            target: effect.target ?? "self",
            value: drawAmount,
            source: effect.source ?? "deck",
            destination: "hand"
          }]
        : [],
      notes: drawAmount > 0 ? [`Pesca ${drawAmount} carte`] : []
    };
  }
}
