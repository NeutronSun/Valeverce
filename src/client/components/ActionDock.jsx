"use client";

import { CLIENT_EVENTS } from "../../shared/events.js";
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
} from "../ui.js";
import { ResourceBar } from "./PlayerRail.jsx";

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
      <button type="button" className="dock-primary" onClick={() => emit(CLIENT_EVENTS.START_GAME)}>
        Avvia partita
      </button>
    );
  } else if (lobby?.phase === "draft") {
    const canDraft = Boolean(self?.isCurrentDrafter && selectedCard && draftItem?.canPick);
    action = (
      <button
        type="button"
        className={canDraft ? "dock-primary" : "dock-secondary"}
        disabled={!canDraft}
        onClick={() => selectedCard && emit(CLIENT_EVENTS.DRAFT_CARD, { cardId: selectedCard.id })}
      >
        {self?.isCurrentDrafter ? (selectedCard ? "Drafta" : "Scegli carta") : "Aspetta turno"}
      </button>
    );
  } else if (lobby?.phase === "select") {
    action = (
      <button
        type="button"
        className="dock-primary"
        disabled={!self?.isActive || !selectedCardId}
        onClick={() => emit(CLIENT_EVENTS.SELECT_CARD, { cardId: selectedCardId })}
      >
        {self?.isActive ? "Seleziona carta" : "Aspetta"}
      </button>
    );
  } else if (lobby?.phase === "plan") {
    action = (
      <>
        <button
          type="button"
          className={`dock-active dock-secondary rich-tooltip${plan.useActive ? " is-on" : ""}`}
          data-tooltip=""
          disabled={!activeAffordable || self?.selected?.attacks}
          onClick={onToggleActive}
        >
          Attiva <small>-{activeCost}</small>
          <TooltipContent>
            <strong>Attiva</strong>
            <RichText text={selectedCard.active?.text ?? selectedCard.active?.name ?? ""} />
            <span className={plan.useActive ? "tooltip-status is-on" : "tooltip-status"}>
              {plan.useActive ? "Selezionata" : activeAffordable ? "Disponibile" : "Mana insufficiente"}
            </span>
          </TooltipContent>
        </button>
        <button
          type="button"
          className="dock-primary"
          disabled={!canSubmitPlan || self?.selected?.attacks}
          onClick={() => emit(CLIENT_EVENTS.SUBMIT_PLAN, compactPlan(plan))}
        >
          Conferma configurazione
        </button>
      </>
    );
  } else if (lobby?.phase === "reveal" && self?.id === lobby.hostId) {
    action = (
      <button type="button" className="dock-primary" onClick={() => emit(CLIENT_EVENTS.NEXT_ROUND)}>
        Prossimo round
      </button>
    );
  }

  return (
    <section className={`action-hud${selectedCard ? " has-card" : ""}`} data-action-dock>
      <div className="dock-topline">
        {selectedCard?.passive ? (
          <div className={`dock-trait rich-tooltip ${trait?.applied ? "is-active" : ""}`} data-tooltip="">
            <span className="trait-mark">P</span>
            <strong>{selectedCard.passive.name}</strong>
            <TooltipContent>
              <strong>Passiva</strong>
              <RichText text={trait?.title ?? selectedCard.passive.text} />
              <span className={trait?.applied ? "tooltip-status is-on" : "tooltip-status"}>
                {trait?.applied ? "Attiva ora" : "Non attiva ora"}
              </span>
            </TooltipContent>
          </div>
        ) : (
          <div className="dock-trait is-empty" />
        )}
        <div className="dock-state">
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
      <div className="hud-main">
        <DockCard card={selectedCard} />
        <div className="action-dock">
          {validation ? (
            <div className="dock-meter-row">
              <span className="is-attack">
                <i>ATT</i>
                <b>{attackSummary || `${validation.attackTotal}/${validation.attackPool}`}</b>
              </span>
              <span className="is-defense">
                <i>DIF</i>
                <b>{defenseSummary || `${validation.defenseTotal}/${validation.defensePool}`}</b>
              </span>
            </div>
          ) : null}
          <DockStats card={selectedCard} plan={plan} />
          <div className={`dock-actions${lobby?.phase === "plan" && selectedCard?.active ? " has-active" : " is-single"}`}>{action}</div>
          <div className="dock-bars">
            <ResourceBar type="health" label="PV" value={self?.health ?? 0} max={self?.maxHealth ?? 50} compact />
            <ResourceBar type="mana" label="Mana" value={self?.mana ?? 0} max={10} compact />
          </div>
        </div>
      </div>
    </section>
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
      <div className="dock-card is-empty">
        <div className="dock-card-art">
          <span>?</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dock-card">
      <div className="dock-card-art">
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
    <div className={`dock-card-stats ${card ? "" : "is-empty"}`}>
      <div className="dock-stat-row">
        {VALERIO_KEYS.map((key) => {
          const influence = influences[key] ?? "";
          const value = Number(valerio[key] ?? 0);
          return (
            <span
              key={key}
              className={`stat-tile rich-tooltip stat-${key.toLowerCase()} ${influence ? `is-${influence}-boosted` : ""}`}
              data-tooltip=""
            >
              <b>{value}</b>
              <small>{key}</small>
              <TooltipContent>
                <strong className={`valerio-term stat-${key.toLowerCase()}`}>
                  {key} - {VALERIO_LABELS[key]}
                </strong>
                <RichText text={card ? getStatTooltip(card, key, plan) : `${VALERIO_LABELS[key]}: nessuna carta selezionata.`} />
              </TooltipContent>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TooltipContent({ children }) {
  return <div className="tooltip-content">{children}</div>;
}

function RichText({ text }) {
  return (
    <span>
      {splitValerioText(text).map((chunk, index) =>
        chunk.stat ? (
          <strong key={`${chunk.text}-${index}`} className={`valerio-term stat-${chunk.stat.toLowerCase()}`}>
            {chunk.text}
          </strong>
        ) : (
          <span key={`${chunk.text}-${index}`}>{chunk.text}</span>
        )
      )}
    </span>
  );
}
