"use client";

import { cardImageSrc, getAttackPool, getDefensePool, getDraftCost, normalizeRarity, rarityLabel } from "../../ui.js";
import { ValerioStats } from "../ValerioStats/ValerioStats.jsx";
import styles from "./Card.module.css";

const rarityClasses = {
  comune: styles.rarityCommon,
  rara: styles.rarityRare,
  epica: styles.rarityEpic,
  leggendaria: styles.rarityLegendary,
  mitica: styles.rarityMythic,
  speciale: styles.rarityMythic
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

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
    return <div className={styles.empty}>Carta nascosta</div>;
  }

  const normalizedRarity = normalizeRarity(card.rarity);

  return (
    <div
      className={classNames(
        styles.root,
        rarityClasses[normalizedRarity] ?? styles.rarityCommon,
        selected && styles.selected,
        mini && styles.mini,
        takenByName && styles.taken
      )}
      data-rarity={normalizedRarity}
    >
      <button type="button" className={styles.button} disabled={disabled} onClick={onClick}>
        <span className={styles.imageFallback}>{card.name?.slice(0, 2) ?? "?"}</span>
        <img className={styles.image} src={cardImageSrc(card)} alt={card.name} />
        <span className={styles.cost}>{getDraftCost(card)}</span>
        <span className={styles.rarity}>{rarityLabel(card.rarity)}</span>
        {cooldown > 0 ? <span className={styles.cooldown}>{cooldown}</span> : null}
        {takenByName ? <span className={styles.takenBadge}>Presa da {takenByName}</span> : null}
        <span className={styles.combat}>
          <span>ATT {getAttackPool(card)}</span>
          <span>DIF {getDefensePool(card)}</span>
        </span>
        <span className={styles.body}>
          <strong>{card.name}</strong>
          <em className={styles.rarityText}>{rarityLabel(card.rarity)}</em>
          <ValerioStats card={card} compact />
        </span>
      </button>
    </div>
  );
}

export function AbilityBox({ ability, kind = "Attiva" }) {
  if (!ability) {
    return null;
  }

  const normalizedKind = kind.toLowerCase().includes("pass") ? "passive" : "active";

  return (
    <div className={classNames(styles.ability, styles[normalizedKind])}>
      <span>{kind}{ability.cost ? ` - ${ability.cost} mana` : ""}</span>
      <strong>{ability.name}</strong>
      <p>{ability.text}</p>
    </div>
  );
}
