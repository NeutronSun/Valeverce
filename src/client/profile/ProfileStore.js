"use client";

import { PlayerProfile } from "../../shared/profile/PlayerProfile.js";

export class ProfileStore {
  static STORAGE_KEY = "valeverce.profile.v1";
  static LEGACY_NAME_KEY = "valeverce.playerName";

  static read() {
    try {
      const rawProfile = window.localStorage.getItem(ProfileStore.STORAGE_KEY);
      if (!rawProfile) {
        return null;
      }

      return PlayerProfile.from(JSON.parse(rawProfile)).toJSON();
    } catch {
      return null;
    }
  }

  static create(input = {}) {
    const profile = PlayerProfile.create(input).toJSON();
    ProfileStore.save(profile);
    return profile;
  }

  static save(profile) {
    const normalized = PlayerProfile.from(profile).toJSON();
    window.localStorage.setItem(ProfileStore.STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.setItem(ProfileStore.LEGACY_NAME_KEY, normalized.username);
    return normalized;
  }

  static update(profile, patch = {}) {
    return ProfileStore.save(PlayerProfile.update(profile, patch).toJSON());
  }
}
