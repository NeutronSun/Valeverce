import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { SwapCardFromDeckEffectData } from "../EffectTypes";

export class SwapCardFromDeckEffect implements EffectHandler<SwapCardFromDeckEffectData> {
  readonly type = "swap_card_from_deck";

  resolve(effect: SwapCardFromDeckEffectData): EffectResult {
    return {
      ...EffectResultFactory.empty(),
      applied: true,
      cardMoves: [{
        kind: "swap_card_from_deck",
        target: effect.target ?? "self",
        source: "deck",
        destination: "hand",
        selection: effect.selection ?? "random_deck",
        targetCardId: effect.targetCardId
      }],
      notes: ["Scambia una carta dal mazzo"]
    };
  }
}
