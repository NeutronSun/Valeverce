import fs from "node:fs";
import path from "node:path";
import {
  SETTINGS,
  VALERIO_KEYS,
  getDraftCostFromCombat,
  validateCardValerio
} from "../src/game.js";

const cardsPath = path.join("public", "data", "cards.json");
const cardsDir = path.join("public", "cards");
const supportedEffects = new Set([
  "damage",
  "score",
  "break-cap",
  "ignore-defense",
  "attack-stat-bonus",
  "defense-stat-bonus",
  "flat-damage",
  "defense-hit-bonus",
  "contains",
  "missing"
]);

const data = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const cards = Array.isArray(data) ? data : data.cards;
const pngIds = new Set(
  fs
    .readdirSync(cardsDir)
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .map((file) => path.basename(file, path.extname(file)))
);
const issues = [];

if (!Array.isArray(cards)) {
  issues.push("cards.json deve essere un array o un oggetto con cards[]");
} else {
  const ids = new Set();

  for (const [index, card] of cards.entries()) {
    const label = card?.id || `index ${index}`;

    if (!card?.id) {
      issues.push(`${label}: manca id`);
      continue;
    }

    if (ids.has(card.id)) {
      issues.push(`${label}: id duplicato`);
    }
    ids.add(card.id);

    if (!card.name) {
      issues.push(`${label}: manca name`);
    }

    if (!pngIds.has(card.id)) {
      issues.push(`${label}: manca immagine public/cards/${card.id}.png`);
    }

    if (card.special) {
      issues.push(`${label}: usa ancora special invece di valerio`);
    }

    const valerio = validateCardValerio(card);
    for (const issue of valerio.issues) {
      issues.push(issue);
    }

    validateCombat(card, label);
    validateAbility(card, "active", label);
    validateAbility(card, "passive", label);
  }

  for (const pngId of [...pngIds].sort()) {
    if (!ids.has(pngId)) {
      issues.push(`public/cards/${pngId}.png non ha una carta nel JSON`);
    }
  }
}

console.log(`cards=${Array.isArray(cards) ? cards.length : 0} images=${pngIds.size}`);

if (issues.length) {
  console.log("Problemi:");
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
  process.exit(1);
}

console.log("OK");

function validateCombat(card, label) {
  const combat = card.combat;
  if (!combat || typeof combat !== "object") {
    issues.push(`${label}: combat mancante`);
    return;
  }

  for (const key of ["attackPower", "defensePower"]) {
    const value = combat[key];
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      issues.push(`${label}: combat.${key} deve essere un intero tra 0 e 100`);
    }
  }

  if (!Number.isInteger(combat.draftCost) || combat.draftCost < 1) {
    issues.push(`${label}: combat.draftCost deve essere un intero positivo`);
  }

  const expectedCost = getDraftCostFromCombat(combat);
  if (combat.draftCost !== expectedCost) {
    issues.push(`${label}: combat.draftCost ${combat.draftCost} non coerente con potenza (${expectedCost})`);
  }
}

function validateAbility(card, key, label) {
  const ability = card[key];
  if (!ability?.name) {
    issues.push(`${label}: ${key}.name mancante`);
  }
  if (key === "active" && (!Number.isInteger(ability?.cost) || ability.cost < 0 || ability.cost > SETTINGS.maxMana)) {
    issues.push(`${label}: active.cost deve essere un intero tra 0 e ${SETTINGS.maxMana}`);
  }
  if (!ability?.text) {
    issues.push(`${label}: ${key}.text mancante`);
  }

  const effect = ability?.effect;
  if (!effect?.type) {
    issues.push(`${label}: ${key}.effect.type mancante`);
    return;
  }

  if (!supportedEffects.has(effect.type)) {
    issues.push(`${label}: ${key}.effect.type non supportato (${effect.type})`);
  }

  if (
    ["ignore-defense", "attack-stat-bonus", "defense-stat-bonus", "contains", "missing"].includes(effect.type) &&
    effect.stat &&
    !VALERIO_KEYS.includes(effect.stat)
  ) {
    issues.push(`${label}: ${key}.effect.stat non valido (${effect.stat})`);
  }

  if (
    ["damage", "score", "attack-stat-bonus", "defense-stat-bonus", "flat-damage", "defense-hit-bonus", "contains", "missing"].includes(
      effect.type
    ) &&
    typeof effect.value !== "number"
  ) {
    issues.push(`${label}: ${key}.effect.value deve essere numerico`);
  }
}
