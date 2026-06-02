import { getCardValerio } from "../../cards/CardAccessors.js";

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
