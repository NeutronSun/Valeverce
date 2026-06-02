"use client";

import * as React from "react";
import { CLIENT_EVENTS } from "../../../shared/events.js";
import { PlayerProfile, PROFILE_ICON_IDS } from "../../../shared/profile/PlayerProfile.js";
import {
  SETTINGS,
  VALERIO_KEYS,
  currentOpponent,
  formatStatName,
  getAttackPool,
  getCardValerio,
  getDefensePool,
  getDraftCost,
  getCardTheme,
  cardImageSrc,
  draftThemeAnchorId,
  getPlanLineInfluence,
  getPlanLineTooltip,
  groupDraftItemsByRarity,
  groupDraftItemsByTheme,
  rarityClass,
  rarityLabel,
  selectedStats,
  splitValerioText,
  sortCardsByRarity,
  sumDistribution,
  validatePlanDraft
} from "../../ui.js";
import { AbilityBox, GameCard } from "../Card/Card.jsx";
import { ConnectionSignal } from "../ConnectionSignal/ConnectionSignal.jsx";
import { ProfileAvatar } from "../ProfileAvatar/ProfileAvatar.jsx";
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

const MAX_UTILITY_DECK_SIZE = 8;
const AUTH_PASSWORD_MIN_LENGTH = 6;
const UTILITY_CARD_TYPES = Object.freeze(["utility", "defense", "trap"]);
const TARGET_EFFECT_TYPES = Object.freeze(["damage", "swap_card", "steal_card", "swap_deck"]);
const AUTH_MODES = Object.freeze({
  LOGIN: "login",
  REGISTER: "register"
});
const HOME_PAGES = Object.freeze([
  { id: "play", label: "Gioca" },
  { id: "profile", label: "Profilo" },
  { id: "decks", label: "Deck Utility" },
  { id: "cards", label: "Carte" }
]);

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

function sortPublicLobbies(lobbies) {
  return [...lobbies].sort((a, b) => {
    const joinableDiff = Number(b.isJoinable) - Number(a.isJoinable);
    if (joinableDiff) {
      return joinableDiff;
    }

    const phaseDiff = String(a.phase ?? "").localeCompare(String(b.phase ?? ""));
    if (phaseDiff) {
      return phaseDiff;
    }

    const playerDiff = Number(b.players ?? 0) - Number(a.players ?? 0);
    if (playerDiff) {
      return playerDiff;
    }

    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

export function AuthGate({ initialName = "", connectionState, pingMs }) {
  const [mode, setMode] = React.useState(/** @type {string} */ (AUTH_MODES.LOGIN));
  const [nick, setNick] = React.useState(initialName || "");
  const [password, setPassword] = React.useState("");
  const [iconId, setIconId] = React.useState(PlayerProfile.iconForName(initialName || PlayerProfile.DEFAULT_USERNAME));
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const cleanNick = PlayerProfile.normalizeUsername(nick);
  const isRegister = mode === AUTH_MODES.REGISTER;
  const canSubmit = cleanNick.length > 0 && password.length >= AUTH_PASSWORD_MIN_LENGTH && !isSubmitting;
  const profilePreview = PlayerProfile.from({
    username: cleanNick,
    avatar: {
      kind: "image",
      iconId,
      initials: PlayerProfile.makeInitials(cleanNick),
      colorId: PlayerProfile.colorForName(cleanNick)
    }
  }).toJSON();

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nick: cleanNick,
          password,
          profile: isRegister ? profilePreview : undefined
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Accesso non riuscito");
        return;
      }

      window.location.reload();
    } catch {
      setError("Server account non raggiungibile");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.profileGate}>
      <section className={styles.profileGatePanel}>
        <div className={styles.profileGateBrand}>
          <span className={styles.homeMark}>V</span>
          <div>
            <p className={styles.homeEyebrow}>account server</p>
            <h1 className={styles.homeTitle}>VALEVERCE</h1>
            <p className={styles.homeSubtitle}>Entra con il tuo nick o crea un account.</p>
          </div>
        </div>

        <div className={styles.authTabs} role="tablist" aria-label="Accesso account">
          <button
            type="button"
            className={classNames(styles.authTab, mode === AUTH_MODES.LOGIN && styles.authTabActive)}
            aria-selected={mode === AUTH_MODES.LOGIN}
            onClick={() => setMode(AUTH_MODES.LOGIN)}
          >
            Login
          </button>
          <button
            type="button"
            className={classNames(styles.authTab, mode === AUTH_MODES.REGISTER && styles.authTabActive)}
            aria-selected={mode === AUTH_MODES.REGISTER}
            onClick={() => setMode(AUTH_MODES.REGISTER)}
          >
            Crea account
          </button>
        </div>

        <form className={styles.profileForm} onSubmit={submit}>
          {isRegister ? (
            <div className={styles.profilePreview}>
              <ProfileAvatar profile={profilePreview} size="xl" />
              <div>
                <strong>{profilePreview.username}</strong>
                <span>Nick unico</span>
              </div>
            </div>
          ) : null}

          <label className={styles.homeField}>
            <span className={styles.homeFieldLabel}>Nick</span>
            <input
              className={styles.homeInput}
              value={nick}
              maxLength={PlayerProfile.MAX_USERNAME_LENGTH}
              autoComplete="username"
              placeholder="Scrivi nick"
              onChange={(event) => setNick(event.target.value)}
            />
          </label>

          <label className={styles.homeField}>
            <span className={styles.homeFieldLabel}>Password</span>
            <input
              className={styles.homeInput}
              value={password}
              minLength={AUTH_PASSWORD_MIN_LENGTH}
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder="Password"
              type="password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {isRegister ? <AvatarIconPicker username={cleanNick} iconId={iconId} onIconIdChange={setIconId} /> : null}

          {error ? <p className={styles.authError}>{error}</p> : null}

          <button type="submit" className={styles.homePrimaryButton} disabled={!canSubmit}>
            {isSubmitting ? "Attendi" : isRegister ? "Crea account" : "Login"}
          </button>
        </form>

        <div className={styles.profileGateStatus}>
          <ConnectionSignal connectionState={connectionState} pingMs={pingMs} />
        </div>
      </section>
    </main>
  );
}

export function CreateProfileGate({ initialName = "", connectionState, pingMs, onProfileCreate }) {
  const [username, setUsername] = React.useState(initialName || "");
  const [iconId, setIconId] = React.useState(PlayerProfile.iconForName(initialName || PlayerProfile.DEFAULT_USERNAME));
  const profileIdRef = React.useRef(PlayerProfile.makeProfileId());
  const createdAtRef = React.useRef(new Date().toISOString());
  const canCreate = username.trim().length > 0;
  const cleanUsername = PlayerProfile.normalizeUsername(username);
  const profilePreview = PlayerProfile.from({
    profileId: profileIdRef.current,
    username: cleanUsername,
    avatar: {
      kind: "image",
      iconId,
      initials: PlayerProfile.makeInitials(cleanUsername),
      colorId: PlayerProfile.colorForName(cleanUsername)
    },
    createdAt: createdAtRef.current,
    updatedAt: new Date().toISOString()
  }).toJSON();

  function submit(event) {
    event.preventDefault();
    if (!canCreate) {
      return;
    }
    onProfileCreate(profilePreview);
  }

  return (
    <main className={styles.profileGate}>
      <section className={styles.profileGatePanel}>
        <div className={styles.profileGateBrand}>
          <span className={styles.homeMark}>V</span>
          <div>
            <p className={styles.homeEyebrow}>account locale</p>
            <h1 className={styles.homeTitle}>VALEVERCE</h1>
            <p className={styles.homeSubtitle}>Crea il profilo che userai in lobby e nei duelli.</p>
          </div>
        </div>

        <form className={styles.profileForm} onSubmit={submit}>
          <div className={styles.profilePreview}>
            <ProfileAvatar profile={profilePreview} size="xl" />
            <div>
              <strong>{profilePreview.username}</strong>
              <span>Icona {profilePreview.avatar.iconId}</span>
            </div>
          </div>

          <label className={styles.homeField}>
            <span className={styles.homeFieldLabel}>Username</span>
            <input
              className={styles.homeInput}
              value={username}
              maxLength={PlayerProfile.MAX_USERNAME_LENGTH}
              placeholder="Scrivi username"
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <AvatarIconPicker username={cleanUsername} iconId={iconId} onIconIdChange={setIconId} />

          <button type="submit" className={styles.homePrimaryButton} disabled={!canCreate}>
            Crea account
          </button>
        </form>

        <div className={styles.profileGateStatus}>
          <ConnectionSignal connectionState={connectionState} pingMs={pingMs} />
        </div>
      </section>
    </main>
  );
}

export function HomeView({
  auth,
  snapshot,
  name,
  onNameChange,
  profile,
  onProfileChange,
  onLogout,
  activePage = "play",
  onActivePageChange,
  emit,
  connectionState,
  pingMs,
  utilityCards = [],
  utilityDecks = [],
  onUtilityDecksChange
}) {
  const lobbies = snapshot?.lobbies ?? [];
  const publicLobbies = sortPublicLobbies(lobbies);
  const openLobbyCount = lobbies.filter((lobby) => lobby.isJoinable).length;
  const totalPlayers = Number(snapshot?.onlinePlayers ?? lobbies.reduce((total, lobby) => total + Number(lobby.players ?? 0), 0));
  const currentPage = HOME_PAGES.some((page) => page.id === activePage) ? activePage : "play";

  return (
    <main className={styles.home}>
      <section className={styles.homeIntro}>
        <div className={styles.homeBrand}>
          <span className={styles.homeMark}>V</span>
          <div className={styles.homeBrandCopy}>
            <p className={styles.homeEyebrow}>card tactics locale</p>
            <h1 className={styles.homeTitle}>VALEVERCE</h1>
            <p className={styles.homeSubtitle}>Draft, duelli VALERIO e lobby sulla stessa rete.</p>
          </div>
        </div>

        <div className={styles.homeStats}>
          <ProfileAvatar profile={profile} name={name} size="sm" label />
          {auth ? (
            <button type="button" className={styles.homeLogoutButton} onClick={onLogout}>
              Logout
            </button>
          ) : null}
          <ConnectionSignal connectionState={connectionState} pingMs={pingMs} />
          <span className={styles.homeStat}>
            <span className={styles.homeStatLabel}>online</span>
            <b className={styles.homeStatValue}>{totalPlayers}</b>
          </span>
          <span className={styles.homeStat}>
            <span className={styles.homeStatLabel}>aperte</span>
            <b className={styles.homeStatValue}>{openLobbyCount}</b>
          </span>
        </div>
      </section>

      <nav className={styles.homeNav} aria-label="Pagine home">
        {HOME_PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            className={classNames(styles.homeNavButton, currentPage === page.id && styles.homeNavButtonActive)}
            aria-current={currentPage === page.id ? "page" : undefined}
            onClick={() => onActivePageChange?.(page.id)}
          >
            {page.label}
          </button>
        ))}
      </nav>

      <section className={styles.homePage}>
        {currentPage === "play" ? (
          <HomePlayPage
            name={name}
            onNameChange={onNameChange}
            emit={emit}
            connectionState={connectionState}
            publicLobbies={publicLobbies}
          />
        ) : null}

        {currentPage === "profile" ? (
          <ProfileHomePage auth={auth} profile={profile} onProfileChange={onProfileChange} onLogout={onLogout} />
        ) : null}

        {currentPage === "decks" ? (
          <UtilityDeckManager
            utilityCards={utilityCards}
            utilityDecks={utilityDecks}
            onUtilityDecksChange={onUtilityDecksChange}
          />
        ) : null}

        {currentPage === "cards" ? <CardsHomePage utilityCards={utilityCards} /> : null}
      </section>
    </main>
  );
}

function HomePlayPage({ name, onNameChange, emit, connectionState, publicLobbies }) {
  return (
    <div className={styles.homePlayGrid}>
      <section className={styles.homeAccess}>
        <div className={styles.homePanelHeader}>
          <div className={styles.homePanelTitleGroup}>
            <p className={styles.homePanelEyebrow}>accesso rapido</p>
            <h2 className={styles.homePanelTitle}>Entra in partita</h2>
          </div>
          <span className={styles.homePanelMeta}>{connectionState === "connected" ? "socket ok" : "offline"}</span>
        </div>

        <label className={styles.homeField}>
          <span className={styles.homeFieldLabel}>Nome player</span>
          <input
            className={styles.homeInput}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Scrivi il tuo nome"
          />
        </label>

        <div className={styles.homeActions}>
          <button type="button" className={styles.homePrimaryButton} onClick={() => emit(CLIENT_EVENTS.CREATE_LOBBY)}>
            Crea lobby
          </button>
          <JoinLobby emit={emit} />
        </div>
        <a className={styles.homeCatalogButton} href="/cards">
          Vedi tutte le carte
        </a>
      </section>

      <section className={styles.publicLobbyPanel}>
        <div className={styles.publicLobbyHeader}>
          <div className={styles.homePanelTitleGroup}>
            <p className={styles.homePanelEyebrow}>stanze disponibili</p>
            <h2 className={styles.homePanelTitle}>Lobby pubbliche</h2>
          </div>
          <span className={styles.publicLobbyCount}>{publicLobbies.length}</span>
        </div>

        <div className={styles.publicLobbyTable}>
          <div className={styles.publicLobbyTableHead}>
            <span className={styles.publicLobbyHeadCell}>Lobby</span>
            <span className={styles.publicLobbyHeadCell}>Host</span>
            <span className={styles.publicLobbyHeadCell}>Player</span>
            <span className={styles.publicLobbyHeadCell}>Stato</span>
          </div>
          {publicLobbies.map((lobby) => (
            <button
              key={lobby.id}
              type="button"
              className={classNames(styles.publicLobbyRow, !lobby.isJoinable && styles.publicLobbyLocked)}
              disabled={!lobby.isJoinable}
              onClick={() => emit(CLIENT_EVENTS.JOIN_LOBBY, { lobbyId: lobby.id })}
            >
              <span className={styles.publicLobbyCode}>{lobby.id}</span>
              <span className={styles.publicLobbyHost}>
                <ProfileAvatar profile={lobby.hostProfile} name={lobby.hostName} size="sm" />
                <b>{lobby.hostName ?? "-"}</b>
              </span>
              <span className={styles.publicLobbyPlayers}>
                {lobby.players}/{lobby.maxPlayers}
              </span>
              <span className={classNames(styles.publicLobbyStatus, lobby.isJoinable ? styles.publicLobbyOpen : styles.publicLobbyClosed)}>
                {lobby.isJoinable ? "aperta" : "in game"}
              </span>
            </button>
          ))}
          {publicLobbies.length === 0 ? (
            <p className={styles.publicLobbyEmpty}>Nessuna lobby pubblica. Crea una stanza e invita gli altri dalla stessa rete.</p>
          ) : null}
        </div>
      </section>

      <section className={styles.homeRules}>
        <div className={styles.homePanelHeader}>
          <div className={styles.homePanelTitleGroup}>
            <p className={styles.homePanelEyebrow}>setup base</p>
            <h2 className={styles.homePanelTitle}>Regole rapide</h2>
          </div>
          <span className={styles.homePanelMeta}>VALERIO</span>
        </div>
        <div className={styles.homeRuleGrid}>
          <span className={styles.homeRule}>
            <b className={styles.homeRuleValue}>{SETTINGS.draftBudget}</b>
            <span className={styles.homeRuleLabel}>budget draft</span>
          </span>
          <span className={styles.homeRule}>
            <b className={styles.homeRuleValue}>{SETTINGS.draftSize}</b>
            <span className={styles.homeRuleLabel}>carte mazzo</span>
          </span>
          <span className={styles.homeRule}>
            <b className={styles.homeRuleValue}>{SETTINGS.startingHealth}</b>
            <span className={styles.homeRuleLabel}>PV iniziali</span>
          </span>
          <span className={styles.homeRule}>
            <b className={styles.homeRuleValue}>{SETTINGS.maxMana}</b>
            <span className={styles.homeRuleLabel}>mana max</span>
          </span>
        </div>
      </section>
    </div>
  );
}

function ProfileHomePage({ auth, profile, onProfileChange, onLogout }) {
  const normalizedProfile = PlayerProfile.from(profile ?? {}).toJSON();
  const [username, setUsername] = React.useState(normalizedProfile.username);

  React.useEffect(() => {
    setUsername(normalizedProfile.username);
  }, [normalizedProfile.username]);

  function updateUsername(value) {
    setUsername(value);
    onProfileChange?.(
      PlayerProfile.update(normalizedProfile, {
        username: value,
        avatar: {
          ...normalizedProfile.avatar,
          initials: PlayerProfile.makeInitials(value)
        }
      }).toJSON()
    );
  }

  function updateIcon(iconId) {
    onProfileChange?.(
      PlayerProfile.update(normalizedProfile, {
        avatar: {
          ...normalizedProfile.avatar,
          kind: "image",
          iconId
        }
      }).toJSON()
    );
  }

  return (
    <section className={styles.profilePage}>
      <div className={styles.homePanelHeader}>
        <div className={styles.homePanelTitleGroup}>
          <p className={styles.homePanelEyebrow}>profilo server</p>
          <h2 className={styles.homePanelTitle}>Modifica profilo</h2>
        </div>
        <span className={styles.homePanelMeta}>{auth?.account?.nick ?? "account"}</span>
      </div>

      <div className={styles.profileEditorGrid}>
        <div className={styles.profilePreviewLarge}>
          <ProfileAvatar profile={normalizedProfile} size="xl" />
          <strong>{normalizedProfile.username}</strong>
          <span>{normalizedProfile.profileId}</span>
        </div>

        <div className={styles.profileForm}>
          <div className={styles.accountSummary}>
            <span>Nick login</span>
            <strong>{auth?.account?.nick ?? normalizedProfile.username}</strong>
            <button type="button" className={styles.joinButton} onClick={onLogout}>
              Logout
            </button>
          </div>

          <label className={styles.homeField}>
            <span className={styles.homeFieldLabel}>Username</span>
            <input
              className={styles.homeInput}
              value={username}
              maxLength={PlayerProfile.MAX_USERNAME_LENGTH}
              onChange={(event) => updateUsername(event.target.value)}
            />
          </label>

          <AvatarIconPicker
            username={username}
            iconId={normalizedProfile.avatar.iconId}
            onIconIdChange={updateIcon}
          />
        </div>
      </div>
    </section>
  );
}

function AvatarIconPicker({ username, iconId, onIconIdChange }) {
  return (
    <div className={styles.avatarColorPicker}>
      <span className={styles.homeFieldLabel}>Avatar</span>
      <div className={styles.avatarColorGrid}>
        {PROFILE_ICON_IDS.map((option) => {
          const previewProfile = PlayerProfile.from({
            username,
            avatar: {
              kind: "image",
              iconId: option,
              initials: PlayerProfile.makeInitials(username),
              colorId: PlayerProfile.colorForName(username)
            }
          }).toJSON();

          return (
            <button
              key={option}
              type="button"
              className={classNames(styles.avatarColorButton, iconId === option && styles.avatarColorButtonActive)}
              aria-pressed={iconId === option}
              onClick={() => onIconIdChange(option)}
            >
              <ProfileAvatar profile={previewProfile} size="lg" />
              <span>Icona {option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardsHomePage({ utilityCards }) {
  const typeCounts = React.useMemo(() => {
    const counts = new Map();
    for (const card of utilityCards) {
      counts.set(card.type, Number(counts.get(card.type) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)));
  }, [utilityCards]);

  return (
    <section className={styles.cardsHomePage}>
      <div className={styles.homePanelHeader}>
        <div className={styles.homePanelTitleGroup}>
          <p className={styles.homePanelEyebrow}>catalogo</p>
          <h2 className={styles.homePanelTitle}>Carte utility</h2>
        </div>
        <a className={styles.homeCatalogButton} href="/cards">
          Catalogo completo
        </a>
      </div>

      <div className={styles.cardTypeSummary}>
        {typeCounts.map(([type, count]) => (
          <article key={type} data-card-type={type}>
            <span>{cardTypeLabel(type)}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>

      <div className={styles.utilityCardPicker}>
        {utilityCards.map((card) => (
          <div key={card.id} className={styles.utilityPick} data-card-type={card.type}>
            <span>{cardTypeLabel(card.type)}</span>
            <strong>{card.name}</strong>
            <small>{effectTypeSummary(card)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function UtilityDeckManager({ utilityCards, utilityDecks, onUtilityDecksChange, compact = false, onSelectDeck = undefined }) {
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [deckName, setDeckName] = React.useState("");
  const cardMap = React.useMemo(() => new Map(utilityCards.map((card) => [card.id, card])), [utilityCards]);
  const selectedCards = selectedIds.map((cardId) => cardMap.get(cardId)).filter(Boolean);
  const canSave = selectedIds.length > 0 && selectedIds.length <= MAX_UTILITY_DECK_SIZE;

  function toggleCard(cardId) {
    setSelectedIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      if (current.length >= MAX_UTILITY_DECK_SIZE) {
        return current;
      }

      return [...current, cardId];
    });
  }

  function saveDeck() {
    if (!canSave || !onUtilityDecksChange) {
      return;
    }

    const nextDeck = {
      id: `utility_${Date.now()}`,
      name: deckName.trim() || `Utility ${utilityDecks.length + 1}`,
      cardIds: selectedIds
    };
    onUtilityDecksChange([...utilityDecks, nextDeck]);
    setDeckName("");
    setSelectedIds([]);
  }

  return (
    <section className={classNames(styles.utilityDeckManager, compact && styles.compactUtilityDeckManager)}>
      <div className={styles.homePanelHeader}>
        <div className={styles.homePanelTitleGroup}>
          <p className={styles.homePanelEyebrow}>utility deck</p>
          <h2 className={styles.homePanelTitle}>Trappole e supporto</h2>
        </div>
        <span className={styles.homePanelMeta}>{utilityDecks.length} salvati</span>
      </div>

      {utilityDecks.length ? (
        <div className={styles.utilityDeckList}>
          {utilityDecks.map((deck) => (
            <article key={deck.id} className={styles.utilityDeckRow}>
              <div>
                <strong>{deck.name}</strong>
                <span className={styles.utilityDeckCount}>{deck.cardIds.length}/{MAX_UTILITY_DECK_SIZE}</span>
                <small>
                  {deck.cardIds
                    .map((cardId) => cardMap.get(cardId)?.name)
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              <div className={styles.utilityDeckActions}>
                {onSelectDeck ? (
                  <button type="button" onClick={() => onSelectDeck(deck)}>
                    Usa
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onUtilityDecksChange?.(utilityDecks.filter((item) => item.id !== deck.id))}
                >
                  Elimina
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.notice}>Nessun deck utility salvato.</p>
      )}

      <div className={styles.utilityBuilder}>
        <label className={styles.homeField}>
          <span className={styles.homeFieldLabel}>Nome deck</span>
          <input
            className={styles.homeInput}
            value={deckName}
            onChange={(event) => setDeckName(event.target.value)}
            placeholder="Deck utility"
          />
        </label>
        <div className={styles.utilityBuilderHead}>
          <strong>{selectedIds.length}/{MAX_UTILITY_DECK_SIZE}</strong>
          <button type="button" className={styles.homePrimaryButton} disabled={!canSave} onClick={saveDeck}>
            Salva deck
          </button>
        </div>
        <div className={styles.utilitySelectedPreview}>
          {selectedCards.length ? (
            selectedCards.map((card) => (
              <span key={card.id} data-card-type={card.type}>
                {card.name}
              </span>
            ))
          ) : (
            <span>Seleziona utility, defense o trap dalla griglia.</span>
          )}
        </div>
        <div className={styles.utilityCardPicker}>
          {utilityCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={classNames(styles.utilityPick, selectedIds.includes(card.id) && styles.selectedUtilityPick)}
              data-card-type={card.type}
              onClick={() => toggleCard(card.id)}
            >
              <span>{cardTypeLabel(card.type)}</span>
              <strong>{card.name}</strong>
              <small>{effectTypeSummary(card)}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
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
      <input
        className={styles.joinInput}
        value={lobbyId}
        placeholder="Codice lobby"
        onChange={(event) => setLobbyId(event.target.value.toUpperCase())}
      />
      <button type="submit" className={styles.joinButton}>Entra</button>
    </form>
  );
}

export function LobbyView({ lobby, emit }) {
  const readyPlayers = lobby.players.filter((player) => player.alive !== false);
  const isHost = lobby.self?.id === lobby.hostId;
  const lobbySettings = lobby.settings ?? {};
  const pickTimerEnabled = Boolean(lobbySettings.pickTimerEnabled);
  const pickTimerSeconds = pickTimerEnabled ? Math.max(10, Number(lobbySettings.pickTimerSeconds ?? SETTINGS.actionSeconds)) : 0;
  const timerSliderSeconds = pickTimerSeconds > 0 ? pickTimerSeconds : SETTINGS.actionSeconds;
  const draftSize = Number(lobbySettings.draftSize ?? SETTINGS.draftSize);
  const minDraftBudget = draftSize * 2;
  const maxDraftBudget = draftSize * 6;
  const draftBudget = Math.max(
    minDraftBudget,
    Math.min(maxDraftBudget, Number(lobbySettings.draftBudget ?? SETTINGS.draftBudget))
  );

  function updateLobbySettings(nextSettings) {
    emit?.(CLIENT_EVENTS.UPDATE_LOBBY_SETTINGS, {
      pickTimerEnabled,
      pickTimerSeconds: timerSliderSeconds,
      draftSize,
      draftBudget,
      ...nextSettings
    });
  }

  function getClampedDraftBudget(value, size = draftSize) {
    return Math.max(size * 2, Math.min(size * 6, Number(value)));
  }

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
              <ProfileAvatar profile={player.profile} name={player.name} size="sm" />
              <div>
                <strong>{player.name}</strong>
                <small>{player.id === lobby.hostId ? "Host partita" : "Player"}</small>
              </div>
              <b>{player.alive === false ? "out" : "pronto"}</b>
            </article>
          ))}
        </section>

        <section className={classNames(styles.panel, styles.settingsPanel)}>
          <div className={styles.sectionTitle}>
            <strong>Setting partita</strong>
            <span>{isHost ? "Host" : "solo lettura"}</span>
          </div>

          <div className={styles.settingRow}>
            <label className={styles.settingToggle}>
              <input
                className={styles.settingCheckbox}
                type="checkbox"
                checked={pickTimerEnabled}
                disabled={!isHost}
                onChange={(event) =>
                  updateLobbySettings({
                    pickTimerEnabled: event.target.checked,
                    pickTimerSeconds: event.target.checked ? timerSliderSeconds : 0,
                    draftSize,
                    draftBudget
                  })
                }
              />
              <span className={styles.settingSwitch} />
              <span className={styles.settingCopy}>
                <strong className={styles.settingTitle}>Timer draft e scelta</strong>
                <small className={styles.settingDescription}>Se attivo, autopick e autoselezione partono allo scadere.</small>
              </span>
            </label>
          </div>

          <div className={classNames(styles.settingRow, !pickTimerEnabled && styles.disabled)}>
            <div className={styles.settingHeader}>
              <span className={styles.settingName}>Durata pick</span>
              <b className={styles.settingValue}>{pickTimerEnabled ? `${timerSliderSeconds}s` : "Off"}</b>
            </div>
            <input
              className={styles.settingSlider}
              type="range"
              min="10"
              max="60"
              step="5"
              value={timerSliderSeconds}
              disabled={!isHost || !pickTimerEnabled}
              onChange={(event) =>
                updateLobbySettings({
                  pickTimerEnabled,
                  pickTimerSeconds: Number(event.target.value),
                  draftSize,
                  draftBudget
                })
              }
            />
            <div className={styles.settingScale}>
              <span className={styles.settingScaleText}>10s</span>
              <span className={styles.settingScaleText}>1min</span>
            </div>
          </div>

          <div className={styles.settingGrid}>
            <div className={styles.settingRow}>
              <div className={styles.settingHeader}>
                <span className={styles.settingName}>Carte max</span>
                <b className={styles.settingValue}>{draftSize}</b>
              </div>
              <input
                className={styles.settingSlider}
                type="range"
                min="3"
                max="10"
                step="1"
                value={draftSize}
                disabled={!isHost}
                onChange={(event) => {
                  const nextDraftSize = Number(event.target.value);
                  updateLobbySettings({
                    draftSize: nextDraftSize,
                    draftBudget: getClampedDraftBudget(draftBudget, nextDraftSize)
                  });
                }}
              />
              <div className={styles.settingScale}>
                <span className={styles.settingScaleText}>3 carte</span>
                <span className={styles.settingScaleText}>10 carte</span>
              </div>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.settingHeader}>
                <span className={styles.settingName}>Budget draft</span>
                <b className={styles.settingValue}>{draftBudget}</b>
              </div>
              <input
                className={styles.settingSlider}
                type="range"
                min={minDraftBudget}
                max={maxDraftBudget}
                step="1"
                value={draftBudget}
                disabled={!isHost}
                onChange={(event) =>
                  updateLobbySettings({
                    draftBudget: getClampedDraftBudget(event.target.value)
                  })
                }
              />
              <div className={styles.settingScale}>
                <span className={styles.settingScaleText}>{minDraftBudget} min</span>
                <span className={styles.settingScaleText}>{maxDraftBudget} max</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <strong>Regole attive</strong>
          <span>VALERIO</span>
        </div>
        <div className={styles.ruleGrid}>
          <span>
            <b>{draftBudget}</b> budget draft
          </span>
          <span>
            <b>{draftSize}</b> carte max
          </span>
          <span>
            <b>{SETTINGS.startingHealth}</b> PV iniziali
          </span>
          <span>
            <b>{SETTINGS.maxMana}</b> mana max
          </span>
        </div>
      </section>
    </section>
  );
}

const draftViewModes = [
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

export function DraftView({ lobby, previewCard, onPreviewCard, emit, groupMode = "rarity", onGroupModeChange = undefined }) {
  const self = lobby.self;
  const [query, setQuery] = React.useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const draftItems = (lobby.draft?.pool ?? []).filter((item) => {
    const card = item.card ?? {};
    const haystack = `${card.name ?? ""} ${card.id ?? ""} ${rarityLabel(card.rarity)} ${getCardTheme(card)}`.toLowerCase();
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });
  const groups = groupDraftItemsByRarity(draftItems);
  const themeGroups = groupDraftItemsByTheme(draftItems);
  const flatItems = [...draftItems].sort((left, right) => {
    if (groupMode === "alpha") {
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
          <span className={styles.metricPill}>
            Budget <b className={styles.metricValue}>{spent}/{budget}</b>
          </span>
          <span className={styles.metricPill}>
            Carte <b className={styles.metricValue}>{self?.deckCount ?? 0}/{draftTarget}</b>
          </span>
          <span className={styles.metricPill}>Connesso</span>
        </div>
      </div>
      <div className={styles.tools}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Cerca</span>
          <input
            className={styles.fieldControl}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, ID, rarità..."
          />
        </label>
        <div className={styles.groupField}>
          <span className={styles.fieldLabel}>Vista</span>
          <div className={styles.groupButtons} role="tablist" aria-label="Vista draft">
            {draftViewModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={classNames(styles.groupButton, groupMode === mode.id && styles.groupButtonActive)}
                title={mode.tooltip}
                aria-label={mode.tooltip}
                aria-pressed={groupMode === mode.id}
                onClick={() => onGroupModeChange?.(mode.id)}
              >
                <span className={styles.groupIcon}>{mode.icon}</span>
                <span className={styles.groupLabel}>{mode.label}</span>
                <span className={styles.groupTooltip}>{mode.tooltip}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <CardGrid
        items={draftItems}
        rarityGroups={groups}
        themeGroups={themeGroups}
        flatItems={flatItems}
        groupMode={groupMode}
        previewCard={previewCard}
        onPreviewCard={onPreviewCard}
      />
    </section>
  );
}

export function CardGrid({
  items,
  rarityGroups,
  themeGroups,
  flatItems,
  groupMode,
  previewCard,
  onPreviewCard,
  emptyText = "Nessuna carta trovata."
}) {
  return (
    <div className={classNames(styles.draftPool, groupMode === "alpha" && styles.flat)}>
      {groupMode === "rarity" ? (
        rarityGroups.map((group) => (
          <details key={group.rarity} className={classNames(styles.accordion, rarityStyleClass(group.rarity))} open>
            <summary className={styles.separator}>
              <span className={styles.raritySigil} />
              <span className={styles.rarityName}>{group.label}</span>
              <b className={styles.rarityFlavor}>{rarityFlavor(group.rarity)}</b>
              <i className={styles.rarityCount}>{group.items.length}</i>
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
      ) : groupMode === "theme" ? (
        themeGroups.map((group) => (
          <details key={group.theme} id={draftThemeAnchorId(group.theme)} className={classNames(styles.accordion, styles.themeAccordion)} open>
            <summary className={styles.separator}>
              <span className={styles.raritySigil} />
              <span className={styles.rarityName}>{group.theme}</span>
              <b className={styles.rarityFlavor}>tema</b>
              <i className={styles.rarityCount}>{group.items.length}</i>
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
      {items.length === 0 ? <p className={styles.empty}>{emptyText}</p> : null}
    </div>
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

export function SelectView({
  lobby,
  selectedCardId,
  onSelectedCardId,
  emit,
  utilityCards = [],
  utilityDecks = [],
  onUtilityDecksChange
}) {
  const self = lobby.self;
  const needsUtilityDeck = Boolean(self?.isActive && !self.utilityDeckReady);

  if (needsUtilityDeck) {
    return (
      <section className={styles.phase}>
        <div className={styles.phaseStrip}>
          <strong>Scegli il deck utility</strong>
          <span>Obbligatorio prima della carta attacco</span>
        </div>
        <UtilityDeckGate
          utilityCards={utilityCards}
          utilityDecks={utilityDecks}
          onUtilityDecksChange={onUtilityDecksChange}
          onSelectDeck={(deck) => emit(CLIENT_EVENTS.SELECT_UTILITY_DECK, { cardIds: deck.cardIds })}
        />
      </section>
    );
  }

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

function UtilityDeckGate({ utilityCards, utilityDecks, onUtilityDecksChange, onSelectDeck }) {
  return (
    <section className={styles.utilityGate}>
      <div className={styles.utilityGateCopy}>
        <strong>Deck utility locale</strong>
        <p>Seleziona un deck salvato o creane uno adesso con massimo {MAX_UTILITY_DECK_SIZE} carte non attack.</p>
      </div>
      <UtilityDeckManager
        utilityCards={utilityCards}
        utilityDecks={utilityDecks}
        onUtilityDecksChange={onUtilityDecksChange}
        compact
        onSelectDeck={onSelectDeck}
      />
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

  const defenseTotal = sumDistribution(plan.defenses);
  const attackTotal = sumDistribution(plan.attacks);
  const defenseReady = defenseTotal > 0;
  const attackReady = attackTotal > 0;
  const selectedAttackStats = selectedStats(plan.attacks);
  const selectedDefenseStats = selectedStats(plan.defenses);

  return (
    <section className={styles.fight}>
      <section className={styles.fightPanel}>
        <div className={styles.fightHead}>
          <span>Fight · round {lobby.round}</span>
          <strong>Configura attacco e difesa</strong>
          <small>La configurazione avversaria resta nascosta fino al reveal.</small>
        </div>

        <div className={styles.fightCards}>
          <PlanCardPanel title="La tua carta" card={selfCard} statsTone="attack" highlighted={selectedAttackStats} />
          <PlanCardPanel title="Carta avversaria" card={opponentCard} statsTone="defense" highlighted={selectedDefenseStats} />
        </div>

        <div className={styles.fightSteps}>
          <span className={classNames(styles.fightStep, defenseReady && styles.fightStepDone, !defenseReady && styles.fightStepActive)}>
            Difesa
          </span>
          <span className={classNames(styles.fightStep, attackReady && styles.fightStepDone, defenseReady && !attackReady && styles.fightStepActive)}>
            Attacco
          </span>
          <span className={classNames(styles.fightStep, plan.useActive && styles.fightStepDone, attackReady && styles.fightStepActive)}>
            Attiva
          </span>
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

        <div className={classNames(styles.preview, styles.fightPreviewPanel)}>
          <div className={styles.sectionTitle}>
            <strong>Preview risultato</strong>
            <span>{selectedAttackStats.length ? "breccia parziale" : "in attesa attacco"}</span>
          </div>
          <div className={styles.list}>
            {selectedAttackStats.length ? (
              selectedAttackStats.map((key) => (
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

function PlanCardPanel({ title, card, statsTone, highlighted }) {
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

export function RevealView({ lobby, emit }) {
  const result = lobby.lastResult;
  if (!result) {
    return <section className={styles.panel}>Reveal in corso...</section>;
  }

  const selfPlay = result.plays.find((play) => play.playerId === lobby.self?.id);
  const effectWindowOpen = lobby.effectWindow?.status === "waiting";
  const outcome = effectWindowOpen ? "Reazione utility" : result.isTie ? "Pareggio" : result.winnerId === lobby.self?.id ? "Hai vinto" : "Hai perso";
  const heroClass = effectWindowOpen ? "is-tie" : result.isTie ? "is-tie" : result.winnerId === lobby.self?.id ? "is-win" : "is-lose";

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

      <UtilityReactionView lobby={lobby} emit={emit} />

      <div className={styles.scoreboard}>
        {result.plays.map((play) => (
          <RevealPlayerReport
            key={play.playerId}
            play={play}
            profile={lobby.players.find((player) => player.id === play.playerId)?.profile}
            isSelf={play.playerId === lobby.self?.id}
            isWinner={play.playerId === result.winnerId}
          />
        ))}
      </div>
    </section>
  );
}

function UtilityReactionView({ lobby, emit }) {
  const [targetByCard, setTargetByCard] = React.useState({});
  const [reactionToast, setReactionToast] = React.useState("");
  const effectWindow = lobby.effectWindow;
  const self = lobby.self;
  const isParticipant = Boolean(effectWindow?.playerIds?.includes(self?.id));
  const hasSubmitted = Boolean(effectWindow?.submissions?.[self?.id]);
  const targetPlayers = lobby.players.filter((player) => effectWindow?.playerIds?.includes(player.id) && player.id !== self?.id);
  const publicLog = effectWindow?.publicLog ?? [];
  const privateLog = self?.privateEffectLog ?? [];

  React.useEffect(() => {
    if (!reactionToast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setReactionToast(""), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [reactionToast]);

  if (!effectWindow) {
    return null;
  }

  return (
    <section className={styles.utilityReaction} data-utility-reaction>
      <div className={styles.sectionTitle}>
        <div>
          <strong>Finestra effetti</strong>
          <small>{effectWindow.status === "waiting" ? "utility, defense, trap o passa" : "chiusa"}</small>
        </div>
        <span>{Object.keys(effectWindow.submissions ?? {}).length}/{effectWindow.playerIds.length}</span>
      </div>

      <EffectTimeline effectWindow={effectWindow} publicLog={publicLog} />
      <UtilityWindowBoard lobby={lobby} effectWindow={effectWindow} />
      <UtilityDecisionPanel
        self={self}
        effectWindow={effectWindow}
        isParticipant={isParticipant}
        hasSubmitted={hasSubmitted}
        onPass={() => {
          emit(CLIENT_EVENTS.PASS_EFFECT_WINDOW);
          setReactionToast("Hai passato la finestra effetti");
        }}
      />
      <TrapStrip lobby={lobby} />
      {reactionToast ? <div className={styles.reactionToast}>{reactionToast}</div> : null}

      {isParticipant && effectWindow.status === "waiting" && !hasSubmitted ? (
        <div className={styles.utilityHand}>
          {(self?.utilityHand ?? []).map((card) => {
            const needsTarget = utilityCardNeedsTarget(card);
            const targetPlayerId = targetByCard[card.id] ?? targetPlayers[0]?.id ?? null;
            return (
              <article key={card.id} className={styles.utilityHandCard} data-card-type={card.type}>
                <button
                  type="button"
                  className={styles.utilityCardButton}
                  data-card-type={card.type}
                  onClick={() => {
                    if (needsTarget && !targetPlayerId) {
                      return;
                    }

                    emit(CLIENT_EVENTS.PLAY_EFFECT_CARD, {
                      cardId: card.id,
                      targetPlayerId: needsTarget ? targetPlayerId : null
                    });
                    setReactionToast(card.type === "trap" ? "Trappola armata per il prossimo round" : `${card.name} giocata`);
                  }}
                >
                  <span>{cardTypeLabel(card.type)}</span>
                  <strong>{card.name}</strong>
                  <small>{effectTypeSummary(card)}</small>
                  <em>{card.type === "trap" ? "Arma trap" : "Gioca"}</em>
                </button>
                {needsTarget ? (
                  <div className={styles.targetPicker}>
                    <span>Bersaglio</span>
                    {targetPlayers.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        className={targetPlayerId === player.id ? styles.selectedTarget : ""}
                        onClick={() => setTargetByCard((current) => ({ ...current, [card.id]: player.id }))}
                      >
                        {player.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
          <button
            type="button"
            className={styles.passButton}
            onClick={() => {
              emit(CLIENT_EVENTS.PASS_EFFECT_WINDOW);
              setReactionToast("Hai passato la finestra effetti");
            }}
          >
            Passa
          </button>
        </div>
      ) : (
        <p className={styles.notice}>
          {hasSubmitted ? "Hai confermato la finestra effetti." : "In attesa delle scelte utility."}
        </p>
      )}

      <details className={styles.utilityDeckOverlay}>
        <summary>Utility deck</summary>
        <div className={styles.utilityOverlayGrid}>
          <span>Mano <b>{self?.utilityHand?.length ?? self?.utilityHandCount ?? 0}</b></span>
          <span>Mazzo <b>{self?.utilityDrawCount ?? 0}</b></span>
          <span>Scarti <b>{self?.utilityDiscardCount ?? 0}</b></span>
        </div>
        <div className={styles.utilityMiniList}>
          {(self?.utilityHand ?? []).map((card) => (
            <span key={card.id}>{card.name}</span>
          ))}
        </div>
      </details>

      <details className={styles.effectLogDetails}>
        <summary>Log effetti</summary>
        <div className={styles.effectLogGrid}>
          <EffectLog title="Log pubblico" entries={publicLog} />
          <EffectLog title="Log privato" entries={privateLog} />
        </div>
      </details>
    </section>
  );
}

function UtilityWindowBoard({ lobby, effectWindow }) {
  const self = lobby.self;
  const players = effectWindow.playerIds.map((playerId) => {
    const publicPlayer = lobby.players.find((player) => player.id === playerId);
    return playerId === self?.id ? { ...publicPlayer, ...self } : publicPlayer;
  }).filter(Boolean);

  return (
    <div className={styles.utilityBoard}>
      {players.map((player) => {
        const isSelf = player.id === self?.id;
        const submission = effectWindow.submissions?.[player.id] ?? null;
        const handCount = isSelf ? player.utilityHand?.length ?? 0 : player.utilityHandCount ?? 0;
        const drawCount = player.utilityDrawCount ?? 0;
        const discardCount = isSelf ? player.utilityDiscard?.length ?? player.utilityDiscardCount ?? 0 : player.utilityDiscardCount ?? 0;
        const armedTraps = isSelf ? player.armedTraps ?? [] : [];
        const armedTrapCount = isSelf ? armedTraps.length : player.armedTrapCount ?? 0;

        return (
          <article
            key={player.id}
            className={classNames(styles.utilityBoardPlayer, isSelf && styles.utilityBoardSelf)}
            data-submitted={submission ? "true" : "false"}
          >
            <div className={styles.utilityBoardHead}>
              <ProfileAvatar profile={player.profile} name={player.name} size="sm" />
              <div>
                <strong>{isSelf ? "Tu" : player.name}</strong>
                <span>{submission ? "scelta in coda" : "deve scegliere"}</span>
              </div>
            </div>

            <div className={styles.utilityZoneGrid}>
              <span>Mano <b>{handCount}</b></span>
              <span>Mazzo <b>{drawCount}</b></span>
              <span>Scarti <b>{discardCount}</b></span>
            </div>

            <div className={styles.utilityTrapField}>
              <span>In campo</span>
              {armedTrapCount ? (
                isSelf ? (
                  armedTraps.map((trap) => <b key={trap.id}>{trap.card?.name ?? "Trap"}</b>)
                ) : (
                  <b>{armedTrapCount} trap coperte</b>
                )
              ) : (
                <b>vuoto</b>
              )}
            </div>

            <div className={styles.utilityQueueSlot}>
              <span>Coda</span>
              <b>{effectSubmissionLabel(submission, isSelf, player)}</b>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function UtilityDecisionPanel({ self, effectWindow, isParticipant, hasSubmitted, onPass }) {
  if (!isParticipant) {
    return (
      <div className={styles.utilityDecisionPanel}>
        <strong>Stai guardando la finestra utility.</strong>
        <span>Solo i duellanti possono giocare o passare.</span>
      </div>
    );
  }

  if (effectWindow.status !== "waiting") {
    return (
      <div className={styles.utilityDecisionPanel}>
        <strong>Finestra utility chiusa.</strong>
        <span>Gli effetti sono stati messi in coda e risolti.</span>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className={styles.utilityDecisionPanel}>
        <strong>Scelta confermata.</strong>
        <span>In attesa dell’altro duellante o del prossimo round.</span>
      </div>
    );
  }

  return (
    <div className={styles.utilityDecisionPanel}>
      <div>
        <strong>Scegli una utility o passa.</strong>
        <span>
          Mano {self?.utilityHand?.length ?? 0} · Mazzo {self?.utilityDrawCount ?? 0} · Scarti {self?.utilityDiscardCount ?? 0}
        </span>
      </div>
      <button type="button" className={styles.passButton} onClick={onPass}>
        Non uso utility
      </button>
    </div>
  );
}

function effectSubmissionLabel(submission, isSelf, player) {
  if (!submission) {
    return "in attesa";
  }

  if (submission.type === "pass") {
    return "passa";
  }

  if (!isSelf) {
    return submission.type === "trap" ? "trap coperta" : "carta coperta";
  }

  const knownCards = [...(player.utilityDiscard ?? []), ...(player.armedTraps ?? []).map((trap) => trap.card).filter(Boolean)];
  const card = knownCards.find((item) => item?.id === submission.cardId);
  if (card) {
    return card.type === "trap" ? `${card.name} armata` : `${card.name} giocata`;
  }

  return submission.type === "trap" ? "trap armata" : "utility giocata";
}

function EffectTimeline({ effectWindow, publicLog }) {
  const submittedCount = Object.keys(effectWindow.submissions ?? {}).length;
  const hasTrapLog = publicLog.some((entry) => String(entry.text ?? "").toLowerCase().includes("trap"));
  const isClosed = effectWindow.status === "closed";
  const steps = [
    { id: "combat", label: "Combat risolto", done: true },
    { id: "traps", label: "Trap precedenti", done: hasTrapLog || submittedCount > 0 },
    { id: "choice", label: "Scelta utility", done: submittedCount >= effectWindow.playerIds.length },
    { id: "effects", label: "Effetti applicati", done: publicLog.length > 0 },
    { id: "next", label: "Prossimo round", done: isClosed }
  ];

  return (
    <ol className={styles.effectTimeline}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={classNames(styles.effectTimelineStep, step.done && styles.effectTimelineDone, !step.done && index === steps.findIndex((item) => !item.done) && styles.effectTimelineActive)}
        >
          <span>{index + 1}</span>
          <strong>{step.label}</strong>
        </li>
      ))}
    </ol>
  );
}

function TrapStrip({ lobby }) {
  const self = lobby.self;
  const opponents = lobby.players.filter((player) => player.id !== self?.id && lobby.activePair.includes(player.id));

  return (
    <div className={styles.trapStrip}>
      <div>
        <span>Tue trap</span>
        {(self?.armedTraps ?? []).length ? (
          self.armedTraps.map((trap) => <b key={trap.id}>{trap.card?.name ?? "Trap"}</b>)
        ) : (
          <b>0</b>
        )}
      </div>
      {opponents.map((player) => (
        <div key={player.id}>
          <span>{player.name}</span>
          <b>{player.armedTrapCount ?? 0} coperte</b>
        </div>
      ))}
    </div>
  );
}

function EffectLog({ title, entries }) {
  return (
    <div className={styles.effectLog}>
      <strong>{title}</strong>
      {entries.length ? entries.map((entry) => <span key={entry.id}>{entry.text}</span>) : <span>Nessun evento.</span>}
    </div>
  );
}

function utilityCardNeedsTarget(card) {
  return collectCardEffects(card).some(
    (effect) => effect.target === "enemy" || (!effect.target && TARGET_EFFECT_TYPES.includes(String(effect.type ?? "")))
  );
}

function effectTypeSummary(card) {
  const types = collectCardEffects(card).map((effect) => String(effect.type ?? "")).filter(Boolean);
  return types.length ? [...new Set(types)].join(" · ") : "effetto";
}

function collectCardEffects(card) {
  return [card?.active, card?.passive, card].flatMap((source) => {
    if (!source) {
      return [];
    }

    if (Array.isArray(source.effects)) {
      return source.effects;
    }

    return source.effect ? [source.effect] : [];
  });
}

function cardTypeLabel(type) {
  if (!UTILITY_CARD_TYPES.includes(type)) {
    return "card";
  }

  return String(type);
}

function RevealPlayerReport({ play, profile, isSelf, isWinner }) {
  return (
    <article className={styles.report}>
      <div className={styles.reportHead}>
        <ProfileAvatar profile={profile} name={play.playerName} size="lg" />
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
