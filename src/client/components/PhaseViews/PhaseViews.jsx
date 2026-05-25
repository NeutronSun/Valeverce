"use client";

import * as React from "react";
import { CLIENT_EVENTS } from "../../../shared/events.js";
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
  groupDraftItemsByRarity,
  rarityClass,
  rarityLabel,
  selectedStats,
  splitValerioText,
  sortCardsByRarity,
  sumDistribution,
  validatePlanDraft
} from "../../ui.js";
import { AbilityBox, GameCard } from "../Card/Card.jsx";
import { ValerioStats } from "../ValerioStats/ValerioStats.jsx";
import styles from "./PhaseViews.module.css";

const statClasses = {
  V: styles.statV,
  A: styles.statA,
  L: styles.statL,
  E: styles.statE,
  R: styles.statR,
  I: styles.statI,
  O: styles.statO
};

const rarityClasses = {
  comune: styles.rarityCommon,
  rara: styles.rarityRare,
  epica: styles.rarityEpic,
  leggendaria: styles.rarityLegendary,
  mitica: styles.rarityMythic,
  speciale: styles.raritySpecial
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function normalizedRarity(value) {
  return String(value ?? "comune")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function rarityStyleClass(rarity) {
  return rarityClasses[normalizedRarity(rarity)] ?? styles.rarityCommon;
}

function ratioStyle(value, max, property = "--pool-ratio") {
  const safeMax = Math.max(1, Number(max ?? 1));
  const ratio = Math.max(0, Math.min(1, Number(value ?? 0) / safeMax));
  return /** @type {import("react").CSSProperties} */ (
    /** @type {unknown} */ ({
      [property]: ratio
    })
  );
}

export function HomeView({ snapshot, name, onNameChange, emit, connectionState, pingMs }) {
  const lobbies = snapshot?.lobbies ?? [];
  const totalPlayers = Number(snapshot?.onlinePlayers ?? lobbies.reduce((total, lobby) => total + Number(lobby.players ?? 0), 0));
  const pingLabel = Number.isFinite(pingMs) ? `${pingMs} ms` : "-- ms";

  return (
    <main className={styles.home}>
      <section className={styles.homeHero}>
        <div className={styles.brand}>
          <span>V</span>
          <div>
            <p className={styles.eyebrow}>card tactics locale</p>
            <h1>VALEVERCE</h1>
          </div>
        </div>

        <div className={styles.homeStatus}>
          <span className={styles.signal} title={`Ping: ${pingLabel}`} aria-label={`Ping: ${pingLabel}`}>
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            Online <b>{totalPlayers}</b>
          </span>
          <span>
            Lobby <b>{lobbies.length}</b>
          </span>
        </div>

        <label className={styles.field}>
          Nome player
          <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Scrivi il tuo nome" />
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => emit(CLIENT_EVENTS.CREATE_LOBBY)}>
            Crea lobby
          </button>
          <JoinLobby emit={emit} />
        </div>
      </section>

      <section className={styles.homePanel}>
        <div className={styles.sectionTitle}>
          <strong>Regole rapide</strong>
          <span>VALERIO</span>
        </div>
        <div className={styles.ruleList}>
          <span><b>{SETTINGS.draftBudget}</b> budget draft</span>
          <span><b>{SETTINGS.draftSize}</b> carte nel mazzo</span>
          <span><b>{SETTINGS.startingHealth}</b> PV iniziali</span>
          <span><b>{SETTINGS.maxMana}</b> mana massimo</span>
        </div>
      </section>

      <section className={styles.homePanel}>
        <div className={styles.sectionTitle}>
          <strong>Lobby pubbliche</strong>
          <span>{lobbies.length}</span>
        </div>
        <div className={styles.list}>
          {lobbies.map((lobby) => (
            <button
              key={lobby.id}
              type="button"
              className={classNames(styles.ghost, styles.lobbyRow)}
              disabled={!lobby.isJoinable}
              onClick={() => emit(CLIENT_EVENTS.JOIN_LOBBY, { lobbyId: lobby.id })}
            >
              <div>
                <strong>{lobby.id}</strong>
                <small>Host: {lobby.hostName ?? "-"}</small>
              </div>
              <span>{lobby.players}/{lobby.maxPlayers}</span>
              <span className={styles.phasePill}>{lobby.phase === "lobby" ? "aperta" : "in game"}</span>
            </button>
          ))}
          {lobbies.length === 0 ? <p className={styles.empty}>Nessuna lobby pubblica. Crea una stanza e invita gli altri dalla stessa rete.</p> : null}
        </div>
      </section>
    </main>
  );
}

function JoinLobby({ emit }) {
  const [lobbyId, setLobbyId] = React.useState("");
  return (
    <form
      className={styles.inlineForm}
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
  const readyPlayers = lobby.players.filter((player) => player.alive !== false);

  return (
    <section className={styles.lobbyPanel}>
      <div className={styles.lobbyHero}>
        <div>
          <p className={styles.eyebrow}>Lobby {lobby.id}</p>
          <h2>Stanza di preparazione</h2>
          <small>{readyPlayers.length}/{SETTINGS.maxPlayers} player connessi</small>
        </div>
        <div className={styles.codeChip}>
          <span>Codice</span>
          <strong>{lobby.id}</strong>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <strong>Partecipanti</strong>
            <span>{lobby.players.length}/{SETTINGS.maxPlayers}</span>
          </div>
          {lobby.players.map((player) => (
            <article key={player.id} className={styles.lobbyPlayer}>
              <span>{player.deckCount ?? 0}</span>
              <div>
                <strong>{player.name}</strong>
                <small>{player.id === lobby.hostId ? "Host partita" : "Player"}</small>
              </div>
              <b>{player.alive === false ? "out" : "pronto"}</b>
            </article>
          ))}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <strong>Regole</strong>
            <span>VALERIO</span>
          </div>
          <div className={styles.ruleGrid}>
            <span>
              <b>{SETTINGS.draftBudget}</b> budget draft
            </span>
            <span>
              <b>{SETTINGS.draftSize}</b> carte max
            </span>
            <span>
              <b>{SETTINGS.startingHealth}</b> PV iniziali
            </span>
            <span>
              <b>{SETTINGS.maxMana}</b> mana max
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}

export function DraftView({ lobby, previewCard, onPreviewCard, emit }) {
  const self = lobby.self;
  const [query, setQuery] = React.useState("");
  const [sortMode, setSortMode] = React.useState("rarity");
  const normalizedQuery = query.trim().toLowerCase();
  const draftItems = (lobby.draft?.pool ?? []).filter((item) => {
    const card = item.card ?? {};
    const haystack = `${card.name ?? ""} ${card.id ?? ""} ${rarityLabel(card.rarity)}`.toLowerCase();
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });
  const groups = groupDraftItemsByRarity(draftItems);
  const flatItems = [...draftItems].sort((left, right) => {
    if (sortMode === "alpha") {
      return String(left.card?.name ?? "").localeCompare(String(right.card?.name ?? ""));
    }

    return 0;
  });
  const currentDrafter = lobby.players.find((player) => player.id === lobby.draft?.currentPlayerId);
  const draftedCount = lobby.draft?.taken?.length ?? 0;
  const draftTarget = lobby.draft?.target ?? SETTINGS.draftSize;
  const budget = self?.draftBudget ?? SETTINGS.draftBudget;
  const spent = self?.draftSpent ?? 0;

  return (
    <section className={styles.phase}>
      <div className={styles.phaseStrip}>
        <div>
          <strong>Draft · {currentDrafter?.name ?? "-"}</strong>
          <small>Pick {Math.min(draftedCount + 1, lobby.players.length * draftTarget)} di {lobby.players.length * draftTarget}</small>
        </div>
        <div className={styles.metrics}>
          <span>Budget <b>{spent}/{budget}</b></span>
          <span>Carte <b>{self?.deckCount ?? 0}/{draftTarget}</b></span>
          <span>Connesso</span>
        </div>
      </div>
      <div className={styles.tools}>
        <label className={styles.field}>
          Cerca
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, ID, rarità..." />
        </label>
        <label className={styles.field}>
          Ordine
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="rarity">Rarità</option>
            <option value="alpha">Alfabetico</option>
          </select>
        </label>
      </div>
      <div className={classNames(styles.draftPool, sortMode === "alpha" && styles.flat)}>
        {sortMode === "rarity" ? (
          groups.map((group) => (
            <details key={group.rarity} className={classNames(styles.accordion, rarityStyleClass(group.rarity))} open>
              <summary className={styles.separator}>
                <span>{group.label}</span>
                <b>{rarityFlavor(group.rarity)}</b>
                <i>{group.items.length}</i>
              </summary>
              <div className={styles.cards}>
                {group.items.map((item) => (
                  <DraftCardItem
                    key={item.card.id}
                    item={item}
                    selected={previewCard?.id === item.card.id}
                    onPreviewCard={onPreviewCard}
                  />
                ))}
              </div>
            </details>
          ))
        ) : (
          flatItems.map((item) => (
            <DraftCardItem
              key={item.card.id}
              item={item}
              selected={previewCard?.id === item.card.id}
              onPreviewCard={onPreviewCard}
            />
          ))
        )}
        {draftItems.length === 0 ? <p className={styles.empty}>Nessuna carta trovata.</p> : null}
      </div>
    </section>
  );
}

function rarityFlavor(rarity) {
  const normalized = String(rarity ?? "").toLowerCase();
  if (normalized.includes("special")) return "unica";
  if (normalized.includes("mit")) return "massima";
  if (normalized.includes("legg")) return "top";
  if (normalized.includes("epic") || normalized.includes("epica")) return "forte";
  if (normalized.includes("rar")) return "elite";
  return "base";
}

function DraftCardItem({ item, selected, onPreviewCard }) {
  return (
    <div
      className={[
        styles.draftCard,
        rarityStyleClass(item.card.rarity),
        selected ? styles.previewed : "",
        item.takenByName ? styles.taken : "",
        !item.canAfford ? styles.expensive : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <GameCard
        card={item.card}
        mini
        takenByName={item.takenByName}
        selected={selected}
        onClick={() => onPreviewCard(item.card)}
      />
      {item.isAvailable && !item.canAfford ? <span className={styles.overlay}>Troppo costosa</span> : null}
    </div>
  );
}

export function SelectView({ lobby, selectedCardId, onSelectedCardId, emit }) {
  const self = lobby.self;
  return (
    <section className={styles.phase}>
      <div className={styles.phaseStrip}>
        <strong>{self?.isActive ? "Scegli carta coperta" : "Stai guardando il duello"}</strong>
        <span>{lobby.players.filter((player) => player.hasSelected).length}/{lobby.activePair.length} pronte</span>
      </div>
      <div className={styles.hand}>
        {sortCardsByRarity(self?.deck ?? []).map((card) => {
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
    return <section className={styles.panel}>Carte in reveal...</section>;
  }

  return (
    <section className={styles.fight}>
      <section className={styles.fightPanel}>
        <div className={styles.fightHead}>
          <span>Fight · round {lobby.round}</span>
          <strong>Configura attacco e difesa</strong>
          <small>La configurazione avversaria resta nascosta fino al reveal.</small>
        </div>

        <div className={styles.planner}>
          <section>
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
          <section>
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

        <div className={styles.preview}>
          <div className={styles.sectionTitle}>
            <strong>Preview risultato</strong>
            <span>breccia parziale</span>
          </div>
          <div className={styles.list}>
            {selectedStats(plan.attacks).length ? (
              selectedStats(plan.attacks).map((key) => (
                <div key={key} className={styles.previewLine}>
                  <strong>{formatStatName(key)}</strong>
                  <small>
                    {plan.attacks[key]} + {getCardValerio(selfCard)[key] ?? 0} - {getCardValerio(opponentCard)[key] ?? 0}
                  </small>
                </div>
              ))
            ) : (
              <div className={styles.previewEmpty}>Distribuisci punti attacco.</div>
            )}
          </div>
        </div>

        {validation?.canSubmit ? null : <p className={styles.notice}>Metti punti in attacco e difesa entro i pool disponibili.</p>}
      </section>

    </section>
  );
}

function PlanDistribution({ kind, card, opponentCard, values, pool, selected, plan, onChange }) {
  const total = sumDistribution(values);
  const valerio = getCardValerio(card);
  const opponentValerio = getCardValerio(opponentCard);
  const remaining = Math.max(0, pool - total);
  const isAttack = kind === "attacks";
  const maxSlots = isAttack ? SETTINGS.attackSlots : SETTINGS.defenseSlots;

  return (
    <div className={styles.choice} data-plan-kind={kind}>
      <div className={styles.sectionTitle}>
        <div>
          <strong>{isAttack ? "Scegli 1-3 statistiche di attacco" : "Scegli 1-3 statistiche di difesa"}</strong>
          <small>{isAttack ? "Punti rossi contro la carta avversaria" : "Punti blu per proteggere la tua carta"}</small>
        </div>
        <span>{selected.length}/{maxSlots} · {total}/{pool}</span>
      </div>
      <div
        className={styles.pool}
        style={ratioStyle(total, pool)}
      >
        <i />
        <span>{remaining <= 0 ? "Pool massimo raggiunto" : `${remaining} punti rimasti`}</span>
      </div>
      <div className={styles.statList}>
        {VALERIO_KEYS.map((key) => {
          const value = Number(values[key] ?? 0);
          const disabled = value === 0 && selected.length >= maxSlots;
          const influence = getPlanLineInfluence(card, kind, key, plan);
          const tooltip = getPlanLineTooltip(card, kind, key, influence, plan);
          return (
            <label
              key={key}
              className={classNames(
                styles.planStat,
                statClasses[key],
                value > 0 && styles.selected,
                disabled && styles.locked
              )}
            >
              <span>{key}</span>
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
                title={tooltip}
                aria-label={`${formatStatName(key)} ${isAttack ? "attacco" : "difesa"}`}
                onChange={(event) => onChange(key, Number(event.target.value))}
              />
              <b>{value}</b>
              {influence ? <em className={styles.lineEffect}>{lineEffectLabel(influence)}</em> : null}
              <TooltipContent>
                <RichText text={tooltip} />
              </TooltipContent>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function lineEffectLabel(influence) {
  if (influence === "both") return "A+P";
  if (influence === "active") return "A";
  if (influence === "trait") return "P";
  return "";
}

function PlanCardPanel({ title, card, tone, statsTone, highlighted }) {
  return (
    <aside className={styles.panel}>
      <div className={styles.sectionTitle}>
        <span>{title}</span>
      </div>
      <GameCard card={card} disabled />
      <div className={styles.panel}>
        <small>VALERIO base</small>
        <ValerioStats card={card} hot={statsTone === "attack" ? highlighted : []} cool={statsTone === "defense" ? highlighted : []} />
      </div>
      <AbilityBox ability={card.active} kind="Attiva" />
      <AbilityBox ability={card.passive} kind="Passiva" />
    </aside>
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
          <strong key={`${chunk.text}-${index}`} className={classNames(styles.term, statClasses[chunk.stat])}>
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
    return <section className={styles.panel}>Reveal in corso...</section>;
  }

  const selfPlay = result.plays.find((play) => play.playerId === lobby.self?.id);
  const outcome = result.isTie ? "Pareggio" : result.winnerId === lobby.self?.id ? "Hai vinto" : "Hai perso";
  const heroClass = result.isTie ? "is-tie" : result.winnerId === lobby.self?.id ? "is-win" : "is-lose";

  return (
    <section className={styles.reveal}>
      <div className={classNames(styles.revealHero, styles[heroClass.replace("is-", "")])}>
        <span>Reveal · round {result.round}</span>
        <strong>{outcome}</strong>
        <p>{result.summary?.reason ?? "Round risolto."}</p>
        {selfPlay ? (
          <div className={styles.heroMetrics}>
            <span>Breccia <b>{selfPlay.breach}</b></span>
            <span>Danno fatto <b>{selfPlay.finalDamage}</b></span>
            <span>Danno subito <b>{selfPlay.damageTaken}</b></span>
          </div>
        ) : null}
      </div>

      <div className={styles.scoreboard}>
        {result.plays.map((play) => (
          <RevealPlayerReport
            key={play.playerId}
            play={play}
            isSelf={play.playerId === lobby.self?.id}
            isWinner={play.playerId === result.winnerId}
          />
        ))}
      </div>
    </section>
  );
}

function RevealPlayerReport({ play, isSelf, isWinner }) {
  return (
    <article className={styles.report}>
      <div className={styles.reportHead}>
        <div className={styles.thumb}>
          <img src={cardImageSrc(play.card)} alt={play.cardName} />
        </div>
        <div>
          <span>{isSelf ? "Tu" : "Avversario"}</span>
          <h3>{play.playerName}</h3>
          <p>{play.cardName}</p>
        </div>
        <strong>{play.outcome === "win" ? "Vittoria" : play.outcome === "lose" ? "Sconfitta" : "Pareggio"}</strong>
      </div>

      <div className={styles.metricGrid}>
        <RevealMetric label="Breccia" value={play.breach} />
        <RevealMetric label="Cap normale" value={play.normalDamageCap} />
        <RevealMetric label="Danno cap" value={play.normalDamage} />
        <RevealMetric label="Extra attiva" value={play.activeDamage} />
        <RevealMetric label="Danno finale" value={play.finalDamage} />
        <RevealMetric label="Danno subito" value={play.damageTaken} />
      </div>

      <div className={styles.stateGrid}>
        <span>PV <b>{play.healthBefore}{" -> "}{play.healthAfter}</b></span>
        <span>Mana <b>{play.manaBefore}{" -> "}{play.manaAfter}</b></span>
        <span>Attacco <b>{formatDistribution(play.attacks)} / {play.attackPool}</b></span>
        <span>Difesa <b>{formatDistribution(play.defenses)} / {play.defensePool}</b></span>
      </div>

      <div className={styles.abilityRow}>
        <span>Attiva {play.useActive ? `-${play.manaCost}` : "off"}</span>
        <span>Tratto {play.traitApplied ? "attivo" : "non attivo"}</span>
      </div>

      {play.traitNotes?.length ? (
        <div className={styles.panel}>
          {play.traitNotes.map((note, index) => (
            <p key={`${play.playerId}-note-${index}`}>
              <RichText text={note} />
            </p>
          ))}
        </div>
      ) : null}

      <div className={styles.lines}>
        <div className={styles.sectionTitle}>
          <strong>Calcolo Breccia</strong>
          <span>attacco + VAL tuo - VAL avversario - difesa</span>
        </div>
        {play.attackLines.map((line) => (
          <div key={`${play.playerId}-${line.stat}`} className={classNames(styles.line, statClasses[line.stat])}>
            <strong>{line.stat}</strong>
            <span className={styles.calc}>
              <i>{line.attackPoints}</i>
              <i>+</i>
              <i>{line.attackerValerio}</i>
              <i>-</i>
              <i>{line.defenderValerio}</i>
              <i>-</i>
              <i>{line.defensePoints}</i>
              <i>=</i>
              <i>{line.lineDamage}</i>
            </span>
            <b>{line.lineDamage}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function RevealMetric({ label, value }) {
  return (
    <span>
      {label}
      <b>{value ?? 0}</b>
    </span>
  );
}

function formatDistribution(distribution) {
  const stats = selectedStats(distribution ?? {});
  return stats.length ? stats.map((key) => `${key}${Number(distribution[key] ?? 0)}`).join(" · ") : "-";
}
