import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCardCombat, validateCardValerio } from "../src/game.js";

const root = process.cwd();
const cardsPath = path.join(root, "public/data/cards.json");
const requiredCombatFields = ["attackPower", "defensePower", "draftCost"];
const validStats = new Set(["V", "A", "L", "E", "R", "I", "O"]);
const issues = [];

function report(card, message) {
  issues.push(`${card?.id ?? "card"}: ${message}`);
}

const data = JSON.parse(await readFile(cardsPath, "utf8"));
const cards = Array.isArray(data) ? data : data.cards;

if (!Array.isArray(cards)) {
  issues.push("public/data/cards.json must expose a cards array");
} else if (cards.length === 0) {
  issues.push("public/data/cards.json must contain cards");
}

const ids = new Set();

for (const card of cards ?? []) {
  if (!card || typeof card !== "object" || Array.isArray(card)) {
    issues.push("card entry must be an object");
    continue;
  }

  if (typeof card.id !== "string" || card.id.trim() === "") {
    report(card, "id must be a non-empty string");
  } else if (ids.has(card.id)) {
    report(card, "duplicate id");
  } else {
    ids.add(card.id);
  }

  const validation = validateCardValerio(card);
  for (const issue of validation.issues) {
    issues.push(issue);
  }

  const combat = getCardCombat(card);
  for (const field of requiredCombatFields) {
    if (!Number.isInteger(combat[field])) {
      report(card, `combat.${field} must be an integer`);
    }
  }

  validateAbility(card, "active", card.active);
  validateAbility(card, "passive", card.passive);
}

if (issues.length) {
  console.error("Card validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Card validation passed: ${cards.length} cards.`);

function validateAbility(card, abilityKey, ability) {
  if (!ability) {
    return;
  }

  if (typeof ability !== "object" || Array.isArray(ability)) {
    report(card, `${abilityKey} must be an object`);
    return;
  }

  if (abilityKey === "active" && !Number.isInteger(ability.cost)) {
    report(card, "active.cost must be an integer");
  }

  if (ability.effects !== undefined && !Array.isArray(ability.effects)) {
    report(card, `${abilityKey}.effects must be an array`);
  }

  const effects = Array.isArray(ability.effects) ? ability.effects : ability.effect ? [ability.effect] : [];
  if (!effects.length) {
    report(card, `${abilityKey} must define effect or effects`);
  }

  for (const effect of effects) {
    validateEffect(card, abilityKey, effect);
  }
}

function validateEffect(card, abilityKey, effect) {
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    report(card, `${abilityKey}.effect must be an object`);
    return;
  }

  if (typeof effect.type !== "string" || effect.type.trim() === "") {
    report(card, `${abilityKey}.effect.type must be a non-empty string`);
  }

  if (effect.stat !== undefined && !validStats.has(effect.stat)) {
    report(card, `${abilityKey}.effect.stat must be a VALERIO key`);
  }

  if (effect.stats !== undefined) {
    if (!Array.isArray(effect.stats)) {
      report(card, `${abilityKey}.effect.stats must be an array`);
    } else {
      for (const stat of effect.stats) {
        if (!validStats.has(stat)) {
          report(card, `${abilityKey}.effect.stats contains invalid VALERIO key`);
        }
      }
    }
  }

  if (effect.value !== undefined && typeof effect.value !== "number") {
    report(card, `${abilityKey}.effect.value must be a number`);
  }
}
