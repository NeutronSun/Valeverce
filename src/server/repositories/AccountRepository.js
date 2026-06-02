import { ObjectId } from "mongodb";
import { MongoConnection } from "../db/MongoConnection.js";

export class AccountRepository {
  static COLLECTION = "accounts";
  static NICK_INDEX = "accounts_normalizedNick_unique";

  constructor(connection = MongoConnection) {
    this.connection = connection;
    this.indexesReady = false;
  }

  async collection() {
    return this.connection.collection(AccountRepository.COLLECTION);
  }

  async ensureIndexes() {
    if (this.indexesReady) {
      return;
    }

    const collection = await this.collection();
    await collection.createIndex({ normalizedNick: 1 }, { unique: true, name: AccountRepository.NICK_INDEX });
    this.indexesReady = true;
  }

  async create({ nick, normalizedNick, passwordHash }) {
    await this.ensureIndexes();

    const now = new Date();
    const doc = {
      nick,
      normalizedNick,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    };
    const collection = await this.collection();
    const result = await collection.insertOne(doc);

    return AccountRepository.serialize({ ...doc, _id: result.insertedId });
  }

  async findByNormalizedNick(normalizedNick) {
    await this.ensureIndexes();

    const collection = await this.collection();
    const account = await collection.findOne({ normalizedNick });
    return account ? AccountRepository.serialize(account, { includePasswordHash: true }) : null;
  }

  async findById(accountId) {
    if (!ObjectId.isValid(accountId)) {
      return null;
    }

    const collection = await this.collection();
    const account = await collection.findOne({ _id: new ObjectId(accountId) });
    return account ? AccountRepository.serialize(account) : null;
  }

  async touchLogin(accountId) {
    if (!ObjectId.isValid(accountId)) {
      return;
    }

    const now = new Date();
    const collection = await this.collection();
    await collection.updateOne(
      { _id: new ObjectId(accountId) },
      {
        $set: {
          lastLoginAt: now,
          updatedAt: now
        }
      }
    );
  }

  static serialize(account, options = {}) {
    const serialized = {
      id: account._id.toString(),
      nick: String(account.nick ?? ""),
      normalizedNick: String(account.normalizedNick ?? ""),
      createdAt: AccountRepository.serializeDate(account.createdAt),
      updatedAt: AccountRepository.serializeDate(account.updatedAt),
      lastLoginAt: account.lastLoginAt ? AccountRepository.serializeDate(account.lastLoginAt) : null
    };

    if (options.includePasswordHash) {
      serialized.passwordHash = String(account.passwordHash ?? "");
    }

    return serialized;
  }

  static serializeDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  }
}
