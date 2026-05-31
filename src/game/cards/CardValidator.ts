import { VALERIO_KEYS } from "../valerio/Valerio";
import type { Ability, RawAbility, RawCard } from "./CardTypes";
import type { CardEffect } from "../systems/effects/EffectTypes";
import type { ValerioKey } from "../../shared/types";

export class CardValidator {
  validate(card: RawCard): string[] {
    const errors: string[] = [];

    if (!card.id || typeof card.id !== "string") {
      errors.push("Card id must be a non-empty string");
    }

    if (!card.name || typeof card.name !== "string") {
      errors.push(`Card ${String(card.id ?? "unknown")} name must be a non-empty string`);
    }

    errors.push(...this.validateAbility(card.active, `${String(card.id ?? "unknown")}.active`));
    errors.push(...this.validateAbility(card.passive, `${String(card.id ?? "unknown")}.passive`));

    return errors;
  }

  validateMany(cards: RawCard[]): string[] {
    const errors: string[] = [];
    const ids = new Set<string>();

    for (const card of cards) {
      errors.push(...this.validate(card));

      if (typeof card.id !== "string" || !card.id) {
        continue;
      }

      if (ids.has(card.id)) {
        errors.push(`Duplicate card id ${card.id}`);
      }

      ids.add(card.id);
    }

    return errors;
  }

  validateAbility(ability?: Ability | RawAbility, label = "ability"): string[] {
    if (!ability) {
      return [];
    }

    const errors: string[] = [];
    const legacyEffect = ability.effect;
    const effects = Array.isArray(ability.effects)
      ? ability.effects
      : legacyEffect
        ? [legacyEffect]
        : [];

    if (ability.effects !== undefined && !Array.isArray(ability.effects)) {
      errors.push(`${label} effects must be an array`);
      return errors;
    }

    for (const effect of effects) {
      errors.push(...this.validateEffect(effect, label));
    }

    return errors;
  }

  private validateEffect(effect: CardEffect, label: string): string[] {
    const errors: string[] = [];

    if (!effect?.type || typeof effect.type !== "string") {
      errors.push(`Effect without type in ${label}`);
      return errors;
    }

    if ("stat" in effect && effect.stat !== undefined && !this.isValerioKey(effect.stat)) {
      errors.push(`Invalid stat ${String(effect.stat)} in ${label}`);
    }

    if ("stats" in effect && effect.stats !== undefined) {
      if (!Array.isArray(effect.stats)) {
        errors.push(`Invalid stats list in ${label}`);
      } else {
        for (const stat of effect.stats) {
          if (!this.isValerioKey(stat)) {
            errors.push(`Invalid stat ${String(stat)} in ${label}`);
          }
        }
      }
    }

    if ("value" in effect && effect.value !== undefined && typeof effect.value !== "number") {
      errors.push(`Invalid value in ${label}`);
    }

    if ("count" in effect && effect.count !== undefined && typeof effect.count !== "number") {
      errors.push(`Invalid count in ${label}`);
    }

    return errors;
  }

  private isValerioKey(value: unknown): value is ValerioKey {
    return typeof value === "string" && VALERIO_KEYS.includes(value as ValerioKey);
  }
}

