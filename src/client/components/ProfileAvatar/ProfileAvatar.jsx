"use client";

import { PlayerProfile } from "../../../shared/profile/PlayerProfile.js";
import { getProfileIconSrc } from "../../profile/ProfileIconAssets.js";
import styles from "./ProfileAvatar.module.css";

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

export function ProfileAvatar({ profile, name = "", size = "md", label = false }) {
  const normalized = PlayerProfile.from(profile ?? {}, name).toJSON();
  const iconSrc = normalized.avatar.kind === "image" ? getProfileIconSrc(normalized.avatar.iconId) : "";

  return (
    <span className={classNames(styles.root, styles[size])} data-color-id={normalized.avatar.colorId}>
      {iconSrc ? (
        <img className={styles.image} src={iconSrc} alt="" aria-hidden="true" />
      ) : (
        <span className={styles.initials}>{normalized.avatar.initials}</span>
      )}
      {label ? <strong className={styles.label}>{normalized.username}</strong> : null}
    </span>
  );
}
