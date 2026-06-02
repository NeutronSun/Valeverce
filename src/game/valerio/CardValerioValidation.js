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

  for (const key of VALERIO_KEYS) {
    const value = valerio[key];
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      issues.push(`${card?.id ?? "card"}: VALERIO ${key} deve essere un intero tra 1 e 10`);
    }
  }

  for (const key of Object.keys(valerio)) {
    if (!VALERIO_KEYS.some((valerioKey) => valerioKey === key)) {
      issues.push(`${card?.id ?? "card"}: VALERIO sconosciuto ${key}`);
    }
  }

  const total = getValerioTotal(card);
  if (total > SETTINGS.cardValerioBudget) {
    issues.push(`${card?.id ?? "card"}: totale VALERIO ${total} oltre budget ${SETTINGS.cardValerioBudget}`);
  }

  return { ok: issues.length === 0, issues, total };
}
