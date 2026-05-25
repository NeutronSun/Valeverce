"use client";

import { VALERIO_KEYS, formatStatName, getCardValerio } from "../../ui.js";
import styles from "./ValerioStats.module.css";

const statClasses = {
  V: styles.statV,
  A: styles.statA,
  L: styles.statL,
  E: styles.statE,
  R: styles.statR,
  I: styles.statI,
  O: styles.statO
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

export function ValerioStats({ card, hot = [], cool = [], compact = false }) {
  const valerio = getCardValerio(card);
  const hotSet = new Set(hot);
  const coolSet = new Set(cool);

  return (
    <div className={classNames(styles.root, compact && styles.compact)}>
      {VALERIO_KEYS.map((key) => {
        const isHot = hotSet.has(key);
        const isCool = coolSet.has(key);

        return (
          <span
            key={key}
            className={classNames(
              styles.item,
              statClasses[key],
              isHot && styles.active,
              isCool && styles.trait,
              isHot && isCool && styles.both
            )}
            title={`${formatStatName(key)}: ${valerio[key] ?? 0}`}
          >
            <b className={styles.value}>{valerio[key] ?? 0}</b>
            <small className={styles.key}>{key}</small>
          </span>
        );
      })}
    </div>
  );
}
