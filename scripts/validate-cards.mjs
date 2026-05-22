import fs from "node:fs";
import path from "node:path";

const cardsPath = path.join("public", "data", "cards.json");
const cardsDir = path.join("public", "cards");
const specialKeys = ["S", "P", "E", "C", "I", "A", "L"];
const supportedEffects = new Set([
  "score",
  "selected-stat",
  "highest-selected",
  "lowest-selected",
  "contains",
  "missing",
  "deck-low",
  "mana-low"
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

    for (const key of specialKeys) {
      const value = card.special?.[key];
      if (!Number.isInteger(value) || value < 0 || value > 10) {
        issues.push(`${label}: SPECIAL ${key} deve essere un intero tra 0 e 10`);
      }
    }

    for (const key of Object.keys(card.special ?? {})) {
      if (!specialKeys.includes(key)) {
        issues.push(`${label}: SPECIAL sconosciuto ${key}`);
      }
    }

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

function validateAbility(card, key, label) {
  const ability = card[key];
  if (!ability?.name) {
    issues.push(`${label}: ${key}.name mancante`);
  }
  if (key === "active" && (!Number.isInteger(ability?.cost) || ability.cost < 0)) {
    issues.push(`${label}: active.cost deve essere un intero >= 0`);
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

  if (["selected-stat", "contains", "missing"].includes(effect.type) && !specialKeys.includes(effect.stat)) {
    issues.push(`${label}: ${key}.effect.stat non valido (${effect.stat})`);
  }

  if (["score", "contains", "missing", "deck-low", "mana-low"].includes(effect.type) && typeof effect.value !== "number") {
    issues.push(`${label}: ${key}.effect.value deve essere numerico`);
  }
}
