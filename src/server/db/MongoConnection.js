import { MongoClient } from "mongodb";

export class MongoConnection {
  static DEFAULT_DB_NAME = "valeverce";
  static SERVER_SELECTION_TIMEOUT_MS = 5000;
  static CONNECT_TIMEOUT_MS = 5000;

  static clientPromise = null;

  static getDatabaseName() {
    return String(process.env.MONGODB_DB_NAME ?? MongoConnection.DEFAULT_DB_NAME).trim() || MongoConnection.DEFAULT_DB_NAME;
  }

  static getMongoUrl() {
    const mongoUrl = String(process.env.MONGODB_URL ?? "").trim();
    if (!mongoUrl) {
      throw new Error("MONGODB_URL non configurato");
    }
    return mongoUrl;
  }

  static async getClient() {
    if (!MongoConnection.clientPromise) {
      const client = new MongoClient(MongoConnection.getMongoUrl(), {
        ignoreUndefined: true,
        serverSelectionTimeoutMS: MongoConnection.SERVER_SELECTION_TIMEOUT_MS,
        connectTimeoutMS: MongoConnection.CONNECT_TIMEOUT_MS
      });
      MongoConnection.clientPromise = client.connect();
    }

    return MongoConnection.clientPromise;
  }

  static async getDb() {
    const client = await MongoConnection.getClient();
    return client.db(MongoConnection.getDatabaseName());
  }

  static async collection(name) {
    const db = await MongoConnection.getDb();
    return db.collection(name);
  }
}
