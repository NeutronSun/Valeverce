export const EFFECT_TIMINGS = {
  ALWAYS: "always",
  ON_ROUND_START: "on_round_start",
  AFTER_SELECT: "after_select",
  BEFORE_FIGHT: "before_fight",
  BEFORE_REVEAL: "before_reveal",
  ON_REVEAL: "on_reveal",
  AFTER_FIGHT: "after_fight",
  ON_ROUND_END: "on_round_end"
} as const;

export type EffectTiming = (typeof EFFECT_TIMINGS)[keyof typeof EFFECT_TIMINGS];

