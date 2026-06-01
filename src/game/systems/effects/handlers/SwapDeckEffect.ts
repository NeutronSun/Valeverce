import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { SwapDeckEffectData } from "../EffectTypes";

export class SwapDeckEffect implements EffectHandler<SwapDeckEffectData> {
  readonly type = "swap_deck";

  resolve(effect: SwapDeckEffectData): EffectResult {
    return {
      ...EffectResultFactory.empty(),
      applied: true,
      cardMoves: [{
        kind: "swap_deck",
        target: effect.target ?? "self"
      }],
      notes: ["Scambia mazzo"]
    };
  }
}
