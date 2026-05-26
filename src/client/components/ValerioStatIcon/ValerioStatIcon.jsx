"use client";

import { formatStatName } from "../../ui.js";
import styles from "./ValerioStatIcon.module.css";

export const valerioStatClasses = {
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

function getTooltipPlacement(statKey) {
  if (statKey === "V" || statKey === "A" || statKey === "L") {
    return styles.tooltipStart;
  }

  if (statKey === "R" || statKey === "I" || statKey === "O") {
    return styles.tooltipEnd;
  }

  return styles.tooltipCenter;
}

export function ValerioStatIcon({
  statKey,
  value = 0,
  active = false,
  trait = false,
  compact = false,
  tooltip = null,
  title = ""
}) {
  const both = active && trait;
  const tooltipPlacement = getTooltipPlacement(statKey);

  return (
    <span
      className={classNames(
        styles.root,
        valerioStatClasses[statKey],
        compact && styles.compact,
        active && styles.active,
        trait && styles.trait,
        both && styles.both
      )}
      title={title || `${formatStatName(statKey)}: ${value}`}
    >
      <b className={styles.value}>{value}</b>
      <small className={styles.key}>{statKey}</small>
      {tooltip ? <div className={classNames(styles.tooltip, tooltipPlacement)}>{tooltip}</div> : null}
    </span>
  );
}

export function ValerioStatTerm({ statKey, children }) {
  return <strong className={classNames(styles.term, valerioStatClasses[statKey])}>{children}</strong>;
}

export function ValerioStatTooltipTitle({ statKey, children }) {
  return <strong className={classNames(styles.tooltipTitle, valerioStatClasses[statKey])}>{children}</strong>;
}

export function ValerioStatTooltipLine({ children }) {
  return <span className={styles.tooltipLine}>{children}</span>;
}
