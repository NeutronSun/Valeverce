import { MongoConnection } from "../db/MongoConnection.js";
import { PlayerProfile } from "../../shared/profile/PlayerProfile.js";

export class ProfileRepository {
  static COLLECTION = "profiles";
  static ACCOUNT_INDEX = "profiles_accountId_unique";

  constructor(connection = MongoConnection) {
    this.connection = connection;
    this.indexesReady = false;
  }

  async collection() {
    return this.connection.collection(ProfileRepository.COLLECTION);
  }

  async ensureIndexes() {
    if (this.indexesReady) {
      return;
    }

    const collection = await this.collection();
    await collection.createIndex({ accountId: 1 }, { unique: true, name: ProfileRepository.ACCOUNT_INDEX });
    this.indexesReady = true;
  }

  async getByAccountId(accountId) {
    await this.ensureIndexes();

    const collection = await this.collection();
    const profile = await collection.findOne({ accountId });
    return profile ? ProfileRepository.serialize(profile) : null;
  }

  async upsertForAccount(accountId, profileInput, fallbackUsername) {
    await this.ensureIndexes();

    const profile = PlayerProfile.from(
      {
        ...profileInput,
        profileId: accountId
      },
      fallbackUsername
    ).toJSON();
    const now = new Date();
    const collection = await this.collection();
    await collection.updateOne(
      { accountId },
      {
        $set: {
          accountId,
          profile,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    return profile;
  }

  static serialize(profileDoc) {
    return PlayerProfile.from(profileDoc.profile).toJSON();
  }
}
