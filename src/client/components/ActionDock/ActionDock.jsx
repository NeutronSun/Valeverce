"use client";

import { CLIENT_EVENTS } from "../../../shared/events.js";
import {
  cardImageSrc,
  compactPlan,
  getCardValerio,
  getStatInfluences,
  getStatTooltip,
  getTraitPreview,
  phaseLabel,
  selectedStats,
  splitValerioText,
  VALERIO_KEYS,
  VALERIO_LABELS,
  validatePlanDraft
} from "../../ui.js";
import { ResourceBar } from "../PlayerRail/PlayerRail.jsx";
import { ValerioStatIcon, ValerioStatTerm } from "../ValerioStatIcon/ValerioStatIcon.jsx";
import styles from "./ActionDock.module.css";

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

export function ActionDock({ lobby, plan, selectedCardId, previewCard, canSubmitPlan, emit, onToggleActive }) {
  const self = lobby?.self;
  const draftItem = lobby?.draft?.pool?.find((item) => item.card?.id === previewCard?.id);
  const selectedCard =
    lobby?.phase === "draft"
      ? previewCard
      : self?.selected?.selectedCard ?? self?.deck?.find((card) => card.id === selectedCardId) ?? null;
  const validation = selectedCard ? validatePlanDraft(plan, selectedCard) : null;
  const trait = selectedCard ? getTraitPreview(selectedCard, plan) : null;
  const activeCost = Number(selectedCard?.active?.cost ?? 0);
  const activeAffordable = Boolean(selectedCard?.active && self?.mana >= activeCost);
  const attackSummary = formatPlanSummary(plan.attacks);
  const defenseSummary = formatPlanSummary(plan.defenses);

  let action = null;
  if (lobby?.phase === "lobby" && self?.id === lobby.hostId) {
    action = (
      <button type="button" className={styles.primary} onClick={() => emit(CLIENT_EVENTS.START_GAME)}>
        Avvia partita
      </button>
    );
  } else if (lobby?.phase === "draft") {
    const canDraft = Boolean(self?.isCurrentDrafter && selectedCard && draftItem?.canPick);
    action = (
      <button
        type="button"
        className={canDraft ? styles.primary : styles.secondary}
        disabled={!canDraft}
        onClick={() => selectedCard && emit(CLIENT_EVENTS.DRAFT_CARD, { cardId: selectedCard.id })}
      >
        {self?.isCurrentDrafter ? (selectedCard ? "Drafta" : "Scegli carta") : "Aspetta turno"}
      </button>
    );
  } else if (lobby?.phase === "select") {
    const utilityReady = !self?.isActive || Boolean(self?.utilityDeckReady);
    action = (
      <button
        type="button"
        className={styles.primary}
        disabled={!self?.isActive || !selectedCardId || !utilityReady}
        onClick={() => emit(CLIENT_EVENTS.SELECT_CARD, { cardId: selectedCardId })}
      >
        {self?.isActive ? (utilityReady ? "Seleziona carta" : "Scegli utility deck") : "Aspetta"}
      </button>
    );
  } else if (lobby?.phase === "plan") {
    action = (
      <button
        type="button"
        className={styles.primary}
        disabled={!canSubmitPlan || self?.selected?.attacks}
        onClick={() => emit(CLIENT_EVENTS.SUBMIT_PLAN, compactPlan(plan))}
      >
        Conferma configurazione
      </button>
    );
  } else if (lobby?.phase === "reveal" && self?.id === lobby.hostId) {
    const effectWindowOpen = lobby.effectWindow?.status === "waiting";
    action = (
      <button
        type="button"
        className={effectWindowOpen ? styles.secondary : styles.primary}
        disabled={effectWindowOpen}
        onClick={() => emit(CLIENT_EVENTS.NEXT_ROUND)}
      >
        {effectWindowOpen ? "Effetti in corso" : "Prossimo round"}
      </button>
    );
  }

  const activeLocked = lobby?.phase === "plan" && (!activeAffordable || self?.selected?.attacks);
  const abilityControls = [
    selectedCard?.active ? (
      <button
        key="active"
        type="button"
        className={classNames(styles.ability, styles.activeAbility, plan.useActive && styles.on, activeLocked && styles.disabled)}
        onClick={() => {
          if (lobby?.phase === "plan" && !activeLocked) {
            onToggleActive();
          }
        }}
      >
        <span>Attiva</span>
        <small>{lobby?.phase === "plan" ? `-${activeCost}` : "A"}</small>
        <TooltipContent>
          <strong>{selectedCard.active.name ?? "Attiva"}</strong>
          <RichText text={selectedCard.active.text ?? ""} />
          <small className={styles.tooltipCost}>{activeCost} mana</small>
          <span className={classNames(styles.status, plan.useActive && styles.on)}>
            {lobby?.phase === "plan" ? (plan.useActive ? "Selezionata" : activeAffordable ? "Disponibile" : "Mana insufficiente") : "Mossa attiva"}
          </span>
        </TooltipContent>
      </button>
    ) : null
  ].filter(Boolean);

  return (
    <section className={classNames(styles.root, selectedCard && styles.withCard)} data-action-dock>
      <div className={styles.topLine}>
        <div className={styles.floatingAbilities}>
          {selectedCard?.passive ? (
            <FloatingAbility
              tone="passive"
              icon="P"
              title={selectedCard.passive.name ?? "Passiva"}
              active={trait?.applied}
            >
              <strong>Passiva</strong>
              <RichText text={trait?.title ?? selectedCard.passive.text} />
              <span className={classNames(styles.status, trait?.applied && styles.on)}>
                {trait?.applied ? "Attiva ora" : "Non attiva ora"}
              </span>
            </FloatingAbility>
          ) : null}
          {selectedCard?.active && plan.useActive ? (
            <FloatingAbility tone="active" icon="A" title={selectedCard.active.name ?? "Attiva"} active>
              <strong>Attiva selezionata</strong>
              <RichText text={selectedCard.active.text ?? selectedCard.active.name ?? ""} />
              <small className={styles.tooltipCost}>{activeCost} mana</small>
              <span className={classNames(styles.status, styles.on)}>Selezionata</span>
            </FloatingAbility>
          ) : null}
        </div>
        <div className={styles.state}>
          <span>{phaseLabel(lobby?.phase)}</span>
          <small>
            {lobby?.phase === "draft"
              ? `${self?.draftSpent ?? 0}/${self?.draftBudget ?? 20} budget`
              : lobby?.activePair?.length
                ? `Round ${lobby.round}`
                : "In attesa"}
          </small>
        </div>
      </div>
      <div className={styles.main}>
        <DockCard card={selectedCard} />
        <div className={styles.dock}>
          {validation ? (
            <div className={styles.meterRow}>
              <span className={classNames(styles.meter, styles.attack)}>
                <i>ATT</i>
                <b>{attackSummary || `${validation.attackTotal}/${validation.attackPool}`}</b>
              </span>
              <span className={classNames(styles.meter, styles.defense)}>
                <i>DIF</i>
                <b>{defenseSummary || `${validation.defenseTotal}/${validation.defensePool}`}</b>
              </span>
            </div>
          ) : null}
          <DockStats card={selectedCard} plan={plan} />
          <div className={styles.bars}>
            <ResourceBar type="health" label="PV" value={self?.health ?? 0} max={self?.maxHealth ?? 50} compact />
            <ResourceBar type="mana" label="Mana" value={self?.mana ?? 0} max={10} compact />
          </div>
        </div>
        <div className={classNames(styles.actions, abilityControls.length ? styles.hasAbilities : styles.single)}>
          {abilityControls.length ? <div className={classNames(styles.abilityStack, abilityControls.length === 1 && styles.single)}>{abilityControls}</div> : null}
          <div className={styles.mainAction}>{action}</div>
        </div>
      </div>
    </section>
  );
}

function FloatingAbility({ tone, icon, title, active, children }) {
  return (
    <div className={classNames(styles.floatingAbility, active && styles.on)} data-tone={tone}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <TooltipContent>{children}</TooltipContent>
    </div>
  );
}

function formatPlanSummary(distribution) {
  return selectedStats(distribution)
    .map((key) => `${key}${Number(distribution[key] ?? 0)}`)
    .join(" · ");
}

function DockCard({ card }) {
  if (!card) {
    return (
      <div className={classNames(styles.card, styles.empty)}>
        <div className={styles.cardArt}>
          <span>?</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardArt}>
        <span>{card.name?.slice(0, 2) ?? "?"}</span>
        <img src={cardImageSrc(card)} alt={card.name} />
      </div>
    </div>
  );
}

function DockStats({ card, plan }) {
  const valerio = getCardValerio(card);
  const influences = getStatInfluences(card, plan);
  return (
    <div className={classNames(styles.stats, !card && styles.empty)}>
      <div className={styles.statRow}>
        {VALERIO_KEYS.map((key) => {
          const influence = influences[key] ?? "";
          const value = Number(valerio[key] ?? 0);
          return (
            <ValerioStatIcon
              key={key}
              statKey={key}
              value={value}
              trait={influence === "trait" || influence === "both"}
              active={influence === "active" || influence === "both"}
              tooltip={
                <>
                  <ValerioStatTerm statKey={key}>
                  {key} - {VALERIO_LABELS[key]}
                  </ValerioStatTerm>
                  <RichText text={card ? getStatTooltip(card, key, plan) : `${VALERIO_LABELS[key]}: nessuna carta selezionata.`} />
                </>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function TooltipContent({ children }) {
  return <div className={styles.tooltip}>{children}</div>;
}

function RichText({ text }) {
  return (
    <span>
      {splitValerioText(text).map((chunk, index) =>
        chunk.stat ? (
          <ValerioStatTerm key={`${chunk.text}-${index}`} statKey={chunk.stat}>
            {chunk.text}
          </ValerioStatTerm>
        ) : (
          <span key={`${chunk.text}-${index}`}>{chunk.text}</span>
        )
      )}
    </span>
  );
}
