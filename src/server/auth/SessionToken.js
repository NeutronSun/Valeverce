import crypto from "node:crypto";

export class SessionToken {
  static TOKEN_BYTES = 32;
  static HASH_ALGORITHM = "sha256";

  static create() {
    return crypto.randomBytes(SessionToken.TOKEN_BYTES).toString("base64url");
  }

  static hash(token) {
    return crypto.createHash(SessionToken.HASH_ALGORITHM).update(String(token ?? "")).digest("hex");
  }
}
