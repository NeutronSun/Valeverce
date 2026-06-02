"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CLIENT_EVENTS } from "../../../shared/events.js";
import { useGameSocket } from "../../useGameSocket.js";
import { ActionDock } from "../ActionDock/ActionDock.jsx";
import { ChatFloat } from "../ChatFloat/ChatFloat.jsx";
import { ConnectionSignal } from "../ConnectionSignal/ConnectionSignal.jsx";
import { PlayerRail } from "../PlayerRail/PlayerRail.jsx";
import { ProfileAvatar } from "../ProfileAvatar/ProfileAvatar.jsx";
import { RightPanel } from "../RightPanel/RightPanel.jsx";
import {
  AuthGate,
  DraftView,
  HomeView,
  LobbyView,
  PlanFightView,
  RevealView,
  SelectView
} from "../PhaseViews/PhaseViews.jsx";
import { ProfileStore } from "../../profile/ProfileStore.js";
import {
  SETTINGS,
  clampValue,
  emptyPlan,
  groupDraftItemsByTheme,
  phaseLabel,
  phasePath,
  selectedStats,
  sumDistribution,
  validatePlanDraft
} from "../../ui.js";
import { PlayerProfile } from "../../../shared/profile/PlayerProfile.js";
import styles from "./GameApp.module.css";

const UTILITY_DECK_STORAGE_KEY = "valeverce.utilityDecks.v1";
const MAX_STORED_UTILITY_DECKS = 12;
const SELECTED_DECK_STORAGE_KEY = "valeverce.selectedDeck.v1";

export function GameApp({ initialAuth = null, initialLobbyId = "" }) {
  const { snapshot, connectionState, pingMs, lastError, clearError, emit, setName, upsertProfile } = useGameSocket({
    initialProfile: initialAuth?.profile ?? null
  });
  const lobby = snapshot?.lobby ?? null;
  const [auth, setAuth] = useState(initialAuth);
  const [name, setNameState] = useState(initialAuth?.profile?.username ?? "");
  const [profile, setProfile] = useState(initialAuth?.profile ?? null);
  const [activeHomePage, setActiveHomePage] = useState("play");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [previewCard, setPreviewCard] = useState(null);
  const [plan, setPlan] = useState(emptyPlan);
  const [planPreview, setPlanPreview] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftGroupMode, setDraftGroupMode] = useState("rarity");
  const [cardCatalog, setCardCatalog] = useState([]);
  const [utilityDecks, setUtilityDecks] = useState(initialAuth?.decks ?? []);
  const [valeverceDecks, setValeverceDecks] = useState([]);
  const [selectedMatchDeckId, setSelectedMatchDeckId] = useState("");
  const [height, setHeight] = useState(0);
  const shellRef = useRef(null);
  const menuDialogRef = useRef(null);
  const autoJoinRef = useRef(false);
  const lobbyDeckSyncRef = useRef("");

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
    if (initialAuth?.profile) {
      const initialDecks = Array.isArray(initialAuth.decks) ? initialAuth.decks : [];
      setAuth(initialAuth);
      setProfile(initialAuth.profile);
      setNameState(initialAuth.profile.username);
      setUtilityDecks(initialDecks);
      setSelectedMatchDeckId(window.localStorage.getItem(SELECTED_DECK_STORAGE_KEY) ?? "");
      ProfileStore.save(initialAuth.profile);
      window.localStorage.setItem(UTILITY_DECK_STORAGE_KEY, JSON.stringify(initialDecks));
      return;
    }

    const savedProfile = ProfileStore.read();
    const savedName = window.localStorage.getItem("valeverce.playerName") ?? "";
    setProfile(savedProfile);
    setNameState(savedProfile?.username ?? savedName);
    setUtilityDecks(readUtilityDecks());
    setSelectedMatchDeckId(window.localStorage.getItem(SELECTED_DECK_STORAGE_KEY) ?? "");
  }, [initialAuth]);

  useEffect(() => {
    let isMounted = true;

    async function loadValeverceDecks() {
      try {
        const response = await fetch("/api/player/valeverce-decks");
        const data = await response.json();
        if (isMounted && response.ok) {
          setValeverceDecks(Array.isArray(data.decks) ? data.decks : []);
        }
      } catch {
        if (isMounted) {
          setValeverceDecks(readValeverceDecks());
        }
      }
    }

    if (initialAuth) {
      loadValeverceDecks();
      return () => {
        isMounted = false;
      };
    }

    setValeverceDecks(readValeverceDecks());
    return () => {
      isMounted = false;
    };
  }, [initialAuth]);

  useEffect(() => {
    let isMounted = true;

    async function loadCards() {
      try {
        const response = await fetch("/data/cards.json");
        const data = await response.json();
        const cards = Array.isArray(data) ? data : data.cards;
        if (isMounted) {
          setCardCatalog(Array.isArray(cards) ? cards : []);
        }
      } catch {
        if (isMounted) {
          setCardCatalog([]);
        }
      }
    }

    loadCards();

    return () => {
      isMounted = false;
    };
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
    if (lobby?.phase !== "draft") {
      setDraftGroupMode("rarity");
    }
  }, [lobby?.phase]);

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
  const draftThemeNav = useMemo(() => {
    if (lobby?.phase !== "draft" || draftGroupMode !== "theme") {
      return [];
    }

    return groupDraftItemsByTheme(lobby.draft?.pool ?? []).map((group) => ({
      theme: group.theme,
      count: group.items.length,
      targetId: group.targetId
    }));
  }, [draftGroupMode, lobby?.draft?.pool, lobby?.phase]);
  const utilityCards = useMemo(
    () => cardCatalog.filter((card) => ["utility", "defense", "trap"].includes(card.type)),
    [cardCatalog]
  );
  const spellCards = useMemo(() => cardCatalog.filter((card) => isSpellDeckCard(card)), [cardCatalog]);
  const energyCards = useMemo(() => cardCatalog.filter((card) => isEnergyDeckCard(card)), [cardCatalog]);
  const selectedMatchDeck = useMemo(
    () => valeverceDecks.find((deck) => deck.id === selectedMatchDeckId) ?? null,
    [selectedMatchDeckId, valeverceDecks]
  );

  useEffect(() => {
    if (!lobby?.id || lobby.phase !== "lobby" || !selectedMatchDeck) {
      return;
    }

    const syncKey = `${lobby.id}:${selectedMatchDeck.id}`;
    if (lobbyDeckSyncRef.current === syncKey) {
      return;
    }

    lobbyDeckSyncRef.current = syncKey;
    emit(CLIENT_EVENTS.SELECT_UTILITY_DECK, {
      spellDeck: selectedMatchDeck.spellDeck,
      energyDeck: selectedMatchDeck.energyDeck
    });
  }, [emit, lobby?.id, lobby?.phase, selectedMatchDeck]);

  const persistProfile = useCallback(async (nextProfile) => {
    try {
      const response = await fetch("/api/player/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ profile: nextProfile })
      });
      const data = await response.json();
      if (response.ok && data.auth) {
        setAuth(data.auth);
      }
    } catch {
      return;
    }
  }, []);

  const updateName = useCallback(
    (value) => {
      setNameState(value);
      if (profile) {
        const nextProfile = ProfileStore.update(profile, {
          username: value,
          avatar: {
            ...profile.avatar,
            initials: PlayerProfile.makeInitials(value)
          }
        });
        setProfile(nextProfile);
        upsertProfile(nextProfile);
        if (auth) {
          void persistProfile(nextProfile);
        }
      } else {
        setName(value);
      }
    },
    [auth, persistProfile, profile, setName, upsertProfile]
  );

  const saveProfile = useCallback(
    (nextProfile) => {
      const normalizedProfile = upsertProfile(nextProfile);
      setProfile(normalizedProfile);
      setNameState(normalizedProfile.username);
      if (auth) {
        void persistProfile(normalizedProfile);
      }
    },
    [auth, persistProfile, upsertProfile]
  );

  const persistUtilityDecks = useCallback(async (nextDecks) => {
    try {
      const response = await fetch("/api/player/decks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ decks: nextDecks })
      });
      const data = await response.json();
      if (response.ok && data.auth) {
        setAuth(data.auth);
      }
    } catch {
      return;
    }
  }, []);

  const saveUtilityDecks = useCallback(
    (nextDecks) => {
      const normalizedDecks = nextDecks.slice(0, MAX_STORED_UTILITY_DECKS);
      setUtilityDecks(normalizedDecks);
      window.localStorage.setItem(UTILITY_DECK_STORAGE_KEY, JSON.stringify(normalizedDecks));
      if (auth) {
        void persistUtilityDecks(normalizedDecks);
      }
    },
    [auth, persistUtilityDecks]
  );

  const saveValeverceDeck = useCallback(
    async (deck) => {
      const isExisting = valeverceDecks.some((item) => item.id === deck.id);
      const optimisticDeck = {
        ...deck,
        id: deck.id || `valeverce_${Date.now()}`,
        createdAt: deck.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const nextDecks = isExisting
        ? valeverceDecks.map((item) => (item.id === optimisticDeck.id ? optimisticDeck : item))
        : [optimisticDeck, ...valeverceDecks];

      setValeverceDecks(nextDecks);
      window.localStorage.setItem("valeverce.decks.v1", JSON.stringify(nextDecks));

      if (!auth) {
        return;
      }

      try {
        const response = await fetch(
          isExisting ? `/api/player/valeverce-decks/${encodeURIComponent(optimisticDeck.id)}` : "/api/player/valeverce-decks",
          {
            method: isExisting ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ deck: optimisticDeck })
          }
        );
        const data = await response.json();
        if (response.ok && data.deck) {
          setValeverceDecks((current) =>
            isExisting
              ? current.map((item) => (item.id === data.deck.id ? data.deck : item))
              : [data.deck, ...current.filter((item) => item.id !== optimisticDeck.id)]
          );
        }
      } catch {
        return;
      }
    },
    [auth, valeverceDecks]
  );

  const deleteValeverceDeck = useCallback(
    async (deckId) => {
      const nextDecks = valeverceDecks.filter((deck) => deck.id !== deckId);
      setValeverceDecks(nextDecks);
      window.localStorage.setItem("valeverce.decks.v1", JSON.stringify(nextDecks));
      if (selectedMatchDeckId === deckId) {
        setSelectedMatchDeckId("");
        window.localStorage.removeItem(SELECTED_DECK_STORAGE_KEY);
      }

      if (!auth) {
        return;
      }

      try {
        await fetch(`/api/player/valeverce-decks/${encodeURIComponent(deckId)}`, { method: "DELETE" });
      } catch {
        return;
      }
    },
    [auth, selectedMatchDeckId, valeverceDecks]
  );

  const selectMatchDeck = useCallback((deckId) => {
    setSelectedMatchDeckId(deckId);
    window.localStorage.setItem(SELECTED_DECK_STORAGE_KEY, deckId);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.reload();
    }
  }, []);

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
      {lobby ? <PlayerRail lobby={lobby} draftThemeNav={draftThemeNav} /> : null}
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

        {!lobby && !auth ? (
          <AuthGate
            initialName={name}
            connectionState={connectionState}
            pingMs={pingMs}
          />
        ) : !lobby ? (
          <HomeView
            auth={auth}
            snapshot={snapshot}
            name={name}
            onNameChange={updateName}
            profile={profile}
            onProfileChange={saveProfile}
            onLogout={logout}
            activePage={activeHomePage}
            onActivePageChange={setActiveHomePage}
            emit={emit}
            connectionState={connectionState}
            pingMs={pingMs}
            utilityCards={utilityCards}
            utilityDecks={utilityDecks}
            onUtilityDecksChange={saveUtilityDecks}
            spellCards={spellCards}
            energyCards={energyCards}
            valeverceDecks={valeverceDecks}
            selectedMatchDeckId={selectedMatchDeckId}
            onValeverceDeckSave={saveValeverceDeck}
            onValeverceDeckDelete={deleteValeverceDeck}
            onSelectedMatchDeckChange={selectMatchDeck}
          />
        ) : (
          <>
            {lobby.phase === "lobby" ? <LobbyView lobby={lobby} emit={emit} /> : null}
            {lobby.phase === "draft" ? (
              <DraftView
                lobby={lobby}
                previewCard={previewCard}
                onPreviewCard={setPreviewCard}
                emit={emit}
                groupMode={draftGroupMode}
                onGroupModeChange={setDraftGroupMode}
              />
            ) : null}
            {lobby.phase === "select" ? (
              <SelectView
                lobby={lobby}
                selectedCardId={selectedCardId}
                onSelectedCardId={setSelectedCardId}
                emit={emit}
                utilityCards={utilityCards}
                utilityDecks={utilityDecks}
                onUtilityDecksChange={saveUtilityDecks}
              />
            ) : null}
            {lobby.phase === "plan" ? (
              <PlanFightView
                lobby={lobby}
                plan={plan}
                onPlanValue={onPlanValue}
                onPlanPatch={(patch) => setPlan((current) => ({ ...current, ...patch }))}
                onPreviewLines={setPlanPreview}
              />
            ) : null}
            {["reveal", "ended"].includes(lobby.phase) ? <RevealView lobby={lobby} emit={emit} /> : null}
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

function readUtilityDecks() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(UTILITY_DECK_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((deck) => Array.isArray(deck.cardIds)) : [];
  } catch {
    return [];
  }
}

function readValeverceDecks() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem("valeverce.decks.v1") ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((deck) => Array.isArray(deck.spellDeck) && Array.isArray(deck.energyDeck)) : [];
  } catch {
    return [];
  }
}

function isSpellDeckCard(card) {
  if (card?.deckType) {
    return card.deckType === "spell";
  }

  return ["attack", "defense"].includes(card?.type) && card?.usesCombat !== false;
}

function isEnergyDeckCard(card) {
  if (card?.deckType) {
    return card.deckType === "energy";
  }

  return ["utility", "trap"].includes(card?.type) && Number.isInteger(card?.energyCost);
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
          <ProfileAvatar profile={self?.profile} name={self?.name} size="sm" />
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
        <ActionTimer lobby={lobby} />
      </div>
      <ConnectionSignal connectionState={connectionState} pingMs={pingMs} />
    </header>
  );
}

function ActionTimer({ lobby }) {
  const seconds = useDeadlineSeconds(lobby.deadlineAt);
  const isVisible = Boolean(lobby.deadlineAt && ["draft", "select"].includes(lobby.phase));

  if (!isVisible) {
    return null;
  }

  return (
    <span className={`${styles.metaItem} ${styles.timerItem} ${seconds <= 5 ? styles.timerLow : ""}`} aria-live="polite">
      <span className={styles.metaLabel}>Timer</span>
      <b className={styles.metaValue}>{seconds}s</b>
    </span>
  );
}

function useDeadlineSeconds(deadlineAt) {
  const [seconds, setSeconds] = useState(() => getDeadlineSeconds(deadlineAt));

  useEffect(() => {
    setSeconds(getDeadlineSeconds(deadlineAt));
    if (!deadlineAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSeconds(getDeadlineSeconds(deadlineAt));
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [deadlineAt]);

  return seconds;
}

function getDeadlineSeconds(deadlineAt) {
  return Math.max(0, Math.ceil((Number(deadlineAt ?? 0) - Date.now()) / 1000));
}
