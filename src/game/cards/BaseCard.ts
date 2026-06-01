import type { RoundIntent } from "../round/RoundIntent";
import { ROUND_INTENTS } from "../round/RoundIntent";
import { CARD_TYPES, type Ability, type Card, type CardCombat, type CardRole, type CardType, type TrapTrigger } from "./CardTypes";
import type { CardEffect } from "../systems/effects/EffectTypes";
import type { ValerioKey, ValerioMap } from "../../shared/types";

export class BaseCard {
  static readonly DEFAULT_ALLOWED_INTENTS = Object.freeze({
    [CARD_TYPES.ATTACK]: Object.freeze([ROUND_INTENTS.COMBAT, ROUND_INTENTS.GUARD]),
    [CARD_TYPES.UTILITY]: Object.freeze([
      ROUND_INTENTS.UTILITY,
      ROUND_INTENTS.DRAW,
      ROUND_INTENTS.FOCUS,
      ROUND_INTENTS.RECOVER
    ]),
    [CARD_TYPES.TRAP]: Object.freeze([ROUND_INTENTS.TRAP]),
    [CARD_TYPES.DEFENSE]: Object.freeze([ROUND_INTENTS.GUARD, ROUND_INTENTS.RECOVER, ROUND_INTENTS.UTILITY])
  } satisfies Record<CardType, readonly RoundIntent[]>);

  constructor(protected readonly data: Card) {}

  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get type(): CardType {
    return this.data.type ?? CARD_TYPES.ATTACK;
  }

  get role(): CardRole {
    return this.data.role ?? this.type;
  }

  get valerio(): ValerioMap {
    return this.data.valerio;
  }

  get active(): Ability | undefined {
    return this.data.active;
  }

  get passive(): Ability | undefined {
    return this.data.passive;
  }

  get effects(): CardEffect[] {
    return this.data.effects ?? [];
  }

  get combat(): CardCombat {
    return this.data.combat;
  }

  get trigger(): TrapTrigger | undefined {
    return this.data.trigger;
  }

  get allowedIntents(): readonly RoundIntent[] {
    return this.data.allowedIntents?.length ? this.data.allowedIntents : BaseCard.DEFAULT_ALLOWED_INTENTS[this.type];
  }

  canBePlayedWithIntent(intent: RoundIntent): boolean {
    return this.allowedIntents.includes(intent);
  }

  getGenericGuardBonus(): number {
    return Number(this.data.guardBonus ?? 0);
  }

  hasValerioStat(stat: ValerioKey): boolean {
    return Number(this.data.valerio[stat] ?? 0) > 0;
  }

  toJSON(): Card {
    return this.data;
  }
}
