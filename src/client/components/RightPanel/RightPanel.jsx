"use client";

import {
  cardImageSrc,
  currentOpponent,
  getAttackPool,
  getDefensePool,
  getDraftCost,
  rarityLabel
} from "../../ui.js";
import { AbilityBox, GameCard } from "../Card/Card.jsx";
import { ResourceBar } from "../PlayerRail/PlayerRail.jsx";
import styles from "./RightPanel.module.css";

export function RightPanel({ lobby, previewCard, planPreview }) {
  const opponent = currentOpponent(lobby);
  const opponentCard = opponent?.selectedCard ?? opponent?.selected?.selectedCard ?? null;
  const card = previewCard ?? opponentCard;

  return (
    <aside className={styles.root}>
      {opponent ? (
        <section className={styles.opponent}>
          <div className={styles.opponentArt}>
            {opponentCard ? <img src={cardImageSrc(opponentCard)} alt={opponentCard.name} /> : "?"}
          </div>
          <div className={styles.opponentBody}>
            <div className={styles.opponentTitle}>
              <strong>{opponent.name}</strong>
              <span>{opponentCard?.name ?? "Carta coperta"}</span>
            </div>
            <div className={styles.bars}>
              <ResourceBar type="health" label="PV" value={opponent.health} max={opponent.maxHealth} />
              <ResourceBar type="mana" label="Mana" value={opponent.mana} max={10} />
            </div>
          </div>
        </section>
      ) : null}

      {card ? (
        <section className={styles.summary}>
          <div className={styles.heading}>
            <span>{previewCard ? "Carta selezionata" : "Carta avversaria"}</span>
          </div>
          <GameCard card={card} disabled />
          <AbilityBox ability={card.active} kind="Attiva" />
          <AbilityBox ability={card.passive} kind="Passiva" />
          <div className={styles.infoGrid}>
            <span>Costo <b>{getDraftCost(card)}</b></span>
            <span>ATT <b>{card.combat?.attackPower ?? 0}% · {getAttackPool(card)}</b></span>
            <span>DIF <b>{card.combat?.defensePower ?? 0}% · {getDefensePool(card)}</b></span>
            <span>Rarità <b>{rarityLabel(card.rarity)}</b></span>
          </div>
        </section>
      ) : (
        <section className={styles.panel}>
          <p>Nessuna carta da ispezionare.</p>
        </section>
      )}

      {planPreview?.length ? (
        <section className={styles.preview}>
          <div className={styles.heading}>
            <span>Preview breccia</span>
          </div>
          {planPreview.map((line) => (
            <div key={line.key} className={styles.previewLine}>
              <strong>{line.title}</strong>
              <small>{line.text}</small>
            </div>
          ))}
        </section>
      ) : null}

    </aside>
  );
}
