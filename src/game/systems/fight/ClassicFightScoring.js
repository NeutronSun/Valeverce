import { getAttackPool, getDefensePool } from "../../cards/CardCombat.js";
import { getAbilityEffects } from "../../cards/CardNormalizer.js";
import { getNormalDamageCap } from "../../valerio/ValerioPlanValidation.js";
import { calculateBreach } from "./FightDamage.js";
import { resolveActiveEffects, resolveTraitEffects } from "./FightEffects.js";

export function scoreFightPlan({
  attacker,
  defender,
  attackerCard,
  defenderCard,
  attacks,
  ownDefenses,
  enemyDefenses,
  enemyAttacks = {},
  useActive,
  mana
}) {
  const activeCost = Number(attackerCard?.active?.cost ?? 0);
  const activeEffects = getAbilityEffects(attackerCard?.active);
  const activeApplied = Boolean(useActive && activeEffects.length && Number(mana ?? 0) >= activeCost);
  const activeResult = activeApplied
    ? resolveActiveEffects(activeEffects, {
        attacker,
        defender,
        attackerCard,
        defenderCard,
        attacks,
        ownDefenses,
        enemyDefenses
      })
    : { activeDamage: 0, breakCap: false, ignoredDefenseStats: [], notes: [] };

  const defenderTrait = resolveTraitEffects(getAbilityEffects(defenderCard?.passive), {
    card: defenderCard,
    attacks: enemyAttacks,
    ownDefenses: enemyDefenses,
    enemyAttacks: attacks
  });
  const effectiveEnemyDefenses = addDefenseBonuses(enemyDefenses, defenderTrait.defenseBonuses);
  const breachResult = calculateBreach({
    attackerCard,
    defenderCard,
    attacks,
    defenderDefenses: effectiveEnemyDefenses,
    ignoredDefenseStats: activeResult.ignoredDefenseStats
  });

  const ownTrait = resolveTraitEffects(getAbilityEffects(attackerCard?.passive), {
    card: attackerCard,
    attacks,
    ownDefenses,
    enemyAttacks
  });
  const traitDamage = ownTrait.damageBonus;
  const breach = Math.max(0, breachResult.breach + traitDamage);
  const normalDamageCap = getNormalDamageCap(attackerCard);
  const normalDamage = Math.min(breach, normalDamageCap);
  const breakCapDamage = activeResult.breakCap ? Math.max(0, breach - normalDamage) : 0;
  const activeDamage = activeResult.activeDamage + breakCapDamage;

  return {
    attackPool: getAttackPool(attackerCard),
    defensePool: getDefensePool(attackerCard),
    breach,
    breachBeforeTrait: breachResult.breach,
    normalDamageCap,
    normalDamage,
    activeDamage,
    finalDamage: normalDamage + activeDamage,
    useActive: Boolean(useActive),
    activeApplied,
    manaCost: activeApplied ? activeCost : 0,
    traitApplied: ownTrait.applied,
    traitNotes: ownTrait.notes,
    activeNotes: activeResult.notes,
    defenseTraitNotes: defenderTrait.notes,
    attackLines: breachResult.lines
  };
}

function addDefenseBonuses(defenses, bonuses) {
  const result = { ...(defenses ?? {}) };
  for (const [stat, value] of Object.entries(bonuses ?? {})) {
    result[stat] = Number(result[stat] ?? 0) + Number(value ?? 0);
  }
  return result;
}
