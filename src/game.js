export const VALERIO_KEYS = ["V", "A", "L", "E", "R", "I", "O"];

export const VALERIO_LABELS = {
  V: "Vigore",
  A: "Astuzia",
  L: "Lucidita",
  E: "Ego",
  R: "Rigore",
  I: "Istinto",
  O: "Opportunismo"
};

export const SETTINGS = {
  startingHealth: 50,
  maxHealth: 50,

  startingMana: 10,
  maxMana: 10,
  roundManaGain: 1,

  cardValerioBudget: 40,

  maxAttackPoints: 20,
  maxDefensePoints: 20,

  attackSlots: 3,
  defenseSlots: 3,

  normalDamageCapRatio: 0.5,

  draftBudget: 20,
  draftSize: 6,
  handSize: 6,

  actionSeconds: 15,
  minPlayers: 2,
  maxPlayers: 4,

  cardCooldownRounds: 1
};

export function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function makeDeck(cards) {
  const deck = shuffle(cards.map((card) => card.id));
  return deck.slice(0, SETTINGS.handSize);
}

export function getCardValerio(card) {
  return card?.valerio ?? card?.special ?? {};
}

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
    if (!VALERIO_KEYS.includes(key)) {
      issues.push(`${card?.id ?? "card"}: VALERIO sconosciuto ${key}`);
    }
  }

  const total = getValerioTotal(card);
  if (total > SETTINGS.cardValerioBudget) {
    issues.push(`${card?.id ?? "card"}: totale VALERIO ${total} oltre budget ${SETTINGS.cardValerioBudget}`);
  }

  return { ok: issues.length === 0, issues, total };
}

export function getCardCombat(card) {
  return card?.combat ?? {};
}

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
    if (!VALERIO_KEYS.includes(key)) {
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

export function calculateAttackLine({
  stat,
  attackerCard,
  defenderCard,
  attackPoints,
  defensePoints
}) {
  const attackerValerio = getCardValerio(attackerCard);
  const defenderValerio = getCardValerio(defenderCard);
  const attackerValue = Number(attackerValerio[stat] ?? 0);
  const defenderValue = Number(defenderValerio[stat] ?? 0);
  const rawDamage = Number(attackPoints ?? 0) + attackerValue - defenderValue - Number(defensePoints ?? 0);
  const lineDamage = Math.max(0, rawDamage);

  return {
    stat,
    attackPoints: Number(attackPoints ?? 0),
    defensePoints: Number(defensePoints ?? 0),
    attackerValerio: attackerValue,
    defenderValerio: defenderValue,
    rawDamage,
    lineDamage
  };
}

export function calculateBreach({
  attackerCard,
  defenderCard,
  attacks,
  defenderDefenses,
  ignoredDefenseStats = []
}) {
  const ignoredStats = new Set(ignoredDefenseStats);
  let breach = 0;
  const lines = [];

  for (const [stat, attackPoints] of Object.entries(attacks ?? {})) {
    const originalDefensePoints = Number(defenderDefenses?.[stat] ?? 0);
    const defenseIgnored = ignoredStats.has(stat);
    const line = calculateAttackLine({
      stat,
      attackerCard,
      defenderCard,
      attackPoints,
      defensePoints: defenseIgnored ? 0 : originalDefensePoints
    });

    breach += line.lineDamage;
    lines.push({
      ...line,
      originalDefensePoints,
      defenseIgnored
    });
  }

  return { breach, lines };
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
  const activeApplied = Boolean(useActive && attackerCard?.active?.effect && Number(mana ?? 0) >= activeCost);
  const activeResult = activeApplied
    ? resolveActiveEffect(attackerCard.active.effect, {
        attacker,
        defender,
        attackerCard,
        defenderCard,
        attacks,
        ownDefenses,
        enemyDefenses
      })
    : { activeDamage: 0, breakCap: false, ignoredDefenseStats: [], notes: [] };

  const defenderTrait = resolveTraitEffect(defenderCard?.passive?.effect, {
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

  const ownTrait = resolveTraitEffect(attackerCard?.passive?.effect, {
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
