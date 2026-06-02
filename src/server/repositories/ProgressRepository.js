import { MongoConnection } from "../db/MongoConnection.js";

export class ProgressRepository {
  static COLLECTION = "progress";
  static ACCOUNT_INDEX = "progress_accountId_unique";

  constructor(connection = MongoConnection) {
    this.connection = connection;
    this.indexesReady = false;
  }

  async collection() {
    return this.connection.collection(ProgressRepository.COLLECTION);
  }

  async ensureIndexes() {
    if (this.indexesReady) {
      return;
    }

    const collection = await this.collection();
    await collection.createIndex({ accountId: 1 }, { unique: true, name: ProgressRepository.ACCOUNT_INDEX });
    this.indexesReady = true;
  }

  async ensureForAccount(accountId) {
    await this.ensureIndexes();

    const now = new Date();
    const collection = await this.collection();
    await collection.updateOne(
      { accountId },
      {
        $setOnInsert: {
          accountId,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          xp: 0,
          unlockedCardIds: [],
          createdAt: now
        },
        $set: {
          updatedAt: now
        }
      },
      { upsert: true }
    );

    const progress = await collection.findOne({ accountId });
    return ProgressRepository.serialize(progress);
  }

  async recordGameFinished(accountId, result) {
    await this.ensureIndexes();

    const won = Boolean(result?.won);
    const tied = Boolean(result?.tied);
    const now = new Date();
    const collection = await this.collection();
    await collection.updateOne(
      { accountId },
      {
        $inc: {
          gamesPlayed: 1,
          wins: won ? 1 : 0,
          losses: !won && !tied ? 1 : 0,
          ties: tied ? 1 : 0,
          xp: won ? 25 : tied ? 10 : 5
        },
        $set: {
          updatedAt: now
        },
        $setOnInsert: {
          accountId,
          unlockedCardIds: [],
          createdAt: now
        }
      },
      { upsert: true }
    );
  }

  static serialize(progress) {
    return {
      gamesPlayed: Number(progress?.gamesPlayed ?? 0),
      wins: Number(progress?.wins ?? 0),
      losses: Number(progress?.losses ?? 0),
      ties: Number(progress?.ties ?? 0),
      xp: Number(progress?.xp ?? 0),
      unlockedCardIds: Array.isArray(progress?.unlockedCardIds) ? progress.unlockedCardIds.map((cardId) => String(cardId)) : []
    };
  }
}
