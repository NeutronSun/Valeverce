"use client";

import { SETTINGS } from "../../../game.js";
import { cardImageSrc, rarityLabel, sortCardsByRarity } from "../../ui.js";
import styles from "./PlayerRail.module.css";

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function ratioStyle(value, max) {
  const safeMax = Math.max(1, Number(max ?? 1));
  const ratio = Math.max(0, Math.min(1, Number(value ?? 0) / safeMax));
  return /** @type {import("react").CSSProperties} */ (
    /** @type {unknown} */ ({
      "--bar-ratio": ratio
    })
  );
}

export function PlayerRail({ lobby, draftThemeNav = [] }) {
  if (!lobby) {
    return null;
  }

  const selfId = lobby.self?.id;
  const opponentId = lobby.activePair?.find((playerId) => playerId !== selfId);
  const selfDeck = sortCardsByRarity(lobby.self?.deck ?? []);

  return (
    <aside className={styles.root}>
      {draftThemeNav.length ? <ThemeMap items={draftThemeNav} /> : null}
      <section className={styles.panel}>
        <div className={styles.heading}>
          <span>Giocatori</span>
          <b>{lobby.players.length}/{SETTINGS.maxPlayers}</b>
        </div>
        <div className={styles.players}>
          {lobby.players.map((player) => (
            <PlayerPlate
              key={player.id}
              player={player}
              isSelf={player.id === selfId}
              isOpponent={player.id === opponentId}
            />
          ))}
        </div>
      </section>

      {selfDeck.length ? <DeckPanel deck={selfDeck} currentCardId={lobby.self?.selected?.cardId} /> : null}
      {lobby.phase === "draft" ? <RarityLegend /> : null}
    </aside>
  );
}

function ThemeMap({ items }) {
  function scrollToTheme(targetId) {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  return (
    <section className={classNames(styles.panel, styles.themeMap)}>
      <div className={styles.themeMapHead}>
        <span className={styles.themeMapLabel}>Mappa temi</span>
        <b className={styles.themeMapCount}>{items.length}</b>
      </div>
      <div className={styles.themeMapList}>
        {items.map((item) => (
          <button
            key={item.theme}
            type="button"
            className={styles.themeMapButton}
            title={`Vai a ${item.theme}`}
            onClick={() => scrollToTheme(item.targetId)}
          >
            <span className={styles.themeMapDot} />
            <span className={styles.themeMapName}>{item.theme}</span>
            <b className={styles.themeMapAmount}>{item.count}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function PlayerPlate({ player, isSelf, isOpponent }) {
  return (
    <article className={classNames(styles.plate, isSelf && styles.self, isOpponent && styles.opponent, !player.alive && styles.out)}>
      <div className={styles.plateHead}>
        <span>{player.deckCount ?? 0}</span>
        <strong>{player.name}</strong>
        <small>{isSelf ? "tu" : player.isActive ? "duello" : `${player.deckCount} carte`}</small>
      </div>
      <CardStrip player={player} />
      <ResourceBar type="health" label="PV" value={player.health} max={player.maxHealth} />
      <ResourceBar type="mana" label="Mana" value={player.mana} max={10} />
    </article>
  );
}

function RarityLegend() {
  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <span>Rarità</span>
      </div>
      <div className={styles.rarityGrid}>
        <span>Comune</span>
        <span className={styles.rare}>Rara</span>
        <span className={styles.epic}>Epica</span>
        <span className={styles.legendary}>Leggendaria</span>
        <span className={styles.mythic}>Mitica</span>
      </div>
    </section>
  );
}

function DeckPanel({ deck, currentCardId }) {
  return (
    <section className={classNames(styles.panel, styles.deck)}>
      <div className={styles.heading}>
        <span>Il tuo mazzo</span>
        <small>{deck.length} carte</small>
      </div>
      <div className={styles.deckList}>
        {deck.map((card) => (
          <div key={card.id} className={classNames(styles.deckRow, card.id === currentCardId && styles.current)}>
            <img src={cardImageSrc(card)} alt={card.name} />
            <strong>{card.name}</strong>
            <span>{rarityLabel(card.rarity)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResourceBar({ type, label, value, max, compact = false }) {
  const safeMax = Math.max(1, Number(max ?? 1));

  return (
    <div className={classNames(styles.resource, type === "mana" && styles.mana, compact && styles.compact)} style={ratioStyle(value, safeMax)}>
      <i />
      <span>
        {compact ? `${value}/${safeMax}` : `${label} ${value}/${safeMax}`}
      </span>
    </div>
  );
}

function CardStrip({ player }) {
  if (!player.deck?.length) {
    return <div className={styles.cardStrip} />;
  }

  return (
    <div className={styles.cardStrip}>
      {player.deck.map((card) => {
        const cooldown = Number(player.cooldowns?.[card.id] ?? 0);
        return (
          <span key={card.id} className={classNames(styles.cardThumb, cooldown > 0 && styles.cooling)}>
            <img src={cardImageSrc(card)} alt={card.name} />
            {cooldown > 0 ? <b>{cooldown}</b> : null}
          </span>
        );
      })}
    </div>
  );
}
