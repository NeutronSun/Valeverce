import type { ValerioKey } from "../../shared/types";

export const VALERIO_KEYS = ["V", "A", "L", "E", "R", "I", "O"] as const satisfies readonly ValerioKey[];

export const VALERIO_LABELS = Object.freeze({
  V: "Vigore",
  A: "Astuzia",
  L: "Lucidita",
  E: "Ego",
  R: "Rigore",
  I: "Istinto",
  O: "Opportunismo"
} as const satisfies Record<ValerioKey, string>);
