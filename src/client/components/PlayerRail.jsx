"use client";

import { SETTINGS } from "../../game.js";
import { cardImageSrc, rarityLabel, sortCardsByRarity } from "../ui.js";

export function PlayerRail({ lobby }) {
  if (!lobby) {
    return null;
  }

  const selfId = lobby.self?.id;
  const opponentId = lobby.activePair?.find((playerId) => playerId !== selfId);
  const selfDeck = sortCardsByRarity(lobby.self?.deck ?? []);

  return (
    <aside className="left-rail player-rail">
      <section className="rail-card">
        <div className="rail-section-title">
          <span>Giocatori</span>
          <b>{lobby.players.length}/{SETTINGS.maxPlayers}</b>
        </div>
        <div className="top-players">
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

function PlayerPlate({ player, isSelf, isOpponent }) {
  return (
    <article
      className={[
        "top-player",
        isSelf ? "is-self" : "",
        isOpponent ? "is-current-opponent" : "",
        !player.alive ? "is-out" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="top-player-head">
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
    <section className="rail-card rarity-legend">
      <div className="rail-section-title">
        <span>Rarità</span>
      </div>
      <div className="rarity-legend-grid">
        <span className="rarity-comune">Comune</span>
        <span className="rarity-rara">Rara</span>
        <span className="rarity-epica">Epica</span>
        <span className="rarity-leggendaria">Leggendaria</span>
        <span className="rarity-mitica">Mitica</span>
      </div>
    </section>
  );
}

function DeckPanel({ deck, currentCardId }) {
  return (
    <section className="deck-panel is-left-deck">
      <div className="panel-heading">
        <span>Il tuo mazzo</span>
        <small>{deck.length} carte</small>
      </div>
      <div className="deck-list">
        {deck.map((card) => (
          <div key={card.id} className={`deck-row ${card.id === currentCardId ? "is-current" : ""}`}>
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
  const width = Math.max(0, Math.min(100, (Number(value ?? 0) / safeMax) * 100));

  return (
    <div className={`resource-bar is-${type}`}>
      <i style={{ width: `${width}%` }} />
      <span>
        {compact ? `${value}/${safeMax}` : `${label} ${value}/${safeMax}`}
      </span>
    </div>
  );
}

function CardStrip({ player }) {
  if (!player.deck?.length) {
    return <div className="top-card-strip" />;
  }

  return (
    <div className="top-card-strip">
      {player.deck.map((card) => {
        const cooldown = Number(player.cooldowns?.[card.id] ?? 0);
        return (
          <span key={card.id} className={`top-card-thumb${cooldown > 0 ? " is-cooling" : ""}`}>
            <img src={cardImageSrc(card)} alt={card.name} />
            {cooldown > 0 ? <b>{cooldown}</b> : null}
          </span>
        );
      })}
    </div>
  );
}
