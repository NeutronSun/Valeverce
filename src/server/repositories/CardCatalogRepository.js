import { MongoConnection } from "../db/MongoConnection.js";

export class CardCatalogRepository {
  static COLLECTION = "cardCatalog";
  static CARD_INDEX = "cardCatalog_cardId_unique";

  constructor(connection = MongoConnection) {
    this.connection = connection;
    this.indexesReady = false;
  }

  async collection() {
    return this.connection.collection(CardCatalogRepository.COLLECTION);
  }

  async ensureIndexes() {
    if (this.indexesReady) {
      return;
    }

    const collection = await this.collection();
    await collection.createIndex({ cardId: 1 }, { unique: true, name: CardCatalogRepository.CARD_INDEX });
    this.indexesReady = true;
  }

  async syncCards(cards) {
    await this.ensureIndexes();

    const normalizedCards = Array.isArray(cards) ? cards.filter((card) => card?.id) : [];
    if (!normalizedCards.length) {
      return;
    }

    const now = new Date();
    const collection = await this.collection();
    await collection.bulkWrite(
      normalizedCards.map((card) => ({
        updateOne: {
          filter: { cardId: card.id },
          update: {
            $set: {
              cardId: card.id,
              card,
              updatedAt: now
            },
            $setOnInsert: {
              createdAt: now
            }
          },
          upsert: true
        }
      }))
    );
  }
}
