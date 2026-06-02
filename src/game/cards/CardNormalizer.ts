import type { Ability, Card, RawAbility, RawCard } from "./CardTypes";
import type { CardEffect } from "../systems/effects/EffectTypes";

export function normalizeCards(cards: RawCard[]): Card[] {
  return cards.map((card) => normalizeCard(card));
}

export function normalizeCard(card: RawCard): Card {
  return new CardNormalizer().normalize(card);
}

export function normalizeAbility(ability?: RawAbility): Ability | undefined {
  return new CardNormalizer().normalizeAbility(ability);
}

export function getAbilityEffects(ability?: RawAbility | Ability): CardEffect[] {
  if (!ability) {
    return [];
  }

  if (Array.isArray(ability.effects)) {
    return ability.effects.filter((effect) => Boolean(effect?.type));
  }

  return ability.effect?.type ? [ability.effect] : [];
}

export class CardNormalizer {
  normalize(card: RawCard): Card {
    return {
      ...card,
      active: this.normalizeAbility(card.active),
      passive: this.normalizeAbility(card.passive)
    } as Card;
  }

  normalizeMany(cards: RawCard[]): Card[] {
    return cards.map((card) => this.normalize(card));
  }

  normalizeAbility(ability?: RawAbility): Ability | undefined {
    if (!ability) {
      return undefined;
    }

    const effects = getAbilityEffects(ability);

    return {
      ...ability,
      effect: ability.effect ?? effects[0],
      effects
    } as Ability;
  }
}
