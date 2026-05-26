"use client";

import { VALERIO_KEYS, formatStatName, getCardValerio } from "../../ui.js";
import {
  ValerioStatIcon,
  ValerioStatTerm,
  ValerioStatTooltipLine,
  ValerioStatTooltipTitle
} from "../ValerioStatIcon/ValerioStatIcon.jsx";
import styles from "./ValerioStats.module.css";

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
        const value = valerio[key] ?? 0;
        const statName = formatStatName(key);
        const isHot = hotSet.has(key);
        const isCool = coolSet.has(key);

        return (
          <ValerioStatIcon
            key={key}
            statKey={key}
            value={value}
            active={isHot}
            trait={isCool}
            compact={compact}
            title={`${statName}: ${value}`}
            tooltip={
              <>
                <ValerioStatTooltipTitle statKey={key}>
                  {key} - {statName}
                </ValerioStatTooltipTitle>

                <ValerioStatTooltipLine>
                  <ValerioStatTerm statKey={key}>
                    {statName}
                  </ValerioStatTerm>
                  <span> originale: {value}</span>
                </ValerioStatTooltipLine>
              </>
            }
          />
        );
      })}
    </div>
  );
}
