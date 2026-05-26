"use client";

import * as React from "react";
import {
  getAttackPool,
  getCardTheme,
  getDefensePool,
  getDraftCost,
  groupDraftItemsByRarity,
  groupDraftItemsByTheme,
  rarityLabel
} from "../../ui.js";
import { CardGrid } from "../PhaseViews/PhaseViews.jsx";
import phaseStyles from "../PhaseViews/PhaseViews.module.css";
import { CardInspector } from "../RightPanel/RightPanel.jsx";
import rightPanelStyles from "../RightPanel/RightPanel.module.css";
import styles from "./CardGallery.module.css";

const viewModes = [
  {
    id: "rarity",
    icon: "◆",
    label: "Rarità",
    tooltip: "Raggruppa le carte per rarità."
  },
  {
    id: "theme",
    icon: "◎",
    label: "Tema",
    tooltip: "Raggruppa le carte per tema dal JSON."
  },
  {
    id: "alpha",
    icon: "A",
    label: "A-Z",
    tooltip: "Mostra tutte le carte in ordine alfabetico."
  }
];

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function normalizeCards(cards) {
  return cards.map((card) => ({
    card,
    cost: getDraftCost(card),
    attackPool: getAttackPool(card),
    defensePool: getDefensePool(card),
    takenByName: null,
    isAvailable: true,
    canPick: false,
    canAfford: true
  }));
}

export function CardGallery({ cards }) {
  const [query, setQuery] = React.useState("");
  const [groupMode, setGroupMode] = React.useState("rarity");
  const [activeTheme, setActiveTheme] = React.useState("");
  const [previewCard, setPreviewCard] = React.useState(cards[0] ?? null);
  const normalizedQuery = query.trim().toLowerCase();

  const items = React.useMemo(() => normalizeCards(cards), [cards]);
  const filteredItems = React.useMemo(
    () =>
      items.filter((item) => {
        const card = item.card ?? {};
        const haystack = `${card.name ?? ""} ${card.id ?? ""} ${rarityLabel(card.rarity)} ${getCardTheme(card)}`.toLowerCase();
        return !normalizedQuery || haystack.includes(normalizedQuery);
      }),
    [items, normalizedQuery]
  );
  const themeNavGroups = React.useMemo(() => groupDraftItemsByTheme(filteredItems), [filteredItems]);
  const visibleItems = React.useMemo(() => {
    if (groupMode !== "theme" || !activeTheme) {
      return filteredItems;
    }

    return filteredItems.filter((item) => getCardTheme(item.card) === activeTheme);
  }, [activeTheme, filteredItems, groupMode]);
  const rarityGroups = React.useMemo(() => groupDraftItemsByRarity(visibleItems), [visibleItems]);
  const themeGroups = React.useMemo(() => groupDraftItemsByTheme(visibleItems), [visibleItems]);
  const flatItems = React.useMemo(
    () => [...visibleItems].sort((left, right) => String(left.card?.name ?? "").localeCompare(String(right.card?.name ?? ""))),
    [visibleItems]
  );

  React.useEffect(() => {
    if (previewCard && visibleItems.some((item) => item.card.id === previewCard.id)) {
      return;
    }

    setPreviewCard(visibleItems[0]?.card ?? null);
  }, [previewCard, visibleItems]);

  React.useEffect(() => {
    if (groupMode !== "theme") {
      setActiveTheme("");
    }
  }, [groupMode]);

  return (
    <div className={classNames(styles.shell, groupMode === "theme" && styles.withThemeRail)}>
      <header className={styles.header}>
        <a className={styles.brand} href="/">
          <span className={styles.mark}>V</span>
          <span className={styles.brandText}>VALEVERCE</span>
        </a>
        <div className={styles.meta}>
          <span className={styles.metaPill}>Catalogo</span>
          <span className={styles.metaPill}>{cards.length} carte</span>
          <span className={styles.metaPill}>{visibleItems.length} visibili</span>
        </div>
      </header>

      {groupMode === "theme" ? (
        <aside className={styles.themeRail}>
          <ThemeFilter
            groups={themeNavGroups}
            activeTheme={activeTheme}
            onActiveTheme={setActiveTheme}
          />
        </aside>
      ) : null}

      <main className={styles.main}>
        <section className={phaseStyles.phase}>
          <div className={phaseStyles.phaseStrip}>
            <div>
              <strong>Tutte le carte</strong>
              <small>Archivio completo con lo stesso layout della draft.</small>
            </div>
            <div className={phaseStyles.metrics}>
              <span className={phaseStyles.metricPill}>
                Totale <b className={phaseStyles.metricValue}>{cards.length}</b>
              </span>
              <span className={phaseStyles.metricPill}>
                Vista <b className={phaseStyles.metricValue}>{activeTheme || groupMode}</b>
              </span>
            </div>
          </div>

          <div className={phaseStyles.tools}>
            <label className={phaseStyles.field}>
              <span className={phaseStyles.fieldLabel}>Cerca</span>
              <input
                className={phaseStyles.fieldControl}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, ID, rarità, tema..."
              />
            </label>
            <div className={phaseStyles.groupField}>
              <span className={phaseStyles.fieldLabel}>Vista</span>
              <div className={phaseStyles.groupButtons} role="tablist" aria-label="Vista catalogo carte">
                {viewModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={classNames(phaseStyles.groupButton, groupMode === mode.id && phaseStyles.groupButtonActive)}
                    title={mode.tooltip}
                    aria-label={mode.tooltip}
                    aria-pressed={groupMode === mode.id}
                    onClick={() => setGroupMode(mode.id)}
                  >
                    <span className={phaseStyles.groupIcon}>{mode.icon}</span>
                    <span className={phaseStyles.groupLabel}>{mode.label}</span>
                    <span className={phaseStyles.groupTooltip}>{mode.tooltip}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <CardGrid
            items={visibleItems}
            rarityGroups={rarityGroups}
            themeGroups={themeGroups}
            flatItems={flatItems}
            groupMode={groupMode}
            previewCard={previewCard}
            onPreviewCard={setPreviewCard}
            emptyText="Nessuna carta nel catalogo."
          />
        </section>
      </main>

      <aside className={rightPanelStyles.root}>
        {previewCard ? (
          <CardInspector card={previewCard} title="Dettaglio carta" />
        ) : (
          <section className={rightPanelStyles.panel}>
            <p className={styles.emptyText}>Seleziona una carta dalla griglia.</p>
          </section>
        )}
      </aside>
    </div>
  );
}

function ThemeFilter({ groups, activeTheme, onActiveTheme }) {
  function scrollToTheme(targetId) {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  return (
    <section className={styles.themeFilter}>
      <div className={styles.themeFilterHead}>
        <span className={styles.themeFilterLabel}>Temi</span>
        <b className={styles.themeFilterCount}>{groups.length}</b>
      </div>
      <div className={styles.themeFilterList}>
        <button
          type="button"
          className={classNames(styles.themeFilterButton, !activeTheme && styles.themeFilterButtonActive)}
          onClick={() => onActiveTheme("")}
        >
          <span className={styles.themeFilterDot} />
          <span className={styles.themeFilterName}>Tutti i temi</span>
          <b className={styles.themeFilterAmount}>{groups.reduce((total, group) => total + group.items.length, 0)}</b>
        </button>
        {groups.map((group) => (
          <button
            key={group.theme}
            type="button"
            className={classNames(styles.themeFilterButton, activeTheme === group.theme && styles.themeFilterButtonActive)}
            title={`Filtra ${group.theme}`}
            onClick={() => {
              onActiveTheme(group.theme);
              window.requestAnimationFrame(() => scrollToTheme(group.targetId));
            }}
          >
            <span className={styles.themeFilterDot} />
            <span className={styles.themeFilterName}>{group.theme}</span>
            <b className={styles.themeFilterAmount}>{group.items.length}</b>
          </button>
        ))}
      </div>
    </section>
  );
}
