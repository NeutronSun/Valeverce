import { MongoConnection } from "../db/MongoConnection.js";

export class DeckRepository {
  static COLLECTION = "decks";
  static ACCOUNT_TYPE_INDEX = "decks_accountId_type";
  static ACCOUNT_TYPE_UPDATED_INDEX = "decks_accountId_type_updatedAt";
  static MAX_STORED_DECKS = 12;
  static MAX_UTILITY_CARDS = 8;
  static SPELL_DECK_SIZE = 10;
  static ENERGY_DECK_SIZE = 3;

  constructor(connection = MongoConnection) {
    this.connection = connection;
    this.indexesReady = false;
  }

  async collection() {
    return this.connection.collection(DeckRepository.COLLECTION);
  }

  async ensureIndexes() {
    if (this.indexesReady) {
      return;
    }

    const collection = await this.collection();
    await collection.createIndex({ accountId: 1, type: 1 }, { name: DeckRepository.ACCOUNT_TYPE_INDEX });
    await collection.createIndex(
      { accountId: 1, type: 1, updatedAt: -1 },
      { name: DeckRepository.ACCOUNT_TYPE_UPDATED_INDEX }
    );
    this.indexesReady = true;
  }

  async listUtilityDecks(accountId) {
    await this.ensureIndexes();

    const collection = await this.collection();
    const decks = await collection.find({ accountId, type: "utility" }).sort({ updatedAt: -1 }).toArray();
    return decks.map((deck) => DeckRepository.serialize(deck));
  }

  async replaceUtilityDecks(accountId, decks) {
    await this.ensureIndexes();

    const normalizedDecks = DeckRepository.normalizeDecks(decks);
    const now = new Date();
    const collection = await this.collection();
    await collection.deleteMany({ accountId, type: "utility" });

    if (normalizedDecks.length) {
      await collection.insertMany(
        normalizedDecks.map((deck, index) => ({
          ...deck,
          accountId,
          type: "utility",
          createdAt: now,
          updatedAt: now,
          order: index
        }))
      );
    }

    return normalizedDecks;
  }

  async listValeverceDecks(accountId) {
    await this.ensureIndexes();

    const collection = await this.collection();
    const decks = await collection.find({ accountId, type: "valeverce" }).sort({ updatedAt: -1 }).toArray();
    return decks.map((deck) => DeckRepository.serializeValeverceDeck(deck));
  }

  async getValeverceDeck(accountId, deckId) {
    await this.ensureIndexes();

    const collection = await this.collection();
    const deck = await collection.findOne({ accountId, type: "valeverce", id: String(deckId ?? "") });
    return deck ? DeckRepository.serializeValeverceDeck(deck) : null;
  }

  async createValeverceDeck(accountId, input) {
    await this.ensureIndexes();

    const now = new Date();
    const deck = {
      ...DeckRepository.normalizeValeverceDeck(input),
      accountId,
      type: "valeverce",
      createdAt: now,
      updatedAt: now
    };
    const collection = await this.collection();
    await collection.insertOne(deck);
    return DeckRepository.serializeValeverceDeck(deck);
  }

  async updateValeverceDeck(accountId, deckId, input) {
    await this.ensureIndexes();

    const id = String(deckId ?? "");
    const nextDeck = DeckRepository.normalizeValeverceDeck({ ...input, id });
    const collection = await this.collection();
    const existing = await collection.findOne({ accountId, type: "valeverce", id });
    if (!existing) {
      return null;
    }

    const updatedAt = new Date();
    await collection.updateOne(
      { accountId, type: "valeverce", id },
      {
        $set: {
          name: nextDeck.name,
          spellDeck: nextDeck.spellDeck,
          energyDeck: nextDeck.energyDeck,
          updatedAt
        }
      }
    );

    return DeckRepository.serializeValeverceDeck({
      ...existing,
      name: nextDeck.name,
      spellDeck: nextDeck.spellDeck,
      energyDeck: nextDeck.energyDeck,
      updatedAt
    });
  }

  async deleteValeverceDeck(accountId, deckId) {
    await this.ensureIndexes();

    const collection = await this.collection();
    const result = await collection.deleteOne({ accountId, type: "valeverce", id: String(deckId ?? "") });
    return result.deletedCount > 0;
  }

  static normalizeDecks(decks) {
    if (!Array.isArray(decks)) {
      return [];
    }

    return decks
      .slice(0, DeckRepository.MAX_STORED_DECKS)
      .map((deck, index) => DeckRepository.normalizeDeck(deck, index))
      .filter((deck) => deck.cardIds.length > 0);
  }

  static normalizeDeck(deck, index) {
    const source = deck && typeof deck === "object" ? deck : {};
    const cardIds = Array.isArray(source.cardIds)
      ? source.cardIds
          .map((cardId) => String(cardId ?? "").trim())
          .filter(Boolean)
          .slice(0, DeckRepository.MAX_UTILITY_CARDS)
      : [];

    return {
      id: String(source.id ?? `utility_${Date.now()}_${index}`).trim(),
      name: String(source.name ?? `Utility ${index + 1}`).trim().slice(0, 32) || `Utility ${index + 1}`,
      cardIds
    };
  }

  static serialize(deck) {
    return {
      id: String(deck.id ?? ""),
      name: String(deck.name ?? ""),
      cardIds: Array.isArray(deck.cardIds) ? deck.cardIds.map((cardId) => String(cardId)) : []
    };
  }

  static normalizeValeverceDeck(input) {
    const source = input && typeof input === "object" ? input : {};
    const id = String(source.id ?? `valeverce_${Date.now()}`).trim();
    return {
      id,
      name: String(source.name ?? "Valeverce Deck").trim().slice(0, 48) || "Valeverce Deck",
      spellDeck: DeckRepository.normalizeCardIds(source.spellDeck, DeckRepository.SPELL_DECK_SIZE),
      energyDeck: DeckRepository.normalizeCardIds(source.energyDeck, DeckRepository.ENERGY_DECK_SIZE)
    };
  }

  static normalizeCardIds(cardIds, maxSize) {
    if (!Array.isArray(cardIds)) {
      return [];
    }

    return cardIds
      .map((cardId) => String(cardId ?? "").trim())
      .filter(Boolean)
      .slice(0, maxSize);
  }

  static serializeValeverceDeck(deck) {
    return {
      id: String(deck.id ?? ""),
      account: String(deck.accountId ?? deck.account ?? ""),
      name: String(deck.name ?? ""),
      spellDeck: Array.isArray(deck.spellDeck) ? deck.spellDeck.map((cardId) => String(cardId)) : [],
      energyDeck: Array.isArray(deck.energyDeck) ? deck.energyDeck.map((cardId) => String(cardId)) : [],
      createdAt: DeckRepository.serializeDate(deck.createdAt),
      updatedAt: DeckRepository.serializeDate(deck.updatedAt)
    };
  }

  static serializeDate(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return String(value ?? "");
  }
}
