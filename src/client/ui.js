import {
  SETTINGS,
  VALERIO_KEYS,
  VALERIO_LABELS,
  getAttackPool,
  getCardValerio,
  getDefensePool,
  getDraftCost
} from "../game.js";

export { SETTINGS, VALERIO_KEYS, VALERIO_LABELS, getAttackPool, getCardValerio, getDefensePool, getDraftCost };

export function cardImageSrc(card) {
  const image = card?.image || `${card?.id ?? ""}.png`;
  return image.startsWith("/") ? image : `/cards/${image}`;
}

export function playerById(lobby, playerId) {
  return lobby?.players?.find((player) => player.id === playerId) ?? null;
}

export function currentOpponent(lobby) {
  const selfId = lobby?.self?.id;
  const opponentId = lobby?.activePair?.find((playerId) => playerId !== selfId);
  return opponentId ? playerById(lobby, opponentId) : null;
}

export function sumDistribution(distribution) {
  return Object.values(distribution ?? {}).reduce((total, value) => total + Number(value ?? 0), 0);
}

export function selectedStats(distribution) {
  return Object.entries(distribution ?? {})
    .filter(([, value]) => Number(value ?? 0) > 0)
    .map(([key]) => key);
}

export function compactDistribution(distribution) {
  return Object.fromEntries(
    Object.entries(distribution ?? {}).filter(([, value]) => Number(value ?? 0) > 0)
  );
}

export function compactPlan(plan) {
  return {
    attacks: compactDistribution(plan.attacks),
    defenses: compactDistribution(plan.defenses),
    useActive: Boolean(plan.useActive)
  };
}

export function emptyPlan() {
  return {
    attacks: Object.fromEntries(VALERIO_KEYS.map((key) => [key, 0])),
    defenses: Object.fromEntries(VALERIO_KEYS.map((key) => [key, 0])),
    useActive: false
  };
}

export function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, Number(value ?? 0)));
}

export function phaseLabel(phase) {
  return {
    lobby: "Lobby",
    draft: "Draft",
    select: "Scelta carta",
    plan: "Piano fight",
    reveal: "Reveal",
    ended: "Fine partita"
  }[phase] ?? "Lobby";
}

export function formatStatName(key) {
  return VALERIO_LABELS[key] ?? key;
}

export function effectStat(effect) {
  return effect?.stat && VALERIO_KEYS.includes(effect.stat) ? effect.stat : null;
}

export function activeTargets(card) {
  const effect = card?.active?.effect;
  return effectStat(effect) ? [effect.stat] : [];
}

export function traitTargets(card) {
  const effect = card?.passive?.effect;
  return effectStat(effect) ? [effect.stat] : [];
}

export function getStatFromText(value) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  for (const [key, label] of Object.entries(VALERIO_LABELS)) {
    const normalizedLabel = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (normalized.includes(normalizedLabel)) {
      return key;
    }
  }

  return "";
}

export function splitValerioText(value) {
  const text = String(value ?? "");
  const statPattern = /(?:(?:[+-]?\d+)\s+(?:punti|Breccia)\s+)?(?:Vigore|Astuzia|Lucidita|Lucidità|Ego|Rigore|Istinto|Opportunismo)\b/gi;
  const chunks = [];
  let lastIndex = 0;

  for (const match of text.matchAll(statPattern)) {
    const start = match.index ?? 0;
    const chunk = match[0];
    if (start > lastIndex) {
      chunks.push({ text: text.slice(lastIndex, start), stat: "" });
    }
    chunks.push({ text: chunk, stat: getStatFromText(chunk) });
    lastIndex = start + chunk.length;
  }

  if (lastIndex < text.length) {
    chunks.push({ text: text.slice(lastIndex), stat: "" });
  }

  return chunks;
}

export function getTraitPreview(card, plan = emptyPlan()) {
  const effect = card?.passive?.effect ?? {};
  const stat = effect.stat;
  const attacks = plan?.attacks ?? {};
  const defenses = plan?.defenses ?? {};
  const hasAttack = VALERIO_KEYS.includes(stat) && Number(attacks[stat] ?? 0) > 0;
  const hasDefense = VALERIO_KEYS.includes(stat) && Number(defenses[stat] ?? 0) > 0;
  const value = Number(effect.value ?? 0);
  const baseTitle = `${card?.passive?.name ?? "Passiva"}: ${card?.passive?.text ?? ""}`;
  const statLabel = VALERIO_LABELS[stat] ?? "stat";

  switch (effect.type) {
    case "attack-stat-bonus":
      return {
        applied: hasAttack,
        boostedStats: hasAttack ? [stat] : [],
        title: `${baseTitle} ${hasAttack ? `Attiva: +${value} Breccia su ${statLabel}.` : `Si attiva attaccando con ${statLabel}.`}`
      };
    case "defense-stat-bonus":
      return {
        applied: hasDefense,
        boostedStats: hasDefense ? [stat] : [],
        title: `${baseTitle} ${hasDefense ? `Attiva: +${value} difesa su ${statLabel}.` : `Si attiva difendendo ${statLabel}.`}`
      };
    case "flat-damage":
    case "score":
      return {
        applied: true,
        boostedStats: [],
        title: `${baseTitle} Sempre attiva: +${value} Breccia.`
      };
    case "contains":
      return {
        applied: hasAttack || hasDefense,
        boostedStats: hasAttack || hasDefense ? [stat] : [],
        title: `${baseTitle} Si attiva usando ${statLabel} in attacco o difesa.`
      };
    case "missing": {
      const applied = VALERIO_KEYS.includes(stat) && !hasAttack && !hasDefense;
      return {
        applied,
        boostedStats: applied ? [stat] : [],
        title: `${baseTitle} Si attiva se non usi ${statLabel}.`
      };
    }
    case "defense-hit-bonus":
      return {
        applied: false,
        boostedStats: [],
        title: `${baseTitle} Condizionale: dipende dagli attacchi avversari.`
      };
    default:
      return {
        applied: false,
        boostedStats: [],
        title: baseTitle
      };
  }
}

export function getOwnValueBoostStats(effect) {
  if (!effect?.type) {
    return [];
  }

  if (["valerio-bonus", "stat-bonus", "self-stat-bonus"].includes(effect.type) && VALERIO_KEYS.includes(effect.stat)) {
    return [effect.stat];
  }

  return [];
}

export function getActiveInfluencedStats(card, plan = emptyPlan()) {
  if (!plan?.useActive) {
    return [];
  }

  const effect = card?.active?.effect ?? {};
  if (["ignore-defense", "selected-stat"].includes(effect.type) && VALERIO_KEYS.includes(effect.stat) && Number(plan.attacks?.[effect.stat] ?? 0) > 0) {
    return [effect.stat];
  }

  const count = Number(effect.count ?? 0);
  if (["ignore-defense", "selected-stat"].includes(effect.type) && count > 0) {
    return Object.entries(plan.attacks ?? {})
      .filter(([, value]) => Number(value ?? 0) > 0)
      .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0))
      .slice(0, count)
      .map(([stat]) => stat);
  }

  return [];
}

export function getTraitLineStats(effect, kind, plan = emptyPlan()) {
  if (!effect?.type || !VALERIO_KEYS.includes(effect.stat)) {
    return [];
  }

  if (kind === "attacks" && ["attack-stat-bonus", "contains"].includes(effect.type) && Number(plan.attacks?.[effect.stat] ?? 0) > 0) {
    return [effect.stat];
  }

  if (kind === "defenses" && ["defense-stat-bonus", "contains"].includes(effect.type) && Number(plan.defenses?.[effect.stat] ?? 0) > 0) {
    return [effect.stat];
  }

  return [];
}

export function getPlanLineInfluence(card, kind, stat, plan = emptyPlan()) {
  const traitStats = getTraitLineStats(card?.passive?.effect, kind, plan);
  const activeStats = kind === "attacks" ? getActiveInfluencedStats(card, plan) : [];
  const trait = traitStats.includes(stat);
  const active = activeStats.includes(stat);

  if (trait && active) return "both";
  if (trait) return "trait";
  if (active) return "active";
  return "";
}

export function getStatInfluences(card, plan = emptyPlan()) {
  const passiveStats = new Set(getOwnValueBoostStats(card?.passive?.effect));
  const activeStats = new Set(plan?.useActive ? getOwnValueBoostStats(card?.active?.effect) : []);
  const result = {};

  for (const key of VALERIO_KEYS) {
    const passive = passiveStats.has(key);
    const active = activeStats.has(key);
    if (passive && active) {
      result[key] = "both";
    } else if (passive) {
      result[key] = "trait";
    } else if (active) {
      result[key] = "active";
    }
  }

  return result;
}

export function getPlanLineTooltip(card, kind, stat, influence, plan = emptyPlan()) {
  const label = VALERIO_LABELS[stat] ?? stat;
  const mode = kind === "attacks" ? "attacco" : "difesa";
  const notes = [`${label}: slider ${mode}`];
  const trait = getTraitPreview(card, plan);

  if (influence === "trait" || influence === "both") {
    notes.push(`Passiva: ${trait.title}`);
  }

  if (influence === "active" || influence === "both") {
    notes.push(`Attiva: ${card?.active?.text ?? card?.active?.name ?? "effetto attivo"}`);
  }

  return notes.join(" - ");
}

export function getStatTooltip(card, stat, plan = emptyPlan()) {
  const valerio = getCardValerio(card);
  const value = Number(valerio[stat] ?? 0);
  const influence = getStatInfluences(card, plan)[stat] ?? "";
  const trait = getTraitPreview(card, plan);
  const activeText = card?.active?.text ? `Attiva: ${card.active.text}` : "Attiva";
  const base = `${VALERIO_LABELS[stat]} originale: ${value}`;

  if (influence === "both") return `${base} - Passiva: ${trait.title} - ${activeText}`;
  if (influence === "trait") return `${base} - Passiva: ${trait.title}`;
  if (influence === "active") return `${base} - ${activeText}`;
  return base;
}

export function validatePlanDraft(plan, card) {
  const attackPool = getAttackPool(card);
  const defensePool = getDefensePool(card);
  const attackCount = selectedStats(plan.attacks).length;
  const defenseCount = selectedStats(plan.defenses).length;
  const attackTotal = sumDistribution(plan.attacks);
  const defenseTotal = sumDistribution(plan.defenses);

  return {
    attackPool,
    defensePool,
    attackTotal,
    defenseTotal,
    attackCount,
    defenseCount,
    canSubmit:
      attackCount === SETTINGS.attackSlots &&
      defenseCount === SETTINGS.defenseSlots &&
      attackTotal <= attackPool &&
      defenseTotal <= defensePool
  };
}
