"use client";

import {
  cardImageSrc,
  currentOpponent,
  getAttackPool,
  getDefensePool,
  getDraftCost,
  rarityLabel
} from "../ui.js";
import { AbilityBox, GameCard } from "./Card/index.js";
import { ResourceBar } from "./PlayerRail/index.js";

export function RightPanel({ lobby, previewCard, planPreview }) {
  const opponent = currentOpponent(lobby);
  const opponentCard = opponent?.selectedCard ?? opponent?.selected?.selectedCard ?? null;
  const card = previewCard ?? opponentCard;

  return (
    <aside className="right-rail right-panel">
      {opponent ? (
        <section className="opponent-hud-card">
          <div className="opponent-card-art">
            {opponentCard ? <img src={cardImageSrc(opponentCard)} alt={opponentCard.name} /> : "?"}
          </div>
          <div className="opponent-hud-body">
            <div className="opponent-hud-title">
              <strong>{opponent.name}</strong>
              <span>{opponentCard?.name ?? "Carta coperta"}</span>
            </div>
            <div className="opponent-hud-bars">
              <ResourceBar type="health" label="PV" value={opponent.health} max={opponent.maxHealth} />
              <ResourceBar type="mana" label="Mana" value={opponent.mana} max={10} />
            </div>
          </div>
        </section>
      ) : null}

      {card ? (
        <section className="side-summary">
          <div className="panel-heading">
            <span>{previewCard ? "Carta selezionata" : "Carta avversaria"}</span>
          </div>
          <GameCard card={card} disabled />
          <AbilityBox ability={card.active} kind="Attiva" />
          <AbilityBox ability={card.passive} kind="Passiva" />
          <div className="card-info-grid">
            <span>Costo <b>{getDraftCost(card)}</b></span>
            <span>ATT <b>{card.combat?.attackPower ?? 0}% · {getAttackPool(card)}</b></span>
            <span>DIF <b>{card.combat?.defensePower ?? 0}% · {getDefensePool(card)}</b></span>
            <span>Rarità <b>{rarityLabel(card.rarity)}</b></span>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p>Nessuna carta da ispezionare.</p>
        </section>
      )}

      {planPreview?.length ? (
        <section className="preview-stack">
          <div className="panel-heading">
            <span>Preview breccia</span>
          </div>
          {planPreview.map((line) => (
            <div key={line.key} className="preview-line">
              <strong>{line.title}</strong>
              <small>{line.text}</small>
            </div>
          ))}
        </section>
      ) : null}

    </aside>
  );
}
