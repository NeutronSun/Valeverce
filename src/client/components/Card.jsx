"use client";

import { cardImageSrc, getAttackPool, getDefensePool, getDraftCost, rarityClass, rarityLabel } from "../ui.js";
import { ValerioStats } from "./ValerioStats.jsx";

export function GameCard({
  card,
  disabled = false,
  selected = false,
  mini = false,
  takenByName = "",
  cooldown = 0,
  onClick = undefined
}) {
  if (!card) {
    return <div className="card-empty">Carta nascosta</div>;
  }

  return (
    <div
      className={[
        "game-card",
        rarityClass(card.rarity),
        selected ? "is-selected" : "",
        mini ? "is-draft-mini" : "",
        takenByName ? "is-taken" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button type="button" disabled={disabled} onClick={onClick}>
        <span className="card-image-fallback">{card.name?.slice(0, 2) ?? "?"}</span>
        <img className="card-full-image" src={cardImageSrc(card)} alt={card.name} />
        {cooldown > 0 ? <span className="cooldown-badge">{cooldown}</span> : null}
        {takenByName ? <span className="taken-label is-overlay">Presa da {takenByName}</span> : null}
        <span className="card-overlay card-body">
          <strong>{card.name}</strong>
          <em className="rarity-tag">{rarityLabel(card.rarity)}</em>
          <ValerioStats card={card} compact />
          <span className="combat-stats">
            <span>Costo {getDraftCost(card)}</span>
            <span>ATT {card.combat?.attackPower ?? 0}% ({getAttackPool(card)})</span>
            <span>DIF {card.combat?.defensePower ?? 0}% ({getDefensePool(card)})</span>
          </span>
        </span>
      </button>
    </div>
  );
}

export function AbilityBox({ ability, kind = "Attiva" }) {
  if (!ability) {
    return null;
  }

  return (
    <div className="ability-box is-compact">
      <span>{kind}{ability.cost ? ` - ${ability.cost} mana` : ""}</span>
      <strong>{ability.name}</strong>
      <p>{ability.text}</p>
    </div>
  );
}
