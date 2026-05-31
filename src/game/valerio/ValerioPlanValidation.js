import { getAttackPool, getDefensePool } from "../cards/CardCombat.js";
import { SETTINGS } from "../rules/ClassicSettings.js";
import { getValerioTotal } from "./CardValerioValidation.js";
import { VALERIO_KEYS } from "./Valerio.js";

export function getNormalDamageCap(card) {
  return Math.floor(getValerioTotal(card) * SETTINGS.normalDamageCapRatio);
}

export function validateValerioDistribution(distribution, maxCount, maxPool) {
  if (!distribution || typeof distribution !== "object" || Array.isArray(distribution)) {
    return { ok: false, error: "Distribuzione non valida", total: 0 };
  }

  const entries = Object.entries(distribution);
  let total = 0;
  let selectedCount = 0;
  for (const [key, value] of entries) {
    if (!VALERIO_KEYS.some((valerioKey) => valerioKey === key)) {
      return { ok: false, error: `Stat VALERIO non valida: ${key}`, total };
    }

    if (!Number.isInteger(value) || value < 0) {
      return { ok: false, error: `Punti non validi per ${key}`, total };
    }

    total += value;
    if (value > 0) {
      selectedCount += 1;
    }
  }

  if (selectedCount < 1) {
    return { ok: false, error: "Metti almeno 1 punto", total };
  }

  if (selectedCount > maxCount) {
    return { ok: false, error: `Puoi usare massimo ${maxCount} statistiche`, total };
  }

  if (total > maxPool) {
    return { ok: false, error: `Punti ${total}/${maxPool}: pool superato`, total };
  }

  return { ok: true, error: "", total };
}

export function validateValerioPlan(plan, card) {
  if (!plan || typeof plan !== "object") {
    return { ok: false, error: "Piano non valido" };
  }

  const attacks = validateValerioDistribution(plan.attacks, SETTINGS.attackSlots, getAttackPool(card));
  if (!attacks.ok) {
    return { ok: false, error: `Attacchi: ${attacks.error}` };
  }

  const defenses = validateValerioDistribution(plan.defenses, SETTINGS.defenseSlots, getDefensePool(card));
  if (!defenses.ok) {
    return { ok: false, error: `Difese: ${defenses.error}` };
  }

  return {
    ok: true,
    error: "",
    attackTotal: attacks.total,
    defenseTotal: defenses.total
  };
}
