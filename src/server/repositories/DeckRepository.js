import { MongoConnection } from "../db/MongoConnection.js";

export class DeckRepository {
  static COLLECTION = "decks";
  static ACCOUNT_TYPE_INDEX = "decks_accountId_type";
  static MAX_STORED_DECKS = 12;
  static MAX_UTILITY_CARDS = 8;

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
}
