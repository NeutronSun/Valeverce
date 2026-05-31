export function normalizeCards(cards) {
  return cards.map((card) => normalizeCard(card));
}

export function normalizeCard(card) {
  return {
    ...card,
    active: normalizeAbility(card.active),
    passive: normalizeAbility(card.passive)
  };
}

export function normalizeAbility(ability) {
  if (!ability) {
    return undefined;
  }

  const effects = getAbilityEffects(ability);
  return {
    ...ability,
    effect: ability.effect ?? effects[0],
    effects
  };
}

export function getAbilityEffects(ability) {
  if (!ability) {
    return [];
  }

  if (Array.isArray(ability.effects)) {
    return ability.effects.filter((effect) => effect?.type);
  }

  return ability.effect?.type ? [ability.effect] : [];
}
