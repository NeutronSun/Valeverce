"use client";

import styles from "./ConnectionSignal.module.css";

const bars = [1, 2, 3, 4];

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function getSignalLevel(connectionState, pingMs) {
  if (connectionState === "disconnected") {
    return 0;
  }

  if (connectionState === "connecting") {
    return 2;
  }

  if (!Number.isFinite(pingMs)) {
    return connectionState === "connected" ? 3 : 1;
  }

  if (pingMs <= 80) {
    return 4;
  }

  if (pingMs <= 160) {
    return 3;
  }

  if (pingMs <= 320) {
    return 2;
  }

  return 1;
}

function getPingLabel(pingMs) {
  return Number.isFinite(pingMs) ? `${pingMs} ms` : "-- ms";
}

function barStyle(bar) {
  return /** @type {import("react").CSSProperties} */ (
    /** @type {unknown} */ ({
      "--bar-index": bar
    })
  );
}

export function ConnectionSignal({ connectionState = "disconnected", pingMs = null, className = "" }) {
  const level = getSignalLevel(connectionState, pingMs);
  const pingLabel = getPingLabel(pingMs);
  const stateLabel = connectionState === "connected" ? "Connesso" : connectionState === "connecting" ? "Connessione" : "Offline";

  return (
    <span
      className={classNames(styles.root, styles[connectionState], className)}
      title={`Ping: ${pingLabel}`}
      aria-label={`Ping: ${pingLabel}`}
    >
      <span className={styles.bars}>
        {bars.map((bar) => (
          <span
            key={bar}
            className={classNames(styles.bar, bar <= level && styles.barActive)}
            style={barStyle(bar)}
          />
        ))}
      </span>
      <span className={styles.tooltip}>
        <span className={styles.tooltipLabel}>{stateLabel}</span>
        <span className={styles.tooltipValue}>{pingLabel}</span>
      </span>
    </span>
  );
}
