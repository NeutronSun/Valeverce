import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { StealCardEffectData } from "../EffectTypes";

export class StealCardEffect implements EffectHandler<StealCardEffectData> {
  readonly type = "steal_card";

  resolve(effect: StealCardEffectData): EffectResult {
    return {
      ...EffectResultFactory.empty(),
      applied: true,
      cardMoves: [{
        kind: "steal_card",
        target: "enemy",
        source: effect.selection?.endsWith("_deck") ? "deck" : "hand",
        destination: "hand",
        selection: effect.selection ?? "random_hand",
        targetCardId: effect.targetCardId
      }],
      notes: ["Ruba una carta"]
    };
  }
}
