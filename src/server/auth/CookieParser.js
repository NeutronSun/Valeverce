export class CookieParser {
  static get(cookieHeader, name) {
    const targetName = String(name ?? "").trim();
    if (!targetName) {
      return "";
    }

    for (const part of String(cookieHeader ?? "").split(";")) {
      const [rawKey, ...rawValue] = part.split("=");
      const key = rawKey.trim();
      if (key === targetName) {
        return decodeURIComponent(rawValue.join("=").trim());
      }
    }

    return "";
  }
}
