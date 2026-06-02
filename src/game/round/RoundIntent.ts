export const ROUND_INTENTS = {
  COMBAT: "combat",
  GUARD: "guard",
  DRAW: "draw",
  FOCUS: "focus",
  RECOVER: "recover",
  UTILITY: "utility",
  TRAP: "trap",
  CONTROL: "control"
} as const;

export type RoundIntent = (typeof ROUND_INTENTS)[keyof typeof ROUND_INTENTS];

export const ROUND_INTENT_NAMES = Object.freeze(Object.values(ROUND_INTENTS)) as readonly RoundIntent[];
