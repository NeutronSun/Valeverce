"use client";

import { VALERIO_KEYS, formatStatName, getCardValerio } from "../ui.js";

export function ValerioStats({ card, hot = [], cool = [], compact = false }) {
  const valerio = getCardValerio(card);
  const hotSet = new Set(hot);
  const coolSet = new Set(cool);

  return (
    <div className={`stats valerio-bubbles${compact ? " is-compact" : ""}`}>
      {VALERIO_KEYS.map((key) => {
        const className = [
          hotSet.has(key) ? "is-active-target" : "",
          coolSet.has(key) ? "is-trait-target" : "",
          hotSet.has(key) && coolSet.has(key) ? "is-both-target" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span key={key} className={className} data-tooltip={`${formatStatName(key)}: ${valerio[key] ?? 0}`}>
            <b>{valerio[key] ?? 0}</b>
            <small>{key}</small>
          </span>
        );
      })}
    </div>
  );
}
