import { BaseCard } from "./BaseCard";
import { CARD_TYPES, type Card, type CardType } from "./CardTypes";

export class CardFactory {
  static readonly ATTACK_ALIASES = Object.freeze(["attack", "character", "combat"]);

  static createDefault(): CardFactory {
    return new CardFactory();
  }

  create(data: Card): BaseCard {
    this.normalizeType(data);
    return new BaseCard(data);
  }

  createMany(cards: Card[]): BaseCard[] {
    return cards.map((card) => this.create(card));
  }

  private normalizeType(data: Card): CardType {
    const type = String(data.role ?? data.type ?? CARD_TYPES.ATTACK);

    if (CardFactory.ATTACK_ALIASES.includes(type)) {
      return CARD_TYPES.ATTACK;
    }

    if (this.isCardType(type)) {
      return type;
    }

    throw new Error(`Unsupported card type: ${type}`);
  }

  private isCardType(value: string): value is CardType {
    return Object.values(CARD_TYPES).includes(value as CardType);
  }
}
