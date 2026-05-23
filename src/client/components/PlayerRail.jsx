"use client";

import { cardImageSrc } from "../ui.js";

export function PlayerRail({ lobby }) {
  if (!lobby) {
    return null;
  }

  const selfId = lobby.self?.id;
  const opponentId = lobby.activePair?.find((playerId) => playerId !== selfId);

  return (
    <aside className="left-rail player-rail">
      <div className="rail-title">
        <strong>{lobby.id}</strong>
        <span>{lobby.phase}</span>
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
        <strong>{player.name}</strong>
        <small>{isSelf ? "tu" : player.isActive ? "duello" : `${player.deckCount} carte`}</small>
      </div>
      <CardStrip player={player} />
      <ResourceBar type="health" label="PV" value={player.health} max={player.maxHealth} />
      <ResourceBar type="mana" label="Mana" value={player.mana} max={10} />
    </article>
  );
}

export function ResourceBar({ type, label, value, max }) {
  const safeMax = Math.max(1, Number(max ?? 1));
  const width = Math.max(0, Math.min(100, (Number(value ?? 0) / safeMax) * 100));

  return (
    <div className={`resource-bar is-${type}`}>
      <i style={{ width: `${width}%` }} />
      <span>
        {label} {value}/{safeMax}
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
