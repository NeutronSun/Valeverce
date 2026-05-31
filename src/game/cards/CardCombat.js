import { SETTINGS } from "../rules/ClassicSettings.js";
import { getCardCombat } from "./CardAccessors.js";

export function getAttackPool(card) {
  const attackPower = Number(getCardCombat(card).attackPower ?? 0);
  return Math.floor((SETTINGS.maxAttackPoints * attackPower) / 100);
}

export function getDefensePool(card) {
  const defensePower = Number(getCardCombat(card).defensePower ?? 0);
  return Math.floor((SETTINGS.maxDefensePoints * defensePower) / 100);
}

export function getDraftCost(card) {
  const combat = getCardCombat(card);
  if (Number.isInteger(combat.draftCost)) {
    return combat.draftCost;
  }
  return getDraftCostFromCombat(combat);
}

export function getDraftCostFromCombat(combat) {
  const totalPower = Number(combat?.attackPower ?? 0) + Number(combat?.defensePower ?? 0);

  if (totalPower <= 100) return 2;
  if (totalPower <= 130) return 3;
  if (totalPower <= 160) return 4;
  if (totalPower <= 180) return 5;
  return 6;
}
