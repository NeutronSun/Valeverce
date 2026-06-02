export const PROFILE_COLOR_OPTIONS = Object.freeze(["gold", "green", "blue", "red", "violet", "teal", "pink", "orange"]);
export const PROFILE_ICON_IDS = Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8"]);

export class PlayerProfile {
  static DEFAULT_USERNAME = "Player";
  static DEFAULT_COLOR_ID = "gold";
  static DEFAULT_ICON_ID = "1";
  static MAX_USERNAME_LENGTH = 18;
  static MAX_INITIALS_LENGTH = 2;

  constructor({ profileId, username, avatar, createdAt, updatedAt }) {
    this.profileId = profileId;
    this.username = username;
    this.avatar = avatar;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static create(input = {}) {
    const now = new Date().toISOString();
    return PlayerProfile.from({
      profileId: input.profileId ?? PlayerProfile.makeProfileId(),
      username: input.username ?? PlayerProfile.DEFAULT_USERNAME,
      avatar: input.avatar,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    });
  }

  static from(input = {}, fallbackUsername = PlayerProfile.DEFAULT_USERNAME) {
    const source = /** @type {Record<string, any>} */ (input && typeof input === "object" ? input : {});
    const username = PlayerProfile.normalizeUsername(source.username ?? fallbackUsername);
    const createdAt = PlayerProfile.normalizeDate(source.createdAt) ?? new Date().toISOString();
    const updatedAt = PlayerProfile.normalizeDate(source.updatedAt) ?? new Date().toISOString();
    const avatar = PlayerProfile.normalizeAvatar(source.avatar, username);

    return new PlayerProfile({
      profileId: PlayerProfile.normalizeProfileId(source.profileId) ?? PlayerProfile.makeProfileId(),
      username,
      avatar,
      createdAt,
      updatedAt
    });
  }

  static update(profile, patch = {}) {
    const base = PlayerProfile.from(profile);
    return PlayerProfile.from({
      ...base.toJSON(),
      ...patch,
      avatar: {
        ...base.avatar,
        ...(patch.avatar ?? {})
      },
      updatedAt: new Date().toISOString()
    });
  }

  static normalizeUsername(value) {
    const username = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, PlayerProfile.MAX_USERNAME_LENGTH);
    return username || PlayerProfile.DEFAULT_USERNAME;
  }

  static normalizeAvatar(avatar, username) {
    const source = avatar && typeof avatar === "object" ? avatar : {};
    const iconId = PlayerProfile.normalizeIconId(source.iconId) ?? PlayerProfile.iconForName(username);
    const colorId = PROFILE_COLOR_OPTIONS.includes(source.colorId) ? source.colorId : PlayerProfile.colorForName(username);
    const initials = PlayerProfile.normalizeInitials(source.initials) || PlayerProfile.makeInitials(username);

    return {
      kind: "image",
      iconId,
      initials,
      colorId
    };
  }

  static normalizeInitials(value) {
    return String(value ?? "")
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, PlayerProfile.MAX_INITIALS_LENGTH)
      .toUpperCase();
  }

  static makeInitials(username) {
    const parts = PlayerProfile.normalizeUsername(username)
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return String(parts[0] ?? PlayerProfile.DEFAULT_USERNAME)
      .slice(0, PlayerProfile.MAX_INITIALS_LENGTH)
      .toUpperCase();
  }

  static colorForName(username) {
    const name = PlayerProfile.normalizeUsername(username);
    let total = 0;
    for (const character of name) {
      total += character.charCodeAt(0);
    }

    return PROFILE_COLOR_OPTIONS[total % PROFILE_COLOR_OPTIONS.length] ?? PlayerProfile.DEFAULT_COLOR_ID;
  }

  static iconForName(username) {
    const name = PlayerProfile.normalizeUsername(username);
    let total = 0;
    for (const character of name) {
      total += character.charCodeAt(0);
    }

    return PROFILE_ICON_IDS[total % PROFILE_ICON_IDS.length] ?? PlayerProfile.DEFAULT_ICON_ID;
  }

  static normalizeIconId(value) {
    const iconId = String(value ?? "").trim();
    return PROFILE_ICON_IDS.includes(iconId) ? iconId : null;
  }

  static normalizeProfileId(value) {
    const profileId = String(value ?? "").trim();
    return profileId || null;
  }

  static normalizeDate(value) {
    const date = String(value ?? "").trim();
    return Number.isNaN(Date.parse(date)) ? null : date;
  }

  static makeProfileId() {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }

    return `profile_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  toJSON() {
    return {
      profileId: this.profileId,
      username: this.username,
      avatar: {
        kind: this.avatar.kind,
        iconId: this.avatar.iconId,
        initials: this.avatar.initials,
        colorId: this.avatar.colorId
      },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
