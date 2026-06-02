import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);

export class PasswordHasher {
  static SALT_BYTES = 16;
  static KEY_LENGTH = 64;
  static FORMAT = "scrypt";

  static async hash(password) {
    const salt = crypto.randomBytes(PasswordHasher.SALT_BYTES).toString("hex");
    const key = await scryptAsync(String(password ?? ""), salt, PasswordHasher.KEY_LENGTH);
    return `${PasswordHasher.FORMAT}:${salt}:${Buffer.from(key).toString("hex")}`;
  }

  static async verify(password, storedHash) {
    const [format, salt, hash] = String(storedHash ?? "").split(":");
    if (format !== PasswordHasher.FORMAT || !salt || !hash) {
      return false;
    }

    const expected = Buffer.from(hash, "hex");
    const key = await scryptAsync(String(password ?? ""), salt, expected.length);
    const actual = Buffer.from(key);

    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
}
