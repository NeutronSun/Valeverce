import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { SwapCardEffectData } from "../EffectTypes";

export class SwapCardEffect implements EffectHandler<SwapCardEffectData> {
  readonly type = "swap_card";

  resolve(effect: SwapCardEffectData): EffectResult {
    return {
      ...EffectResultFactory.empty(),
      applied: true,
      cardMoves: [{
        kind: "swap_card",
        target: effect.target ?? "self",
        source: effect.source ?? "hand",
        destination: effect.destination ?? "hand",
        selection: effect.selection,
        targetCardId: effect.targetCardId
      }],
      notes: ["Scambia carta"]
    };
  }
}
