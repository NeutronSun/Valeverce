import type { EffectHandler } from "../EffectHandler";
import { EffectResultFactory, type EffectResult } from "../EffectResult";
import type { BreakCapEffectData } from "../EffectTypes";

export class BreakCapEffect implements EffectHandler<BreakCapEffectData> {
  readonly type = "break-cap";

  resolve(): EffectResult {
    return {
      ...EffectResultFactory.empty(),
      applied: true,
      breakDamageCap: true,
      notes: ["Ignora il cap danno"]
    };
  }
}

