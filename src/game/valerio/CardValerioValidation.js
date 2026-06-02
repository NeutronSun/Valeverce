import { getCardValerio } from "../cards/CardAccessors.js";
import { SETTINGS } from "../rules/ClassicSettings.js";
import { VALERIO_KEYS } from "./Valerio.js";

export function getValerioTotal(card) {
  const valerio = getCardValerio(card);
  return VALERIO_KEYS.reduce((total, key) => total + Number(valerio[key] ?? 0), 0);
}

export function validateCardValerio(card) {
  const issues = [];
  const valerio = getCardValerio(card);
  const usesValerio = card?.usesValerio !== false && card?.deckType !== "energy";

  for (const key of VALERIO_KEYS) {
    const value = valerio[key];
    const minValue = usesValerio ? 1 : 0;
    if (!Number.isInteger(value) || value < minValue || value > 10) {
      issues.push(`${card?.id ?? "card"}: VALERIO ${key} deve essere un intero tra ${minValue} e 10`);
    }
  }

  for (const key of Object.keys(valerio)) {
    if (!VALERIO_KEYS.some((valerioKey) => valerioKey === key)) {
      issues.push(`${card?.id ?? "card"}: VALERIO sconosciuto ${key}`);
    }
  }

  const total = getValerioTotal(card);
  const maxBudget = card?.deckType === "spell" ? 42 : SETTINGS.cardValerioBudget;
  if (usesValerio && total > maxBudget) {
    issues.push(`${card?.id ?? "card"}: totale VALERIO ${total} oltre budget ${maxBudget}`);
  }

  return { ok: issues.length === 0, issues, total };
}
