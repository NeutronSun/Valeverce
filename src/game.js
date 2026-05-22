export const SPECIAL_KEYS = ["S", "P", "E", "C", "I", "A", "L"];

export const SPECIAL_LABELS = {
  S: "Strength",
  P: "Perception",
  E: "Endurance",
  C: "Charisma",
  I: "Intelligence",
  A: "Agility",
  L: "Luck"
};

export const SETTINGS = {
  startingMana: 3,
  maxMana: 10,
  roundManaGain: 1,
  winnerManaGain: 2,
  loserManaGain: 1,
  draftSize: 6,
  handSize: 6,
  minPlayers: 2,
  maxPlayers: 4
};

export function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function pickSpecials(count = 3) {
  return shuffle(SPECIAL_KEYS).slice(0, count);
}

export function makeDeck(cards) {
  const deck = shuffle(cards.map((card) => card.id));
  return SETTINGS.handSize === "all" ? deck : deck.slice(0, SETTINGS.handSize);
}

export function scorePlay({ card, specials, useActive, mana, deckSize }) {
  const selectedStats = specials.map((key) => Number(card.special[key] ?? 0));
  const baseScore = selectedStats.reduce((total, value) => total + value, 0);
  const notes = [`Base ${baseScore}`];

  let activeScore = 0;
  let passiveScore = 0;
  let manaCost = 0;
  let activeApplied = false;

  if (useActive && card.active) {
    const cost = Number(card.active.cost ?? 0);
    if (mana >= cost) {
      activeApplied = true;
      manaCost = cost;
      activeScore = resolveEffect(card.active.effect, { card, specials, selectedStats, mana, deckSize });

      if (activeScore !== 0) {
        notes.push(`${card.active.name} ${formatSigned(activeScore)}`);
      } else {
        notes.push(card.active.name);
      }

      if (card.passive?.effect) {
        passiveScore = resolveEffect(card.passive.effect, { card, specials, selectedStats, mana, deckSize });
        if (passiveScore !== 0) {
          notes.push(`${card.passive.name} ${formatSigned(passiveScore)}`);
        }
      }
    } else {
      notes.push("Mana insufficiente");
    }
  }

  return {
    score: baseScore + activeScore + passiveScore,
    baseScore,
    activeScore,
    passiveScore,
    manaCost,
    activeApplied,
    notes
  };
}

function resolveEffect(effect, context) {
  if (!effect) {
    return 0;
  }

  switch (effect.type) {
    case "score":
      return Number(effect.value ?? 0);
    case "selected-stat":
      return context.specials.includes(effect.stat) ? Number(context.card.special[effect.stat] ?? 0) : 0;
    case "highest-selected":
      return Math.max(...context.selectedStats);
    case "lowest-selected":
      return Math.min(...context.selectedStats);
    case "contains":
      return context.specials.includes(effect.stat) ? Number(effect.value ?? 0) : 0;
    case "missing":
      return context.specials.includes(effect.stat) ? 0 : Number(effect.value ?? 0);
    case "deck-low":
      return context.deckSize <= Number(effect.count ?? 0) ? Number(effect.value ?? 0) : 0;
    case "mana-low":
      return context.mana <= Number(effect.mana ?? 0) ? Number(effect.value ?? 0) : 0;
    default:
      return 0;
  }
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}
