import { MongoConnection } from "../db/MongoConnection.js";
import { AuthCookie } from "../auth/AuthCookie.js";
import { SessionToken } from "../auth/SessionToken.js";

export class SessionRepository {
  static COLLECTION = "sessions";
  static TOKEN_INDEX = "sessions_tokenHash_unique";
  static EXPIRATION_INDEX = "sessions_expiresAt_ttl";

  constructor(connection = MongoConnection) {
    this.connection = connection;
    this.indexesReady = false;
  }

  async collection() {
    return this.connection.collection(SessionRepository.COLLECTION);
  }

  async ensureIndexes() {
    if (this.indexesReady) {
      return;
    }

    const collection = await this.collection();
    await collection.createIndex({ tokenHash: 1 }, { unique: true, name: SessionRepository.TOKEN_INDEX });
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: SessionRepository.EXPIRATION_INDEX });
    this.indexesReady = true;
  }

  async createForAccount(accountId) {
    await this.ensureIndexes();

    const token = SessionToken.create();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AuthCookie.MAX_AGE_SECONDS * 1000);
    const collection = await this.collection();
    await collection.insertOne({
      accountId,
      tokenHash: SessionToken.hash(token),
      createdAt: now,
      expiresAt
    });

    return { token, expiresAt: expiresAt.toISOString() };
  }

  async findAccountIdByToken(token) {
    if (!token) {
      return "";
    }

    await this.ensureIndexes();

    const collection = await this.collection();
    const session = await collection.findOne({
      tokenHash: SessionToken.hash(token),
      expiresAt: { $gt: new Date() }
    });

    return String(session?.accountId ?? "");
  }

  async deleteByToken(token) {
    if (!token) {
      return;
    }

    const collection = await this.collection();
    await collection.deleteOne({ tokenHash: SessionToken.hash(token) });
  }
}
