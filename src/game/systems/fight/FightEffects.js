import { VALERIO_KEYS, VALERIO_LABELS } from "../../valerio/Valerio.js";

export function resolveTraitEffects(effects, context) {
  return mergeTraitResults(effects.map((effect) => resolveTraitEffect(effect, context)));
}

export function resolveTraitEffect(effect, context) {
  if (!effect?.type) {
    return { damageBonus: 0, defenseBonuses: {}, applied: false, notes: [] };
  }

  const value = Number(effect.value ?? 0);
  const stat = effect.stat;
  const attacks = context.attacks ?? {};
  const ownDefenses = context.ownDefenses ?? {};
  const enemyAttacks = context.enemyAttacks ?? {};
  const notes = [];

  switch (effect.type) {
    case "attack-stat-bonus":
      if (VALERIO_KEYS.includes(stat) && Object.hasOwn(attacks, stat)) {
        notes.push(`Tratto: +${value} Breccia su ${VALERIO_LABELS[stat]}`);
        return { damageBonus: value, defenseBonuses: {}, applied: true, notes };
      }
      break;
    case "defense-stat-bonus":
      if (VALERIO_KEYS.includes(stat) && Object.hasOwn(ownDefenses, stat)) {
        notes.push(`Tratto: +${value} difesa virtuale su ${VALERIO_LABELS[stat]}`);
        return { damageBonus: 0, defenseBonuses: { [stat]: value }, applied: true, notes };
      }
      break;
    case "flat-damage":
    case "score":
      notes.push(`Tratto: +${value} Breccia`);
      return { damageBonus: value, defenseBonuses: {}, applied: value !== 0, notes };
    case "defense-hit-bonus": {
      const count = Number(effect.count ?? 0);
      const hits = Object.keys(ownDefenses).filter((key) => Object.hasOwn(enemyAttacks, key)).length;
      if (hits >= count) {
        notes.push(`Tratto: +${value} Breccia, ${hits} difese colpite`);
        return { damageBonus: value, defenseBonuses: {}, applied: true, notes };
      }
      break;
    }
    case "contains":
      if (VALERIO_KEYS.includes(stat) && (Object.hasOwn(attacks, stat) || Object.hasOwn(ownDefenses, stat))) {
        notes.push(`Tratto: +${value} per ${VALERIO_LABELS[stat]}`);
        return { damageBonus: value, defenseBonuses: {}, applied: true, notes };
      }
      break;
    case "missing":
      if (VALERIO_KEYS.includes(stat) && !Object.hasOwn(attacks, stat) && !Object.hasOwn(ownDefenses, stat)) {
        notes.push(`Tratto: +${value} senza ${VALERIO_LABELS[stat]}`);
        return { damageBonus: value, defenseBonuses: {}, applied: true, notes };
      }
      break;
    default:
      break;
  }

  return { damageBonus: 0, defenseBonuses: {}, applied: false, notes };
}

export function resolveActiveEffects(effects, context) {
  return mergeActiveResults(effects.map((effect) => resolveActiveEffect(effect, context)));
}

export function resolveActiveEffect(effect, context) {
  if (!effect?.type) {
    return { activeDamage: 0, breakCap: false, ignoredDefenseStats: [], notes: [] };
  }

  const notes = [];
  switch (effect.type) {
    case "damage":
    case "score": {
      const activeDamage = Number(effect.value ?? 0);
      if (activeDamage !== 0) {
        notes.push(`Attiva: +${activeDamage} danni oltre cap`);
      }
      return { activeDamage, breakCap: false, ignoredDefenseStats: [], notes };
    }
    case "break-cap":
    case "highest-selected":
      notes.push("Attiva: Breccia oltre il cap");
      return { activeDamage: 0, breakCap: true, ignoredDefenseStats: [], notes };
    case "ignore-defense":
    case "selected-stat": {
      const ignoredDefenseStats = getIgnoredDefenseStats(effect, context);
      if (ignoredDefenseStats.length) {
        notes.push(`Attiva: ignora difesa su ${ignoredDefenseStats.map((key) => VALERIO_LABELS[key]).join(", ")}`);
      }
      return { activeDamage: 0, breakCap: false, ignoredDefenseStats, notes };
    }
    default:
      return { activeDamage: Number(effect.value ?? 0), breakCap: false, ignoredDefenseStats: [], notes };
  }
}

function mergeTraitResults(results) {
  const merged = { damageBonus: 0, defenseBonuses: {}, applied: false, notes: [] };

  for (const result of results) {
    merged.damageBonus += result.damageBonus;
    merged.applied = merged.applied || result.applied;
    merged.notes.push(...result.notes);

    for (const [stat, value] of Object.entries(result.defenseBonuses ?? {})) {
      merged.defenseBonuses[stat] = Number(merged.defenseBonuses[stat] ?? 0) + Number(value ?? 0);
    }
  }

  return merged;
}

function mergeActiveResults(results) {
  const merged = { activeDamage: 0, breakCap: false, ignoredDefenseStats: [], notes: [] };

  for (const result of results) {
    merged.activeDamage += result.activeDamage;
    merged.breakCap = merged.breakCap || result.breakCap;
    merged.notes.push(...result.notes);

    for (const stat of result.ignoredDefenseStats ?? []) {
      if (!merged.ignoredDefenseStats.includes(stat)) {
        merged.ignoredDefenseStats.push(stat);
      }
    }
  }

  return merged;
}

function getIgnoredDefenseStats(effect, context) {
  const attacks = context.attacks ?? {};
  const enemyDefenses = context.enemyDefenses ?? {};

  if (VALERIO_KEYS.includes(effect.stat) && Object.hasOwn(attacks, effect.stat)) {
    return [effect.stat];
  }

  const count = Number(effect.count ?? 0);
  if (count <= 0) {
    return [];
  }

  return Object.keys(attacks)
    .sort((left, right) => Number(enemyDefenses[right] ?? 0) - Number(enemyDefenses[left] ?? 0))
    .slice(0, count);
}
