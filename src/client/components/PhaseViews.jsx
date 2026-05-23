"use client";

import * as React from "react";
import { CLIENT_EVENTS } from "../../shared/events.js";
import {
  SETTINGS,
  VALERIO_KEYS,
  currentOpponent,
  formatStatName,
  getAttackPool,
  getCardValerio,
  getDefensePool,
  getDraftCost,
  cardImageSrc,
  getPlanLineInfluence,
  getPlanLineTooltip,
  selectedStats,
  splitValerioText,
  sumDistribution,
  validatePlanDraft
} from "../ui.js";
import { AbilityBox, GameCard } from "./Card.jsx";
import { ValerioStats } from "./ValerioStats.jsx";

export function HomeView({ snapshot, name, onNameChange, emit }) {
  return (
    <main className="home-grid">
      <section className="panel">
        <p className="eyebrow">valeverce</p>
        <h1>valeverce</h1>
        <label>
          Nome player
          <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Nome" />
        </label>
        <div className="actions">
          <button type="button" onClick={() => emit(CLIENT_EVENTS.CREATE_LOBBY)}>
            Crea lobby
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>Lobby</h2>
        <JoinLobby emit={emit} />
        <div className="lobby-list">
          {(snapshot?.lobbies ?? []).map((lobby) => (
            <button key={lobby.id} type="button" className="ghost lobby-row" onClick={() => emit(CLIENT_EVENTS.JOIN_LOBBY, { lobbyId: lobby.id })}>
              <strong>{lobby.id}</strong>
              <span>
                {lobby.players}/{lobby.maxPlayers} - {lobby.phase}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function JoinLobby({ emit }) {
  const [lobbyId, setLobbyId] = React.useState("");
  return (
    <form
      className="inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        emit(CLIENT_EVENTS.JOIN_LOBBY, { lobbyId });
      }}
    >
      <input value={lobbyId} placeholder="Codice lobby" onChange={(event) => setLobbyId(event.target.value.toUpperCase())} />
      <button type="submit">Entra</button>
    </form>
  );
}

export function LobbyView({ lobby }) {
  return (
    <section className="panel lobby-panel">
      <div className="lobby-head">
        <div>
          <p className="eyebrow">Lobby {lobby.id}</p>
          <h2>{lobby.players.length}/{SETTINGS.maxPlayers} player</h2>
        </div>
      </div>
      <div className="player-board">
        {lobby.players.map((player) => (
          <div key={player.id} className="player">
            <strong>{player.name}</strong>
            <small>{player.id === lobby.hostId ? "host" : "player"}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DraftView({ lobby, previewCard, onPreviewCard, emit }) {
  const self = lobby.self;
  return (
    <section className="draft-view">
      <div className="phase-strip">
        <strong>Draft: {lobby.players.find((player) => player.id === lobby.draft?.currentPlayerId)?.name ?? "-"}</strong>
        <span>
          Budget {self?.draftSpent ?? 0}/{self?.draftBudget ?? SETTINGS.draftBudget} - carte {self?.deckCount ?? 0}/{lobby.draft?.target ?? SETTINGS.draftSize}
        </span>
      </div>
      <div className="draft-pool">
        {(lobby.draft?.pool ?? []).map((item) => {
          const disabled = !item.canPick;
          return (
            <div
              key={item.card.id}
              className={[
                "draft-card-wrap",
                previewCard?.id === item.card.id ? "is-previewed" : "",
                item.takenByName ? "is-taken" : "",
                !item.canAfford ? "is-too-expensive" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseEnter={() => onPreviewCard(item.card)}
            >
              <GameCard
                card={item.card}
                mini
                disabled={disabled}
                takenByName={item.takenByName}
                selected={previewCard?.id === item.card.id}
                onClick={() => onPreviewCard(item.card)}
              />
              <div className="draft-card-meta">
                <span>Costo {item.cost}</span>
                <span>ATT {item.card.combat?.attackPower ?? 0}% ({item.attackPool})</span>
                <span>DIF {item.card.combat?.defensePower ?? 0}% ({item.defensePool})</span>
              </div>
              {item.isAvailable && !item.canAfford ? <span className="taken-label is-overlay">Troppo costosa</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SelectView({ lobby, selectedCardId, onSelectedCardId, emit }) {
  const self = lobby.self;
  return (
    <section className="select-view">
      <div className="phase-strip">
        <strong>{self?.isActive ? "Scegli carta coperta" : "Stai guardando il duello"}</strong>
        <span>{lobby.players.filter((player) => player.hasSelected).length}/{lobby.activePair.length} pronte</span>
      </div>
      <div className="hand">
        {(self?.deck ?? []).map((card) => {
          const cooldown = Number(self.cooldowns?.[card.id] ?? 0);
          const disabled = !self.isActive || cooldown > 0 || Boolean(self.selected?.cardId);
          return (
            <GameCard
              key={card.id}
              card={card}
              selected={selectedCardId === card.id || self.selected?.cardId === card.id}
              disabled={disabled}
              cooldown={cooldown}
              onClick={() => {
                onSelectedCardId(card.id);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

export function PlanFightView({ lobby, plan, onPlanValue, onPreviewLines }) {
  const selfCard = lobby.self?.selected?.selectedCard;
  const opponent = currentOpponent(lobby);
  const opponentCard = opponent?.selectedCard;
  const validation = selfCard ? validatePlanDraft(plan, selfCard) : null;

  React.useEffect(() => {
    if (!selfCard || !opponentCard) {
      onPreviewLines([]);
      return;
    }

    const selfValerio = getCardValerio(selfCard);
    const opponentValerio = getCardValerio(opponentCard);
    onPreviewLines(
      selectedStats(plan.attacks).map((key) => ({
        key,
        title: `${formatStatName(key)}: ${plan.attacks[key]} + ${selfValerio[key]} - ${opponentValerio[key]}`,
        text: `Stima Breccia senza difesa avversaria: ${Math.max(0, Number(plan.attacks[key] ?? 0) + Number(selfValerio[key] ?? 0) - Number(opponentValerio[key] ?? 0))}`
      }))
    );
  }, [plan, selfCard, opponentCard, onPreviewLines]);

  if (!selfCard || !opponentCard) {
    return <section className="panel">Carte in reveal...</section>;
  }

  return (
    <section className="plan-controls">
      <div className="fight-preview">
        <div className="fight-preview-head">
          <strong>Preview Breccia</strong>
          <span>prima della difesa avversaria</span>
        </div>
        <div className="preview-stack is-main">
          {selectedStats(plan.attacks).length ? (
            selectedStats(plan.attacks).map((key) => (
              <div key={key} className="preview-line">
                <strong>{formatStatName(key)}</strong>
                <small>
                  {plan.attacks[key]} + {getCardValerio(selfCard)[key] ?? 0} - {getCardValerio(opponentCard)[key] ?? 0}
                </small>
              </div>
            ))
          ) : (
            <div className="preview-empty">Distribuisci punti attacco.</div>
          )}
        </div>
      </div>
      <div className="duel-planner is-grid">
        <section className="duel-zone own-zone defense-zone">
          <div className="duel-zone-head">
            <div className="fight-lane-title">
              <span className="role-pill is-you">TU</span>
              <div>
                <strong>{lobby.self?.name}</strong>
                <small>proteggi la tua carta</small>
              </div>
            </div>
            <ValerioStats card={selfCard} cool={selectedStats(plan.defenses)} />
          </div>
          <PlanDistribution
            kind="defenses"
            card={selfCard}
            opponentCard={opponentCard}
            values={plan.defenses}
            pool={getDefensePool(selfCard)}
            selected={selectedStats(plan.defenses)}
            plan={plan}
            onChange={(key, value) => onPlanValue("defenses", key, value)}
          />
        </section>
        <section className="duel-zone enemy-zone attack-zone">
          <div className="duel-zone-head">
            <div className="fight-lane-title">
              <span className="role-pill is-opponent">TARGET</span>
              <div>
                <strong>{opponent?.name ?? "Avversario"}</strong>
                <small>{opponentCard.name}</small>
              </div>
            </div>
            <ValerioStats card={opponentCard} hot={selectedStats(plan.attacks)} />
          </div>
          <PlanDistribution
            kind="attacks"
            card={selfCard}
            opponentCard={opponentCard}
            values={plan.attacks}
            pool={getAttackPool(selfCard)}
            selected={selectedStats(plan.attacks)}
            plan={plan}
            onChange={(key, value) => onPlanValue("attacks", key, value)}
          />
        </section>
      </div>
      {validation?.canSubmit ? null : <p className="notice">Servono 3 attacchi e 3 difese entro i pool disponibili.</p>}
    </section>
  );
}

function PlanDistribution({ kind, card, opponentCard, values, pool, selected, plan, onChange }) {
  const total = sumDistribution(values);
  const valerio = getCardValerio(card);
  const opponentValerio = getCardValerio(opponentCard);
  const remaining = Math.max(0, pool - total);

  return (
    <div className="choice-panel" data-plan-kind={kind}>
      <div className="section-title">
        <span>{selected.length}/3 - {total}/{pool}</span>
      </div>
      <div className={`pool-meter${remaining <= 0 ? " is-full" : ""}`}>
        <i style={{ width: `${pool > 0 ? Math.min(100, (total / pool) * 100) : 0}%` }} />
        <span>{remaining <= 0 ? "Pool massimo raggiunto" : `${remaining} punti rimasti`}</span>
      </div>
      <div className="plan-stat-list">
        {VALERIO_KEYS.map((key) => {
          const value = Number(values[key] ?? 0);
          const disabled = value === 0 && selected.length >= 3;
          const influence = getPlanLineInfluence(card, kind, key, plan);
          return (
            <label
              key={key}
              className={`plan-stat rich-tooltip ${value > 0 ? "is-selected" : ""} ${disabled ? "is-locked" : ""} ${influence ? `is-${influence}-line` : ""}`}
              data-tooltip=""
            >
              <span className={`stat-${key.toLowerCase()}`}>{key}</span>
              <strong>{formatStatName(key)}</strong>
              <small>
                {valerio[key] ?? 0} vs {opponentValerio[key] ?? 0}
              </small>
              <input
                type="range"
                min="0"
                max={pool}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(key, Number(event.target.value))}
              />
              <b>{value}</b>
              <TooltipContent>
                <RichText text={getPlanLineTooltip(card, kind, key, influence, plan)} />
              </TooltipContent>
            </label>
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

export function RevealView({ lobby }) {
  const result = lobby.lastResult;
  if (!result) {
    return <section className="panel">Reveal in corso...</section>;
  }

  return (
    <section className="reveal-view">
      <div className="winner-banner">{result.summary?.reason ?? "Round risolto"}</div>
      <div className="result-list">
        {result.plays.map((play) => (
          <article key={play.playerId} className={`result-row is-${play.outcome}`}>
            <div className="result-card-art">
              <img src={cardImageSrc(play.card)} alt={play.cardName} />
            </div>
            <div>
              <h3>{play.playerName}</h3>
              <p>
                Breccia {play.breach}, cap {play.normalDamageCap}, danno {play.finalDamage}, PV {play.healthBefore}
                {" -> "}
                {play.healthAfter}, mana {play.manaBefore}
                {" -> "}
                {play.manaAfter}
              </p>
            </div>
            <strong className="result-score">{play.breach}</strong>
            <div className="line-list">
              {play.attackLines.map((line) => (
                <div key={`${play.playerId}-${line.stat}`} className={`attack-line${line.lineDamage > 0 ? " is-hit" : ""}`}>
                  <strong>{line.stat}</strong>
                  <span className="calc-strip">
                    <i className="calc-atk">{line.attackPoints}</i>
                    <i className="calc-plus">+</i>
                    <i className="calc-own">{line.attackerValerio}</i>
                    <i className="calc-minus">-</i>
                    <i className="calc-enemy">{line.defenderValerio}</i>
                    <i className="calc-minus">-</i>
                    <i className="calc-def">{line.defensePoints}</i>
                    <i className="calc-equals">=</i>
                    <i className="calc-result">{line.lineDamage}</i>
                  </span>
                  <b>{line.lineDamage}</b>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
