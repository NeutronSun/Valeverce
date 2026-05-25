"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CLIENT_EVENTS } from "../../../shared/events.js";
import { useGameSocket } from "../../useGameSocket.js";
import { ActionDock } from "../ActionDock/ActionDock.jsx";
import { ChatFloat } from "../ChatFloat/ChatFloat.jsx";
import { ConnectionSignal } from "../ConnectionSignal/ConnectionSignal.jsx";
import { PlayerRail } from "../PlayerRail/PlayerRail.jsx";
import { RightPanel } from "../RightPanel/RightPanel.jsx";
import {
  DraftView,
  HomeView,
  LobbyView,
  PlanFightView,
  RevealView,
  SelectView
} from "../PhaseViews/PhaseViews.jsx";
import { SETTINGS, clampValue, emptyPlan, phaseLabel, phasePath, selectedStats, sumDistribution, validatePlanDraft } from "../../ui.js";
import styles from "./GameApp.module.css";

export function GameApp({ initialLobbyId = "" }) {
  const { snapshot, connectionState, pingMs, lastError, clearError, emit, setName } = useGameSocket();
  const lobby = snapshot?.lobby ?? null;
  const [name, setNameState] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [previewCard, setPreviewCard] = useState(null);
  const [plan, setPlan] = useState(emptyPlan);
  const [planPreview, setPlanPreview] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const shellRef = useRef(null);
  const menuDialogRef = useRef(null);
  const autoJoinRef = useRef(false);

  useLayoutEffect(() => {
    const updateHeight = () => {
      setHeight(shellRef.current?.getBoundingClientRect().height ?? 0);
    };

    updateHeight();

    window.addEventListener("resize", updateHeight);

    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  useEffect(() => {
    const savedName = window.localStorage.getItem("valeverce.playerName") ?? "";
    setNameState(savedName);
  }, []);

  useEffect(() => {
    if (!initialLobbyId || lobby || autoJoinRef.current || connectionState !== "connected") {
      return;
    }

    autoJoinRef.current = true;
    emit(CLIENT_EVENTS.JOIN_LOBBY, { lobbyId: initialLobbyId });
  }, [connectionState, emit, initialLobbyId, lobby]);

  useEffect(() => {
    setSelectedCardId("");
    setPreviewCard(null);
    setPlan(emptyPlan());
    setPlanPreview([]);
  }, [lobby?.phase, lobby?.round]);

  useEffect(() => {
    const dialog = menuDialogRef.current;
    if (!dialog) {
      return;
    }

    if (menuOpen && !dialog.open) {
      dialog.showModal();
    } else if (!menuOpen && dialog.open) {
      dialog.close();
    }
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (lobby?.id) {
      const phaseSegment = phasePath(lobby.phase);
      const nextPath = phaseSegment ? `/lobby/${lobby.id}/${phaseSegment}` : `/lobby/${lobby.id}`;
      if (window.location.pathname !== nextPath) {
        window.history.replaceState(null, "", nextPath);
      }
      return;
    }

    if (!initialLobbyId && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
  }, [initialLobbyId, lobby?.id, lobby?.phase]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        setMenuOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const selfCard = lobby?.self?.selected?.selectedCard ?? lobby?.self?.deck?.find((card) => card.id === selectedCardId) ?? null;
  const canSubmitPlan = useMemo(() => {
    if (!selfCard || lobby?.phase !== "plan" || lobby.self?.selected?.attacks) {
      return false;
    }

    const validation = validatePlanDraft(plan, selfCard);
    const activeCost = Number(selfCard.active?.cost ?? 0);

    return validation.canSubmit && (!plan.useActive || Number(lobby.self?.mana ?? 0) >= activeCost);
  }, [lobby, plan, selfCard]);

  const updateName = useCallback(
    (value) => {
      setNameState(value);
      setName(value);
    },
    [setName]
  );

  const onPlanValue = useCallback(
    (section, key, value) => {
      const card = lobby?.self?.selected?.selectedCard;
      if (!card) {
        return;
      }

      const pool = section === "attacks" ? validatePlanDraft(plan, card).attackPool : validatePlanDraft(plan, card).defensePool;

      setPlan((current) => {
        const nextSection = { ...current[section] };
        const currentValue = Number(nextSection[key] ?? 0);
        const totalWithoutKey = sumDistribution(nextSection) - currentValue;
        const selected = selectedStats(nextSection).filter((stat) => stat !== key);
        const maxSlots = section === "attacks" ? SETTINGS.attackSlots : SETTINGS.defenseSlots;
        const canEnable = currentValue > 0 || value > 0 ? selected.length < maxSlots || currentValue > 0 : true;

        nextSection[key] = canEnable ? clampValue(value, 0, Math.max(0, pool - totalWithoutKey)) : 0;

        return { ...current, [section]: nextSection };
      });
    },
    [lobby, plan]
  );

  const shellClass = lobby ? `${styles.shell} ${styles.layout}` : styles.shell;
  const shellStyle = /** @type {import("react").CSSProperties} */ (
    /** @type {unknown} */ ({
      "--header-height": `${height}px`
    })
  );

  return (
    <div ref={shellRef} className={shellClass} style={shellStyle}>
      {lobby ? <MatchHeader lobby={lobby} connectionState={connectionState} pingMs={pingMs} /> : null}
      {lobby ? <PlayerRail lobby={lobby} /> : null}
      <main className={lobby ? styles.main : ""}>
        {lastError ? (
          <aside className={styles.toast} role="status" aria-live="polite">
            <span className={styles.toastIcon}>!</span>
            <div className={styles.toastCopy}>
              <span className={styles.toastLabel}>Errore</span>
              <p className={styles.toastText}>{lastError}</p>
            </div>
            <button type="button" className={styles.toastClose} onClick={clearError} aria-label="Chiudi errore">
              x
            </button>
          </aside>
        ) : null}

        {!lobby ? (
          <HomeView
            snapshot={snapshot}
            name={name}
            onNameChange={updateName}
            emit={emit}
            connectionState={connectionState}
            pingMs={pingMs}
          />
        ) : (
          <>
            {lobby.phase === "lobby" ? <LobbyView lobby={lobby} /> : null}
            {lobby.phase === "draft" ? (
              <DraftView lobby={lobby} previewCard={previewCard} onPreviewCard={setPreviewCard} emit={emit} />
            ) : null}
            {lobby.phase === "select" ? (
              <SelectView lobby={lobby} selectedCardId={selectedCardId} onSelectedCardId={setSelectedCardId} emit={emit} />
            ) : null}
            {lobby.phase === "plan" ? (
              <PlanFightView lobby={lobby} plan={plan} onPlanValue={onPlanValue} onPreviewLines={setPlanPreview} />
            ) : null}
            {["reveal", "ended"].includes(lobby.phase) ? <RevealView lobby={lobby} /> : null}
          </>
        )}
      </main>

      {lobby ? <RightPanel lobby={lobby} previewCard={previewCard} planPreview={planPreview} /> : null}
      {lobby ? (
        <ActionDock
          lobby={lobby}
          plan={plan}
          selectedCardId={selectedCardId}
          previewCard={previewCard}
          canSubmitPlan={canSubmitPlan}
          emit={emit}
          onToggleActive={() => setPlan((current) => ({ ...current, useActive: !current.useActive }))}
        />
      ) : null}
      {lobby ? <ChatFloat lobby={lobby} emit={emit} /> : null}

      <dialog
        ref={menuDialogRef}
        className={styles.menu}
        onCancel={(event) => {
          event.preventDefault();
          setMenuOpen(false);
        }}
        onClose={() => setMenuOpen(false)}
      >
        <div className={styles.menuHeader}>
          <span className={styles.menuMark}>V</span>
          <div className={styles.menuHeading}>
            <p className={styles.menuEyebrow}>pausa</p>
            <h2 className={styles.menuTitle}>Menu partita</h2>
          </div>
        </div>
        <p className={styles.menuText}>Gestisci la stanza o torna al gioco. Esc chiude questa finestra.</p>
        <div className={styles.menuActions}>
          <button type="button" className={styles.menuSecondary} onClick={() => setMenuOpen(false)}>
            Torna
          </button>
          {lobby ? (
            <button
              type="button"
              className={styles.menuDanger}
              onClick={() => {
                emit(CLIENT_EVENTS.LEAVE_LOBBY);
                setMenuOpen(false);
              }}
            >
              Esci lobby
            </button>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

function MatchHeader({ lobby, connectionState, pingMs }) {
  const self = lobby.self;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>V</span>
        <strong className={styles.brandName}>VALEVERCE</strong>
      </div>
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>Lobby</span>
          <b className={styles.metaValue}>{lobby.id}</b>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>Player</span>
          <b className={styles.metaValue}>{self?.name ?? "-"}</b>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>Fase</span>
          <b className={styles.metaValue}>{phaseLabel(lobby.phase)}</b>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>Round</span>
          <b className={styles.metaValue}>{lobby.round ?? 0}</b>
        </span>
      </div>
      <ConnectionSignal connectionState={connectionState} pingMs={pingMs} />
    </header>
  );
}
