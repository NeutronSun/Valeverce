import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { SwapSelectedCardEffectData } from "../EffectTypes";

export class SwapSelectedCardEffect implements EffectHandler<SwapSelectedCardEffectData> {
  readonly type = "swap_selected_card";

  resolve(effect: SwapSelectedCardEffectData): EffectResult {
    return {
      ...EffectResultFactory.empty(),
      applied: true,
      cardMoves: [{
        kind: "swap_selected_card",
        target: effect.target ?? "self",
        source: "selected",
        destination: "hand",
        selection: effect.selection,
        targetCardId: effect.targetCardId
      }],
      notes: ["Sostituisce la carta scelta"]
    };
  }
}
